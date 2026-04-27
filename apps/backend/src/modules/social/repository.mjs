import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp, getFirebaseDataConnect } from "../../../../../packages/config/src/index.mjs";
import {
  connectorConfig as socialConnectorConfig,
  createComment as createCommentMutation,
  createFollow as createFollowMutation,
  createPostMedia as createPostMediaMutation,
  createReaction as createReactionMutation,
  createStory as createStoryMutation,
  createStoryReaction as createStoryReactionMutation,
  getFollowByKey as getFollowByKeyQuery,
  getReactionByKey as getReactionByKeyQuery,
  getStoryById as getStoryByIdQuery,
  getStoryReactionByKey as getStoryReactionByKeyQuery,
  listCommentsByPost as listCommentsByPostQuery,
  listCommentsByTenant as listCommentsByTenantQuery,
  listFollowersByUser as listFollowersByUserQuery,
  listFollowingByUser as listFollowingByUserQuery,
  listReactionsByPost as listReactionsByPostQuery,
  listReactionsByTenant as listReactionsByTenantQuery,
  listStoriesByTenant as listStoriesByTenantQuery,
  listStoryReactionsByStory as listStoryReactionsByStoryQuery,
  listStoryReactionsByTenant as listStoryReactionsByTenantQuery,
  softDeleteFollow as softDeleteFollowMutation,
  softDeletePost as softDeletePostMutation,
  updateReaction as updateReactionMutation,
  updateStoryReaction as updateStoryReactionMutation
} from "../../../../../packages/dataconnect/social-admin-sdk/esm/index.esm.js";
import { listProfilesByTenant } from "../identity/profile-repository.mjs";

const directoryName = path.dirname(fileURLToPath(import.meta.url));
const fallbackStorePath = path.resolve(directoryName, "../../data/social-store.json");
const superAdminStorePath = path.resolve(directoryName, "../../data/super-admin-store.json");
const TENANT_SCAN_LIMIT = 5000;
const FEED_SCAN_MULTIPLIER = 4;
const INACTIVE_COMMENT_REACTION_TYPE = "__inactive__";
const ANONYMOUS_AUTHOR_USERNAME = "anonymous";
const ANONYMOUS_AUTHOR_DISPLAY_NAME = "Anonymous";

const defaultFallbackStore = {
  posts: [],
  comments: [],
  commentReactions: [],
  reactions: [],
  stories: [],
  follows: []
};

let fallbackStoreCache = null;
let fallbackWriteQueue = Promise.resolve();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readSuperAdminStore() {
  try {
    const raw = await readFile(superAdminStorePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getPostAuthorUserId(item) {
  return item.authorUserId ?? item.userId ?? item.membershipId ?? null;
}

function isBlockedByAdminControls(item, adminStore, viewerUserId = null) {
  if (adminStore?.hiddenPosts?.[item.id]) {
    return true;
  }

  const authorUserId = getPostAuthorUserId(item);
  const control = authorUserId ? adminStore?.userControls?.[authorUserId] : null;

  if (!control) {
    return false;
  }

  if (control.status === "suspended" || control.status === "banned") {
    return true;
  }

  return Boolean(control.shadowBanned && viewerUserId !== authorUserId);
}

async function ensureFallbackStore() {
  if (fallbackStoreCache) {
    return fallbackStoreCache;
  }

  await mkdir(path.dirname(fallbackStorePath), { recursive: true });

  try {
    const raw = await readFile(fallbackStorePath, "utf8");
    fallbackStoreCache = JSON.parse(raw);
  } catch {
    fallbackStoreCache = clone(defaultFallbackStore);
    await persistFallbackStore();
  }

  fallbackStoreCache.posts = Array.isArray(fallbackStoreCache.posts) ? fallbackStoreCache.posts : [];
  fallbackStoreCache.comments = Array.isArray(fallbackStoreCache.comments) ? fallbackStoreCache.comments : [];
  fallbackStoreCache.commentReactions = Array.isArray(fallbackStoreCache.commentReactions)
    ? fallbackStoreCache.commentReactions
    : [];
  fallbackStoreCache.reactions = Array.isArray(fallbackStoreCache.reactions) ? fallbackStoreCache.reactions : [];
  fallbackStoreCache.stories = Array.isArray(fallbackStoreCache.stories) ? fallbackStoreCache.stories : [];
  fallbackStoreCache.follows = Array.isArray(fallbackStoreCache.follows) ? fallbackStoreCache.follows : [];

  return fallbackStoreCache;
}

async function persistFallbackStore() {
  if (!fallbackStoreCache) {
    return;
  }

  const snapshot = JSON.stringify(fallbackStoreCache, null, 2);
  fallbackWriteQueue = fallbackWriteQueue.then(() => writeFile(fallbackStorePath, snapshot, "utf8"));
  await fallbackWriteQueue;
}

function isFallbackEligibleError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("oauth2.googleapis.com/token") ||
    message.includes("failed to fetch a valid google oauth2 access token") ||
    message.includes("connect eacces") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("fetch failed") ||
    message.includes("unrecognized operation query.") ||
    message.includes("unrecognized operation mutation.")
  );
}

function isMissingPostSaveOperationError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("unrecognized operation query.postsaves");
}

function normalizeFallbackPostRecord(item) {
  return {
    id: item.id,
    tenantId: item.tenantId,
    communityId: item.communityId ?? null,
    membershipId: item.membershipId,
    authorUserId: item.authorUserId ?? item.userId ?? item.membershipId ?? item.id,
    authorUsername: item.authorUsername ?? "vyb_user",
    authorName: item.authorName ?? "Vyb Student",
    authorEmail: item.authorEmail ?? null,
    isAnonymous: Boolean(item.isAnonymous),
    placement: item.placement ?? "feed",
    kind: item.kind ?? (item.mediaUrl ? "image" : "text"),
    mediaUrl: item.mediaUrl ?? null,
    location: item.location ?? null,
    title: item.title ?? "Campus update",
    body: item.body ?? "",
    status: item.status ?? "published",
    reactions: item.reactions ?? 0,
    comments: item.comments ?? 0,
    savedCount: item.savedCount ?? 0,
    isSaved: item.isSaved ?? false,
    viewerReactionType: item.viewerReactionType ?? null,
    createdAt: item.createdAt ?? new Date().toISOString()
  };
}

function normalizeFallbackCommentRecord(item) {
  return {
    id: item.id,
    tenantId: item.tenantId ?? "tenant-demo",
    postId: item.postId,
    membershipId: item.membershipId ?? item.authorUserId ?? item.id,
    authorUserId: item.authorUserId ?? item.membershipId ?? item.id,
    parentCommentId: item.parentCommentId ?? null,
    body: item.body ?? "",
    mediaUrl: item.mediaUrl ?? null,
    mediaType: item.mediaType ?? null,
    status: item.status ?? "published",
    createdAt: item.createdAt ?? new Date().toISOString()
  };
}

function normalizeFallbackCommentReactionRecord(item) {
  return {
    id: item.id,
    commentId: item.commentId,
    membershipId: item.membershipId,
    reactionType: item.reactionType ?? "like",
    createdAt: item.createdAt ?? new Date().toISOString(),
    updatedAt: item.updatedAt ?? item.createdAt ?? new Date().toISOString()
  };
}

function normalizeFallbackReactionRecord(item) {
  return {
    id: item.id,
    postId: item.postId,
    membershipId: item.membershipId,
    reactionType: item.reactionType ?? "like",
    createdAt: item.createdAt ?? new Date().toISOString(),
    updatedAt: item.updatedAt ?? item.createdAt ?? new Date().toISOString(),
    deletedAt: item.deletedAt ?? null
  };
}

function normalizeFallbackFollowRecord(item) {
  return {
    id: item.id,
    tenantId: item.tenantId ?? "tenant-demo",
    followerUserId: item.followerUserId,
    followingUserId: item.followingUserId,
    createdAt: item.createdAt ?? new Date().toISOString(),
    updatedAt: item.updatedAt ?? item.createdAt ?? new Date().toISOString(),
    deletedAt: item.deletedAt ?? null
  };
}

const EXTENDED_COMMENT_FIELDS = `
  id
  postId
  membershipId
  authorUserId
  parentCommentId
  body
  mediaUrl
  mediaType
  mediaMimeType
  mediaSizeBytes
  status
  createdAt
`;

const LIST_COMMENTS_BY_POST_EXTENDED_QUERY = `
  query ListCommentsByPostExtended($postId: UUID!, $limit: Int!) {
    comments(
      where: { postId: { eq: $postId }, deletedAt: { isNull: true } }
      orderBy: [{ createdAt: ASC }]
      limit: $limit
    ) {
      ${EXTENDED_COMMENT_FIELDS}
    }
  }
`;

const GET_COMMENT_BY_ID_QUERY = `
  query GetCommentById($id: UUID!) {
    comment(key: { id: $id }) {
      ${EXTENDED_COMMENT_FIELDS}
      tenantId
    }
  }
`;

const LIST_COMMENT_REACTIONS_BY_TENANT_QUERY = `
  query ListCommentReactionsByTenant($tenantId: UUID!, $limit: Int!) {
    commentReactions(
      where: { comment: { tenantId: { eq: $tenantId } }, deletedAt: { isNull: true } }
      orderBy: [{ createdAt: DESC }]
      limit: $limit
    ) {
      id
      commentId
      membershipId
      reactionType
      createdAt
      updatedAt
    }
  }
`;

const LIST_COMMENT_REACTIONS_BY_COMMENT_QUERY = `
  query ListCommentReactionsByComment($commentId: UUID!, $limit: Int!) {
    commentReactions(
      where: { commentId: { eq: $commentId }, deletedAt: { isNull: true } }
      orderBy: [{ createdAt: DESC }]
      limit: $limit
    ) {
      id
      commentId
      membershipId
      reactionType
      createdAt
      updatedAt
    }
  }
`;

const GET_COMMENT_REACTION_BY_KEY_QUERY = `
  query GetCommentReactionByKey($commentReactionKey: String!) {
    commentReactions(
      where: { commentReactionKey: { eq: $commentReactionKey }, deletedAt: { isNull: true } }
      limit: 1
    ) {
      id
      commentId
      membershipId
      reactionType
      createdAt
      updatedAt
    }
  }
`;

const CREATE_COMMENT_EXTENDED_MUTATION = `
  mutation CreateCommentExtended(
    $id: UUID!
    $tenantId: UUID!
    $postId: UUID!
    $membershipId: UUID!
    $authorUserId: UUID!
    $parentCommentId: UUID
    $body: String!
    $mediaUrl: String
    $mediaType: String
    $mediaMimeType: String
    $mediaSizeBytes: Int64
  ) {
    comment_insert(
      data: {
        id: $id
        tenantId: $tenantId
        postId: $postId
        membershipId: $membershipId
        authorUserId: $authorUserId
        parentCommentId: $parentCommentId
        body: $body
        mediaUrl: $mediaUrl
        mediaType: $mediaType
        mediaMimeType: $mediaMimeType
        mediaSizeBytes: $mediaSizeBytes
        status: "published"
        createdAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const CREATE_COMMENT_REACTION_MUTATION = `
  mutation CreateCommentReaction(
    $id: UUID!
    $commentReactionKey: String!
    $commentId: UUID!
    $membershipId: UUID!
    $reactionType: String!
  ) {
    commentReaction_insert(
      data: {
        id: $id
        commentReactionKey: $commentReactionKey
        commentId: $commentId
        membershipId: $membershipId
        reactionType: $reactionType
        createdAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const UPDATE_COMMENT_REACTION_MUTATION = `
  mutation UpdateCommentReaction($id: UUID!, $reactionType: String!) {
    commentReaction_update(
      key: { id: $id }
      data: {
        reactionType: $reactionType
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const PRIVATE_POST_FIELDS = `
  id
  tenantId
  communityId
  membershipId
  authorUserId
  authorUsername
  authorName
  authorEmail
  isAnonymous
  placement
  kind
  title
  body
  mediaUrl
  storagePath
  mediaMimeType
  mediaSizeBytes
  location
  status
  createdAt
`;

const LIST_POSTS_BY_TENANT_PRIVATE_QUERY = `
  query ListPostsByTenantPrivate($tenantId: UUID!, $placement: String!, $limit: Int!) {
    posts(
      where: {
        tenantId: { eq: $tenantId }
        placement: { eq: $placement }
        status: { eq: "published" }
        deletedAt: { isNull: true }
      }
      orderBy: [{ createdAt: DESC }]
      limit: $limit
    ) {
      ${PRIVATE_POST_FIELDS}
    }
  }
`;

const LIST_POSTS_BY_AUTHOR_PRIVATE_QUERY = `
  query ListPostsByAuthorPrivate($tenantId: UUID!, $authorUserId: UUID!, $placement: String!, $limit: Int!) {
    posts(
      where: {
        tenantId: { eq: $tenantId }
        authorUserId: { eq: $authorUserId }
        placement: { eq: $placement }
        status: { eq: "published" }
        deletedAt: { isNull: true }
      }
      orderBy: [{ createdAt: DESC }]
      limit: $limit
    ) {
      ${PRIVATE_POST_FIELDS}
    }
  }
`;

const GET_POST_BY_ID_PRIVATE_QUERY = `
  query GetPostByIdPrivate($id: UUID!) {
    post(key: { id: $id }) {
      ${PRIVATE_POST_FIELDS}
    }
  }
`;

const CREATE_POST_PRIVATE_MUTATION = `
  mutation CreatePostPrivate(
    $id: UUID!
    $tenantId: UUID!
    $communityId: UUID
    $membershipId: UUID!
    $authorUserId: UUID
    $authorUsername: String! = "vyb_user"
    $authorName: String! = "Vyb Student"
    $authorEmail: String
    $isAnonymous: Boolean!
    $placement: String! = "feed"
    $kind: String!
    $title: String
    $body: String!
    $mediaUrl: String
    $storagePath: String
    $mediaMimeType: String
    $mediaSizeBytes: Int64
    $location: String
    $status: String!
  ) {
    post_insert(
      data: {
        id: $id
        tenantId: $tenantId
        communityId: $communityId
        membershipId: $membershipId
        authorUserId: $authorUserId
        authorUsername: $authorUsername
        authorName: $authorName
        authorEmail: $authorEmail
        isAnonymous: $isAnonymous
        placement: $placement
        kind: $kind
        title: $title
        body: $body
        mediaUrl: $mediaUrl
        storagePath: $storagePath
        mediaMimeType: $mediaMimeType
        mediaSizeBytes: $mediaSizeBytes
        location: $location
        status: $status
        visibility: "tenant"
        publishedAt_expr: "request.time"
        createdAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const SOFT_DELETE_COMMENT_MUTATION = `
  mutation SoftDeleteComment($id: UUID!) {
    comment_update(
      key: { id: $id }
      data: {
        status: "removed"
        deletedAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const LIST_STORY_VIEWS_BY_TENANT_QUERY = `
  query ListStoryViewsByTenant($tenantId: UUID!, $limit: Int!) {
    storyViews(
      where: { story: { tenantId: { eq: $tenantId } }, deletedAt: { isNull: true } }
      orderBy: [{ createdAt: DESC }]
      limit: $limit
    ) {
      id
      storyId
      membershipId
      seenAt
      createdAt
      updatedAt
    }
  }
`;

const GET_STORY_VIEW_BY_KEY_QUERY = `
  query GetStoryViewByKey($storyViewKey: String!) {
    storyViews(where: { storyViewKey: { eq: $storyViewKey }, deletedAt: { isNull: true } }, limit: 1) {
      id
      storyId
      membershipId
      seenAt
      createdAt
      updatedAt
    }
  }
`;

const CREATE_STORY_VIEW_MUTATION = `
  mutation CreateStoryView(
    $id: UUID!
    $storyViewKey: String!
    $storyId: UUID!
    $membershipId: UUID!
  ) {
    storyView_insert(
      data: {
        id: $id
        storyViewKey: $storyViewKey
        storyId: $storyId
        membershipId: $membershipId
        seenAt_expr: "request.time"
        createdAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const UPDATE_POST_MUTATION = `
  mutation UpdatePost($id: UUID!, $title: String, $body: String!, $location: String) {
    post_update(
      key: { id: $id }
      data: {
        title: $title
        body: $body
        location: $location
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

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

function parsePostCursor(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(value.trim(), "base64url").toString("utf8"));
    const createdAtMs = new Date(decoded.createdAt).getTime();
    if (!Number.isFinite(createdAtMs) || typeof decoded.id !== "string") {
      return null;
    }

    return {
      createdAtMs,
      id: decoded.id
    };
  } catch {
    return null;
  }
}

function isBeforePostCursor(item, cursor) {
  if (!cursor) {
    return true;
  }

  const createdAtMs = new Date(item.createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }

  if (createdAtMs !== cursor.createdAtMs) {
    return createdAtMs < cursor.createdAtMs;
  }

  return String(item.id) < cursor.id;
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

function buildCommentReactionKey(commentId, membershipId) {
  return `${commentId}:${membershipId}`;
}

function buildStoryViewKey(storyId, membershipId) {
  return `${storyId}:${membershipId}`;
}

function buildAnonymousAuthor() {
  return {
    userId: null,
    username: ANONYMOUS_AUTHOR_USERNAME,
    displayName: ANONYMOUS_AUTHOR_DISPLAY_NAME,
    avatarUrl: null,
    isAnonymous: true
  };
}

function isViewerManagingPost(item, { viewerUserId = null, viewerMembershipId = null } = {}) {
  return Boolean(
    (viewerUserId && item.authorUserId === viewerUserId) ||
      (viewerMembershipId && item.membershipId === viewerMembershipId)
  );
}

async function buildProfileByUserIdMap(tenantId, userIds) {
  const normalizedUserIds = Array.from(
    new Set(userIds.filter((value) => typeof value === "string" && value.trim().length > 0))
  );
  if (!tenantId || normalizedUserIds.length === 0) {
    return new Map();
  }

  const userIdSet = new Set(normalizedUserIds);
  const profiles = await listProfilesByTenant(tenantId);
  return new Map(
    profiles
      .filter((profile) => userIdSet.has(profile.userId))
      .map((profile) => [profile.userId, profile])
  );
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
  try {
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
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    const store = await ensureFallbackStore();
    const idSet = new Set(postIds);
    const comments = new Map();
    const reactions = new Map();
    const viewerReactions = new Map();

    for (const item of store.comments.map(normalizeFallbackCommentRecord)) {
      if (item.status === "removed" || !idSet.has(item.postId)) {
        continue;
      }
      comments.set(item.postId, Number(comments.get(item.postId) ?? 0) + 1);
    }

    for (const item of store.reactions.map(normalizeFallbackReactionRecord)) {
      if (item.deletedAt || !idSet.has(item.postId)) {
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

async function buildCommentReactionMaps(tenantId, commentIds, viewerMembershipId = null) {
  try {
    const response = await getSocialDc().executeGraphqlRead(LIST_COMMENT_REACTIONS_BY_TENANT_QUERY, {
      operationName: "ListCommentReactionsByTenant",
      variables: {
        tenantId,
        limit: TENANT_SCAN_LIMIT
      }
    });

    const idSet = new Set(commentIds);
    const reactions = new Map();
    const viewerReactions = new Map();

    for (const item of response.data.commentReactions ?? []) {
      if ((item.reactionType ?? "like") === INACTIVE_COMMENT_REACTION_TYPE) {
        continue;
      }

      if (!idSet.has(item.commentId)) {
        continue;
      }

      reactions.set(item.commentId, Number(reactions.get(item.commentId) ?? 0) + 1);

      if (viewerMembershipId && item.membershipId === viewerMembershipId && !viewerReactions.has(item.commentId)) {
        viewerReactions.set(item.commentId, item.reactionType ?? "like");
      }
    }

    return {
      reactions,
      viewerReactions
    };
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    const store = await ensureFallbackStore();
    const idSet = new Set(commentIds);
    const reactions = new Map();
    const viewerReactions = new Map();

    for (const item of store.commentReactions.map(normalizeFallbackCommentReactionRecord)) {
      if ((item.reactionType ?? "like") === INACTIVE_COMMENT_REACTION_TYPE || !idSet.has(item.commentId)) {
        continue;
      }

      reactions.set(item.commentId, Number(reactions.get(item.commentId) ?? 0) + 1);

      if (viewerMembershipId && item.membershipId === viewerMembershipId && !viewerReactions.has(item.commentId)) {
        viewerReactions.set(item.commentId, item.reactionType ?? "like");
      }
    }

    return {
      reactions,
      viewerReactions
    };
  }
}

async function buildStoryViewMaps(tenantId, storyIds, viewerMembershipId = null) {
  const response = await getSocialDc().executeGraphqlRead(LIST_STORY_VIEWS_BY_TENANT_QUERY, {
    operationName: "ListStoryViewsByTenant",
    variables: {
      tenantId,
      limit: TENANT_SCAN_LIMIT
    }
  });

  const idSet = new Set(storyIds);
  const viewerSeen = new Map();

  for (const item of response.data.storyViews ?? []) {
    if (!idSet.has(item.storyId)) {
      continue;
    }

    if (viewerMembershipId && item.membershipId === viewerMembershipId && !viewerSeen.has(item.storyId)) {
      viewerSeen.set(item.storyId, true);
    }
  }

  return {
    viewerSeen
  };
}

async function countStoryReactionsByStory(storyId) {
  const response = await listStoryReactionsByStoryQuery(getSocialDc(), {
    storyId,
    limit: TENANT_SCAN_LIMIT
  });

  return response.data.storyReactions.length;
}

async function countCommentReactionsByComment(commentId) {
  try {
    const response = await getSocialDc().executeGraphqlRead(LIST_COMMENT_REACTIONS_BY_COMMENT_QUERY, {
      operationName: "ListCommentReactionsByComment",
      variables: {
        commentId,
        limit: TENANT_SCAN_LIMIT
      }
    });

    return response.data.commentReactions.filter(
      (item) => (item.reactionType ?? "like") !== INACTIVE_COMMENT_REACTION_TYPE
    ).length;
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    const store = await ensureFallbackStore();
    return store.commentReactions
      .map(normalizeFallbackCommentReactionRecord)
      .filter((item) => item.commentId === commentId)
      .filter((item) => (item.reactionType ?? "like") !== INACTIVE_COMMENT_REACTION_TYPE).length;
  }
}

function mapPostRecord(item, counts = null, profileMap = null, viewerIdentity = null) {
  const profile = profileMap?.get(item.authorUserId) ?? null;
  const mediaKind = item.kind === "video" ? "video" : "image";
  const isAnonymous = Boolean(item.isAnonymous);
  const viewerCanManage = isViewerManagingPost(item, viewerIdentity ?? {});
  const author = isAnonymous
    ? buildAnonymousAuthor()
    : {
        userId: item.authorUserId,
        username: profile?.username ?? item.authorUsername ?? "vyb_user",
        displayName: profile?.fullName ?? item.authorName ?? "Vyb Student",
        avatarUrl: profile?.avatarUrl ?? null,
        isAnonymous: false
      };

  return {
    id: item.id,
    tenantId: item.tenantId,
    communityId: item.communityId ?? null,
    userId: isAnonymous ? null : item.authorUserId,
    membershipId: isAnonymous ? null : item.membershipId,
    placement: normalizePlacement(item.placement),
    kind: item.kind ?? "text",
    mediaUrl: item.mediaUrl ?? null,
    media:
      Array.isArray(item.media) && item.media.length > 0
        ? item.media
        : item.mediaUrl
          ? [{ url: item.mediaUrl, kind: mediaKind }]
          : [],
    location: item.location ?? null,
    title: item.title ?? "Campus update",
    body: item.body ?? "",
    status: item.status ?? "published",
    reactions: Number(counts?.reactions?.get(item.id) ?? item.reactions ?? 0),
    comments: Number(counts?.comments?.get(item.id) ?? item.comments ?? 0),
    savedCount: Number(item.savedCount ?? 0),
    isSaved: Boolean(item.isSaved),
    isAnonymous,
    viewerCanManage,
    viewerReactionType: counts?.viewerReactions?.get(item.id) ?? item.viewerReactionType ?? null,
    createdAt: toIsoString(item.createdAt),
    author
  };
}

function mapCommentRecord(item, reactionMaps = null) {
  return {
    id: item.id,
    postId: item.postId,
    membershipId: item.membershipId,
    authorUserId: item.authorUserId,
    parentCommentId: item.parentCommentId ?? null,
    body: item.body,
    mediaUrl: item.mediaUrl ?? null,
    mediaType: item.mediaType ?? null,
    createdAt: toIsoString(item.createdAt),
    reactions: Number(reactionMaps?.reactions?.get(item.id) ?? 0),
    viewerHasLiked: Boolean(reactionMaps?.viewerReactions?.get(item.id)),
    author: null
  };
}

function mapStoryRecord(item, viewerUserId = null, reactionMaps = null, viewMaps = null, profileMap = null) {
  const profile = profileMap?.get(item.userId) ?? null;
  return {
    id: item.id,
    tenantId: item.tenantId,
    userId: item.userId,
    username: profile?.username ?? item.username,
    displayName: profile?.fullName ?? item.displayName,
    avatarUrl: profile?.avatarUrl ?? null,
    mediaType: item.mediaType,
    mediaUrl: item.mediaUrl,
    caption: item.caption ?? "",
    createdAt: toIsoString(item.createdAt),
    expiresAt: toIsoString(item.expiresAt),
    isOwn: item.userId === viewerUserId,
    reactions: Number(reactionMaps?.reactions?.get(item.id) ?? 0),
    viewerHasLiked: Boolean(reactionMaps?.viewerReactions?.get(item.id)),
    viewerHasSeen: Boolean(viewMaps?.viewerSeen?.get(item.id))
  };
}

async function mapPostList(records, viewerIdentity = null, profileMap = null) {
  if (records.length === 0) {
    return [];
  }

  const counts = await buildPostCountMaps(
    records[0].tenantId,
    records.map((item) => item.id),
    viewerIdentity?.viewerMembershipId ?? null
  );

  return records.map((item) => mapPostRecord(item, counts, profileMap, viewerIdentity));
}

async function listFallbackPosts({
  tenantId,
  communityId = null,
  limit,
  placement = "feed",
  userId = null,
  cursor = null,
  includeAnonymous = true,
  viewerIdentity = null
}) {
  const store = await ensureFallbackStore();
  const adminStore = await readSuperAdminStore();
  const normalizedPlacement = normalizePlacement(placement);
  const parsedCursor = parsePostCursor(cursor);

  return store.posts
    .map(normalizeFallbackPostRecord)
    .filter((item) => item.tenantId === tenantId)
    .filter((item) => item.status === "published")
    .filter((item) => normalizePlacement(item.placement) === normalizedPlacement)
    .filter((item) => !isBlockedByAdminControls(item, adminStore, viewerIdentity?.viewerUserId ?? null))
    .filter((item) => (communityId ? item.communityId === communityId : true))
    .filter((item) => (userId ? item.authorUserId === userId : true))
    .filter((item) => (includeAnonymous ? true : !item.isAnonymous))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .filter((item) => isBeforePostCursor(item, parsedCursor))
    .slice(0, limit)
    .map((item) => mapPostRecord(item, null, null, viewerIdentity));
}

async function findFallbackPostRecordById(postId, tenantId = null) {
  const store = await ensureFallbackStore();
  return (
    store.posts
      .map(normalizeFallbackPostRecord)
      .find((item) => item.id === postId && item.status !== "removed" && (!tenantId || item.tenantId === tenantId)) ?? null
  );
}

async function listFallbackCommentsByPost({ tenantId, postId, limit = 50, viewerMembershipId = null }) {
  const store = await ensureFallbackStore();
  const comments = store.comments
    .map(normalizeFallbackCommentRecord)
    .filter((item) => item.postId === postId)
    .filter((item) => item.status !== "removed")
    .filter((item) => (!tenantId ? true : item.tenantId === tenantId))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .slice(0, limit);

  const reactionMaps = comments.length ? await buildCommentReactionMaps(tenantId, comments.map((item) => item.id), viewerMembershipId) : null;
  return comments.map((item) => mapCommentRecord(item, reactionMaps));
}

async function findFallbackCommentRecordById(commentId, tenantId = null) {
  const store = await ensureFallbackStore();
  return (
    store.comments
      .map(normalizeFallbackCommentRecord)
      .find((item) => item.id === commentId && item.status !== "removed" && (!tenantId || item.tenantId === tenantId)) ?? null
  );
}

export async function listPosts({
  tenantId,
  communityId = null,
  limit,
  placement = "feed",
  userId = null,
  viewerMembershipId = null,
  viewerUserId = null,
  cursor = null,
  includeAnonymous = userId ? false : true
}) {
  const normalizedPlacement = normalizePlacement(placement);
  const parsedCursor = parsePostCursor(cursor);
  const cursorScanLimit = parsedCursor ? Math.min(TENANT_SCAN_LIMIT, Math.max(limit * FEED_SCAN_MULTIPLIER, limit + 1)) : limit;
  const effectiveLimit = communityId || parsedCursor ? Math.max(cursorScanLimit * FEED_SCAN_MULTIPLIER, cursorScanLimit) : cursorScanLimit;
  const viewerIdentity = {
    viewerMembershipId,
    viewerUserId
  };

  try {
    const response = await getSocialDc().executeGraphqlRead(
      userId ? LIST_POSTS_BY_AUTHOR_PRIVATE_QUERY : LIST_POSTS_BY_TENANT_PRIVATE_QUERY,
      {
        operationName: userId ? "ListPostsByAuthorPrivate" : "ListPostsByTenantPrivate",
        variables: userId
          ? {
              tenantId,
              authorUserId: userId,
              placement: normalizedPlacement,
              limit: effectiveLimit
            }
          : {
              tenantId,
              placement: normalizedPlacement,
              limit: effectiveLimit
            }
      }
    );

    const adminStore = await readSuperAdminStore();
    const filtered = response.data.posts
      .filter((item) => (communityId ? item.communityId === communityId : true))
      .filter((item) => !isBlockedByAdminControls(item, adminStore, viewerUserId))
      .filter((item) => (includeAnonymous ? true : !item.isAnonymous))
      .filter((item) => isBeforePostCursor(item, parsedCursor))
      .slice(0, limit);

    if (filtered.length === 0) {
      return listFallbackPosts({
        tenantId,
        communityId,
        limit,
        placement: normalizedPlacement,
        userId,
        includeAnonymous,
        viewerIdentity
      });
    }

    const profileMap = await buildProfileByUserIdMap(
      tenantId,
      filtered.filter((item) => !item.isAnonymous).map((item) => item.authorUserId)
    );

    return mapPostList(filtered, viewerIdentity, profileMap);
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    console.warn("[social/repository] listPosts falling back to local social store", {
      tenantId,
      placement: normalizedPlacement,
      communityId,
      userId,
      cursor: cursor ?? null,
      message: error instanceof Error ? error.message : String(error)
    });

    return listFallbackPosts({
      tenantId,
      communityId,
      limit,
      placement: normalizedPlacement,
      userId,
      cursor,
      includeAnonymous,
      viewerIdentity
    });
  }
}

export async function listPostsByUser({
  tenantId,
  userId,
  limit = 24,
  placement = "feed",
  viewerMembershipId = null,
  viewerUserId = null,
  includeAnonymous = false
}) {
  return listPosts({ tenantId, userId, limit, placement, viewerMembershipId, viewerUserId, includeAnonymous });
}

export async function countPostsByUser({ tenantId, userId, placement = "feed", includeAnonymous = false }) {
  try {
    const response = await getSocialDc().executeGraphqlRead(LIST_POSTS_BY_AUTHOR_PRIVATE_QUERY, {
      operationName: "ListPostsByAuthorPrivate",
      variables: {
        tenantId,
        authorUserId: userId,
        placement: normalizePlacement(placement),
        limit: TENANT_SCAN_LIMIT
      }
    });

    const adminStore = await readSuperAdminStore();
    return response.data.posts
      .filter((item) => !isBlockedByAdminControls(item, adminStore, userId))
      .filter((item) => (includeAnonymous ? true : !item.isAnonymous)).length;
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    const items = await listFallbackPosts({
      tenantId,
      userId,
      placement,
      limit: TENANT_SCAN_LIMIT,
      includeAnonymous
    });
    return items.length;
  }
}

export async function findPostRecordById(postId, { tenantId = null } = {}) {
  try {
    const response = await getSocialDc().executeGraphqlRead(GET_POST_BY_ID_PRIVATE_QUERY, {
      operationName: "GetPostByIdPrivate",
      variables: {
        id: postId
      }
    });
    const item = response.data.post;
    if (!item || item.status === "removed" || (tenantId && item.tenantId !== tenantId)) {
      return await findFallbackPostRecordById(postId, tenantId);
    }
    return item;
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    return await findFallbackPostRecordById(postId, tenantId);
  }
}

export async function findPostById(postId, { tenantId = null, viewerMembershipId = null, viewerUserId = null } = {}) {
  const item = await findPostRecordById(postId, { tenantId });
  if (!item) {
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

  const profileMap = item.isAnonymous ? new Map() : await buildProfileByUserIdMap(item.tenantId, [item.authorUserId]);
  return mapPostRecord(item, counts, profileMap, {
    viewerMembershipId,
    viewerUserId
  });
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

  const postRecord = {
    id,
    tenantId: payload.tenantId,
    communityId: payload.communityId ?? null,
    authorUserId: payload.userId,
    userId: payload.userId,
    membershipId: payload.membershipId,
    authorUsername: payload.authorUsername,
    authorName: payload.authorName,
    authorEmail: payload.authorEmail ?? null,
    isAnonymous: Boolean(payload.isAnonymous),
    placement,
    kind: payload.kind,
    mediaUrl: media.mediaUrl,
    media: payload.mediaAssets ?? null,
    storagePath: media.storagePath,
    mediaMimeType: media.mediaMimeType,
    mediaSizeBytes: media.mediaSizeBytes,
    location: payload.location ?? null,
    title: payload.title ?? "Campus update",
    body: payload.body,
    status: "published",
    reactions: 0,
    comments: 0,
    savedCount: 0,
    isSaved: false,
    createdAt: new Date().toISOString()
  };

  let wroteFallbackPost = false;

  try {
    await getSocialDc().executeGraphql(CREATE_POST_PRIVATE_MUTATION, {
      operationName: "CreatePostPrivate",
      variables: {
        id,
        tenantId: payload.tenantId,
        communityId: payload.communityId ?? null,
        membershipId: payload.membershipId,
        authorUserId: payload.userId,
        authorUsername: payload.authorUsername,
        authorName: payload.authorName,
        authorEmail: payload.authorEmail ?? null,
        isAnonymous: Boolean(payload.isAnonymous),
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
      }
    });
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    console.warn("[social/repository] createPost falling back to local social store", {
      tenantId: payload.tenantId,
      placement,
      message: error instanceof Error ? error.message : String(error)
    });

    const store = await ensureFallbackStore();
    store.posts = [postRecord, ...store.posts.filter((item) => item.id !== id)];
    await persistFallbackStore();
    wroteFallbackPost = true;
  }

  if (!wroteFallbackPost && media.storagePath && media.mediaMimeType && media.mediaSizeBytes !== null) {
    try {
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
    } catch (error) {
      if (!isFallbackEligibleError(error)) {
        throw error;
      }

      console.warn("[social/repository] createPostMedia skipped because the deployed schema is behind", {
        tenantId: payload.tenantId,
        postId: id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return mapPostRecord(
    postRecord,
    null,
    null,
    {
      viewerMembershipId: payload.viewerMembershipId ?? payload.membershipId,
      viewerUserId: payload.viewerUserId ?? payload.userId
    }
  );
}

export async function createComment(payload) {
  const id = randomUUID();
  const media = await persistMediaAsset({
    tenantId: payload.tenantId,
    userId: payload.authorUserId,
    assetId: id,
    assetType: "comments",
    mediaUrl: payload.mediaUrl ?? null,
    mediaType: payload.mediaType === "gif" || payload.mediaType === "sticker" ? "image" : payload.mediaType ?? "image",
    placement: payload.placement ?? "feed",
    storagePathOverride: payload.mediaStoragePath ?? null,
    mediaMimeTypeOverride: payload.mediaMimeType ?? null,
    mediaSizeBytesOverride: payload.mediaSizeBytes ?? null
  });

  try {
    await getSocialDc().executeGraphql(CREATE_COMMENT_EXTENDED_MUTATION, {
      operationName: "CreateCommentExtended",
      variables: {
        id,
        tenantId: payload.tenantId,
        postId: payload.postId,
        membershipId: payload.membershipId,
        authorUserId: payload.authorUserId,
        parentCommentId: payload.parentCommentId ?? null,
        body: payload.body,
        mediaUrl: media.mediaUrl,
        mediaType: payload.mediaType ?? null,
        mediaMimeType: media.mediaMimeType,
        mediaSizeBytes: media.mediaSizeBytes === null ? null : String(media.mediaSizeBytes)
      }
    });
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    const store = await ensureFallbackStore();
    const post = store.posts.find((item) => item.id === payload.postId);
    if (post) {
      post.comments = Number(post.comments ?? 0) + 1;
    }

    store.comments.push({
      id,
      tenantId: payload.tenantId,
      postId: payload.postId,
      membershipId: payload.membershipId,
      authorUserId: payload.authorUserId,
      parentCommentId: payload.parentCommentId ?? null,
      body: payload.body,
      mediaUrl: media.mediaUrl,
      mediaType: payload.mediaType ?? null,
      status: "published",
      createdAt: new Date().toISOString()
    });
    await persistFallbackStore();
  }

  return {
    id,
    postId: payload.postId,
    membershipId: payload.membershipId,
    authorUserId: payload.authorUserId,
    parentCommentId: payload.parentCommentId ?? null,
    body: payload.body,
    mediaUrl: media.mediaUrl,
    mediaType: payload.mediaType ?? null,
    createdAt: new Date().toISOString(),
    reactions: 0,
    viewerHasLiked: false,
    author: null
  };
}

export async function listCommentsByPost({ tenantId, postId, limit = 50, viewerMembershipId = null }) {
  try {
    const response = await getSocialDc().executeGraphqlRead(LIST_COMMENTS_BY_POST_EXTENDED_QUERY, {
      operationName: "ListCommentsByPostExtended",
      variables: {
        postId,
        limit
      }
    });

    const comments = response.data.comments ?? [];
    const reactionMaps = comments.length
      ? await buildCommentReactionMaps(
        tenantId,
        comments.map((item) => item.id),
        viewerMembershipId
      )
      : null;

    return comments.map((item) => mapCommentRecord(item, reactionMaps));
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    return listFallbackCommentsByPost({ tenantId, postId, limit, viewerMembershipId });
  }
}

function collectCommentThreadIds(comments, rootCommentId) {
  const ids = new Set([rootCommentId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const comment of comments) {
      if (comment.parentCommentId && ids.has(comment.parentCommentId) && !ids.has(comment.id)) {
        ids.add(comment.id);
        changed = true;
      }
    }
  }

  return Array.from(ids);
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

export async function listPostReactions({ postId, limit = 100 }) {
  const response = await listReactionsByPostQuery(getSocialDc(), {
    postId,
    limit
  });

  return response.data.reactions.map((item) => ({
    id: item.id,
    postId: item.postId,
    membershipId: item.membershipId,
    reactionType: item.reactionType ?? "like",
    createdAt: toIsoString(item.createdAt)
  }));
}

export async function togglePostSave({ tenantId, postId, userId }) {
  void tenantId;
  void postId;
  void userId;
  throw new Error("Post save support is not deployed in the current Data Connect service yet.");
}

export async function upsertCommentReaction(payload) {
  const commentReactionKey = buildCommentReactionKey(payload.commentId, payload.membershipId);

  try {
    const existing = await getSocialDc().executeGraphqlRead(GET_COMMENT_REACTION_BY_KEY_QUERY, {
      operationName: "GetCommentReactionByKey",
      variables: {
        commentReactionKey
      }
    });
    const current = existing.data.commentReactions?.[0] ?? null;
    const currentReactionType = current?.reactionType ?? null;
    const isRemovingReaction =
      currentReactionType !== null &&
      currentReactionType !== INACTIVE_COMMENT_REACTION_TYPE &&
      currentReactionType === payload.reactionType;
    const nextReactionType = isRemovingReaction ? INACTIVE_COMMENT_REACTION_TYPE : payload.reactionType;

    if (current) {
      await getSocialDc().executeGraphql(UPDATE_COMMENT_REACTION_MUTATION, {
        operationName: "UpdateCommentReaction",
        variables: {
          id: current.id,
          reactionType: nextReactionType
        }
      });
    } else {
      await getSocialDc().executeGraphql(CREATE_COMMENT_REACTION_MUTATION, {
        operationName: "CreateCommentReaction",
        variables: {
          id: randomUUID(),
          commentReactionKey,
          commentId: payload.commentId,
          membershipId: payload.membershipId,
          reactionType: nextReactionType
        }
      });
    }

    return {
      commentId: payload.commentId,
      membershipId: payload.membershipId,
      reactionType: nextReactionType,
      aggregateCount: await countCommentReactionsByComment(payload.commentId),
      active: !isRemovingReaction
    };
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    const store = await ensureFallbackStore();
    const current = store.commentReactions
      .map(normalizeFallbackCommentReactionRecord)
      .find((item) => item.commentId === payload.commentId && item.membershipId === payload.membershipId) ?? null;
    const currentReactionType = current?.reactionType ?? null;
    const isRemovingReaction =
      currentReactionType !== null &&
      currentReactionType !== INACTIVE_COMMENT_REACTION_TYPE &&
      currentReactionType === payload.reactionType;
    const nextReactionType = isRemovingReaction ? INACTIVE_COMMENT_REACTION_TYPE : payload.reactionType;

    if (current) {
      const target = store.commentReactions.find((item) => item.id === current.id);
      if (target) {
        target.reactionType = nextReactionType;
        target.updatedAt = new Date().toISOString();
      }
    } else {
      store.commentReactions.push({
        id: randomUUID(),
        commentId: payload.commentId,
        membershipId: payload.membershipId,
        reactionType: nextReactionType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    await persistFallbackStore();

    return {
      commentId: payload.commentId,
      membershipId: payload.membershipId,
      reactionType: nextReactionType,
      aggregateCount: await countCommentReactionsByComment(payload.commentId),
      active: !isRemovingReaction
    };
  }
}

export async function deleteComment(commentId, { tenantId = null, postId = null } = {}) {
  const relatedComments = postId
    ? await listCommentsByPost({
        tenantId,
        postId,
        limit: 500,
        viewerMembershipId: null
      }).catch(() => [])
    : [];
  const commentIds = relatedComments.length > 0 ? collectCommentThreadIds(relatedComments, commentId) : [commentId];

  try {
    for (const id of commentIds) {
      await getSocialDc().executeGraphql(SOFT_DELETE_COMMENT_MUTATION, {
        operationName: "SoftDeleteComment",
        variables: {
          id
        }
      });
    }
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    const store = await ensureFallbackStore();
    const activeComments = store.comments.map(normalizeFallbackCommentRecord);
    const fallbackIds = postId ? collectCommentThreadIds(activeComments, commentId) : commentIds;
    const idSet = new Set(fallbackIds);

    for (const item of store.comments) {
      if (idSet.has(item.id)) {
        item.status = "removed";
        item.deletedAt = new Date().toISOString();
        item.updatedAt = new Date().toISOString();
      }
    }

    const post = postId ? store.posts.find((item) => item.id === postId) : null;
    if (post) {
      post.comments = Math.max(0, Number(post.comments ?? 0) - idSet.size);
    }

    await persistFallbackStore();

    return {
      commentId,
      postId,
      deleted: true,
      deletedCount: idSet.size
    };
  }

  return {
    commentId,
    postId,
    deleted: true,
    deletedCount: commentIds.length
  };
}

export async function deletePost(postId) {
  await softDeletePostMutation(getSocialDc(), {
    id: postId
  });

  return {
    postId,
    deleted: true
  };
}

export async function findCommentById(commentId, { tenantId = null, viewerMembershipId = null } = {}) {
  try {
    const response = await getSocialDc().executeGraphqlRead(GET_COMMENT_BY_ID_QUERY, {
      operationName: "GetCommentById",
      variables: {
        id: commentId
      }
    });
    const item = response.data.comment;

    if (!item || item.status === "removed" || (tenantId && item.tenantId !== tenantId)) {
      const fallbackItem = await findFallbackCommentRecordById(commentId, tenantId);
      if (!fallbackItem) {
        return null;
      }

      const fallbackReactionMaps = {
        reactions: new Map([[fallbackItem.id, await countCommentReactionsByComment(fallbackItem.id)]]),
        viewerReactions: new Map()
      };

      if (viewerMembershipId) {
        const store = await ensureFallbackStore();
        const current = store.commentReactions
          .map(normalizeFallbackCommentReactionRecord)
          .find((entry) => entry.commentId === fallbackItem.id && entry.membershipId === viewerMembershipId) ?? null;
        if (current && (current.reactionType ?? "like") !== INACTIVE_COMMENT_REACTION_TYPE) {
          fallbackReactionMaps.viewerReactions.set(fallbackItem.id, current.reactionType ?? "like");
        }
      }

      return mapCommentRecord(fallbackItem, fallbackReactionMaps);
    }

    const reactionMaps = {
      reactions: new Map([[item.id, await countCommentReactionsByComment(item.id)]]),
      viewerReactions: new Map()
    };

    if (viewerMembershipId) {
      const existing = await getSocialDc().executeGraphqlRead(GET_COMMENT_REACTION_BY_KEY_QUERY, {
        operationName: "GetCommentReactionByKey",
        variables: {
          commentReactionKey: buildCommentReactionKey(item.id, viewerMembershipId)
        }
      });
      const current = existing.data.commentReactions?.[0] ?? null;
      if (current && (current.reactionType ?? "like") !== INACTIVE_COMMENT_REACTION_TYPE) {
        reactionMaps.viewerReactions.set(item.id, current.reactionType ?? "like");
      }
    }

    return mapCommentRecord(item, reactionMaps);
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    const item = await findFallbackCommentRecordById(commentId, tenantId);
    if (!item) {
      return null;
    }

    const reactionMaps = {
      reactions: new Map([[item.id, await countCommentReactionsByComment(item.id)]]),
      viewerReactions: new Map()
    };

    if (viewerMembershipId) {
      const store = await ensureFallbackStore();
      const current = store.commentReactions
        .map(normalizeFallbackCommentReactionRecord)
        .find((entry) => entry.commentId === item.id && entry.membershipId === viewerMembershipId) ?? null;
      if (current && (current.reactionType ?? "like") !== INACTIVE_COMMENT_REACTION_TYPE) {
        reactionMaps.viewerReactions.set(item.id, current.reactionType ?? "like");
      }
    }

    return mapCommentRecord(item, reactionMaps);
  }
}

export async function updatePost(postId, payload, { tenantId = null, viewerMembershipId = null, viewerUserId = null } = {}) {
  await getSocialDc().executeGraphql(UPDATE_POST_MUTATION, {
    operationName: "UpdatePost",
    variables: {
      id: postId,
      title: payload.title ?? null,
      body: payload.body,
      location: payload.location ?? null
    }
  });

  return findPostById(postId, { tenantId, viewerMembershipId, viewerUserId });
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

  const viewMaps = viewerMembershipId
    ? await buildStoryViewMaps(item.tenantId, [item.id], viewerMembershipId)
    : { viewerSeen: new Map() };

  const profileMap = await buildProfileByUserIdMap(item.tenantId, [item.userId]);
  return mapStoryRecord(item, viewerUserId, reactionMaps, viewMaps, profileMap);
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
  const records = [];

  for (const item of storyResponse.data.stories) {
    if (!isActiveStory(item)) {
      continue;
    }

    if (item.userId !== viewerUserId && !followingIds.has(item.userId)) {
      continue;
    }

    records.push(item);
  }

  if (records.length === 0) {
    return [];
  }

  const reactionMaps = await buildStoryReactionMaps(
    tenantId,
    records.map((item) => item.id),
    viewerMembershipId
  );
  const viewMaps = viewerMembershipId
    ? await buildStoryViewMaps(
      tenantId,
      records.map((item) => item.id),
      viewerMembershipId
    )
    : { viewerSeen: new Map() };

  const profileMap = await buildProfileByUserIdMap(
    tenantId,
    records.map((item) => item.userId)
  );

  return records.map((item) => mapStoryRecord(item, viewerUserId, reactionMaps, viewMaps, profileMap));
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
    viewerHasLiked: false,
    viewerHasSeen: true
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

export async function markStorySeen({ storyId, membershipId }) {
  const storyViewKey = buildStoryViewKey(storyId, membershipId);
  const existing = await getSocialDc().executeGraphqlRead(GET_STORY_VIEW_BY_KEY_QUERY, {
    operationName: "GetStoryViewByKey",
    variables: {
      storyViewKey
    }
  });
  const current = existing.data.storyViews?.[0] ?? null;

  if (!current) {
    await getSocialDc().executeGraphql(CREATE_STORY_VIEW_MUTATION, {
      operationName: "CreateStoryView",
      variables: {
        id: randomUUID(),
        storyViewKey,
        storyId,
        membershipId
      }
    });
  }

  return {
    storyId,
    membershipId,
    viewed: true
  };
}

export async function followUser({ tenantId, followerUserId, followingUserId }) {
  if (followerUserId === followingUserId) {
    return false;
  }

  const followKey = buildFollowKey(followerUserId, followingUserId);
  try {
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
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    const store = await ensureFallbackStore();
    const now = new Date().toISOString();
    const current = store.follows
      .map(normalizeFallbackFollowRecord)
      .find((item) => item.tenantId === tenantId && item.followerUserId === followerUserId && item.followingUserId === followingUserId);

    if (current) {
      const target = store.follows.find((item) => item.id === current.id);
      if (target) {
        target.deletedAt = null;
        target.updatedAt = now;
      }
    } else {
      store.follows.push({
        id: randomUUID(),
        tenantId,
        followerUserId,
        followingUserId,
        createdAt: now,
        updatedAt: now
      });
    }

    await persistFallbackStore();
    return true;
  }
}

export async function unfollowUser({ tenantId, followerUserId, followingUserId }) {
  const followKey = buildFollowKey(followerUserId, followingUserId);
  try {
    const existing = await getFollowByKeyQuery(getSocialDc(), { followKey });
    const current = existing.data.follows[0] ?? null;

    if (!current) {
      return false;
    }

    await softDeleteFollowMutation(getSocialDc(), { id: current.id });
    return true;
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    const store = await ensureFallbackStore();
    const current = store.follows
      .map(normalizeFallbackFollowRecord)
      .find(
        (item) =>
          item.tenantId === tenantId &&
          item.followerUserId === followerUserId &&
          item.followingUserId === followingUserId &&
          !item.deletedAt
      );

    if (!current) {
      return false;
    }

    const target = store.follows.find((item) => item.id === current.id);
    if (target) {
      target.deletedAt = new Date().toISOString();
      target.updatedAt = target.deletedAt;
      await persistFallbackStore();
    }

    return true;
  }
}

export async function isFollowing({ tenantId, followerUserId, followingUserId }) {
  const followKey = buildFollowKey(followerUserId, followingUserId);
  try {
    const existing = await getFollowByKeyQuery(getSocialDc(), { followKey });
    return Boolean(existing.data.follows[0]);
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    const store = await ensureFallbackStore();
    return store.follows
      .map(normalizeFallbackFollowRecord)
      .some(
        (item) =>
          item.tenantId === tenantId &&
          item.followerUserId === followerUserId &&
          item.followingUserId === followingUserId &&
          !item.deletedAt
      );
  }
}

export async function getFollowStats({ tenantId, userId }) {
  try {
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
  } catch (error) {
    if (!isFallbackEligibleError(error)) {
      throw error;
    }

    const store = await ensureFallbackStore();
    const follows = store.follows
      .map(normalizeFallbackFollowRecord)
      .filter((item) => item.tenantId === tenantId && !item.deletedAt);

    return {
      followers: follows.filter((item) => item.followingUserId === userId).length,
      following: follows.filter((item) => item.followerUserId === userId).length
    };
  }
}
