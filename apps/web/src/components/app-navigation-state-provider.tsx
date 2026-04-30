"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  hydrateQueuedAppRouteOrigin,
  queueAppRouteOrigin
} from "../lib/app-navigation-state";

const ROUTE_SCROLL_STORAGE_KEY = "vyb.appNavigation.routeScroll";
const MAX_SCROLL_SNAPSHOTS = 80;

type RouteScrollSnapshot = {
  x: number;
  y: number;
  updatedAt: number;
};

function canUseDom() {
  return typeof window !== "undefined";
}

function readScrollSnapshots(): Record<string, RouteScrollSnapshot> {
  if (!canUseDom()) {
    return {};
  }

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(ROUTE_SCROLL_STORAGE_KEY) ?? "{}") as Record<
      string,
      RouteScrollSnapshot
    >;

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function writeScrollSnapshot(routeKey: string, snapshot: RouteScrollSnapshot) {
  if (!canUseDom()) {
    return;
  }

  const snapshots = readScrollSnapshots();
  snapshots[routeKey] = snapshot;

  const entries = Object.entries(snapshots)
    .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_SCROLL_SNAPSHOTS);

  window.sessionStorage.setItem(ROUTE_SCROLL_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
}

function restoreScrollSnapshot(routeKey: string) {
  if (!canUseDom()) {
    return;
  }

  const snapshot = readScrollSnapshots()[routeKey];
  if (!snapshot) {
    window.scrollTo({ left: 0, top: 0, behavior: "auto" });
    return;
  }

  window.requestAnimationFrame(() => {
    window.scrollTo({
      left: snapshot.x,
      top: snapshot.y,
      behavior: "auto"
    });
  });
}

function shouldIgnoreLinkClick(event: MouseEvent, anchor: HTMLAnchorElement) {
  return (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0 ||
    anchor.target === "_blank" ||
    anchor.hasAttribute("download") ||
    anchor.dataset.vybSkipOrigin === "true" ||
    anchor.dataset.vybPrimaryNav === "true"
  );
}

export function AppNavigationStateProvider() {
  const pathname = usePathname();
  const routeKey = pathname;
  const routeKeyRef = useRef(routeKey);

  useEffect(() => {
    if (!canUseDom()) {
      return;
    }

    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    if (!canUseDom()) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || shouldIgnoreLinkClick(event, anchor)) {
        return;
      }

      const targetUrl = new URL(anchor.href, window.location.origin);
      if (targetUrl.origin !== window.location.origin) {
        return;
      }

      queueAppRouteOrigin(targetUrl);
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (!canUseDom()) {
      return;
    }

    const saveCurrentScroll = () => {
      writeScrollSnapshot(routeKeyRef.current, {
        x: window.scrollX,
        y: window.scrollY,
        updatedAt: Date.now()
      });
    };

    let frameId = 0;
    const handleScroll = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(saveCurrentScroll);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", saveCurrentScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", saveCurrentScroll);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      saveCurrentScroll();
    };
  }, []);

  useEffect(() => {
    if (!canUseDom()) {
      return;
    }

    writeScrollSnapshot(routeKeyRef.current, {
      x: window.scrollX,
      y: window.scrollY,
      updatedAt: Date.now()
    });

    routeKeyRef.current = routeKey;
    hydrateQueuedAppRouteOrigin(window.location.href);
    restoreScrollSnapshot(routeKey);
  }, [routeKey]);

  return null;
}
