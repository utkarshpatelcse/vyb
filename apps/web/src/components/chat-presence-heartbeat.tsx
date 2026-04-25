"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 45 * 1000;

export function ChatPresenceHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function sendHeartbeat() {
      if (cancelled || typeof document === "undefined" || typeof navigator === "undefined") {
        return;
      }

      if (document.visibilityState !== "visible" || !navigator.onLine) {
        return;
      }

      try {
        await fetch("/api/chats/presence/heartbeat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: pathname ?? "/" }),
          cache: "no-store",
          credentials: "same-origin",
          keepalive: true
        });
      } catch {
        // Presence updates are best-effort only.
      }
    }

    void sendHeartbeat();

    const intervalId = window.setInterval(() => {
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
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [pathname]);

  return null;
}
