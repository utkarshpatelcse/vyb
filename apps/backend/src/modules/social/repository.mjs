import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp, getFirebaseDataConnect } from "../../../../../packages/config/src/index.mjs";
import {
  connectorConfig as socialConnectorConfig,
  createComment as createCommentMutation,
  createFollow as createFollowMutation,
  createPostMedia as createPostMediaMutation,
  createPost as createPostMutation,
  createReaction as createReactionMutation,
  createStory as createStoryMutation,
  createStoryReaction as createStoryReactionMutation,
  getFollowByKey as getFollowByKeyQuery,
  getPostById as getPostByIdQuery,
  getReactionByKey as getReactionByKeyQuery,
  getStoryById as getStoryByIdQuery,
  getStoryReactionByKey as getStoryReactionByKeyQuery,
  listCommentsByPost as listCommentsByPostQuery,
  listCommentsByTenant as listCommentsByTenantQuery,
  listFeedByTenant as listFeedByTenantQuery,
  listFollowersByUser as listFollowersByUserQuery,
  listFollowingByUser as listFollowingByUserQuery,
  listPostsByAuthor as listPostsByAuthorQuery,
  listReactionsByPost as listReactionsByPostQuery,
  listReactionsByTenant as listReactionsByTenantQuery,
  listStoriesByTenant as listStoriesByTenantQuery,
  listStoryReactionsByStory as listStoryReactionsByStoryQuery,
  listStoryReactionsByTenant as listStoryReactionsByTenantQuery,
  softDeleteFollow as softDeleteFollowMutation,
  updateReaction as updateReactionMutation,
  updateStoryReaction as updateStoryReactionMutation
} from "../../../../../packages/dataconnect/social-admin-sdk/esm/index.esm.js";

const TENANT_SCAN_LIMIT = 5000;
const FEED_SCAN_MULTIPLIER = 4;

function getSocialDc() {
  return getFirebaseDataConnect(socialConnectorConfig);
}

function getFirebaseSocialBucket() {
  return getStorage(getFirebaseAdminApp()).bucket();
}

function normalizePlacement(value) {
  return value === "vibe" ? "vibe" : "feed";
}

function toDate(value) {
  const parsed = new Date(value ?? Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toIsoString(value) {
  return toDate(value).toISOString();
}

function isActiveStory(story) {
  return toDate(story.expiresAt).getTime() > Date.now();
}

function buildDownloadUrl(bucketName, storagePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function buildFollowKey(followerUserId, followingUserId) {
  return `${followerUserId}:${followingUserId}`;
}

function buildReactionKey(postId, membershipId) {
  return `${postId}:${membershipId}`;
}

function buildStoryReactionKey(storyId, membershipId) {
  return `${storyId}:${membershipId}`;
}

function decodeDataUrl(value) {
  if (typeof value !== "string" || !value.startsWith("data:")) {
    return null;
  }

  const commaIndex = value.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Invalid data URL payload.");
  }

  const header = value.slice(5, commaIndex);
  const base64Body = value.slice(commaIndex + 1);
  const [mimeType, ...flags] = header.split(";");

  if (!flags.includes("base64")) {
    throw new Error("Only base64 data URLs are supported.");
  }

  return {
    mimeType: mimeType || "application/octet-stream",
    buffer: Buffer.from(base64Body, "base64")
  };
}

function extensionFromMimeType(mimeType, fallback = "bin") {
  const explicit = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov"
  };

  return explicit[mimeType] ?? mimeType.split("/")[1] ?? fallback;
}

async function persistMediaAsset({
  tenantId,
  userId,
  assetId,
  assetType,
  mediaUrl,
  mediaType,
  placement = "feed",
  storagePathOverride = null,
  mediaMimeTypeOverride = null,
  mediaSizeBytesOverride = null
}) {
  if (!mediaUrl) {
    return {
      mediaUrl: null,
      storagePath: null,
      mediaMimeType: null,
      mediaSizeBytes: null
    };
  }

  const decoded = decodeDataUrl(mediaUrl);
  if (!decoded) {
    return {
      mediaUrl,
      storagePath: storagePathOverride,
      mediaMimeType: mediaMimeTypeOverride,
      mediaSizeBytes: mediaSizeBytesOverride
    };
  }

  const extension = extensionFromMimeType(decoded.mimeType, mediaType === "video" ? "mp4" : "bin");
  const storagePath = `social/${tenantId}/${assetType}/${normalizePlacement(placement)}/${userId}/${assetId}.${extension}`;
  const bucket = getFirebaseSocialBucket();
  const file = bucket.file(storagePath);
  const token = randomUUID();

  await file.save(decoded.buffer, {
    resumable: false,
    metadata: {
      contentType: decoded.mimeType,
      cacheControl: "public, max-age=31536000, immutable",
      metadata: {
        firebaseStorageDownloadTokens: token
      }
    }
  });

  return {
    mediaUrl: buildDownloadUrl(bucket.name, storagePath, token),
    storagePath,
    mediaMimeType: decoded.mimeType,
    mediaSizeBytes: decoded.buffer.byteLength
  };
}

async function buildPostCountMaps(tenantId, postIds, viewerMembershipId = null) {
  const [commentsResponse, reactionsResponse] = await Promise.all([
    listCommentsByTenantQuery(getSocialDc(), {
      tenantId,
      limit: TENANT_SCAN_LIMIT
    }),
    listReactionsByTenantQuery(getSocialDc(), {
      tenantId,
      limit: TENANT_SCAN_LIMIT
    })
  ]);

  const idSet = new Set(postIds);
  const comments = new Map();
  const reactions = new Map();
  const viewerReactions = new Map();

  for (const item of commentsResponse.data.comments) {
    if (!idSet.has(item.postId)) {
      continue;
    }
    comments.set(item.postId, Number(comments.get(item.postId) ?? 0) + 1);
  }

  for (const item of reactionsResponse.data.reactions) {
    if (!idSet.has(item.postId)) {
      continue;
    }
    reactions.set(item.postId, Number(reactions.get(item.postId) ?? 0) + 1);

    if (viewerMembershipId && item.membershipId === viewerMembershipId && !viewerReactions.has(item.postId)) {
      viewerReactions.set(item.postId, item.reactionType ?? "like");
    }
  }

  return {
    comments,
    reactions,
    viewerReactions
  };
}

async function countCommentsByPost(postId) {
  const response = await listCommentsByPostQuery(getSocialDc(), {
    postId,
    limit: TENANT_SCAN_LIMIT
  });

  return response.data.comments.length;
}

async function countReactionsByPost(postId) {
  const response = await listReactionsByPostQuery(getSocialDc(), {
    postId,
    limit: TENANT_SCAN_LIMIT
  });

  return response.data.reactions.length;
}

async function buildStoryReactionMaps(tenantId, storyIds, viewerMembershipId = null) {
  const response = await listStoryReactionsByTenantQuery(getSocialDc(), {
    tenantId,
    limit: TENANT_SCAN_LIMIT
  });

  const idSet = new Set(storyIds);
  const reactions = new Map();
  const viewerReactions = new Map();

  for (const item of response.data.storyReactions) {
    if (!idSet.has(item.storyId)) {
      continue;
    }

    reactions.set(item.storyId, Number(reactions.get(item.storyId) ?? 0) + 1);

    if (viewerMembershipId && item.membershipId === viewerMembershipId && !viewerReactions.has(item.storyId)) {
      viewerReactions.set(item.storyId, item.reactionType ?? "like");
    }
  }

  return {
    reactions,
    viewerReactions
  };
}

async function countStoryReactionsByStory(storyId) {
  const response = await listStoryReactionsByStoryQuery(getSocialDc(), {
    storyId,
    limit: TENANT_SCAN_LIMIT
  });

  return response.data.storyReactions.length;
}

function mapPostRecord(item, counts = null) {
  return {
    id: item.id,
    tenantId: item.tenantId,
    communityId: item.communityId ?? null,
    userId: item.authorUserId,
    membershipId: item.membershipId,
    placement: normalizePlacement(item.placement),
    kind: item.kind ?? "text",
    mediaUrl: item.mediaUrl ?? null,
    location: item.location ?? null,
    title: item.title ?? "Campus update",
    body: item.body ?? "",
    status: item.status ?? "published",
    reactions: Number(counts?.reactions?.get(item.id) ?? 0),
    comments: Number(counts?.comments?.get(item.id) ?? 0),
    viewerReactionType: counts?.viewerReactions?.get(item.id) ?? null,
    createdAt: toIsoString(item.createdAt),
    author: {
      userId: item.authorUserId,
      username: item.authorUsername ?? "vyb_user",
      displayName: item.authorName ?? "Vyb Student"
    }
  };
}

function mapCommentRecord(item) {
  return {
    id: item.id,
    postId: item.postId,
    membershipId: item.membershipId,
    authorUserId: item.authorUserId,
    body: item.body,
    createdAt: toIsoString(item.createdAt),
    author: null
  };
}

function mapStoryRecord(item, viewerUserId = null, reactionMaps = null) {
  return {
    id: item.id,
    tenantId: item.tenantId,
    userId: item.userId,
    username: item.username,
    displayName: item.displayName,
    mediaType: item.mediaType,
    mediaUrl: item.mediaUrl,
    caption: item.caption ?? "",
    createdAt: toIsoString(item.createdAt),
    expiresAt: toIsoString(item.expiresAt),
    isOwn: item.userId === viewerUserId,
    reactions: Number(reactionMaps?.reactions?.get(item.id) ?? 0),
    viewerHasLiked: Boolean(reactionMaps?.viewerReactions?.get(item.id))
  };
}

async function mapPostList(records, viewerMembershipId = null) {
  if (records.length === 0) {
    return [];
  }

  const counts = await buildPostCountMaps(
    records[0].tenantId,
    records.map((item) => item.id),
    viewerMembershipId
  );

  return records.map((item) => mapPostRecord(item, counts));
}

export async function listPosts({
  tenantId,
  communityId = null,
  limit,
  placement = "feed",
  userId = null,
  viewerMembershipId = null
}) {
  const normalizedPlacement = normalizePlacement(placement);
  const effectiveLimit = communityId ? Math.max(limit * FEED_SCAN_MULTIPLIER, limit) : limit;

  const response = userId
    ? await listPostsByAuthorQuery(getSocialDc(), {
        tenantId,
        authorUserId: userId,
        placement: normalizedPlacement,
        limit: effectiveLimit
      })
    : await listFeedByTenantQuery(getSocialDc(), {
        tenantId,
        placement: normalizedPlacement,
        limit: effectiveLimit
      });

  const filtered = response.data.posts
    .filter((item) => (communityId ? item.communityId === communityId : true))
    .slice(0, limit);

  return mapPostList(filtered, viewerMembershipId);
}

export async function listPostsByUser({ tenantId, userId, limit = 24, placement = "feed", viewerMembershipId = null }) {
  return listPosts({ tenantId, userId, limit, placement, viewerMembershipId });
}

export async function countPostsByUser({ tenantId, userId, placement = "feed" }) {
  const response = await listPostsByAuthorQuery(getSocialDc(), {
    tenantId,
    authorUserId: userId,
    placement: normalizePlacement(placement),
    limit: TENANT_SCAN_LIMIT
  });

  return response.data.posts.length;
}

export async function findPostById(postId, { tenantId = null, viewerMembershipId = null } = {}) {
  const response = await getPostByIdQuery(getSocialDc(), { id: postId });
  const item = response.data.post;
  if (!item || item.status === "removed" || (tenantId && item.tenantId !== tenantId)) {
    return null;
  }

  const counts = {
    comments: new Map([[item.id, await countCommentsByPost(item.id)]]),
    reactions: new Map([[item.id, await countReactionsByPost(item.id)]]),
    viewerReactions: new Map()
  };

  if (viewerMembershipId) {
    const existing = await getReactionByKeyQuery(getSocialDc(), {
      reactionKey: buildReactionKey(item.id, viewerMembershipId)
    });
    const current = existing.data.reactions[0] ?? null;
    if (current) {
      counts.viewerReactions.set(item.id, current.reactionType ?? "like");
    }
  }

  return mapPostRecord(item, counts);
}

export async function createPost(payload) {
  const id = randomUUID();
  const placement = normalizePlacement(payload.placement);
  const media = await persistMediaAsset({
    tenantId: payload.tenantId,
    userId: payload.userId,
    assetId: id,
    assetType: "posts",
    mediaUrl: payload.mediaUrl ?? null,
    mediaType: payload.kind,
    placement,
    storagePathOverride: payload.mediaStoragePath ?? null,
    mediaMimeTypeOverride: payload.mediaMimeType ?? null,
    mediaSizeBytesOverride: payload.mediaSizeBytes ?? null
  });

  await createPostMutation(getSocialDc(), {
    id,
    tenantId: payload.tenantId,
    communityId: payload.communityId ?? null,
    membershipId: payload.membershipId,
    authorUserId: payload.userId,
    authorUsername: payload.authorUsername,
    authorName: payload.authorName,
    placement,
    kind: payload.kind,
    title: payload.title ?? "Campus update",
    body: payload.body,
    mediaUrl: media.mediaUrl,
    storagePath: media.storagePath,
    mediaMimeType: media.mediaMimeType,
    mediaSizeBytes: media.mediaSizeBytes === null ? null : String(media.mediaSizeBytes),
    location: payload.location ?? null,
    status: "published"
  });

  if (media.storagePath && media.mediaMimeType && media.mediaSizeBytes !== null) {
    await createPostMediaMutation(getSocialDc(), {
      tenantId: payload.tenantId,
      postId: id,
      storagePath: media.storagePath,
      mediaType: payload.kind,
      mimeType: media.mediaMimeType,
      sizeBytes: String(media.mediaSizeBytes),
      width: null,
      height: null,
      durationMs: null
    });
  }

  return {
    id,
    tenantId: payload.tenantId,
    communityId: payload.communityId ?? null,
    userId: payload.userId,
    membershipId: payload.membershipId,
    placement,
    kind: payload.kind,
    mediaUrl: media.mediaUrl,
    location: payload.location ?? null,
    title: payload.title ?? "Campus update",
    body: payload.body,
    status: "published",
    reactions: 0,
    comments: 0,
    createdAt: new Date().toISOString(),
    author: {
      userId: payload.userId,
      username: payload.authorUsername,
      displayName: payload.authorName
    }
  };
}

export async function createComment(payload) {
  const id = randomUUID();
  await createCommentMutation(getSocialDc(), {
    id,
    tenantId: payload.tenantId,
    postId: payload.postId,
    membershipId: payload.membershipId,
    authorUserId: payload.authorUserId,
    body: payload.body
  });

  return {
    id,
    postId: payload.postId,
    membershipId: payload.membershipId,
    authorUserId: payload.authorUserId,
    body: payload.body,
    createdAt: new Date().toISOString(),
    author: null
  };
}

export async function listCommentsByPost({ postId, limit = 50 }) {
  const response = await listCommentsByPostQuery(getSocialDc(), {
    postId,
    limit
  });

  return response.data.comments.map((item) => mapCommentRecord(item));
}

export async function upsertReaction(payload) {
  const reactionKey = buildReactionKey(payload.postId, payload.membershipId);
  const existing = await getReactionByKeyQuery(getSocialDc(), { reactionKey });
  const current = existing.data.reactions[0] ?? null;

  if (current) {
    await updateReactionMutation(getSocialDc(), {
      id: current.id,
      reactionType: payload.reactionType
    });
  } else {
    await createReactionMutation(getSocialDc(), {
      id: randomUUID(),
      reactionKey,
      postId: payload.postId,
      membershipId: payload.membershipId,
      reactionType: payload.reactionType
    });
  }

  return {
    postId: payload.postId,
    membershipId: payload.membershipId,
    reactionType: payload.reactionType,
    aggregateCount: await countReactionsByPost(payload.postId),
    active: true,
    viewerReactionType: payload.reactionType
  };
}

export async function findStoryById(storyId, { tenantId = null, viewerUserId = null, viewerMembershipId = null } = {}) {
  const response = await getStoryByIdQuery(getSocialDc(), { id: storyId });
  const item = response.data.story;

  if (!item || (tenantId && item.tenantId !== tenantId) || !isActiveStory(item)) {
    return null;
  }

  const reactionMaps = {
    reactions: new Map([[item.id, await countStoryReactionsByStory(item.id)]]),
    viewerReactions: new Map()
  };

  if (viewerMembershipId) {
    const existing = await getStoryReactionByKeyQuery(getSocialDc(), {
      storyReactionKey: buildStoryReactionKey(item.id, viewerMembershipId)
    });
    const current = existing.data.storyReactions[0] ?? null;
    if (current) {
      reactionMaps.viewerReactions.set(item.id, current.reactionType ?? "like");
    }
  }

  return mapStoryRecord(item, viewerUserId, reactionMaps);
}

export async function listStories({ tenantId, viewerUserId, viewerMembershipId = null }) {
  const [storyResponse, followingResponse] = await Promise.all([
    listStoriesByTenantQuery(getSocialDc(), {
      tenantId,
      limit: 200
    }),
    listFollowingByUserQuery(getSocialDc(), {
      tenantId,
      followerUserId: viewerUserId,
      limit: TENANT_SCAN_LIMIT
    })
  ]);

  const followingIds = new Set(followingResponse.data.follows.map((item) => item.followingUserId));
  const latestByUser = new Map();

  for (const item of storyResponse.data.stories) {
    if (!isActiveStory(item)) {
      continue;
    }

    if (item.userId !== viewerUserId && !followingIds.has(item.userId)) {
      continue;
    }

    if (!latestByUser.has(item.userId)) {
      latestByUser.set(item.userId, item);
    }
  }

  const records = Array.from(latestByUser.values());
  if (records.length === 0) {
    return [];
  }

  const reactionMaps = await buildStoryReactionMaps(
    tenantId,
    records.map((item) => item.id),
    viewerMembershipId
  );

  return records.map((item) => mapStoryRecord(item, viewerUserId, reactionMaps));
}

export async function createStory(payload) {
  const id = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
  const media = await persistMediaAsset({
    tenantId: payload.tenantId,
    userId: payload.userId,
    assetId: id,
    assetType: "stories",
    mediaUrl: payload.mediaUrl,
    mediaType: payload.mediaType,
    placement: "feed",
    storagePathOverride: payload.mediaStoragePath ?? null,
    mediaMimeTypeOverride: payload.mediaMimeType ?? null,
    mediaSizeBytesOverride: payload.mediaSizeBytes ?? null
  });

  await createStoryMutation(getSocialDc(), {
    id,
    tenantId: payload.tenantId,
    userId: payload.userId,
    username: payload.username,
    displayName: payload.displayName,
    mediaType: payload.mediaType,
    mediaUrl: media.mediaUrl,
    storagePath: media.storagePath,
    mediaMimeType: media.mediaMimeType,
    mediaSizeBytes: media.mediaSizeBytes === null ? null : String(media.mediaSizeBytes),
    caption: payload.caption ?? "",
    expiresAt: expiresAt.toISOString()
  });

  return {
    id,
    tenantId: payload.tenantId,
    userId: payload.userId,
    username: payload.username,
    displayName: payload.displayName,
    mediaType: payload.mediaType,
    mediaUrl: media.mediaUrl,
    caption: payload.caption ?? "",
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    isOwn: true,
    reactions: 0,
    viewerHasLiked: false
  };
}

export async function upsertStoryReaction(payload) {
  const storyReactionKey = buildStoryReactionKey(payload.storyId, payload.membershipId);
  const existing = await getStoryReactionByKeyQuery(getSocialDc(), { storyReactionKey });
  const current = existing.data.storyReactions[0] ?? null;

  if (current) {
    await updateStoryReactionMutation(getSocialDc(), {
      id: current.id,
      reactionType: payload.reactionType
    });
  } else {
    await createStoryReactionMutation(getSocialDc(), {
      id: randomUUID(),
      storyReactionKey,
      storyId: payload.storyId,
      membershipId: payload.membershipId,
      reactionType: payload.reactionType
    });
  }

  return {
    storyId: payload.storyId,
    membershipId: payload.membershipId,
    reactionType: payload.reactionType,
    aggregateCount: await countStoryReactionsByStory(payload.storyId),
    active: true
  };
}

export async function followUser({ tenantId, followerUserId, followingUserId }) {
  if (followerUserId === followingUserId) {
    return false;
  }

  const followKey = buildFollowKey(followerUserId, followingUserId);
  const existing = await getFollowByKeyQuery(getSocialDc(), { followKey });
  if (existing.data.follows[0]) {
    return true;
  }

  await createFollowMutation(getSocialDc(), {
    id: randomUUID(),
    followKey,
    tenantId,
    followerUserId,
    followingUserId
  });

  return true;
}

export async function unfollowUser({ tenantId, followerUserId, followingUserId }) {
  const followKey = buildFollowKey(followerUserId, followingUserId);
  const existing = await getFollowByKeyQuery(getSocialDc(), { followKey });
  const current = existing.data.follows[0] ?? null;

  if (!current) {
    return false;
  }

  await softDeleteFollowMutation(getSocialDc(), { id: current.id });
  return true;
}

export async function isFollowing({ tenantId: _tenantId, followerUserId, followingUserId }) {
  const followKey = buildFollowKey(followerUserId, followingUserId);
  const existing = await getFollowByKeyQuery(getSocialDc(), { followKey });
  return Boolean(existing.data.follows[0]);
}

export async function getFollowStats({ tenantId, userId }) {
  const [followersResponse, followingResponse] = await Promise.all([
    listFollowersByUserQuery(getSocialDc(), {
      tenantId,
      followingUserId: userId,
      limit: TENANT_SCAN_LIMIT
    }),
    listFollowingByUserQuery(getSocialDc(), {
      tenantId,
      followerUserId: userId,
      limit: TENANT_SCAN_LIMIT
    })
  ]);

  return {
    followers: followersResponse.data.follows.length,
    following: followingResponse.data.follows.length
  };
}
