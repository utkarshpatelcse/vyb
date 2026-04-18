import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directoryName = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.resolve(directoryName, "../data/store.json");

const defaultStore = {
  resources: [
    {
      id: "resource-1",
      tenantId: "tenant-demo",
      membershipId: "membership-demo-1",
      courseId: "course-dbms",
      title: "DBMS Quick Revision Notes",
      description: "Concise notes for normalization, transactions, and indexing.",
      type: "notes",
      downloads: 412,
      status: "published",
      createdAt: "2026-04-17T12:00:00.000Z"
    },
    {
      id: "resource-2",
      tenantId: "tenant-demo",
      membershipId: "membership-demo-2",
      courseId: "course-os",
      title: "Operating Systems PYQ Pack",
      description: "Sorted PYQs with topic tags and short answer pointers.",
      type: "pyq",
      downloads: 305,
      status: "published",
      createdAt: "2026-04-16T14:30:00.000Z"
    }
  ],
  resourceFiles: [
    {
      id: "resource-file-1",
      resourceId: "resource-1",
      fileName: "dbms-revision.pdf",
      mimeType: "application/pdf",
      sizeBytes: 384210
    }
  ]
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

function sortByCreatedAtDesc(items) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export async function listResources({ tenantId, courseId, limit }) {
  const store = await ensureStore();

  return sortByCreatedAtDesc(store.resources)
    .filter((item) => item.tenantId === tenantId)
    .filter((item) => (courseId ? item.courseId === courseId : true))
    .slice(0, limit);
}

export async function getResourceDetail(resourceId) {
  const store = await ensureStore();
  const item = store.resources.find((resource) => resource.id === resourceId);

  if (!item) {
    return null;
  }

  return {
    ...item,
    files: store.resourceFiles.filter((file) => file.resourceId === item.id)
  };
}

export async function createResource(payload) {
  const store = await ensureStore();
  const item = {
    id: `resource-${store.resources.length + 1}`,
    tenantId: payload.tenantId,
    membershipId: payload.membershipId,
    courseId: payload.courseId ?? null,
    title: payload.title,
    description: payload.description,
    type: payload.type,
    downloads: 0,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  store.resources.unshift(item);
  await persistStore();
  return item;
}
