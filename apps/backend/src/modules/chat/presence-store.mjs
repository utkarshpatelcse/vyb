const ONLINE_WINDOW_MS = 90 * 1000;
const STALE_PRESENCE_RETENTION_MS = 24 * 60 * 60 * 1000;

const presenceByUserKey = new Map();

function buildPresenceKey(tenantId, userId) {
  return `${tenantId}:${userId}`;
}

function prunePresenceStore(now = Date.now()) {
  for (const [key, value] of presenceByUserKey.entries()) {
    const lastActiveAt = typeof value?.lastActiveAt === "string" ? Date.parse(value.lastActiveAt) : Number.NaN;
    if (!Number.isFinite(lastActiveAt) || now - lastActiveAt > STALE_PRESENCE_RETENTION_MS) {
      presenceByUserKey.delete(key);
    }
  }
}

export function recordChatPresenceHeartbeat({ tenantId, userId, membershipId, now = new Date() }) {
  if (!tenantId || !userId || !membershipId) {
    return null;
  }

  const timestamp = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const value = {
    tenantId,
    userId,
    membershipId,
    lastActiveAt: timestamp,
    activePath: null
  };

  prunePresenceStore(Date.parse(timestamp));
  presenceByUserKey.set(buildPresenceKey(tenantId, userId), value);
  return {
    ok: true,
    lastActiveAt: value.lastActiveAt,
    activePath: null
  };
}

export function getChatPresenceSnapshot({ tenantId, userId, now = Date.now() }) {
  if (!tenantId || !userId) {
    return null;
  }

  prunePresenceStore(now);
  const value = presenceByUserKey.get(buildPresenceKey(tenantId, userId));
  if (!value?.lastActiveAt) {
    return null;
  }

  const lastActiveTimestamp = Date.parse(value.lastActiveAt);
  if (!Number.isFinite(lastActiveTimestamp)) {
    return null;
  }

  return {
    isOnline: now - lastActiveTimestamp <= ONLINE_WINDOW_MS,
    lastActiveAt: value.lastActiveAt,
    activePath: null
  };
}
