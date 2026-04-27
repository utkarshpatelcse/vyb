import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

type JsonRecord = Record<string, unknown>;

type ProfileRecord = {
  userId: string;
  tenantId: string;
  primaryEmail?: string;
  collegeName?: string;
  username?: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  course?: string | null;
  stream?: string | null;
  branch?: string | null;
  year?: number;
  section?: string | null;
  profileCompleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type SocialPostRecord = {
  id: string;
  tenantId: string;
  authorUserId?: string;
  userId?: string;
  membershipId?: string;
  authorUsername?: string;
  authorName?: string;
  placement?: "feed" | "vibe" | string;
  kind?: "text" | "image" | "video" | string;
  title?: string;
  body?: string;
  status?: string;
  reactions?: number;
  comments?: number;
  createdAt?: string;
};

export type SuperAdminAction =
  | "user.status"
  | "user.role"
  | "user.shadowBan"
  | "post.kill"
  | "post.restore"
  | "keyword.add"
  | "keyword.remove"
  | "maintenance.update"
  | "notification.broadcast"
  | "arena.update"
  | "backup.trigger"
  | "apiKey.note";

type UserControl = {
  userId: string;
  status: "active" | "suspended" | "banned";
  role: "student" | "moderator";
  shadowBanned: boolean;
  deviceInfo: string;
  karmaPoints: number;
  updatedAt: string;
};

type AdminReport = {
  id: string;
  tenantId: string;
  targetType: "post" | "comment" | "user" | "vibe";
  targetId: string;
  reason: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "open" | "reviewing" | "resolved";
  createdAt: string;
};

type AdminAuditLog = {
  id: string;
  actor: string;
  action: SuperAdminAction;
  entityType: string;
  entityId: string;
  metadata: JsonRecord;
  createdAt: string;
};

type AdminNotification = {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  audience: "all" | "students" | "moderators";
  createdAt: string;
};

type AdminStore = {
  maintenance: {
    enabled: boolean;
    message: string;
    updatedAt: string | null;
  };
  userControls: Record<string, UserControl>;
  hiddenPosts: Record<string, { postId: string; reason: string; hiddenAt: string }>;
  keywordFirewall: string[];
  reports: AdminReport[];
  auditLogs: AdminAuditLog[];
  notifications: AdminNotification[];
  arena: {
    dailyLevel: string;
    difficultyMin: number;
    difficultyMax: number;
    cheaterThresholdSeconds: number;
    leaderboardVerification: boolean;
    updatedAt: string | null;
  };
  apiKeys: {
    provider: string;
    status: "healthy" | "rotate-soon" | "blocked";
    lastRotatedAt: string | null;
    note: string;
  }[];
  backups: {
    id: string;
    path: string;
    createdAt: string;
  }[];
};

const defaultStore: AdminStore = {
  maintenance: {
    enabled: false,
    message: "VYB is upgrading. Back in 10 mins!",
    updatedAt: null
  },
  userControls: {},
  hiddenPosts: {},
  keywordFirewall: ["abuse", "spam", "scam"],
  reports: [],
  auditLogs: [],
  notifications: [],
  arena: {
    dailyLevel: "auto",
    difficultyMin: 5,
    difficultyMax: 9,
    cheaterThresholdSeconds: 2,
    leaderboardVerification: true,
    updatedAt: null
  },
  apiKeys: [
    {
      provider: "Firebase Storage",
      status: "healthy",
      lastRotatedAt: null,
      note: "Managed through Firebase service account."
    },
    {
      provider: "Maps",
      status: "rotate-soon",
      lastRotatedAt: null,
      note: "Add key rotation once maps integration lands."
    }
  ],
  backups: []
};

let writeQueue = Promise.resolve();

function getBackendDataPath(fileName: string) {
  return path.join(process.cwd(), "..", "backend", "src", "data", fileName);
}

function getAdminStorePath() {
  return getBackendDataPath("super-admin-store.json");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
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

function normalizeStore(raw: Partial<AdminStore>): AdminStore {
  return {
    ...clone(defaultStore),
    ...raw,
    maintenance: {
      ...defaultStore.maintenance,
      ...(raw.maintenance ?? {})
    },
    userControls: raw.userControls && typeof raw.userControls === "object" ? raw.userControls : {},
    hiddenPosts: raw.hiddenPosts && typeof raw.hiddenPosts === "object" ? raw.hiddenPosts : {},
    keywordFirewall: Array.isArray(raw.keywordFirewall) ? raw.keywordFirewall : [...defaultStore.keywordFirewall],
    reports: Array.isArray(raw.reports) ? raw.reports : [],
    auditLogs: Array.isArray(raw.auditLogs) ? raw.auditLogs : [],
    notifications: Array.isArray(raw.notifications) ? raw.notifications : [],
    arena: {
      ...defaultStore.arena,
      ...(raw.arena ?? {})
    },
    apiKeys: Array.isArray(raw.apiKeys) ? raw.apiKeys : [...defaultStore.apiKeys],
    backups: Array.isArray(raw.backups) ? raw.backups : []
  };
}

async function readAdminStore() {
  return normalizeStore(await readJsonFile<Partial<AdminStore>>(getAdminStorePath(), defaultStore));
}

async function writeAdminStore(store: AdminStore) {
  await writeJsonFile(getAdminStorePath(), store);
}

function toTimestamp(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function getAuthorUserId(post: SocialPostRecord) {
  return post.authorUserId ?? post.userId ?? post.membershipId ?? "unknown";
}

function buildUserControl(profile: ProfileRecord, existing?: UserControl): UserControl {
  return {
    userId: profile.userId,
    status: existing?.status ?? "active",
    role: existing?.role ?? "student",
    shadowBanned: existing?.shadowBanned ?? false,
    deviceInfo: existing?.deviceInfo ?? "Web PWA",
    karmaPoints: existing?.karmaPoints ?? Math.max(0, Math.round((profile.profileCompleted ? 40 : 5) + (profile.year ?? 1) * 7)),
    updatedAt: existing?.updatedAt ?? toTimestamp(profile.updatedAt ?? profile.createdAt)
  };
}

function groupTenants(profiles: ProfileRecord[], posts: SocialPostRecord[], store: AdminStore) {
  const ids = new Set<string>();
  profiles.forEach((profile) => ids.add(profile.tenantId));
  posts.forEach((post) => ids.add(post.tenantId));

  return Array.from(ids).map((tenantId) => {
    const tenantProfiles = profiles.filter((profile) => profile.tenantId === tenantId);
    const tenantPosts = posts.filter((post) => post.tenantId === tenantId);
    return {
      id: tenantId,
      name: tenantProfiles[0]?.collegeName || "Campus tenant",
      domainHint: tenantProfiles[0]?.primaryEmail?.split("@")[1] ?? "domain pending",
      users: tenantProfiles.length,
      posts: tenantPosts.length,
      hiddenPosts: tenantPosts.filter((post) => store.hiddenPosts[post.id]).length,
      activeUsers: tenantProfiles.filter((profile) => buildUserControl(profile, store.userControls[profile.userId]).status === "active").length
    };
  });
}

function seedReports(posts: SocialPostRecord[], store: AdminStore) {
  if (store.reports.length > 0) {
    return store.reports;
  }

  return posts.slice(0, 3).map((post, index) => ({
    id: `seed-report-${post.id}`,
    tenantId: post.tenantId,
    targetType: post.placement === "vibe" ? "vibe" : "post",
    targetId: post.id,
    reason: index === 0 ? "Spam or suspicious growth" : index === 1 ? "Offensive keyword review" : "Community report",
    priority: index === 0 ? "high" : "medium",
    status: "open",
    createdAt: toTimestamp(post.createdAt)
  })) satisfies AdminReport[];
}

function buildHeartbeat(profiles: ProfileRecord[], posts: SocialPostRecord[], store: AdminStore) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const activeToday = profiles.filter((profile) => now - new Date(profile.updatedAt ?? profile.createdAt ?? now).getTime() < dayMs).length;
  const activeMonth = profiles.filter((profile) => now - new Date(profile.updatedAt ?? profile.createdAt ?? now).getTime() < dayMs * 30).length;
  const publicPosts = posts.filter((post) => !store.hiddenPosts[post.id] && post.status !== "removed");

  return {
    dau: activeToday,
    mau: activeMonth,
    posts: publicPosts.length,
    reportsOpen: seedReports(posts, store).filter((report) => report.status !== "resolved").length,
    apiErrorRate: 0.7,
    databaseLatencyMs: 42,
    cpuUsage: 31,
    retention: [
      { from: "Arena", to: "Messages", percent: 38 },
      { from: "Feed", to: "Profile", percent: 54 },
      { from: "Events", to: "Market", percent: 16 }
    ]
  };
}

export async function getPublicMaintenanceState() {
  const store = await readAdminStore();
  return store.maintenance;
}

export async function getSuperAdminSnapshot() {
  const [store, profileStore, socialStore] = await Promise.all([
    readAdminStore(),
    readJsonFile<{ profiles?: ProfileRecord[] }>(getBackendDataPath("profile-store.json"), { profiles: [] }),
    readJsonFile<{ posts?: SocialPostRecord[] }>(getBackendDataPath("social-store.json"), { posts: [] })
  ]);

  const profiles = Array.isArray(profileStore.profiles) ? profileStore.profiles : [];
  const posts = Array.isArray(socialStore.posts) ? socialStore.posts : [];
  const controls = Object.fromEntries(profiles.map((profile) => [profile.userId, buildUserControl(profile, store.userControls[profile.userId])]));
  const reports = seedReports(posts, store);

  return {
    tenantResolution: {
      primary: "Email domain -> tenantDomains lookup in Data Connect",
      fallback: "VYB_DEFAULT_TENANT_SLUG and VYB_DEFAULT_TENANT_DOMAIN",
      localDefault: "tenant-demo is only the dev-session fallback"
    },
    tenants: groupTenants(profiles, posts, store),
    users: profiles.map((profile) => ({
      ...profile,
      control: controls[profile.userId],
      postCount: posts.filter((post) => getAuthorUserId(post) === profile.userId).length
    })),
    posts: posts.map((post) => ({
      ...post,
      authorUserId: getAuthorUserId(post),
      hidden: Boolean(store.hiddenPosts[post.id]),
      hiddenReason: store.hiddenPosts[post.id]?.reason ?? null
    })),
    reports,
    auditLogs: store.auditLogs.slice().sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    notifications: store.notifications.slice().sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    maintenance: store.maintenance,
    keywordFirewall: store.keywordFirewall,
    arena: store.arena,
    apiKeys: store.apiKeys,
    backups: store.backups,
    heartbeat: buildHeartbeat(profiles, posts, store)
  };
}

function appendAudit(store: AdminStore, input: {
  actor?: string;
  action: SuperAdminAction;
  entityType: string;
  entityId: string;
  metadata?: JsonRecord;
}) {
  store.auditLogs.unshift({
    id: randomUUID(),
    actor: input.actor || "super-admin",
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString()
  });
  store.auditLogs = store.auditLogs.slice(0, 200);
}

export async function mutateSuperAdminStore(payload: JsonRecord, actor = "super-admin") {
  const store = await readAdminStore();
  const action = payload.action as SuperAdminAction | undefined;
  const now = new Date().toISOString();

  if (action === "user.status") {
    const userId = String(payload.userId ?? "");
    const status = payload.status === "suspended" || payload.status === "banned" ? payload.status : "active";
    const existing = store.userControls[userId] ?? {
      userId,
      status: "active",
      role: "student",
      shadowBanned: false,
      deviceInfo: "Web PWA",
      karmaPoints: 0,
      updatedAt: now
    };
    store.userControls[userId] = { ...existing, status, updatedAt: now };
    appendAudit(store, { actor, action, entityType: "user", entityId: userId, metadata: { status } });
  } else if (action === "user.role") {
    const userId = String(payload.userId ?? "");
    const role = payload.role === "moderator" ? "moderator" : "student";
    const existing = store.userControls[userId] ?? {
      userId,
      status: "active",
      role: "student",
      shadowBanned: false,
      deviceInfo: "Web PWA",
      karmaPoints: 0,
      updatedAt: now
    };
    store.userControls[userId] = { ...existing, role, updatedAt: now };
    appendAudit(store, { actor, action, entityType: "user", entityId: userId, metadata: { role } });
  } else if (action === "user.shadowBan") {
    const userId = String(payload.userId ?? "");
    const shadowBanned = Boolean(payload.shadowBanned);
    const existing = store.userControls[userId] ?? {
      userId,
      status: "active",
      role: "student",
      shadowBanned: false,
      deviceInfo: "Web PWA",
      karmaPoints: 0,
      updatedAt: now
    };
    store.userControls[userId] = { ...existing, shadowBanned, updatedAt: now };
    appendAudit(store, { actor, action, entityType: "user", entityId: userId, metadata: { shadowBanned } });
  } else if (action === "post.kill") {
    const postId = String(payload.postId ?? "");
    const reason = String(payload.reason ?? "Manual kill switch");
    store.hiddenPosts[postId] = { postId, reason, hiddenAt: now };
    appendAudit(store, { actor, action, entityType: "post", entityId: postId, metadata: { reason } });
  } else if (action === "post.restore") {
    const postId = String(payload.postId ?? "");
    delete store.hiddenPosts[postId];
    appendAudit(store, { actor, action, entityType: "post", entityId: postId });
  } else if (action === "keyword.add") {
    const keyword = String(payload.keyword ?? "").trim();
    if (keyword && !store.keywordFirewall.includes(keyword)) {
      store.keywordFirewall.push(keyword);
      appendAudit(store, { actor, action, entityType: "keyword", entityId: keyword });
    }
  } else if (action === "keyword.remove") {
    const keyword = String(payload.keyword ?? "").trim();
    store.keywordFirewall = store.keywordFirewall.filter((item) => item !== keyword);
    appendAudit(store, { actor, action, entityType: "keyword", entityId: keyword });
  } else if (action === "maintenance.update") {
    store.maintenance = {
      enabled: Boolean(payload.enabled),
      message: String(payload.message ?? store.maintenance.message).trim() || defaultStore.maintenance.message,
      updatedAt: now
    };
    appendAudit(store, { actor, action, entityType: "platform", entityId: "maintenance", metadata: store.maintenance });
  } else if (action === "notification.broadcast") {
    const notification: AdminNotification = {
      id: randomUUID(),
      tenantId: String(payload.tenantId ?? "all"),
      title: String(payload.title ?? "VYB update").trim() || "VYB update",
      body: String(payload.body ?? "").trim(),
      audience: payload.audience === "moderators" || payload.audience === "students" ? payload.audience : "all",
      createdAt: now
    };
    store.notifications.unshift(notification);
    appendAudit(store, { actor, action, entityType: "notification", entityId: notification.id, metadata: notification });
  } else if (action === "arena.update") {
    store.arena = {
      dailyLevel: String(payload.dailyLevel ?? store.arena.dailyLevel).trim() || "auto",
      difficultyMin: Math.max(5, Math.min(9, Number(payload.difficultyMin ?? store.arena.difficultyMin))),
      difficultyMax: Math.max(5, Math.min(9, Number(payload.difficultyMax ?? store.arena.difficultyMax))),
      cheaterThresholdSeconds: Math.max(1, Math.min(30, Number(payload.cheaterThresholdSeconds ?? store.arena.cheaterThresholdSeconds))),
      leaderboardVerification: Boolean(payload.leaderboardVerification),
      updatedAt: now
    };
    appendAudit(store, { actor, action, entityType: "arena", entityId: "daily-config", metadata: store.arena });
  } else if (action === "backup.trigger") {
    const backupId = `backup-${Date.now()}`;
    const backupPath = getBackendDataPath(`${backupId}.json`);
    const snapshot = await getSuperAdminSnapshot();
    await writeJsonFile(backupPath, snapshot);
    store.backups.unshift({ id: backupId, path: backupPath, createdAt: now });
    appendAudit(store, { actor, action, entityType: "database", entityId: backupId, metadata: { path: backupPath } });
  } else if (action === "apiKey.note") {
    const provider = String(payload.provider ?? "");
    store.apiKeys = store.apiKeys.map((item) =>
      item.provider === provider
        ? {
            ...item,
            status: payload.status === "blocked" || payload.status === "rotate-soon" ? payload.status : "healthy",
            note: String(payload.note ?? item.note),
            lastRotatedAt: payload.markRotated ? now : item.lastRotatedAt
          }
        : item
    );
    appendAudit(store, { actor, action, entityType: "api_key", entityId: provider });
  } else {
    throw new Error("Unsupported super-admin action.");
  }

  await writeAdminStore(store);
  return getSuperAdminSnapshot();
}
