"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const HEARTBEAT_INTERVAL_MS = 45 * 1000;

function isChatPath(pathname: string | null) {
  return pathname === "/messages" || Boolean(pathname?.startsWith("/messages/"));
}

function getActivePath() {
  if (typeof window === "undefined") {
    return null;
  }

  return `${window.location.pathname}${window.location.search}`;
}

export function ChatPresenceHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isChatPath(pathname)) {
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

      try {
        const response = await fetch("/api/chats/presence/heartbeat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: getActivePath() }),
          cache: "no-store",
          credentials: "same-origin",
          keepalive: true
        });

        if (response.status === 401 || response.status === 403) {
          stopHeartbeat();
        }
      } catch {
        // Presence updates are best-effort only.
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
