"use client";

export type AppHistoryLayer = {
  scope: string;
  id: string;
  payload?: Record<string, unknown>;
  createdAt: number;
};

export type AppRouteOrigin = {
  source: "app-route-origin";
  from: string;
  to: string;
  createdAt: number;
};

const APP_HISTORY_LAYER_KEY = "__vybAppHistoryLayer";
const APP_ROUTE_ORIGIN_KEY = "__vybAppRouteOrigin";
const APP_ROUTE_ORIGIN_QUEUE_KEY = "vyb.appNavigation.routeOriginQueue";

function canUseDom() {
  return typeof window !== "undefined";
}

function readCurrentHistoryState(): Record<string, unknown> {
  if (!canUseDom() || typeof window.history.state !== "object" || window.history.state === null) {
    return {};
  }

  return window.history.state as Record<string, unknown>;
}

function stripLayerState(state: Record<string, unknown>) {
  const nextState = { ...state };
  delete nextState[APP_HISTORY_LAYER_KEY];
  return nextState;
}

function stripOriginState(state: Record<string, unknown>) {
  const nextState = { ...state };
  delete nextState[APP_ROUTE_ORIGIN_KEY];
  return nextState;
}

function normalizeRouteKey(value: string | URL) {
  const url = new URL(String(value), window.location.origin);
  return `${url.pathname}${url.search}`;
}

function parseQueuedRouteOrigin(value: string | null): AppRouteOrigin | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AppRouteOrigin> | null;
    if (
      parsed?.source !== "app-route-origin" ||
      typeof parsed.from !== "string" ||
      typeof parsed.to !== "string" ||
      typeof parsed.createdAt !== "number"
    ) {
      return null;
    }

    return {
      source: "app-route-origin",
      from: parsed.from,
      to: parsed.to,
      createdAt: parsed.createdAt
    };
  } catch {
    return null;
  }
}

export function readAppHistoryLayer(): AppHistoryLayer | null {
  const layer = readCurrentHistoryState()[APP_HISTORY_LAYER_KEY] as AppHistoryLayer | undefined;
  if (!layer || typeof layer.scope !== "string" || typeof layer.id !== "string") {
    return null;
  }

  return layer;
}

export function readAppRouteOrigin(): AppRouteOrigin | null {
  const origin = readCurrentHistoryState()[APP_ROUTE_ORIGIN_KEY] as AppRouteOrigin | undefined;
  if (origin?.source !== "app-route-origin" || typeof origin.from !== "string" || typeof origin.to !== "string") {
    return null;
  }

  return origin;
}

export function queueAppRouteOrigin(targetUrl: string | URL, sourceUrl: string | URL = window.location.href) {
  if (!canUseDom()) {
    return;
  }

  const from = normalizeRouteKey(sourceUrl);
  const to = normalizeRouteKey(targetUrl);

  if (from === to) {
    return;
  }

  window.sessionStorage.setItem(
    APP_ROUTE_ORIGIN_QUEUE_KEY,
    JSON.stringify({
      source: "app-route-origin",
      from,
      to,
      createdAt: Date.now()
    } satisfies AppRouteOrigin)
  );
}

export function readQueuedAppRouteOrigin(currentUrl: string | URL = window.location.href) {
  if (!canUseDom()) {
    return null;
  }

  const queuedOrigin = parseQueuedRouteOrigin(window.sessionStorage.getItem(APP_ROUTE_ORIGIN_QUEUE_KEY));
  if (!queuedOrigin || normalizeRouteKey(currentUrl) !== queuedOrigin.to) {
    return null;
  }

  return queuedOrigin;
}

export function hasAppRouteOriginForCurrentRoute(currentUrl: string | URL = window.location.href) {
  return Boolean(readAppRouteOrigin() || readQueuedAppRouteOrigin(currentUrl));
}

export function hydrateQueuedAppRouteOrigin(currentUrl: string | URL = window.location.href) {
  if (!canUseDom()) {
    return null;
  }

  const queuedOrigin = readQueuedAppRouteOrigin(currentUrl);
  if (!queuedOrigin) {
    return null;
  }

  window.sessionStorage.removeItem(APP_ROUTE_ORIGIN_QUEUE_KEY);
  window.history.replaceState(
    {
      ...readCurrentHistoryState(),
      [APP_ROUTE_ORIGIN_KEY]: queuedOrigin
    },
    "",
    window.location.href
  );

  return queuedOrigin;
}

export function clearAppRouteOrigin() {
  if (!canUseDom()) {
    return;
  }

  window.history.replaceState(stripOriginState(readCurrentHistoryState()), "", window.location.href);
}

export function pushAppHistoryLayer(
  scope: string,
  id: string,
  options?: {
    payload?: Record<string, unknown>;
    url?: string | URL;
  }
) {
  if (!canUseDom()) {
    return;
  }

  const currentLayer = readAppHistoryLayer();
  const targetUrl = options?.url ? String(options.url) : window.location.href;

  if (currentLayer?.scope === scope && currentLayer.id === id && targetUrl === window.location.href) {
    return;
  }

  window.history.pushState(
    {
      ...readCurrentHistoryState(),
      [APP_HISTORY_LAYER_KEY]: {
        scope,
        id,
        payload: options?.payload,
        createdAt: Date.now()
      } satisfies AppHistoryLayer
    },
    "",
    targetUrl
  );
}

export function promoteCurrentUrlToAppHistoryLayer(
  scope: string,
  id: string,
  options: {
    baseUrl: string | URL;
    layerUrl?: string | URL;
    payload?: Record<string, unknown>;
  }
) {
  if (!canUseDom()) {
    return;
  }

  const currentLayer = readAppHistoryLayer();
  if (currentLayer?.scope === scope && currentLayer.id === id) {
    return;
  }

  window.history.replaceState(stripLayerState(readCurrentHistoryState()), "", String(options.baseUrl));
  pushAppHistoryLayer(scope, id, {
    payload: options.payload,
    url: options.layerUrl ?? window.location.href
  });
}

export function closeAppHistoryLayer(scope: string, id?: string) {
  if (!canUseDom()) {
    return false;
  }

  const layer = readAppHistoryLayer();
  if (!layer || layer.scope !== scope || (id && layer.id !== id)) {
    return false;
  }

  window.history.back();
  return true;
}

export function replaceUrlWithoutAppHistoryLayer(url: string | URL = window.location.href) {
  if (!canUseDom()) {
    return;
  }

  window.history.replaceState(stripLayerState(readCurrentHistoryState()), "", String(url));
}
