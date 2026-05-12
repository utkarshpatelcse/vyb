"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    window.sessionStorage.removeItem("vyb-sw-dev-cleanup");

    navigator.serviceWorker.register("/sw.js").then((registration) => registration.update()).catch(() => {
      // Silent fail is acceptable for the starter shell.
    });
  }, []);

  return null;
}
