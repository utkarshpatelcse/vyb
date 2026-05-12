"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const HEARTBEAT_INTERVAL_MS = 45 * 1000;
const LIVE_MODE_TTL_MS = 2 * 60 * 1000;

type LiveModePayload = {
  mode: "chat" | "game" | "event" | "live";
  contextId: string | null;
  ttlMs: number;
};

function getPathSegment(pathname: string, base: string) {
  if (!pathname.startsWith(base)) {
    return null;
  }

  return pathname.slice(base.length).split("/").filter(Boolean)[0] ?? null;
}

function getSearchParam(name: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get(name);
}

function getNotificationLiveMode(pathname: string | null): LiveModePayload | null {
  if (!pathname) {
    return null;
  }

  if (pathname === "/messages" || pathname.startsWith("/messages/")) {
    return {
      mode: "chat",
      contextId: getPathSegment(pathname, "/messages/"),
      ttlMs: LIVE_MODE_TTL_MS
    };
  }

  if (pathname.startsWith("/hub/gameshub") || pathname === "/scribble" || pathname.startsWith("/scribble/") || pathname.startsWith("/join/scribble")) {
    return {
      mode: "game",
      contextId: getSearchParam("code"),
      ttlMs: LIVE_MODE_TTL_MS
    };
  }

  if (pathname === "/hub" && getSearchParam("tab") === "events") {
    return {
      mode: "event",
      contextId: getSearchParam("eventId"),
      ttlMs: LIVE_MODE_TTL_MS
    };
  }

  if (pathname === "/events" || pathname.startsWith("/events/")) {
    return {
      mode: "event",
      contextId: getSearchParam("eventId") ?? getPathSegment(pathname, "/events/"),
      ttlMs: LIVE_MODE_TTL_MS
    };
  }

  return null;
}

export function NotificationLiveModeHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    const initialPayload = getNotificationLiveMode(pathname);
    if (!initialPayload) {
      return;
    }

    let cancelled = false;
    let authenticationRejected = false;
    let intervalId: number | null = null;

    function stopHeartbeat() {
      authenticationRejected = true;
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    }

    async function sendHeartbeat() {
      if (cancelled || authenticationRejected || typeof document === "undefined" || typeof navigator === "undefined") {
        return;
      }

      if (document.visibilityState !== "visible" || !navigator.onLine) {
        return;
      }

      const payload = getNotificationLiveMode(window.location.pathname);
      if (!payload) {
        return;
      }

      try {
        const response = await fetch("/api/notifications/live-mode", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
          credentials: "same-origin",
          keepalive: true
        });

        if (response.status === 401 || response.status === 403) {
          stopHeartbeat();
        }
      } catch {
        // Live-mode updates are best-effort only.
      }
    }

    void sendHeartbeat();

    intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void sendHeartbeat();
      }
    }

    function handleOnline() {
      void sendHeartbeat();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [pathname]);

  return null;
}
