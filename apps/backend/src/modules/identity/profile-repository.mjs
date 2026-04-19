import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directoryName = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.resolve(directoryName, "../../data/profile-store.json");

const defaultStore = {
  profiles: []
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
    storeCache = JSON.parse(raw);
  } catch {
    storeCache = clone(defaultStore);
    await persistStore();
  }

  if (!Array.isArray(storeCache.profiles)) {
    storeCache.profiles = [];
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

function toNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function sanitizeUsername(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^@+/u, "")
    .replace(/\s+/gu, "_")
    .replace(/[^a-z0-9._]+/gu, "_")
    .replace(/[._]{2,}/gu, "_")
    .replace(/^[._]+|[._]+$/gu, "");

  if (normalized.length < 3 || normalized.length > 24) {
    return null;
  }

  if (!/^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])?$/u.test(normalized)) {
    return null;
  }

  return normalized;
}

function buildUsernameSeed(existing) {
  const explicit = sanitizeUsername(existing?.username);
  if (explicit) {
    return explicit;
  }

  const emailSeed = sanitizeUsername(String(existing?.primaryEmail ?? "").split("@")[0] ?? "");
  if (emailSeed) {
    return emailSeed;
  }

  const nameSeed = sanitizeUsername(existing?.fullName ?? existing?.firstName ?? "");
  if (nameSeed) {
    return nameSeed;
  }

  const userIdSeed = sanitizeUsername(String(existing?.userId ?? "").slice(0, 24));
  return userIdSeed ?? `user_${String(existing?.userId ?? "vyb").slice(-6).toLowerCase()}`;
}

function usernamesMatch(left, right) {
  return sanitizeUsername(left) === sanitizeUsername(right);
}

function ensureUniqueUsername(store, seed, excludedUserId) {
  let candidate = sanitizeUsername(seed);
  if (!candidate) {
    candidate = "vyb_user";
  }

  let suffix = 1;
  while (
    store.profiles.some(
      (item) => item.userId !== excludedUserId && usernamesMatch(item.username ?? buildUsernameSeed(item), candidate)
    )
  ) {
    const trimmed = candidate.slice(0, Math.max(3, 24 - String(suffix).length - 1)).replace(/[._]+$/u, "");
    candidate = `${trimmed}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function inferCourseAndStream(existing) {
  const course = toNonEmptyString(existing.course);
  const stream = toNonEmptyString(existing.stream ?? existing.branch);

  if (course && stream) {
    return {
      course,
      stream
    };
  }

  const legacyBranch = toNonEmptyString(existing.branch);
  if (!legacyBranch) {
    return {
      course: "B.Tech",
      stream: "Computer Science and Engineering"
    };
  }

  if (
    [
      "Computer Science and Engineering",
      "Computer Science and Engineering - AI",
      "Computer Science and Engineering - AI & ML",
      "Computer Science and Engineering - Data Science",
      "Information Technology",
      "Electronics and Communication Engineering",
      "Electrical and Electronics Engineering",
      "Electrical Engineering",
      "Mechanical Engineering",
      "Civil Engineering"
    ].includes(legacyBranch)
  ) {
    return {
      course: "B.Tech",
      stream: legacyBranch
    };
  }

  if (legacyBranch === "MBA") {
    return {
      course: "MBA",
      stream: "Finance"
    };
  }

  if (legacyBranch === "MCA") {
    return {
      course: "MCA",
      stream: "General"
    };
  }

  if (legacyBranch === "Pharmacy") {
    return {
      course: "B.Pharm",
      stream: "General"
    };
  }

  if (legacyBranch === "Applied Sciences") {
    return {
      course: "Applied Sciences",
      stream: "Physics"
    };
  }

  return {
    course: "Other",
    stream: "General"
  };
}

function normalizeProfileRecord(existing, store) {
  if (!existing) {
    return null;
  }

  const inferred = inferCourseAndStream(existing);
  const username = ensureUniqueUsername(store, buildUsernameSeed(existing), existing.userId);

  return {
    ...existing,
    username,
    course: inferred.course,
    stream: inferred.stream,
    branch: inferred.stream
  };
}

function matchQuery(profile, query) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return false;
  }

  const lowered = normalizedQuery.toLowerCase();
  return [
    profile.username,
    profile.fullName,
    profile.firstName,
    profile.lastName
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(lowered));
}

export function normalizeUsername(value) {
  return sanitizeUsername(value);
}

export async function getProfileByUserId(userId) {
  const store = await ensureStore();
  const existing = store.profiles.find((item) => item.userId === userId) ?? null;
  return normalizeProfileRecord(existing, store);
}

export async function getProfileByUsername({ tenantId, username }) {
  const store = await ensureStore();
  const normalizedUsername = sanitizeUsername(username);
  if (!normalizedUsername) {
    return null;
  }

  const existing =
    store.profiles.find(
      (item) =>
        item.tenantId === tenantId &&
        usernamesMatch(item.username ?? buildUsernameSeed(item), normalizedUsername)
    ) ?? null;

  return normalizeProfileRecord(existing, store);
}

export async function listProfilesByTenant(tenantId) {
  const store = await ensureStore();
  return store.profiles
    .filter((item) => item.tenantId === tenantId)
    .map((item) => normalizeProfileRecord(item, store))
    .filter(Boolean)
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function searchProfiles({ tenantId, query, limit = 12, excludedUserId = null }) {
  const profiles = await listProfilesByTenant(tenantId);
  return profiles
    .filter((profile) => profile.userId !== excludedUserId)
    .filter((profile) => matchQuery(profile, query.trim()))
    .slice(0, limit);
}

export async function updateUsername({ userId, username }) {
  const store = await ensureStore();
  const existing = store.profiles.find((item) => item.userId === userId);
  if (!existing) {
    return null;
  }

  const normalizedUsername = sanitizeUsername(username);
  if (!normalizedUsername) {
    const error = new Error("Invalid username.");
    error.code = "INVALID_USERNAME";
    throw error;
  }

  const takenBySomeoneElse = store.profiles.some(
    (item) => item.userId !== userId && usernamesMatch(item.username ?? buildUsernameSeed(item), normalizedUsername)
  );
  if (takenBySomeoneElse) {
    const error = new Error("That user ID is already taken.");
    error.code = "USERNAME_TAKEN";
    throw error;
  }

  existing.username = normalizedUsername;
  existing.updatedAt = new Date().toISOString();
  await persistStore();
  return normalizeProfileRecord(existing, store);
}

export async function upsertProfile(input) {
  const store = await ensureStore();
  const existing = store.profiles.find((item) => item.userId === input.userId);
  const timestamp = new Date().toISOString();
  const normalizedUsername = sanitizeUsername(input.username);

  if (!normalizedUsername) {
    const error = new Error("User ID format is invalid.");
    error.code = "INVALID_USERNAME";
    throw error;
  }

  const takenBySomeoneElse = store.profiles.some(
    (item) => item.userId !== input.userId && usernamesMatch(item.username ?? buildUsernameSeed(item), normalizedUsername)
  );

  if (takenBySomeoneElse) {
    const error = new Error("That user ID is already taken.");
    error.code = "USERNAME_TAKEN";
    throw error;
  }

  const normalized = {
    userId: input.userId,
    tenantId: input.tenantId,
    primaryEmail: input.primaryEmail,
    collegeName: input.collegeName,
    username: normalizedUsername,
    firstName: input.firstName,
    lastName: toNonEmptyString(input.lastName),
    fullName: input.fullName,
    course: input.course,
    stream: input.stream,
    branch: input.stream,
    year: input.year,
    section: input.section,
    isHosteller: Boolean(input.isHosteller),
    hostelName: input.isHosteller ? toNonEmptyString(input.hostelName) : null,
    phoneNumber: toNonEmptyString(input.phoneNumber),
    profileCompleted: true,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp
  };

  if (existing) {
    Object.assign(existing, normalized);
  } else {
    store.profiles.push(normalized);
  }

  await persistStore();
  return normalizeProfileRecord(existing ?? normalized, store);
}
