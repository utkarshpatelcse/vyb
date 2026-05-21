import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getWorkspaceRoot } from "../../../../../packages/config/src/index.mjs";

const storePath = path.resolve(
  process.env.VYB_COMMUNITY_STATE_STORE_PATH?.trim() ||
    path.join(getWorkspaceRoot(), ".tmp", "runtime", "community-state-store.json")
);

const defaultStore = {
  preferences: [],
  joinRequests: [],
  invites: []
};

let storeCache = null;
let writeQueue = Promise.resolve();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function ensureStore() {
  if (storeCache) {
    return storeCache;
  }

  await mkdir(path.dirname(storePath), { recursive: true });

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw);
    storeCache = {
      preferences: Array.isArray(parsed?.preferences) ? parsed.preferences : [],
      joinRequests: Array.isArray(parsed?.joinRequests) ? parsed.joinRequests : [],
      invites: Array.isArray(parsed?.invites) ? parsed.invites : []
    };
  } catch {
    storeCache = clone(defaultStore);
    await persistStore();
  }

  return storeCache;
}

async function persistStore() {
  if (!storeCache) {
    return;
  }

  const snapshot = JSON.stringify(storeCache, null, 2);
  writeQueue = writeQueue.then(() => writeFile(storePath, snapshot, "utf8"));
  await writeQueue;
}

function buildViewerKey({ tenantId, communityId, membershipId, userId }) {
  return [tenantId, communityId, membershipId || userId].filter(Boolean).join(":");
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeIsoDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function findPreference(store, input) {
  const key = buildViewerKey(input);
  return store.preferences.find((item) => item.key === key) ?? null;
}

function ensurePreference(store, input, now = new Date()) {
  const key = buildViewerKey(input);
  const existing = store.preferences.find((item) => item.key === key);

  if (existing) {
    return existing;
  }

  const created = {
    key,
    tenantId: input.tenantId,
    communityId: input.communityId,
    membershipId: input.membershipId ?? null,
    userId: input.userId ?? null,
    muted: false,
    pinned: false,
    membershipStatus: input.isLiveMember ? "member" : "not_member",
    leftAt: null,
    updatedAt: now.toISOString()
  };

  store.preferences.push(created);
  return created;
}

function findPendingJoinRequest(store, input) {
  return (
    store.joinRequests.find(
      (item) =>
        item.tenantId === input.tenantId &&
        item.communityId === input.communityId &&
        (item.membershipId === input.membershipId || item.userId === input.userId) &&
        item.status === "pending"
    ) ?? null
  );
}

function findInvite(store, input) {
  const code = typeof input.inviteCode === "string" ? input.inviteCode.trim() : "";
  if (!code) {
    return null;
  }

  return (
    store.invites.find(
      (item) =>
        item.code === code &&
        item.tenantId === input.tenantId &&
        item.communityId === input.communityId &&
        item.communitySlug === input.communitySlug
    ) ?? null
  );
}

function buildViewerState(store, input) {
  const preference = findPreference(store, input);
  const pendingRequest = findPendingJoinRequest(store, input);
  const storedStatus = typeof preference?.membershipStatus === "string" ? preference.membershipStatus : null;
  const membershipStatus = pendingRequest
    ? "requested"
    : storedStatus === "left"
      ? "left"
      : input.isLiveMember
        ? "member"
        : "not_member";

  return {
    muted: normalizeBoolean(preference?.muted),
    pinned: normalizeBoolean(preference?.pinned),
    membershipStatus,
    requestedAt: pendingRequest?.createdAt ?? null,
    requestId: pendingRequest?.id ?? null,
    leftAt: normalizeIsoDate(preference?.leftAt),
    updatedAt: normalizeIsoDate(preference?.updatedAt) ?? new Date().toISOString()
  };
}

export async function getCommunityViewerState(input) {
  const store = await ensureStore();
  return buildViewerState(store, input);
}

export async function listCommunityViewerStatesForMembership(input) {
  const store = await ensureStore();
  const entries = store.preferences.filter(
    (item) =>
      item.tenantId === input.tenantId &&
      (item.membershipId === input.membershipId || item.userId === input.userId)
  );

  return new Map(entries.map((item) => [item.communityId, buildViewerState(store, {
    ...input,
    communityId: item.communityId,
    isLiveMember: true
  })]));
}

export async function updateCommunityViewerState(input, payload = {}) {
  const store = await ensureStore();
  const now = new Date();
  const preference = ensurePreference(store, input, now);
  let changed = false;

  if (typeof payload.muted === "boolean" && preference.muted !== payload.muted) {
    preference.muted = payload.muted;
    changed = true;
  }

  if (typeof payload.pinned === "boolean" && preference.pinned !== payload.pinned) {
    preference.pinned = payload.pinned;
    changed = true;
  }

  const membershipAction = typeof payload.membershipAction === "string" ? payload.membershipAction : null;
  if (membershipAction === "leave") {
    preference.membershipStatus = "left";
    preference.leftAt = now.toISOString();
    for (const request of store.joinRequests) {
      if (
        request.tenantId === input.tenantId &&
        request.communityId === input.communityId &&
        (request.membershipId === input.membershipId || request.userId === input.userId) &&
        request.status === "pending"
      ) {
        request.status = "cancelled";
        request.updatedAt = now.toISOString();
      }
    }
    changed = true;
  } else if (membershipAction === "request_join") {
    if (input.isLiveMember && preference.membershipStatus !== "left") {
      preference.membershipStatus = "member";
    } else {
      const pending = findPendingJoinRequest(store, input);
      if (!pending) {
        store.joinRequests.unshift({
          id: `community-request-${randomUUID()}`,
          tenantId: input.tenantId,
          communityId: input.communityId,
          communitySlug: input.communitySlug,
          communityName: input.communityName,
          membershipId: input.membershipId ?? null,
          userId: input.userId ?? null,
          requesterName: input.displayName ?? null,
          previousMembershipStatus: preference.membershipStatus === "left" ? "left" : input.isLiveMember ? "member" : "not_member",
          status: "pending",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        });
      }
      preference.membershipStatus = "requested";
      preference.leftAt = null;
    }
    changed = true;
  } else if (membershipAction === "cancel_request") {
    const pendingBeforeCancel = findPendingJoinRequest(store, input);
    for (const request of store.joinRequests) {
      if (
        request.tenantId === input.tenantId &&
        request.communityId === input.communityId &&
        (request.membershipId === input.membershipId || request.userId === input.userId) &&
        request.status === "pending"
      ) {
        request.status = "cancelled";
        request.updatedAt = now.toISOString();
        changed = true;
      }
    }
    preference.membershipStatus = pendingBeforeCancel?.previousMembershipStatus === "left"
      ? "left"
      : input.isLiveMember
        ? "member"
        : "not_member";
    if (preference.membershipStatus !== "left") {
      preference.leftAt = null;
    }
    changed = true;
  }

  if (changed) {
    preference.updatedAt = now.toISOString();
    await persistStore();
  }

  return buildViewerState(store, input);
}

export async function createCommunityInvite(input) {
  const store = await ensureStore();
  const now = new Date();
  const code = randomUUID().replace(/-/g, "").slice(0, 18);
  const origin = typeof input.origin === "string" && input.origin.trim()
    ? input.origin.trim()
    : process.env.VYB_WEB_ORIGIN ?? process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000";
  const pathName = `/messages/community/${encodeURIComponent(input.communitySlug)}`;
  const inviteUrl = new URL(`${pathName}?invite=${encodeURIComponent(code)}`, origin).toString();
  const invite = {
    id: `community-invite-${code}`,
    code,
    tenantId: input.tenantId,
    communityId: input.communityId,
    communitySlug: input.communitySlug,
    communityName: input.communityName,
    createdByMembershipId: input.membershipId ?? null,
    createdByUserId: input.userId ?? null,
    inviteUrl,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };

  store.invites.unshift(invite);
  store.invites = store.invites.slice(0, 1000);
  await persistStore();

  return {
    inviteCode: invite.code,
    inviteUrl: invite.inviteUrl,
    expiresAt: invite.expiresAt
  };
}

export async function redeemCommunityInvite(input) {
  const store = await ensureStore();
  const now = new Date();
  const invite = findInvite(store, input);

  if (!invite) {
    return {
      status: "invalid",
      state: buildViewerState(store, input)
    };
  }

  if (invite.expiresAt && Date.parse(invite.expiresAt) <= now.getTime()) {
    return {
      status: "expired",
      state: buildViewerState(store, input)
    };
  }

  const preference = ensurePreference(store, input, now);
  const requiresApproval = input.requiresApproval === true;

  if (requiresApproval) {
    const pending = findPendingJoinRequest(store, input);
    if (!pending) {
      store.joinRequests.unshift({
        id: `community-request-${randomUUID()}`,
        tenantId: input.tenantId,
        communityId: input.communityId,
        communitySlug: input.communitySlug,
        communityName: input.communityName,
        membershipId: input.membershipId ?? null,
        userId: input.userId ?? null,
        requesterName: input.displayName ?? null,
        previousMembershipStatus: preference.membershipStatus === "left" ? "left" : input.isLiveMember ? "member" : "not_member",
        source: "invite",
        inviteCode: invite.code,
        status: "pending",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      });
    }

    preference.membershipStatus = "requested";
    preference.leftAt = null;
    preference.updatedAt = now.toISOString();
    await persistStore();

    return {
      status: "requested",
      state: buildViewerState(store, input)
    };
  }

  for (const request of store.joinRequests) {
    if (
      request.tenantId === input.tenantId &&
      request.communityId === input.communityId &&
      (request.membershipId === input.membershipId || request.userId === input.userId) &&
      request.status === "pending"
    ) {
      request.status = "approved";
      request.updatedAt = now.toISOString();
    }
  }

  preference.membershipStatus = "member";
  preference.leftAt = null;
  preference.updatedAt = now.toISOString();
  await persistStore();

  return {
    status: "joined",
    state: buildViewerState(store, input)
  };
}
