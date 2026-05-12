import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import webpush from "web-push";
import type {
  ListNotificationsResponse,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
  NotificationActor,
  NotificationChannel,
  NotificationCopy,
  NotificationDeliveryPolicy,
  NotificationEntity,
  NotificationPriorityScore,
  NotificationPrivacy,
  NotificationRecord,
  NotificationRecipientScope,
  NotificationStateFilter,
  RegisterNotificationDeviceRequest,
  RegisterNotificationDeviceResponse
} from "@vyb/contracts";
import type { DevSession } from "./dev-session";

type NotificationEmitInput = {
  eventKey: string;
  tenantId: string;
  recipientScope: NotificationRecipientScope;
  recipientUserIds: string[];
  actor?: Partial<NotificationActor> | null;
  entity: NotificationEntity;
  priorityScore: NotificationPriorityScore;
  channels?: NotificationChannel[];
  deliveryPolicy?: Partial<NotificationDeliveryPolicy>;
  copy: NotificationCopy;
  privacy?: Partial<NotificationPrivacy>;
  metadata?: Record<string, unknown>;
};

type ScheduledNotification = {
  id: string;
  scheduleKey: string;
  deliverAt: string;
  payload: NotificationEmitInput;
  createdAt: string;
  deliveredAt: string | null;
  cancelledAt: string | null;
};

type NotificationDevice = {
  userId: string;
  tenantId: string;
  deviceId: string;
  platform: RegisterNotificationDeviceRequest["platform"];
  endpoint: string | null;
  pushSubscription: Record<string, unknown> | null;
  updatedAt: string;
};

type NotificationPushDelivery = {
  id: string;
  notificationId: string;
  tenantId: string;
  userId: string;
  deviceId: string;
  payload: {
    title: string;
    body: string;
    href: string;
    collapseKey: string;
    notificationId: string;
    eventKey: string;
  };
  status: "pending" | "sent" | "failed";
  attempts: number;
  nextAttemptAt: string;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  lastError: string | null;
};

type NotificationLiveMode = {
  userId: string;
  tenantId: string;
  mode: "chat" | "game" | "event" | "live";
  contextId: string | null;
  activeUntil: string;
  updatedAt: string;
};

type NotificationStore = {
  notifications: NotificationRecord[];
  scheduled: ScheduledNotification[];
  devices: NotificationDevice[];
  pushDeliveries: NotificationPushDelivery[];
  liveModes: Record<string, NotificationLiveMode>;
};

const defaultStore: NotificationStore = {
  notifications: [],
  scheduled: [],
  devices: [],
  pushDeliveries: [],
  liveModes: {}
};

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 14;
const DEFAULT_COLLAPSE_WINDOW_MS = 30 * 60 * 1000;
const LIVE_MODE_TTL_MS = 2 * 60 * 1000;
const PUSH_DELIVERY_MAX_ATTEMPTS = 5;
let writeQueue = Promise.resolve();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getWorkspaceDataPath(fileName: string) {
  const cwd = process.cwd();
  const isWebPackage = path.basename(cwd) === "web" && path.basename(path.dirname(cwd)) === "apps";
  const dataRoot = isWebPackage ? path.resolve(cwd, "../../data") : path.resolve(cwd, "data");
  return path.join(dataRoot, fileName);
}

function getNotificationStorePath() {
  return getWorkspaceDataPath("notifications-store.json");
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return clone(fallback);
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const snapshot = JSON.stringify(value, null, 2);
  writeQueue = writeQueue.then(() => writeFile(filePath, snapshot, "utf8"));
  await writeQueue;
}

function normalizeStore(raw: Partial<NotificationStore>): NotificationStore {
  return {
    notifications: Array.isArray(raw.notifications)
      ? raw.notifications.map(normalizeNotification).filter((item): item is NotificationRecord => Boolean(item))
      : [],
    scheduled: Array.isArray(raw.scheduled)
      ? raw.scheduled.map(normalizeScheduled).filter((item): item is ScheduledNotification => Boolean(item))
      : [],
    devices: Array.isArray(raw.devices)
      ? raw.devices.map(normalizeDevice).filter((item): item is NotificationDevice => Boolean(item))
      : [],
    pushDeliveries: Array.isArray(raw.pushDeliveries)
      ? raw.pushDeliveries.map(normalizePushDelivery).filter((item): item is NotificationPushDelivery => Boolean(item))
      : [],
    liveModes:
      raw.liveModes && typeof raw.liveModes === "object"
        ? Object.fromEntries(
            Object.entries(raw.liveModes)
              .map(([key, value]) => [key, normalizeLiveMode(value)])
              .filter((entry): entry is [string, NotificationLiveMode] => Boolean(entry[1]))
          )
        : {}
  };
}

function normalizeNotification(value: unknown): NotificationRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<NotificationRecord>;
  if (typeof item.id !== "string" || typeof item.event_key !== "string" || typeof item.tenant_id !== "string") {
    return null;
  }

  return {
    id: item.id,
    event_key: item.event_key,
    tenant_id: item.tenant_id,
    recipient_scope: normalizeRecipientScope(item.recipient_scope),
    recipient_user_ids: normalizeUserIds(item.recipient_user_ids),
    actor: {
      user_id: item.actor?.user_id ?? null,
      display_name: item.actor?.display_name ?? null,
      avatar_url: item.actor?.avatar_url ?? null
    },
    entity: {
      type: item.entity?.type ?? "unknown",
      id: item.entity?.id ?? item.id,
      parent_type: item.entity?.parent_type ?? null,
      parent_id: item.entity?.parent_id ?? null
    },
    priority_score: normalizePriorityScore(item.priority_score),
    channels: normalizeChannels(item.channels),
    delivery_policy: {
      collapse_key: item.delivery_policy?.collapse_key ?? item.id,
      dedupe_key: item.delivery_policy?.dedupe_key ?? item.id,
      ttl_seconds: normalizePositiveInteger(item.delivery_policy?.ttl_seconds, DEFAULT_TTL_SECONDS),
      respect_quiet_mode: item.delivery_policy?.respect_quiet_mode !== false,
      silent: item.delivery_policy?.silent === true
    },
    copy: {
      title: item.copy?.title ?? "Vyb update",
      body: item.copy?.body ?? "",
      cta_label: item.copy?.cta_label ?? "Open",
      href: item.copy?.href ?? "/home"
    },
    privacy: {
      contains_plaintext: item.privacy?.contains_plaintext === true,
      push_body_safe: item.privacy?.push_body_safe !== false
    },
    state: {
      read_at: item.state?.read_at ?? null,
      seen_at: item.state?.seen_at ?? null,
      archived_at: item.state?.archived_at ?? null
    },
    category: item.category ?? inferCategory(item.event_key),
    metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : {},
    created_at: item.created_at ?? new Date().toISOString()
  };
}

function normalizeScheduled(value: unknown): ScheduledNotification | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<ScheduledNotification>;
  if (
    typeof item.id !== "string" ||
    typeof item.scheduleKey !== "string" ||
    typeof item.deliverAt !== "string" ||
    !item.payload
  ) {
    return null;
  }

  return {
    id: item.id,
    scheduleKey: item.scheduleKey,
    deliverAt: item.deliverAt,
    payload: item.payload,
    createdAt: item.createdAt ?? new Date().toISOString(),
    deliveredAt: item.deliveredAt ?? null,
    cancelledAt: item.cancelledAt ?? null
  };
}

function normalizeDevice(value: unknown): NotificationDevice | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<NotificationDevice>;
  if (typeof item.userId !== "string" || typeof item.tenantId !== "string" || typeof item.deviceId !== "string") {
    return null;
  }

  return {
    userId: item.userId,
    tenantId: item.tenantId,
    deviceId: item.deviceId,
    platform: normalizeDevicePlatform(item.platform),
    endpoint: typeof item.endpoint === "string" ? item.endpoint : null,
    pushSubscription: item.pushSubscription && typeof item.pushSubscription === "object" ? item.pushSubscription : null,
    updatedAt: item.updatedAt ?? new Date().toISOString()
  };
}

function normalizePushDelivery(value: unknown): NotificationPushDelivery | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<NotificationPushDelivery>;
  if (
    typeof item.id !== "string" ||
    typeof item.notificationId !== "string" ||
    typeof item.tenantId !== "string" ||
    typeof item.userId !== "string" ||
    typeof item.deviceId !== "string" ||
    !item.payload ||
    typeof item.payload !== "object"
  ) {
    return null;
  }

  return {
    id: item.id,
    notificationId: item.notificationId,
    tenantId: item.tenantId,
    userId: item.userId,
    deviceId: item.deviceId,
    payload: {
      title: typeof item.payload.title === "string" ? item.payload.title : "Vyb update",
      body: typeof item.payload.body === "string" ? item.payload.body : "Open Vyb to check the latest update.",
      href: typeof item.payload.href === "string" ? item.payload.href : "/home",
      collapseKey: typeof item.payload.collapseKey === "string" ? item.payload.collapseKey : item.notificationId,
      notificationId: typeof item.payload.notificationId === "string" ? item.payload.notificationId : item.notificationId,
      eventKey: typeof item.payload.eventKey === "string" ? item.payload.eventKey : "notification"
    },
    status: item.status === "sent" || item.status === "failed" ? item.status : "pending",
    attempts: normalizePositiveInteger(item.attempts, 0),
    nextAttemptAt: item.nextAttemptAt ?? new Date().toISOString(),
    lastAttemptAt: item.lastAttemptAt ?? null,
    deliveredAt: item.deliveredAt ?? null,
    lastError: item.lastError ?? null
  };
}

function normalizeLiveMode(value: unknown): NotificationLiveMode | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<NotificationLiveMode>;
  if (typeof item.userId !== "string" || typeof item.tenantId !== "string" || typeof item.activeUntil !== "string") {
    return null;
  }

  return {
    userId: item.userId,
    tenantId: item.tenantId,
    mode: item.mode === "game" || item.mode === "event" || item.mode === "live" ? item.mode : "chat",
    contextId: typeof item.contextId === "string" ? item.contextId : null,
    activeUntil: item.activeUntil,
    updatedAt: item.updatedAt ?? new Date().toISOString()
  };
}

function normalizeRecipientScope(value: unknown): NotificationRecipientScope {
  const allowed: NotificationRecipientScope[] = [
    "user",
    "tenant_user",
    "content_owner",
    "content_participants",
    "conversation",
    "event_host",
    "event_audience",
    "market_watchers",
    "course_audience",
    "role_audience",
    "tenant_broadcast",
    "platform_broadcast",
    "device_security",
    "local_only"
  ];

  return allowed.includes(value as NotificationRecipientScope) ? (value as NotificationRecipientScope) : "user";
}

function normalizePriorityScore(value: unknown): NotificationPriorityScore {
  return value === 10 || value === 7 || value === 5 || value === 3 || value === 1 ? value : 5;
}

function normalizeChannels(value: unknown): NotificationChannel[] {
  const channels = Array.isArray(value) ? value : ["in_app"];
  const allowed: NotificationChannel[] = ["in_app", "push", "email", "local_toast"];
  const normalized = channels.filter((item): item is NotificationChannel => allowed.includes(item as NotificationChannel));
  return normalized.length > 0 ? [...new Set(normalized)] : ["in_app"];
}

function normalizeUserIds(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))]
    : [];
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
}

function normalizeDevicePlatform(value: unknown): RegisterNotificationDeviceRequest["platform"] {
  return value === "web" || value === "ios" || value === "android" || value === "desktop" ? value : "unknown";
}

function inferCategory(eventKey: string) {
  return eventKey.split(".")[0]?.trim() || "system";
}

async function loadStore() {
  return normalizeStore(await readJsonFile<Partial<NotificationStore>>(getNotificationStorePath(), defaultStore));
}

async function saveStore(store: NotificationStore) {
  await writeJsonFile(getNotificationStorePath(), store);
}

function buildNotificationId() {
  return `notif_${Date.now().toString(36)}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function buildScheduledId() {
  return `notif_sched_${Date.now().toString(36)}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function buildPushDeliveryId() {
  return `notif_push_${Date.now().toString(36)}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function getWebPushVapidConfig() {
  const publicKey = process.env.VYB_VAPID_PUBLIC_KEY?.trim() || process.env.NEXT_PUBLIC_VYB_VAPID_PUBLIC_KEY?.trim() || "";
  const privateKey = process.env.VYB_VAPID_PRIVATE_KEY?.trim() || "";
  const subject = process.env.VYB_VAPID_SUBJECT?.trim() || process.env.VYB_WEB_PUSH_SUBJECT?.trim() || "mailto:support@vyb.local";

  if (!publicKey || !privateKey) {
    return null;
  }

  return {
    publicKey,
    privateKey,
    subject
  };
}

export function getNotificationVapidPublicKey() {
  return process.env.VYB_VAPID_PUBLIC_KEY?.trim() || process.env.NEXT_PUBLIC_VYB_VAPID_PUBLIC_KEY?.trim() || null;
}

function isSelfNotificationSuppressed(eventKey: string, actorUserId: string | null, recipientUserId: string) {
  if (!actorUserId || actorUserId !== recipientUserId) {
    return false;
  }

  return !(
    eventKey.startsWith("security.") ||
    eventKey.startsWith("chat.security.") ||
    eventKey.startsWith("background.") ||
    eventKey.endsWith(".failed") ||
    eventKey.endsWith(".ready")
  );
}

function isNotificationRelatedToLiveMode(item: NotificationEmitInput, liveMode: NotificationLiveMode) {
  if (liveMode.mode === "chat") {
    return item.eventKey.startsWith("chat.") && item.entity.parent_id === liveMode.contextId;
  }

  if (liveMode.mode === "game") {
    return item.eventKey.startsWith("game.") || item.entity.parent_type === "game_room";
  }

  if (liveMode.mode === "event") {
    return item.eventKey.startsWith("event.") && (item.entity.id === liveMode.contextId || item.entity.parent_id === liveMode.contextId);
  }

  return false;
}

function applyLiveModeSuppression(store: NotificationStore, recipientUserId: string, item: NotificationEmitInput) {
  const liveMode = store.liveModes[`${item.tenantId}:${recipientUserId}`] ?? store.liveModes[recipientUserId];
  if (!liveMode || new Date(liveMode.activeUntil).getTime() <= Date.now()) {
    return null;
  }

  if (liveMode.tenantId !== item.tenantId) {
    return null;
  }

  if (item.priorityScore >= 10 || isNotificationRelatedToLiveMode(item, liveMode)) {
    return null;
  }

  if (item.priorityScore <= 5) {
    return {
      silent: true,
      channels: normalizeChannels(item.channels).filter((channel) => channel === "in_app")
    };
  }

  return null;
}

function buildRecordForRecipient(store: NotificationStore, input: NotificationEmitInput, recipientUserId: string) {
  const channels = normalizeChannels(input.channels);
  const defaultDedupeKey = `${input.eventKey}:${input.entity.type}:${input.entity.id}:${recipientUserId}`;
  const defaultCollapseKey = `${input.eventKey}:${input.entity.parent_type ?? input.entity.type}:${input.entity.parent_id ?? input.entity.id}:${recipientUserId}`;
  const liveModePolicy = applyLiveModeSuppression(store, recipientUserId, input);
  const deliveryPolicy: NotificationDeliveryPolicy = {
    collapse_key: input.deliveryPolicy?.collapse_key ?? defaultCollapseKey,
    dedupe_key: input.deliveryPolicy?.dedupe_key ?? defaultDedupeKey,
    ttl_seconds: normalizePositiveInteger(input.deliveryPolicy?.ttl_seconds, DEFAULT_TTL_SECONDS),
    respect_quiet_mode: input.deliveryPolicy?.respect_quiet_mode ?? input.priorityScore < 10,
    silent: liveModePolicy?.silent ?? input.deliveryPolicy?.silent ?? false
  };

  return {
    id: buildNotificationId(),
    event_key: input.eventKey,
    tenant_id: input.tenantId,
    recipient_scope: input.recipientScope,
    recipient_user_ids: [recipientUserId],
    actor: {
      user_id: input.actor?.user_id ?? null,
      display_name: input.actor?.display_name ?? null,
      avatar_url: input.actor?.avatar_url ?? null
    },
    entity: input.entity,
    priority_score: input.priorityScore,
    channels: liveModePolicy?.channels.length ? liveModePolicy.channels : channels,
    delivery_policy: deliveryPolicy,
    copy: input.copy,
    privacy: {
      contains_plaintext: input.privacy?.contains_plaintext === true,
      push_body_safe: input.privacy?.push_body_safe !== false
    },
    state: {
      read_at: null,
      seen_at: null,
      archived_at: null
    },
    category: inferCategory(input.eventKey),
    metadata: input.metadata ?? {},
    created_at: new Date().toISOString()
  } satisfies NotificationRecord;
}

function findDedupeRecord(store: NotificationStore, recipientUserId: string, dedupeKey: string) {
  return store.notifications.find(
    (item) =>
      item.recipient_user_ids.includes(recipientUserId) &&
      item.delivery_policy.dedupe_key === dedupeKey &&
      item.state.archived_at === null
  );
}

function findCollapseRecord(store: NotificationStore, recipientUserId: string, collapseKey: string) {
  const cutoff = Date.now() - DEFAULT_COLLAPSE_WINDOW_MS;
  return store.notifications.find(
    (item) =>
      item.recipient_user_ids.includes(recipientUserId) &&
      item.delivery_policy.collapse_key === collapseKey &&
      item.priority_score <= 5 &&
      item.state.archived_at === null &&
      new Date(item.created_at).getTime() >= cutoff
  );
}

function mergeCollapsedNotification(existing: NotificationRecord, incoming: NotificationRecord) {
  const aggregateCount = normalizePositiveInteger(existing.metadata.aggregate_count, 1) + 1;
  existing.created_at = incoming.created_at;
  existing.copy = incoming.copy;
  existing.channels = incoming.channels;
  existing.delivery_policy = {
    ...incoming.delivery_policy,
    dedupe_key: existing.delivery_policy.dedupe_key
  };
  existing.metadata = {
    ...existing.metadata,
    ...incoming.metadata,
    aggregate_count: aggregateCount
  };
}

function isPushCapableDevice(device: NotificationDevice) {
  return Boolean(
    device.pushSubscription &&
      typeof device.pushSubscription === "object" &&
      typeof (device.pushSubscription as { endpoint?: unknown }).endpoint === "string"
  );
}

function buildPushPayload(item: NotificationRecord) {
  const body = item.privacy.push_body_safe ? item.copy.body : "Open Vyb to check the latest update.";

  return {
    title: item.copy.title || "Vyb update",
    body,
    href: item.copy.href?.startsWith("/") ? item.copy.href : "/home",
    collapseKey: item.delivery_policy.collapse_key,
    notificationId: item.id,
    eventKey: item.event_key
  };
}

function queuePushDeliveries(store: NotificationStore, item: NotificationRecord) {
  if (!item.channels.includes("push") || item.delivery_policy.silent || !item.privacy.push_body_safe) {
    return;
  }

  const timestamp = new Date().toISOString();
  const recipientUserId = item.recipient_user_ids[0];
  if (!recipientUserId) {
    return;
  }

  const devices = store.devices.filter(
    (device) => device.tenantId === item.tenant_id && device.userId === recipientUserId && isPushCapableDevice(device)
  );
  const payload = buildPushPayload(item);

  for (const device of devices) {
    const alreadyQueued = store.pushDeliveries.some(
      (delivery) =>
        delivery.notificationId === item.id &&
        delivery.deviceId === device.deviceId &&
        delivery.payload.collapseKey === item.delivery_policy.collapse_key &&
        delivery.status !== "failed"
    );

    if (alreadyQueued) {
      continue;
    }

    store.pushDeliveries.push({
      id: buildPushDeliveryId(),
      notificationId: item.id,
      tenantId: item.tenant_id,
      userId: recipientUserId,
      deviceId: device.deviceId,
      payload,
      status: "pending",
      attempts: 0,
      nextAttemptAt: timestamp,
      lastAttemptAt: null,
      deliveredAt: null,
      lastError: null
    });
  }
}

export async function emitNotification(input: NotificationEmitInput) {
  const store = await loadStore();
  const created: NotificationRecord[] = [];
  const recipients = normalizeUserIds(input.recipientUserIds);

  for (const recipientUserId of recipients) {
    if (isSelfNotificationSuppressed(input.eventKey, input.actor?.user_id ?? null, recipientUserId)) {
      continue;
    }

    const record = buildRecordForRecipient(store, input, recipientUserId);
    const existingDedupe = findDedupeRecord(store, recipientUserId, record.delivery_policy.dedupe_key);
    if (existingDedupe) {
      continue;
    }

    const existingCollapse = findCollapseRecord(store, recipientUserId, record.delivery_policy.collapse_key);
    if (existingCollapse) {
      mergeCollapsedNotification(existingCollapse, record);
      queuePushDeliveries(store, existingCollapse);
      created.push(existingCollapse);
      continue;
    }

    store.notifications.unshift(record);
    queuePushDeliveries(store, record);
    created.push(record);
  }

  if (created.length > 0) {
    await saveStore(store);
    await runNotificationDeliveryOutbox({ tenantId: input.tenantId }).catch(() => undefined);
  }

  return created;
}

export async function scheduleNotification(input: NotificationEmitInput, deliverAt: string, scheduleKey: string) {
  const store = await loadStore();
  const existing = store.scheduled.find((item) => item.scheduleKey === scheduleKey && !item.deliveredAt && !item.cancelledAt);
  const timestamp = new Date().toISOString();

  if (existing) {
    existing.deliverAt = deliverAt;
    existing.payload = input;
    existing.createdAt = timestamp;
  } else {
    store.scheduled.push({
      id: buildScheduledId(),
      scheduleKey,
      deliverAt,
      payload: input,
      createdAt: timestamp,
      deliveredAt: null,
      cancelledAt: null
    });
  }

  await saveStore(store);
}

export async function cancelScheduledNotifications(scheduleKeyPrefix: string) {
  const store = await loadStore();
  const timestamp = new Date().toISOString();
  let updatedCount = 0;

  for (const item of store.scheduled) {
    if (!item.deliveredAt && !item.cancelledAt && item.scheduleKey.startsWith(scheduleKeyPrefix)) {
      item.cancelledAt = timestamp;
      updatedCount += 1;
    }
  }

  if (updatedCount > 0) {
    await saveStore(store);
  }

  return updatedCount;
}

export async function runNotificationScheduler(options?: { tenantId?: string | null }) {
  const store = await loadStore();
  const now = Date.now();
  const due = store.scheduled.filter((item) => {
    if (item.deliveredAt || item.cancelledAt) {
      return false;
    }

    if (options?.tenantId && item.payload.tenantId !== options.tenantId) {
      return false;
    }

    return new Date(item.deliverAt).getTime() <= now;
  });

  if (due.length === 0) {
    return 0;
  }

  for (const item of due) {
    await emitNotification(item.payload);
    item.deliveredAt = new Date().toISOString();
  }

  const nextStore = await loadStore();
  const deliveredById = new Map(due.map((item) => [item.id, item.deliveredAt]));
  nextStore.scheduled = nextStore.scheduled.map((item) =>
    deliveredById.has(item.id) ? { ...item, deliveredAt: deliveredById.get(item.id) ?? item.deliveredAt } : item
  );
  await saveStore(nextStore);

  return due.length;
}

function getPushRetryDelayMs(attempts: number) {
  return Math.min(60 * 60 * 1000, 2 ** Math.max(0, attempts - 1) * 60 * 1000);
}

function getPushErrorStatusCode(error: unknown) {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? Number((error as { statusCode?: unknown }).statusCode)
    : null;
}

function getPushErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Push delivery failed.";
}

export async function runNotificationDeliveryOutbox(options?: { tenantId?: string | null; limit?: number }) {
  const vapidConfig = getWebPushVapidConfig();
  if (!vapidConfig) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: "missing_vapid_config" as const
    };
  }

  webpush.setVapidDetails(vapidConfig.subject, vapidConfig.publicKey, vapidConfig.privateKey);

  const store = await loadStore();
  const now = Date.now();
  const limit = Math.max(1, Math.min(100, options?.limit ?? 25));
  const due = store.pushDeliveries
    .filter((delivery) => {
      if (delivery.status === "sent" || delivery.attempts >= PUSH_DELIVERY_MAX_ATTEMPTS) {
        return false;
      }

      if (options?.tenantId && delivery.tenantId !== options.tenantId) {
        return false;
      }

      return new Date(delivery.nextAttemptAt).getTime() <= now;
    })
    .slice(0, limit);

  let sent = 0;
  let failed = 0;

  for (const delivery of due) {
    const device = store.devices.find(
      (candidate) =>
        candidate.tenantId === delivery.tenantId &&
        candidate.userId === delivery.userId &&
        candidate.deviceId === delivery.deviceId &&
        isPushCapableDevice(candidate)
    );

    if (!device?.pushSubscription) {
      delivery.status = "failed";
      delivery.lastAttemptAt = new Date().toISOString();
      delivery.lastError = "Push subscription is no longer registered.";
      failed += 1;
      continue;
    }

    delivery.attempts += 1;
    delivery.lastAttemptAt = new Date().toISOString();

    try {
      await webpush.sendNotification(device.pushSubscription as unknown as webpush.PushSubscription, JSON.stringify(delivery.payload), {
        TTL: DEFAULT_TTL_SECONDS,
        urgency: "normal",
        topic: delivery.payload.collapseKey.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32) || undefined
      });
      delivery.status = "sent";
      delivery.deliveredAt = new Date().toISOString();
      delivery.lastError = null;
      sent += 1;
    } catch (error) {
      const statusCode = getPushErrorStatusCode(error);
      delivery.lastError = getPushErrorMessage(error);
      failed += 1;

      if (statusCode === 404 || statusCode === 410) {
        delivery.status = "failed";
        store.devices = store.devices.filter((candidate) => candidate.deviceId !== device.deviceId || candidate.userId !== device.userId);
        continue;
      }

      delivery.status = delivery.attempts >= PUSH_DELIVERY_MAX_ATTEMPTS ? "failed" : "pending";
      delivery.nextAttemptAt = new Date(Date.now() + getPushRetryDelayMs(delivery.attempts)).toISOString();
    }
  }

  if (due.length > 0) {
    await saveStore(store);
  }

  return {
    attempted: due.length,
    sent,
    failed,
    skipped: null
  };
}

export async function listNotifications(
  viewer: DevSession,
  options?: {
    state?: NotificationStateFilter;
    category?: string | null;
    limit?: number;
    cursor?: string | null;
  }
): Promise<ListNotificationsResponse> {
  await runNotificationScheduler({ tenantId: viewer.tenantId });
  await runNotificationDeliveryOutbox({ tenantId: viewer.tenantId }).catch(() => undefined);
  const store = await loadStore();
  const state = options?.state ?? "all";
  const category = options?.category?.trim() || null;
  const limit = Math.max(1, Math.min(100, options?.limit ?? 30));
  const offset = Math.max(0, Number(options?.cursor ?? "0") || 0);
  const allItems = store.notifications
    .filter((item) => item.tenant_id === viewer.tenantId && item.recipient_user_ids.includes(viewer.userId))
    .filter((item) => {
      if (category && item.category !== category) {
        return false;
      }

      if (state === "unread") {
        return item.state.read_at === null && item.state.archived_at === null;
      }

      if (state === "read") {
        return item.state.read_at !== null && item.state.archived_at === null;
      }

      if (state === "archived") {
        return item.state.archived_at !== null;
      }

      return item.state.archived_at === null;
    })
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());

  const items = allItems.slice(offset, offset + limit);

  return {
    tenantId: viewer.tenantId,
    items,
    unreadCount: store.notifications.filter(
      (item) =>
        item.tenant_id === viewer.tenantId &&
        item.recipient_user_ids.includes(viewer.userId) &&
        item.state.read_at === null &&
        item.state.archived_at === null
    ).length,
    nextCursor: offset + limit < allItems.length ? String(offset + limit) : null
  };
}

function scheduleMarketReplyReminderOnRead(store: NotificationStore, item: NotificationRecord, readAt: string) {
  if (item.event_key !== "market.contact.created" || item.state.archived_at !== null) {
    return;
  }

  const requesterUserId = typeof item.metadata.requester_user_id === "string" ? item.metadata.requester_user_id.trim() : "";
  const targetType = item.metadata.target_type === "request" ? "request" : item.metadata.target_type === "listing" ? "listing" : null;
  const targetTitle =
    typeof item.metadata.target_title === "string" && item.metadata.target_title.trim()
      ? item.metadata.target_title.trim()
      : "that market post";
  const recipientUserId = item.recipient_user_ids[0];

  if (!requesterUserId || !targetType || !recipientUserId) {
    return;
  }

  const scheduleKey = `market.reply_reminder:${targetType}:${item.entity.id}:${requesterUserId}:${recipientUserId}`;
  const existing = store.scheduled.find((candidate) => candidate.scheduleKey === scheduleKey && !candidate.deliveredAt && !candidate.cancelledAt);
  const deliverAt = new Date(new Date(readAt).getTime() + 12 * 60 * 60 * 1000).toISOString();
  const payload: NotificationEmitInput = {
    eventKey: "market.reply_reminder",
    tenantId: item.tenant_id,
    recipientScope: "market_watchers",
    recipientUserIds: [recipientUserId],
    actor: {
      user_id: null,
      display_name: "Vyb Market",
      avatar_url: null
    },
    entity: item.entity,
    priorityScore: 5,
    channels: ["in_app"],
    deliveryPolicy: {
      collapse_key: `market:${targetType}:${item.entity.id}:reply-reminder`,
      dedupe_key: scheduleKey,
      ttl_seconds: 60 * 60 * 24,
      respect_quiet_mode: true
    },
    copy: {
      title: "Don't keep them waiting",
      body: `Reply to ${item.actor.display_name ?? "the buyer"} about ${targetTitle}.`,
      cta_label: "Open",
      href: "/market"
    },
    privacy: {
      contains_plaintext: true,
      push_body_safe: true
    },
    metadata: {
      requester_user_id: requesterUserId,
      source_notification_id: item.id
    }
  };

  if (existing) {
    existing.deliverAt = deliverAt;
    existing.payload = payload;
    existing.createdAt = readAt;
    return;
  }

  store.scheduled.push({
    id: buildScheduledId(),
    scheduleKey,
    deliverAt,
    payload,
    createdAt: readAt,
    deliveredAt: null,
    cancelledAt: null
  });
}

export async function markNotificationRead(viewer: DevSession, notificationId: string): Promise<MarkNotificationReadResponse> {
  const store = await loadStore();
  const item = store.notifications.find(
    (candidate) =>
      candidate.id === notificationId &&
      candidate.tenant_id === viewer.tenantId &&
      candidate.recipient_user_ids.includes(viewer.userId)
  );

  if (!item) {
    throw new Error("Notification not found.");
  }

  const wasUnread = item.state.read_at === null;
  const timestamp = new Date().toISOString();
  item.state.read_at = item.state.read_at ?? timestamp;
  item.state.seen_at = item.state.seen_at ?? timestamp;
  if (wasUnread) {
    scheduleMarketReplyReminderOnRead(store, item, item.state.read_at);
  }
  await saveStore(store);

  return {
    item
  };
}

export async function markAllNotificationsRead(
  viewer: DevSession,
  options?: { category?: string | null }
): Promise<MarkAllNotificationsReadResponse> {
  const store = await loadStore();
  const timestamp = new Date().toISOString();
  let updatedCount = 0;
  const category = options?.category?.trim() || null;

  for (const item of store.notifications) {
    if (
      item.tenant_id === viewer.tenantId &&
      item.recipient_user_ids.includes(viewer.userId) &&
      item.state.archived_at === null &&
      item.state.read_at === null &&
      (!category || item.category === category)
    ) {
      item.state.read_at = timestamp;
      item.state.seen_at = item.state.seen_at ?? timestamp;
      updatedCount += 1;
    }
  }

  if (updatedCount > 0) {
    await saveStore(store);
  }

  return {
    updatedCount,
    readAt: timestamp
  };
}

export async function registerNotificationDevice(
  viewer: DevSession,
  payload: RegisterNotificationDeviceRequest
): Promise<RegisterNotificationDeviceResponse> {
  const deviceId = payload.deviceId?.trim();
  if (!deviceId) {
    throw new Error("A notification device id is required.");
  }

  const store = await loadStore();
  const timestamp = new Date().toISOString();
  const nextDevice: NotificationDevice = {
    userId: viewer.userId,
    tenantId: viewer.tenantId,
    deviceId,
    platform: normalizeDevicePlatform(payload.platform),
    endpoint: payload.endpoint?.trim() || null,
    pushSubscription: payload.pushSubscription && typeof payload.pushSubscription === "object" ? payload.pushSubscription : null,
    updatedAt: timestamp
  };
  const existingIndex = store.devices.findIndex(
    (item) => item.userId === viewer.userId && item.tenantId === viewer.tenantId && item.deviceId === deviceId
  );

  if (existingIndex >= 0) {
    store.devices[existingIndex] = nextDevice;
  } else {
    store.devices.push(nextDevice);
  }

  await saveStore(store);

  return {
    deviceId,
    registered: true,
    updatedAt: timestamp
  };
}

export async function recordNotificationLiveMode(
  viewer: DevSession,
  input: {
    mode: NotificationLiveMode["mode"];
    contextId?: string | null;
    ttlMs?: number;
  }
) {
  const store = await loadStore();
  const ttlMs = Math.max(30_000, Math.min(10 * 60 * 1000, input.ttlMs ?? LIVE_MODE_TTL_MS));
  const timestamp = new Date().toISOString();
  store.liveModes[`${viewer.tenantId}:${viewer.userId}`] = {
    userId: viewer.userId,
    tenantId: viewer.tenantId,
    mode: input.mode,
    contextId: input.contextId?.trim() || null,
    activeUntil: new Date(Date.now() + ttlMs).toISOString(),
    updatedAt: timestamp
  };
  await saveStore(store);
}

export function buildViewerNotificationActor(viewer: DevSession): NotificationActor {
  return {
    user_id: viewer.userId,
    display_name: viewer.displayName,
    avatar_url: null
  };
}

export function uniqueNotificationRecipients(recipients: Array<string | null | undefined>) {
  return [...new Set(recipients.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))];
}
