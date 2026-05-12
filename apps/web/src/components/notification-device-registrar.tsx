"use client";

import { useEffect } from "react";

const DEVICE_ID_STORAGE_KEY = "vyb.notificationDeviceId";

function getOrCreateDeviceId() {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const next = `web-${crypto.randomUUID()}`;
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return `web-${Date.now().toString(36)}`;
  }
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

async function getVapidPublicKey() {
  const response = await fetch("/api/notifications/vapid-public-key", {
    cache: "no-store",
    credentials: "same-origin"
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as { publicKey?: string | null; enabled?: boolean } | null;
  return payload?.enabled && payload.publicKey ? payload.publicKey : null;
}

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

    let cancelled = false;

    async function registerDevice() {
      const publicKey = await getVapidPublicKey();
      if (!publicKey || cancelled) {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }

      if (cancelled) {
        return;
      }

      await fetch("/api/notifications/register-device", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          deviceId: getOrCreateDeviceId(),
          platform: "web",
          endpoint: subscription.endpoint,
          pushSubscription: subscription.toJSON()
        })
      });
    }

    void registerDevice().catch(() => {
      // Push registration should never block the app shell.
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
