import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp } from "../../../../../packages/config/src/index.mjs";

const CHAT_PRIVACY_VISIBILITY_OPTIONS = new Set(["Everyone", "My Contacts", "Nobody"]);

export const DEFAULT_CHAT_PRIVACY_SETTINGS = Object.freeze({
  lastSeenOnline: "My Contacts",
  readReceipts: true,
  typingIndicator: true
});

function getChatBucket() {
  return getStorage(getFirebaseAdminApp("backend-chat-storage")).bucket();
}

function buildChatPrivacySettingsStoragePath(tenantId, userId) {
  return `chat/${tenantId}/users/${userId}/privacy-settings.json`;
}

function normalizeVisibility(value, fallback) {
  return CHAT_PRIVACY_VISIBILITY_OPTIONS.has(value) ? value : fallback;
}

function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeChatPrivacySettings(value = {}, now = new Date()) {
  const parsed = value && typeof value === "object" ? value : {};
  const fallbackUpdatedAt =
    typeof parsed.updatedAt === "string" && Number.isFinite(Date.parse(parsed.updatedAt))
      ? parsed.updatedAt
      : now.toISOString();

  return {
    lastSeenOnline: normalizeVisibility(parsed.lastSeenOnline, DEFAULT_CHAT_PRIVACY_SETTINGS.lastSeenOnline),
    readReceipts: normalizeBoolean(parsed.readReceipts, DEFAULT_CHAT_PRIVACY_SETTINGS.readReceipts),
    typingIndicator: normalizeBoolean(parsed.typingIndicator, DEFAULT_CHAT_PRIVACY_SETTINGS.typingIndicator),
    updatedAt: fallbackUpdatedAt
  };
}

export async function getChatPrivacySettings({ tenantId, userId }) {
  if (!tenantId || !userId) {
    return normalizeChatPrivacySettings();
  }

  const file = getChatBucket().file(buildChatPrivacySettingsStoragePath(tenantId, userId));

  try {
    const [exists] = await file.exists();
    if (!exists) {
      return normalizeChatPrivacySettings();
    }

    const [buffer] = await file.download();
    return normalizeChatPrivacySettings(JSON.parse(buffer.toString("utf8")));
  } catch {
    return normalizeChatPrivacySettings();
  }
}

export async function upsertChatPrivacySettings(viewer, payload = {}) {
  const current = await getChatPrivacySettings(viewer);
  const settings = normalizeChatPrivacySettings(
    {
      ...current,
      ...payload,
      updatedAt: new Date().toISOString()
    },
    new Date()
  );

  await getChatBucket()
    .file(buildChatPrivacySettingsStoragePath(viewer.tenantId, viewer.userId))
    .save(Buffer.from(JSON.stringify(settings), "utf8"), {
      resumable: false,
      metadata: {
        contentType: "application/json",
        cacheControl: "no-store"
      }
    });

  return { settings };
}

export function canExposeChatPresence(settings) {
  return settings?.lastSeenOnline !== "Nobody";
}

export function canExposeChatReadReceipts(settings) {
  return settings?.readReceipts === true;
}

export function canExposeChatTyping(settings) {
  return settings?.typingIndicator === true;
}
