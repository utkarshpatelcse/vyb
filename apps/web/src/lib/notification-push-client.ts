"use client";

const DEVICE_ID_STORAGE_KEY = "vyb.notificationDeviceId";
const SERVICE_WORKER_PATH = "/sw.js";

export type NotificationPushRegistrationResult =
  | { status: "registered"; deviceId: string }
  | { status: "permission_needed" }
  | { status: "permission_denied" }
  | { status: "unsupported" }
  | { status: "vapid_unavailable" }
  | { status: "registration_failed" };

export type NotificationPushClientState =
  | { status: "available"; permission: NotificationPermission }
  | { status: "granted"; permission: "granted" }
  | { status: "blocked"; permission: "denied" }
  | { status: "unsupported" }
  | { status: "vapid_unavailable"; permission: NotificationPermission };

function isWebPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function getOrCreateDeviceId() {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const randomId = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const next = `web-${randomId}`;
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

async function getReadyServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) {
    await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
  }

  return navigator.serviceWorker.ready;
}

export async function getNotificationPushClientState(): Promise<NotificationPushClientState> {
  if (!isWebPushSupported()) {
    return { status: "unsupported" };
  }

  const permission = Notification.permission;
  if (permission === "denied") {
    return { status: "blocked", permission };
  }

  const publicKey = await getVapidPublicKey().catch(() => null);
  if (!publicKey) {
    return { status: "vapid_unavailable", permission };
  }

  if (permission === "granted") {
    return { status: "granted", permission };
  }

  return { status: "available", permission };
}

export async function registerWebPushDevice(options?: {
  requestPermission?: boolean;
}): Promise<NotificationPushRegistrationResult> {
  if (!isWebPushSupported()) {
    return { status: "unsupported" };
  }

  const publicKey = await getVapidPublicKey().catch(() => null);
  if (!publicKey) {
    return { status: "vapid_unavailable" };
  }

  let permission = Notification.permission;
  if (permission === "default" && options?.requestPermission) {
    permission = await Notification.requestPermission();
  }

  if (permission === "default") {
    return { status: "permission_needed" };
  }

  if (permission !== "granted") {
    return { status: "permission_denied" };
  }

  try {
    const registration = await getReadyServiceWorkerRegistration();
    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription =
      existingSubscription ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      }));
    const deviceId = getOrCreateDeviceId();

    const response = await fetch("/api/notifications/register-device", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        deviceId,
        platform: "web",
        endpoint: subscription.endpoint,
        pushSubscription: subscription.toJSON()
      })
    });

    if (!response.ok) {
      return { status: "registration_failed" };
    }

    return { status: "registered", deviceId };
  } catch {
    return { status: "registration_failed" };
  }
}
