import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProfileRecord, ProfileResponse, UpsertProfileRequest } from "@vyb/contracts";
import type { DevSession } from "./dev-session";
import { launchCollege } from "./college-access";

type ProfileStore = {
  profiles: ProfileRecord[];
};

const storePath = path.resolve(process.cwd(), "../../data/profile-store.json");
const defaultStore: ProfileStore = {
  profiles: []
};

let storeCache: ProfileStore | null = null;
let writeQueue = Promise.resolve();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function ensureStore() {
  if (storeCache) {
    return storeCache;
  }

  await mkdir(path.dirname(storePath), { recursive: true });

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ProfileStore>;
    storeCache = {
      profiles: Array.isArray(parsed.profiles) ? (parsed.profiles as ProfileRecord[]) : []
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

function toOptionalString(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function buildCollegeName(existing?: string | null) {
  return existing?.trim() || launchCollege.name;
}

export async function readFallbackProfile(userId: string) {
  const store = await ensureStore();
  return store.profiles.find((item) => item.userId === userId) ?? null;
}

export async function buildFallbackProfileResponse(viewer: DevSession): Promise<ProfileResponse> {
  const profile = await readFallbackProfile(viewer.userId);
  return {
    profileCompleted: Boolean(profile?.profileCompleted),
    allowedEmailDomain: launchCollege.domain,
    collegeName: buildCollegeName(profile?.collegeName),
    profile
  };
}

export async function upsertFallbackProfile(viewer: DevSession, payload: UpsertProfileRequest): Promise<ProfileResponse> {
  const store = await ensureStore();
  const existing = store.profiles.find((item) => item.userId === viewer.userId) ?? null;
  const timestamp = new Date().toISOString();
  const firstName = payload.firstName.trim();
  const lastName = toOptionalString(payload.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  const profile: ProfileRecord = {
    userId: viewer.userId,
    tenantId: viewer.tenantId,
    primaryEmail: viewer.email,
    collegeName: buildCollegeName(existing?.collegeName),
    firstName,
    lastName,
    fullName,
    course: payload.course.trim(),
    stream: payload.stream.trim(),
    branch: payload.stream.trim(),
    year: Number(payload.year),
    section: payload.section.trim().toUpperCase(),
    isHosteller: Boolean(payload.isHosteller),
    hostelName: payload.isHosteller ? toOptionalString(payload.hostelName) : null,
    phoneNumber: toOptionalString(payload.phoneNumber),
    profileCompleted: true,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp
  };

  if (existing) {
    Object.assign(existing, profile);
  } else {
    store.profiles.push(profile);
  }

  await persistStore();

  return {
    profileCompleted: true,
    allowedEmailDomain: launchCollege.domain,
    collegeName: profile.collegeName,
    profile
  };
}
