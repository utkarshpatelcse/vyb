"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    async function cleanupDevelopmentServiceWorkers() {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ("caches" in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      if (navigator.serviceWorker.controller && !window.sessionStorage.getItem("vyb-sw-dev-cleanup")) {
        window.sessionStorage.setItem("vyb-sw-dev-cleanup", "1");
        window.location.reload();
      }
    }

    if (process.env.NODE_ENV !== "production") {
      void cleanupDevelopmentServiceWorkers().catch(() => {
        // Silent fail is acceptable in local development.
      });
      return;
    }

    window.sessionStorage.removeItem("vyb-sw-dev-cleanup");

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silent fail is acceptable for the starter shell.
    });
  }, []);

  return null;
}
