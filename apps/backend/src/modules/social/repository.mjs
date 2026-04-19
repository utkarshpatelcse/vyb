import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directoryName = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.resolve(directoryName, "../../data/social-store.json");

const defaultStore = {
  posts: [
    {
      id: "post-1",
      tenantId: "tenant-demo",
      communityId: "community-general",
      membershipId: "membership-demo-1",
      kind: "text",
      title: "Prototype Night",
      body: "Club demo night is live. Bring your build, record a clip, and drop your wins before 9 PM.",
      status: "published",
      reactions: 124,
      comments: 18,
      createdAt: "2026-04-18T08:15:00.000Z"
    },
    {
      id: "post-2",
      tenantId: "tenant-demo",
      communityId: "community-batch",
      membershipId: "membership-demo-1",
      kind: "text",
      title: "Placement Prep Sprint",
      body: "Shared DSA revision sheet plus mock interview slots for tomorrow evening.",
      status: "published",
      reactions: 88,
      comments: 26,
      createdAt: "2026-04-18T06:45:00.000Z"
    }
  ],
  comments: [
    {
      id: "comment-1",
      postId: "post-1",
      membershipId: "membership-demo-2",
      body: "Bringing the hostel attendance bot prototype.",
      createdAt: "2026-04-18T08:22:00.000Z"
    }
  ],
  reactions: []
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

export async function listPosts({ tenantId, communityId, limit }) {
  const store = await ensureStore();
  return sortByCreatedAtDesc(store.posts)
    .filter((item) => item.tenantId === tenantId)
    .filter((item) => (communityId ? item.communityId === communityId : true))
    .slice(0, limit);
}

export async function findPostById(postId) {
  const store = await ensureStore();
  return store.posts.find((item) => item.id === postId) ?? null;
}

export async function createPost(payload) {
  const store = await ensureStore();
  const item = {
    id: `post-${store.posts.length + 1}`,
    tenantId: payload.tenantId,
    communityId: payload.communityId ?? null,
    membershipId: payload.membershipId,
    kind: payload.kind,
    title: payload.title,
    body: payload.body,
    status: "pending",
    reactions: 0,
    comments: 0,
    createdAt: new Date().toISOString()
  };

  store.posts.unshift(item);
  await persistStore();
  return item;
}

export async function createComment(payload) {
  const store = await ensureStore();
  const post = store.posts.find((item) => item.id === payload.postId);
  if (!post) {
    return null;
  }

  const item = {
    id: `comment-${store.comments.length + 1}`,
    postId: payload.postId,
    membershipId: payload.membershipId,
    body: payload.body,
    createdAt: new Date().toISOString()
  };

  store.comments.push(item);
  post.comments += 1;
  await persistStore();
  return item;
}

export async function upsertReaction(payload) {
  const store = await ensureStore();
  const post = store.posts.find((item) => item.id === payload.postId);
  if (!post) {
    return null;
  }

  const existing = store.reactions.find(
    (item) => item.postId === payload.postId && item.membershipId === payload.membershipId
  );

  if (existing) {
    existing.reactionType = payload.reactionType;
  } else {
    store.reactions.push({
      postId: payload.postId,
      membershipId: payload.membershipId,
      reactionType: payload.reactionType,
      createdAt: new Date().toISOString()
    });
    post.reactions += 1;
  }

  await persistStore();

  return {
    postId: post.id,
    membershipId: payload.membershipId,
    reactionType: payload.reactionType,
    aggregateCount: post.reactions
  };
}
