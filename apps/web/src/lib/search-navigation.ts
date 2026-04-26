"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SearchNavigationTargetType = "profile" | "post" | "vibe";

type SearchNavigationOrigin = {
  navigation_origin: "search";
  targetPathname: string;
  targetType: SearchNavigationTargetType;
  targetId?: string | null;
  createdAt: number;
};

const SEARCH_SCROLL_TOP_KEY = "vyb.search.scrollTop";
const SEARCH_RESTORE_FLAG_KEY = "vyb.search.restore";
const SEARCH_HANDOFF_KEY = "vyb.search.handoff";
const SEARCH_ORIGIN_STATE_KEY = "__vybSearchNavigationOrigin";

function canUseDom() {
  return typeof window !== "undefined";
}

function parseStoredOrigin(value: string | null): SearchNavigationOrigin | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<SearchNavigationOrigin> | null;
    if (
      parsed?.navigation_origin !== "search" ||
      typeof parsed.targetPathname !== "string" ||
      typeof parsed.targetType !== "string" ||
      typeof parsed.createdAt !== "number"
    ) {
      return null;
    }

    return {
      navigation_origin: "search",
      targetPathname: parsed.targetPathname,
      targetType: parsed.targetType as SearchNavigationTargetType,
      targetId: parsed.targetId ?? null,
      createdAt: parsed.createdAt
    };
  } catch {
    return null;
  }
}

function normalizePathname(value: string) {
  return value.replace(/\/+$/u, "") || "/";
}

function writeOriginToHistory(origin: SearchNavigationOrigin) {
  if (!canUseDom()) {
    return;
  }

  const currentState =
    typeof window.history.state === "object" && window.history.state !== null ? window.history.state : {};

  window.history.replaceState(
    {
      ...currentState,
      [SEARCH_ORIGIN_STATE_KEY]: origin
    },
    "",
    window.location.href
  );
}

export function readSearchNavigationOrigin() {
  if (!canUseDom()) {
    return null;
  }

  const historyState =
    typeof window.history.state === "object" && window.history.state !== null ? window.history.state : null;

  const parsed = historyState?.[SEARCH_ORIGIN_STATE_KEY] as SearchNavigationOrigin | undefined;
  if (!parsed || parsed.navigation_origin !== "search") {
    return null;
  }

  return parsed;
}

export function clearSearchNavigationOrigin() {
  if (!canUseDom()) {
    return;
  }

  const historyState =
    typeof window.history.state === "object" && window.history.state !== null ? { ...window.history.state } : {};

  if (!(SEARCH_ORIGIN_STATE_KEY in historyState)) {
    return;
  }

  delete historyState[SEARCH_ORIGIN_STATE_KEY];
  window.history.replaceState(historyState, "", window.location.href);
}

export function queueSearchNavigationOrigin(
  href: string,
  options: {
    targetType: SearchNavigationTargetType;
    targetId?: string | null;
  }
) {
  if (!canUseDom()) {
    return;
  }

  const targetUrl = new URL(href, window.location.origin);
  const payload: SearchNavigationOrigin = {
    navigation_origin: "search",
    targetPathname: normalizePathname(targetUrl.pathname),
    targetType: options.targetType,
    targetId: options.targetId ?? null,
    createdAt: Date.now()
  };

  window.sessionStorage.setItem(SEARCH_HANDOFF_KEY, JSON.stringify(payload));
}

export function captureSearchScrollPosition(scrollTop: number) {
  if (!canUseDom()) {
    return;
  }

  window.sessionStorage.setItem(SEARCH_SCROLL_TOP_KEY, String(Math.max(0, Math.round(scrollTop))));
}

export function restoreSearchScrollPosition(container: HTMLElement | null) {
  if (!canUseDom() || !container) {
    return;
  }

  if (window.sessionStorage.getItem(SEARCH_RESTORE_FLAG_KEY) !== "1") {
    return;
  }

  window.sessionStorage.removeItem(SEARCH_RESTORE_FLAG_KEY);
  const savedValue = window.sessionStorage.getItem(SEARCH_SCROLL_TOP_KEY);
  const scrollTop = Number.parseInt(savedValue ?? "", 10);

  if (!Number.isFinite(scrollTop)) {
    return;
  }

  window.requestAnimationFrame(() => {
    container.scrollTop = scrollTop;
  });
}

export function backToSearchSession(router: ReturnType<typeof useRouter>, fallbackHref: string) {
  if (canUseDom() && readSearchNavigationOrigin() && window.history.length > 1) {
    window.sessionStorage.setItem(SEARCH_RESTORE_FLAG_KEY, "1");
    router.back();
    return true;
  }

  router.push(fallbackHref);
  return false;
}

export function useSearchNavigationGuard(fallbackHref = "/search") {
  const pathname = usePathname();
  const router = useRouter();
  const [isFromSearch, setIsFromSearch] = useState(false);

  useEffect(() => {
    if (!canUseDom()) {
      return;
    }

    const queuedOrigin = parseStoredOrigin(window.sessionStorage.getItem(SEARCH_HANDOFF_KEY));
    if (queuedOrigin && normalizePathname(pathname) === normalizePathname(queuedOrigin.targetPathname)) {
      writeOriginToHistory(queuedOrigin);
      window.sessionStorage.removeItem(SEARCH_HANDOFF_KEY);
      setIsFromSearch(true);
      return;
    }

    setIsFromSearch(Boolean(readSearchNavigationOrigin()));
  }, [pathname]);

  return {
    isFromSearch,
    goBack() {
      return backToSearchSession(router, fallbackHref);
    },
    clearOrigin() {
      clearSearchNavigationOrigin();
      setIsFromSearch(false);
    }
  };
}
