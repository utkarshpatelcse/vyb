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

export async function getProfileByUserId(userId) {
  const store = await ensureStore();
  const existing = store.profiles.find((item) => item.userId === userId) ?? null;

  if (!existing) {
    return null;
  }

  const inferred = inferCourseAndStream(existing);
  return {
    ...existing,
    course: inferred.course,
    stream: inferred.stream,
    branch: inferred.stream
  };
}

export async function upsertProfile(input) {
  const store = await ensureStore();
  const existing = store.profiles.find((item) => item.userId === input.userId);
  const timestamp = new Date().toISOString();
  const normalized = {
    userId: input.userId,
    tenantId: input.tenantId,
    primaryEmail: input.primaryEmail,
    collegeName: input.collegeName,
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
  return normalized;
}
