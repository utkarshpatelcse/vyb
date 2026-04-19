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
      userId: "dev-akash-1",
      membershipId: "membership-demo-1",
      authorUsername: "akash_vyb",
      authorName: "Akash Verma",
      placement: "feed",
      kind: "image",
      mediaUrl:
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
      location: "Innovation Lab",
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
      userId: "dev-priya-1",
      membershipId: "membership-demo-2",
      authorUsername: "priya.dev",
      authorName: "Priya Sharma",
      placement: "feed",
      kind: "text",
      mediaUrl: null,
      location: "KIET Library",
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
  reactions: [],
  stories: [],
  follows: []
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

  if (!Array.isArray(storeCache.posts)) {
    storeCache.posts = [];
  }
  if (!Array.isArray(storeCache.comments)) {
    storeCache.comments = [];
  }
  if (!Array.isArray(storeCache.reactions)) {
    storeCache.reactions = [];
  }
  if (!Array.isArray(storeCache.stories)) {
    storeCache.stories = [];
  }
  if (!Array.isArray(storeCache.follows)) {
    storeCache.follows = [];
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

function buildId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortByCreatedAtDesc(items) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function isActiveStory(story) {
  return new Date(story.expiresAt).getTime() > Date.now();
}

function mapPost(item) {
  return {
    id: item.id,
    tenantId: item.tenantId,
    communityId: item.communityId ?? null,
    userId: item.userId,
    membershipId: item.membershipId,
    placement: item.placement ?? "feed",
    kind: item.kind,
    mediaUrl: item.mediaUrl ?? null,
    location: item.location ?? null,
    title: item.title ?? "Campus update",
    body: item.body,
    status: item.status ?? "published",
    reactions: Number(item.reactions ?? 0),
    comments: Number(item.comments ?? 0),
    createdAt: item.createdAt,
    author: {
      userId: item.userId,
      username: item.authorUsername ?? "vyb_user",
      displayName: item.authorName ?? "Vyb Student"
    }
  };
}

export async function listPosts({
  tenantId,
  communityId = null,
  limit,
  placement = "feed",
  userId = null
}) {
  const store = await ensureStore();
  return sortByCreatedAtDesc(store.posts)
    .filter((item) => item.tenantId === tenantId)
    .filter((item) => item.status !== "removed")
    .filter((item) => item.status === "published")
    .filter((item) => item.placement === placement)
    .filter((item) => (communityId ? item.communityId === communityId : true))
    .filter((item) => (userId ? item.userId === userId : true))
    .slice(0, limit)
    .map(mapPost);
}

export async function listPostsByUser({ tenantId, userId, limit = 24, placement = "feed" }) {
  return listPosts({ tenantId, userId, limit, placement });
}

export async function countPostsByUser({ tenantId, userId, placement = "feed" }) {
  const store = await ensureStore();
  return store.posts.filter(
    (item) =>
      item.tenantId === tenantId &&
      item.userId === userId &&
      item.placement === placement &&
      item.status === "published"
  ).length;
}

export async function findPostById(postId) {
  const store = await ensureStore();
  const item = store.posts.find((post) => post.id === postId) ?? null;
  return item ? mapPost(item) : null;
}

export async function createPost(payload) {
  const store = await ensureStore();
  const item = {
    id: buildId("post"),
    tenantId: payload.tenantId,
    communityId: payload.communityId ?? null,
    userId: payload.userId,
    membershipId: payload.membershipId,
    authorUsername: payload.authorUsername,
    authorName: payload.authorName,
    placement: payload.placement ?? "feed",
    kind: payload.kind,
    mediaUrl: payload.mediaUrl ?? null,
    location: payload.location ?? null,
    title: payload.title ?? "Campus update",
    body: payload.body,
    status: "published",
    reactions: 0,
    comments: 0,
    createdAt: new Date().toISOString()
  };

  store.posts.unshift(item);
  await persistStore();
  return mapPost(item);
}

export async function createComment(payload) {
  const store = await ensureStore();
  const post = store.posts.find((item) => item.id === payload.postId);
  if (!post) {
    return null;
  }

  const item = {
    id: buildId("comment"),
    postId: payload.postId,
    membershipId: payload.membershipId,
    body: payload.body,
    createdAt: new Date().toISOString()
  };

  store.comments.push(item);
  post.comments = Number(post.comments ?? 0) + 1;
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
      id: buildId("reaction"),
      postId: payload.postId,
      membershipId: payload.membershipId,
      reactionType: payload.reactionType,
      createdAt: new Date().toISOString()
    });
    post.reactions = Number(post.reactions ?? 0) + 1;
  }

  await persistStore();

  return {
    postId: post.id,
    membershipId: payload.membershipId,
    reactionType: payload.reactionType,
    aggregateCount: Number(post.reactions ?? 0)
  };
}

export async function listStories({ tenantId, viewerUserId }) {
  const store = await ensureStore();
  const followingIds = new Set(
    store.follows
      .filter((item) => item.tenantId === tenantId && item.followerUserId === viewerUserId)
      .map((item) => item.followingUserId)
  );

  const latestByUser = new Map();

  for (const item of sortByCreatedAtDesc(store.stories)) {
    if (item.tenantId !== tenantId || !isActiveStory(item)) {
      continue;
    }

    if (item.userId !== viewerUserId && !followingIds.has(item.userId)) {
      continue;
    }

    if (!latestByUser.has(item.userId)) {
      latestByUser.set(item.userId, {
        id: item.id,
        tenantId: item.tenantId,
        userId: item.userId,
        username: item.username,
        displayName: item.displayName,
        mediaType: item.mediaType,
        mediaUrl: item.mediaUrl,
        caption: item.caption,
        createdAt: item.createdAt,
        expiresAt: item.expiresAt,
        isOwn: item.userId === viewerUserId
      });
    }
  }

  return Array.from(latestByUser.values());
}

export async function createStory(payload) {
  const store = await ensureStore();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

  const item = {
    id: buildId("story"),
    tenantId: payload.tenantId,
    userId: payload.userId,
    username: payload.username,
    displayName: payload.displayName,
    mediaType: payload.mediaType,
    mediaUrl: payload.mediaUrl,
    caption: payload.caption ?? "",
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  store.stories.unshift(item);
  await persistStore();

  return {
    ...item,
    isOwn: true
  };
}

export async function followUser({ tenantId, followerUserId, followingUserId }) {
  if (followerUserId === followingUserId) {
    return false;
  }

  const store = await ensureStore();
  const existing = store.follows.find(
    (item) =>
      item.tenantId === tenantId &&
      item.followerUserId === followerUserId &&
      item.followingUserId === followingUserId
  );

  if (existing) {
    return true;
  }

  store.follows.push({
    id: buildId("follow"),
    tenantId,
    followerUserId,
    followingUserId,
    createdAt: new Date().toISOString()
  });
  await persistStore();
  return true;
}

export async function unfollowUser({ tenantId, followerUserId, followingUserId }) {
  const store = await ensureStore();
  const next = store.follows.filter(
    (item) =>
      !(
        item.tenantId === tenantId &&
        item.followerUserId === followerUserId &&
        item.followingUserId === followingUserId
      )
  );

  if (next.length === store.follows.length) {
    return false;
  }

  store.follows = next;
  await persistStore();
  return true;
}

export async function isFollowing({ tenantId, followerUserId, followingUserId }) {
  const store = await ensureStore();
  return store.follows.some(
    (item) =>
      item.tenantId === tenantId &&
      item.followerUserId === followerUserId &&
      item.followingUserId === followingUserId
  );
}

export async function getFollowStats({ tenantId, userId }) {
  const store = await ensureStore();
  const followers = store.follows.filter((item) => item.tenantId === tenantId && item.followingUserId === userId).length;
  const following = store.follows.filter((item) => item.tenantId === tenantId && item.followerUserId === userId).length;

  return {
    followers,
    following
  };
}
