"use client";

import { useEffect } from "react";
import { registerWebPushDevice } from "../lib/notification-push-client";

export function NotificationDeviceRegistrar() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return;
    }

    async function registerDevice() {
      await registerWebPushDevice({ requestPermission: false });
    }

    void registerDevice().catch(() => {
      // Push registration should never block the app shell.
    });
  }, []);

  return null;
}
