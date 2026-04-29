import { readJson, sendError, sendJson } from "../../lib/http.mjs";
import {
  getProfileByUsername,
  getProfileByUserId,
  listProfilesByTenant,
  searchProfiles
} from "../identity/profile-repository.mjs";
import { trackActivity } from "../moderation/repository.mjs";
import { resolveLiveContext } from "../shared/viewer-context.mjs";
import { persistSocialMediaAsset } from "./media-storage.mjs";
import { emitSocialRealtimeEvent } from "./realtime-hub.mjs";
import {
  countPostsByUser,
  createComment,
  createPost,
  createStory,
  deleteComment,
  deletePost,
  findCommentById,
  findCommentRecordById,
  findPostById,
  findPostRecordById,
  findStoryById,
  followUser,
  getFollowStats,
  isFollowing,
  listCommentsByPost,
  listPostReactions,
  listPosts,
  listPostsByUser,
  listStories,
  markStorySeen,
  unfollowUser,
  updateComment,
  updatePost,
  upsertCommentReaction,
  upsertReaction,
  upsertStoryReaction
} from "./repository.mjs";

const allowedPostKinds = new Set(["text", "image", "video"]);
const allowedReactionTypes = new Set(["fire", "support", "like", "love", "insight", "funny"]);
const allowedStoryMediaTypes = new Set(["image", "video"]);
const allowedCommentMediaTypes = new Set(["image", "gif", "sticker"]);
const allowedVibeVideoMimeTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_VIBE_VIDEO_BYTES = 40 * 1024 * 1024;

function requireNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeMimeType(value) {
  return typeof value === "string" ? value.split(";")[0]?.trim().toLowerCase() ?? "" : "";
}

function isSafeVibeStoragePath(value, tenantId, userIds) {
  if (!requireNonEmptyString(value)) {
    return false;
  }

  const allowedUserIds = new Set(
    (Array.isArray(userIds) ? userIds : [userIds])
      .filter(requireNonEmptyString)
      .map((userId) => userId.trim())
  );
  const segments = value.split("/").filter(Boolean);
  return (
    segments.length === 6 &&
    segments[0] === "social" &&
    segments[1] === tenantId &&
    segments[2] === "posts" &&
    segments[3] === "vibe" &&
    allowedUserIds.has(segments[4]) &&
    /\.(mp4|webm|mov)$/i.test(segments[5] ?? "")
  );
}

function decodeStorageObjectPath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getLocalMediaObjectPath(mediaUrl) {
  const localPrefix = "/api/social-media/files/";
  let pathname = mediaUrl.split(/[?#]/)[0] ?? "";

  try {
    pathname = new URL(mediaUrl).pathname;
  } catch {
    // Relative local URLs are expected in development fallback mode.
  }

  if (!pathname.startsWith(localPrefix)) {
    return null;
  }

  return decodeStorageObjectPath(pathname.slice(localPrefix.length));
}

function getFirebaseStorageObjectPath(pathname) {
  const objectMarker = "/o/";
  const markerIndex = pathname.indexOf(objectMarker);

  if (markerIndex === -1) {
    return null;
  }

  return decodeStorageObjectPath(pathname.slice(markerIndex + objectMarker.length));
}

function isSafeVibeMediaUrl(value, storagePath) {
  if (!requireNonEmptyString(value) || !requireNonEmptyString(storagePath)) {
    return false;
  }

  const mediaUrl = value.trim();
  const localObjectPath = getLocalMediaObjectPath(mediaUrl);

  if (localObjectPath) {
    return localObjectPath === storagePath;
  }

  try {
    const parsed = new URL(mediaUrl);
    const firebaseObjectPath = getFirebaseStorageObjectPath(parsed.pathname);

    return parsed.hostname === "firebasestorage.googleapis.com" && firebaseObjectPath === storagePath;
  } catch {
    return false;
  }
}

function getVibePostPayloadChecks(payload, tenantId, userIds) {
  const storagePath = requireNonEmptyString(payload.mediaStoragePath) ? payload.mediaStoragePath.trim() : "";
  const mediaMimeType = normalizeMimeType(payload.mediaMimeType);
  const mediaSizeBytes = Number(payload.mediaSizeBytes);

  return {
    vibePlacement: payload.placement === "vibe",
    videoKind: payload.kind === "video",
    safeStoragePath: isSafeVibeStoragePath(storagePath, tenantId, userIds),
    safeMediaUrl: isSafeVibeMediaUrl(payload.mediaUrl, storagePath),
    allowedMimeType: allowedVibeVideoMimeTypes.has(mediaMimeType),
    safeSize: Number.isFinite(mediaSizeBytes) && mediaSizeBytes > 0 && mediaSizeBytes <= MAX_VIBE_VIDEO_BYTES
  };
}

function validateVibePostPayload(payload, tenantId, userIds) {
  const checks = getVibePostPayloadChecks(payload, tenantId, userIds);
  return Object.values(checks).every(Boolean);
}

function parseLimit(value, fallback = 20) {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    return null;
  }
  return parsed;
}

function buildFeedPayload(item) {
  return {
    ...item
  };
}

function buildRealtimeFeedPayload(item) {
  return {
    ...buildFeedPayload(item),
    isSaved: false,
    viewerCanManage: false,
    viewerReactionType: null
  };
}

function buildRealtimeCommentPayload(item) {
  return {
    ...item,
    viewerCanManage: false,
    viewerHasLiked: false
  };
}

function getRealtimeActorMembershipId(resolvedMembershipId, context) {
  return resolvedMembershipId ?? context.actor?.id ?? null;
}

function buildPostCursor(item) {
  if (!item?.createdAt || !item?.id) {
    return null;
  }

  return Buffer.from(
    JSON.stringify({
      createdAt: item.createdAt,
      id: item.id
    }),
    "utf8"
  ).toString("base64url");
}

function isAdminRole(role) {
  return role === "admin";
}

function buildCommentAuthor(profile, authorUserId) {
  if (profile) {
    return {
      userId: profile.userId,
      username: profile.username,
      displayName: profile.fullName,
      avatarUrl: profile.avatarUrl ?? null,
      isAnonymous: false
    };
  }

  if (!authorUserId) {
    return null;
  }

  return {
    userId: authorUserId,
    username: "vyb_user",
    displayName: "Vyb Student",
    avatarUrl: null,
    isAnonymous: false
  };
}

async function enrichCommentItems(tenantId, items) {
  const uniqueUserIds = Array.from(
    new Set(
      items
        .filter((item) => !item.isAnonymous)
        .map((item) => item.authorUserId)
        .filter((value) => typeof value === "string" && value.trim().length > 0)
    )
  );
  const profiles = await Promise.all(
    uniqueUserIds.map(async (userId) => [
      userId,
      await getProfileByUserId({
        tenantId,
        userId
      })
    ])
  );
  const profileMap = new Map(profiles);

  return items.map((item) => ({
    ...item,
    author: item.isAnonymous ? item.author : buildCommentAuthor(profileMap.get(item.authorUserId) ?? null, item.authorUserId)
  }));
}

async function buildReactionMemberItems(tenantId, items) {
  if (items.length === 0) {
    return [];
  }

  const profiles = await listProfilesByTenant(tenantId);
  const profileByMembershipId = new Map(
    profiles
      .filter((profile) => typeof profile.membershipId === "string" && profile.membershipId.trim().length > 0)
      .map((profile) => [profile.membershipId, profile])
  );

  return items.map((item) => {
    const profile = profileByMembershipId.get(item.membershipId) ?? null;

      return {
        membershipId: item.membershipId,
        userId: profile?.userId ?? null,
        username: profile?.username ?? "vyb_user",
        displayName: profile?.fullName ?? "Vyb Student",
        avatarUrl: profile?.avatarUrl ?? null,
        reactionType: item.reactionType ?? "like",
        reactedAt: item.createdAt
      };
  });
}

function buildRepostBody(post, quote = null) {
  const trimmedQuote = requireNonEmptyString(quote) ? quote.trim() : null;
  const originalBody = requireNonEmptyString(post.body) ? post.body.trim() : "";
  const repostLine = post.isAnonymous ? "Reposted from Anonymous" : `Reposted from @${post.author.username}`;

  if (trimmedQuote && originalBody) {
    return `${trimmedQuote}\n\n${repostLine}\n${originalBody}`;
  }

  if (trimmedQuote) {
    return `${trimmedQuote}\n\n${repostLine}`;
  }

  return originalBody ? `${repostLine}\n${originalBody}` : repostLine;
}

function resolveTenantScope({ requestedTenantId, resolvedTenantId, routeLabel }) {
  if (resolvedTenantId && requestedTenantId && requestedTenantId !== resolvedTenantId) {
    console.warn(`[social] ${routeLabel}:tenant-mismatch`, {
      requestedTenantId,
      resolvedTenantId
    });
  }

  return resolvedTenantId ?? requestedTenantId ?? null;
}

function isRecoverableReadError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("oauth2.googleapis.com/token") ||
    message.includes("failed to fetch a valid google oauth2 access token") ||
    message.includes("could not load the default credentials") ||
    message.includes("default credentials") ||
    message.includes("metadata lookup") ||
    message.includes("metadata server") ||
    message.includes("all promises were rejected") ||
    message.includes("connect eacces") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("fetch failed") ||
    message.includes("unrecognized operation query.")
  );
}

async function buildUserSearchItems({ tenantId, viewerUserId, query, limit }) {
  let profiles = [];

  try {
    profiles = await searchProfiles({
      tenantId,
      query,
      limit,
      excludedUserId: viewerUserId
    });
  } catch (error) {
    if (!isRecoverableReadError(error)) {
      throw error;
    }

    console.warn("[social] search-users:profiles-unavailable", {
      tenantId,
      query,
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return Promise.all(
    profiles.map(async (profile) => {
      const followStats = await getFollowStats({
        tenantId,
        userId: profile.userId
      });

        return {
          userId: profile.userId,
          username: profile.username,
          displayName: profile.fullName,
          avatarUrl: profile.avatarUrl ?? null,
          collegeName: profile.collegeName,
          course: profile.course,
          stream: profile.stream,
        isFollowing: await isFollowing({
          tenantId,
          followerUserId: viewerUserId,
          followingUserId: profile.userId
        }),
        stats: {
          posts:
            (await countPostsByUser({
              tenantId,
              userId: profile.userId,
              placement: "feed"
            })) +
            (await countPostsByUser({
              tenantId,
              userId: profile.userId,
              placement: "vibe"
            })),
          followers: followStats.followers,
          following: followStats.following
        }
      };
    })
  );
}

async function buildSuggestedUserItems({ tenantId, viewerUserId, limit }) {
  let profiles = [];

  try {
    profiles = (await listProfilesByTenant(tenantId))
      .filter((profile) => profile.userId !== viewerUserId)
      .slice(0, limit);
  } catch (error) {
    if (!isRecoverableReadError(error)) {
      throw error;
    }

    console.warn("[social] suggested-users:profiles-unavailable", {
      tenantId,
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return Promise.all(
    profiles.map(async (profile) => {
      const followStats = await getFollowStats({
        tenantId,
        userId: profile.userId
      });

        return {
          userId: profile.userId,
          username: profile.username,
          displayName: profile.fullName,
          avatarUrl: profile.avatarUrl ?? null,
          collegeName: profile.collegeName,
          course: profile.course,
          stream: profile.stream,
        isFollowing: await isFollowing({
          tenantId,
          followerUserId: viewerUserId,
          followingUserId: profile.userId
        }),
        stats: {
          posts:
            (await countPostsByUser({
              tenantId,
              userId: profile.userId,
              placement: "feed"
            })) +
            (await countPostsByUser({
              tenantId,
              userId: profile.userId,
              placement: "vibe"
            })),
          followers: followStats.followers,
          following: followStats.following
        }
      };
    })
  );
}

async function logSocialActivity({
  tenantId,
  membershipId,
  activityType,
  entityType,
  entityId,
  metadata,
  auditAction = activityType
}) {
  await trackActivity({
    tenantId,
    membershipId,
    activityType,
    entityType,
    entityId,
    metadata,
    auditAction
  });
}

export function getSocialModuleHealth() {
  return {
    module: "social",
    status: "ok"
  };
}

export async function canOpenSocialRealtimeConnection({ tenantId, userId, membershipId }) {
  return requireNonEmptyString(tenantId) && requireNonEmptyString(userId) && requireNonEmptyString(membershipId);
}

export async function handleSocialRoute({ request, response, url, context }) {
  if (!context.actor) {
    return false;
  }

  const resolved = await resolveLiveContext(context.actor);
  if (!resolved?.viewer) {
    return false;
  }
  const resolvedTenantId = resolved.live?.tenant?.id ?? null;
  const resolvedMembershipId = resolved.live?.membership?.id ?? null;
  const resolvedUserId = resolved.live?.user?.id ?? null;

  if (request.method === "GET" && url.pathname === "/v1/feed") {
    const tenantId = resolveTenantScope({
      requestedTenantId: url.searchParams.get("tenantId"),
      resolvedTenantId,
      routeLabel: "feed"
    });
    const communityId = url.searchParams.get("communityId");
    const authorUserId = url.searchParams.get("authorUserId");
    const limit = parseLimit(url.searchParams.get("limit"));

    if (!requireNonEmptyString(tenantId)) {
      sendError(response, 400, "INVALID_TENANT", "tenantId is required.");
      return true;
    }

    if (limit === null) {
      sendError(response, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 50.");
      return true;
    }

    const items = await listPosts({
      tenantId,
      communityId,
      limit,
      placement: "feed",
      userId: authorUserId ?? null,
      viewerMembershipId: resolvedMembershipId,
      viewerUserId: resolvedUserId
    });

    sendJson(response, 200, {
      tenantId,
      communityId,
      items: items.map(buildFeedPayload),
      nextCursor: null
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/vibes") {
    const tenantId = resolveTenantScope({
      requestedTenantId: url.searchParams.get("tenantId"),
      resolvedTenantId,
      routeLabel: "vibes"
    });
    const limit = parseLimit(url.searchParams.get("limit"), 24);
    const cursor = url.searchParams.get("cursor");

    if (!requireNonEmptyString(tenantId)) {
      sendError(response, 400, "INVALID_TENANT", "tenantId is required.");
      return true;
    }

    if (limit === null) {
      sendError(response, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 50.");
      return true;
    }

    const items = await listPosts({
      tenantId,
      limit: limit + 1,
      placement: "vibe",
      viewerMembershipId: resolvedMembershipId,
      viewerUserId: resolvedUserId,
      cursor
    });
    const pageItems = items.slice(0, limit);
    const lastItem = pageItems[pageItems.length - 1] ?? null;

    sendJson(response, 200, {
      tenantId,
      communityId: null,
      items: pageItems.map(buildFeedPayload),
      nextCursor: items.length > limit && lastItem ? buildPostCursor(lastItem) : null
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/social-media/upload") {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const intent = payload.intent === "post" || payload.intent === "story" || payload.intent === "vibe" ? payload.intent : null;
    if (!intent) {
      sendError(response, 400, "INVALID_INTENT", "Upload intent is missing or invalid.");
      return true;
    }

    if (!requireNonEmptyString(payload.mimeType) || !requireNonEmptyString(payload.fileName) || !requireNonEmptyString(payload.base64Data)) {
      sendError(response, 400, "INVALID_FILE", "Choose an image or video before uploading.");
      return true;
    }

    try {
      const asset = await persistSocialMediaAsset({
        tenantId: resolved.live.tenant.id,
        userId: resolved.live.user.id,
        intent,
        fileName: payload.fileName.trim(),
        mimeType: payload.mimeType.trim(),
        base64Data: payload.base64Data
      });

      sendJson(response, 201, { asset });
    } catch (error) {
      console.error("[social] media-upload-failed", {
        tenantId: resolved.live.tenant.id,
        userId: resolved.live.user.id,
        intent,
        fileName: payload.fileName ?? null,
        mimeType: payload.mimeType ?? null,
        message: error instanceof Error ? error.message : "unknown"
      });
      sendError(
        response,
        502,
        "SOCIAL_MEDIA_UPLOAD_FAILED",
        error instanceof Error ? error.message : "We could not upload this media right now."
      );
    }
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/posts") {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const tenantId = resolveTenantScope({
      requestedTenantId: payload.tenantId,
      resolvedTenantId,
      routeLabel: "create-post"
    });

    if (!requireNonEmptyString(tenantId)) {
      sendError(response, 400, "INVALID_TENANT", "tenantId is required.");
      return true;
    }

    if (!allowedPostKinds.has(payload.kind ?? "text")) {
      sendError(response, 400, "INVALID_KIND", "kind must be one of text, image, or video.");
      return true;
    }

    const hasMedia = requireNonEmptyString(payload.mediaUrl) || (Array.isArray(payload.mediaAssets) && payload.mediaAssets.length > 0);
    if (!requireNonEmptyString(payload.body) && !hasMedia) {
      sendError(response, 400, "INVALID_BODY", "Add a caption, message, or media before publishing.");
      return true;
    }

    const vibeUploaderIds = [resolvedUserId, context.actor?.id].filter(requireNonEmptyString);
    const vibeChecks = getVibePostPayloadChecks(payload, tenantId, vibeUploaderIds);
    if (payload.placement === "vibe" && !Object.values(vibeChecks).every(Boolean)) {
      console.warn("[social] invalid-vibe-media", {
        tenantId,
        actorId: context.actor?.id ?? null,
        resolvedUserId,
        mediaStoragePath: requireNonEmptyString(payload.mediaStoragePath) ? payload.mediaStoragePath.trim() : null,
        mediaMimeType: normalizeMimeType(payload.mediaMimeType),
        mediaSizeBytes: Number(payload.mediaSizeBytes),
        checks: vibeChecks
      });
      sendError(response, 400, "INVALID_VIBE_MEDIA", "Vibes must use a verified video uploaded by your account.", {
        checks: vibeChecks
      });
      return true;
    }

    const profile = await getProfileByUserId({
      tenantId,
      userId: resolvedUserId
    });
    if (!profile?.profileCompleted) {
      sendError(response, 403, "PROFILE_INCOMPLETE", "Complete your profile before publishing.");
      return true;
    }

    const item = await createPost({
      tenantId,
      communityId: payload.communityId ?? null,
      userId: resolvedUserId,
      membershipId: resolvedMembershipId ?? payload.membershipId ?? context.actor.id,
      authorUsername: profile.username,
      authorName: profile.fullName,
      authorEmail: profile.primaryEmail ?? null,
      placement: payload.placement === "vibe" ? "vibe" : "feed",
      kind: payload.kind ?? "text",
      isAnonymous: payload.isAnonymous === true,
      allowAnonymousComments: payload.allowAnonymousComments !== false,
      mediaAssets: Array.isArray(payload.mediaAssets) ? payload.mediaAssets : null,
      mediaUrl: requireNonEmptyString(payload.mediaUrl) ? payload.mediaUrl.trim() : null,
      mediaStoragePath: requireNonEmptyString(payload.mediaStoragePath) ? payload.mediaStoragePath.trim() : null,
      mediaMimeType: requireNonEmptyString(payload.mediaMimeType) ? payload.mediaMimeType.trim() : null,
      mediaSizeBytes: Number.isFinite(Number(payload.mediaSizeBytes)) ? Number(payload.mediaSizeBytes) : null,
      location: requireNonEmptyString(payload.location) ? payload.location.trim() : profile.collegeName,
      title: requireNonEmptyString(payload.title) ? payload.title.trim() : "Campus update",
      body: requireNonEmptyString(payload.body) ? payload.body.trim() : "",
      viewerMembershipId: resolvedMembershipId ?? payload.membershipId ?? context.actor.id,
      viewerUserId: resolvedUserId
    });

    await logSocialActivity({
      tenantId,
      membershipId: resolvedMembershipId,
      activityType: payload.placement === "vibe" ? "vibe.created" : "post.created",
      entityType: "post",
      entityId: item.id,
      metadata: {
        placement: item.placement,
        kind: item.kind
      }
    });

    emitSocialRealtimeEvent({
      tenantId: item.tenantId,
      type: "social.post.created",
      payload: {
        item: buildRealtimeFeedPayload(item)
      },
      excludeMembershipId: getRealtimeActorMembershipId(resolvedMembershipId, context)
    });

    sendJson(response, 201, {
      item: buildFeedPayload(item)
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/stories") {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const tenantId = resolveTenantScope({
      requestedTenantId: payload.tenantId,
      resolvedTenantId,
      routeLabel: "create-story"
    });

    if (!requireNonEmptyString(tenantId)) {
      sendError(response, 400, "INVALID_TENANT", "tenantId is required.");
      return true;
    }

    if (!allowedStoryMediaTypes.has(payload.mediaType ?? "")) {
      sendError(response, 400, "INVALID_MEDIA_TYPE", "Stories support image or video media.");
      return true;
    }

    if (!requireNonEmptyString(payload.mediaUrl)) {
      sendError(response, 400, "MISSING_MEDIA", "Add story media before publishing.");
      return true;
    }

    const profile = await getProfileByUserId({
      tenantId,
      userId: resolvedUserId
    });
    if (!profile?.profileCompleted) {
      sendError(response, 403, "PROFILE_INCOMPLETE", "Complete your profile before publishing stories.");
      return true;
    }

    const item = await createStory({
      tenantId,
      userId: resolvedUserId,
      username: profile.username,
      displayName: profile.fullName,
      mediaType: payload.mediaType,
      mediaUrl: payload.mediaUrl.trim(),
      mediaStoragePath: requireNonEmptyString(payload.mediaStoragePath) ? payload.mediaStoragePath.trim() : null,
      mediaMimeType: requireNonEmptyString(payload.mediaMimeType) ? payload.mediaMimeType.trim() : null,
      mediaSizeBytes: Number.isFinite(Number(payload.mediaSizeBytes)) ? Number(payload.mediaSizeBytes) : null,
      caption: requireNonEmptyString(payload.caption) ? payload.caption.trim() : ""
    });

    await logSocialActivity({
      tenantId,
      membershipId: resolvedMembershipId,
      activityType: "story.created",
      entityType: "story",
      entityId: item.id,
      metadata: {
        mediaType: item.mediaType
      }
    });

    sendJson(response, 201, { item });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/stories") {
    const tenantId = resolveTenantScope({
      requestedTenantId: url.searchParams.get("tenantId"),
      resolvedTenantId,
      routeLabel: "stories"
    });
    if (!requireNonEmptyString(tenantId)) {
      sendError(response, 400, "INVALID_TENANT", "tenantId is required.");
      return true;
    }

    const items = await listStories({
      tenantId,
      viewerUserId: resolvedUserId,
      viewerMembershipId: resolvedMembershipId
    });

    sendJson(response, 200, { items });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/users/search") {
    const tenantId = resolveTenantScope({
      requestedTenantId: url.searchParams.get("tenantId"),
      resolvedTenantId,
      routeLabel: "search-users"
    });
    const query = url.searchParams.get("q") ?? "";
    const trimmedQuery = query.trim();
    const suggested = url.searchParams.get("suggested") === "1";
    const limit = parseLimit(url.searchParams.get("limit"), 12);

    if (!requireNonEmptyString(tenantId)) {
      sendError(response, 400, "INVALID_TENANT", "tenantId is required.");
      return true;
    }

    if (limit === null) {
      sendError(response, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 50.");
      return true;
    }

    const items = suggested
      ? await buildSuggestedUserItems({
          tenantId,
          viewerUserId: resolvedUserId,
          limit
        })
      : trimmedQuery
        ? await buildUserSearchItems({
            tenantId,
            viewerUserId: resolvedUserId,
            query: trimmedQuery,
            limit
          })
        : [];

    sendJson(response, 200, {
      query: trimmedQuery,
      items
    });
    return true;
  }

  const publicProfileMatch = request.method === "GET" ? url.pathname.match(/^\/v1\/users\/([^/]+)$/) : null;
  if (publicProfileMatch) {
    const tenantId = resolveTenantScope({
      requestedTenantId: url.searchParams.get("tenantId"),
      resolvedTenantId,
      routeLabel: "public-profile"
    });
    if (!requireNonEmptyString(tenantId)) {
      sendError(response, 400, "INVALID_TENANT", "tenantId is required.");
      return true;
    }

    const profile = await getProfileByUsername({
      tenantId,
      username: decodeURIComponent(publicProfileMatch[1])
    });

    if (!profile) {
      sendError(response, 404, "USER_NOT_FOUND", "That campus profile was not found.");
      return true;
    }

    const followStats = await getFollowStats({
      tenantId,
      userId: profile.userId
    });
    const [feedPosts, vibePosts] = await Promise.all([
      listPostsByUser({
        tenantId,
        userId: profile.userId,
        limit: 24,
        placement: "feed",
        viewerMembershipId: resolvedMembershipId,
        viewerUserId: resolvedUserId
      }),
      listPostsByUser({
        tenantId,
        userId: profile.userId,
        limit: 24,
        placement: "vibe",
        viewerMembershipId: resolvedMembershipId,
        viewerUserId: resolvedUserId
      })
    ]);
    const posts = [...feedPosts, ...vibePosts].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );

    sendJson(response, 200, {
      profile: {
        userId: profile.userId,
        username: profile.username,
        displayName: profile.fullName,
        avatarUrl: profile.avatarUrl ?? null,
        collegeName: profile.collegeName,
        course: profile.course,
        stream: profile.stream,
        bio: profile.bio ?? null,
        socialLinks: profile.socialLinks ?? null
      },
      stats: {
        posts: posts.length,
        followers: followStats.followers,
        following: followStats.following
      },
      isFollowing: await isFollowing({
        tenantId,
        followerUserId: resolvedUserId,
        followingUserId: profile.userId
      }),
      isViewerProfile: profile.userId === resolvedUserId,
      posts
    });
    return true;
  }

  const followMatch =
    request.method === "PUT" || request.method === "DELETE"
      ? url.pathname.match(/^\/v1\/users\/([^/]+)\/follow$/)
      : null;
  if (followMatch) {
    const tenantId = resolveTenantScope({
      requestedTenantId: url.searchParams.get("tenantId"),
      resolvedTenantId,
      routeLabel: "follow"
    });
    if (!requireNonEmptyString(tenantId)) {
      sendError(response, 400, "INVALID_TENANT", "tenantId is required.");
      return true;
    }

    const target = await getProfileByUsername({
      tenantId,
      username: decodeURIComponent(followMatch[1])
    });

    if (!target) {
      sendError(response, 404, "USER_NOT_FOUND", "That campus profile was not found.");
      return true;
    }

    if (request.method === "PUT") {
      await followUser({
        tenantId,
        followerUserId: resolvedUserId,
        followingUserId: target.userId
      });

      await logSocialActivity({
        tenantId,
        membershipId: resolvedMembershipId,
        activityType: "follow.created",
        entityType: "user",
        entityId: target.userId,
        metadata: {
          username: target.username
        }
      });
    } else {
      await unfollowUser({
        tenantId,
        followerUserId: resolvedUserId,
        followingUserId: target.userId
      });

      await logSocialActivity({
        tenantId,
        membershipId: resolvedMembershipId,
        activityType: "follow.removed",
        entityType: "user",
        entityId: target.userId,
        metadata: {
          username: target.username
        }
      });
    }

    const followStats = await getFollowStats({
      tenantId,
      userId: target.userId
    });

    sendJson(response, 200, {
      username: target.username,
      isFollowing: request.method === "PUT",
      stats: {
        followers: followStats.followers,
        following: followStats.following
      }
    });
    return true;
  }

  const adminAnonymousIdentityMatch =
    request.method === "GET" ? url.pathname.match(/^\/v1\/admin\/posts\/([^/]+)\/identity$/) : null;
  if (adminAnonymousIdentityMatch) {
    if (!isAdminRole(resolved.live?.membership?.role ?? null)) {
      sendError(response, 403, "FORBIDDEN", "Admin access is required.");
      return true;
    }

    const postRecord = await findPostRecordById(adminAnonymousIdentityMatch[1], {
      tenantId: resolvedTenantId ?? null
    });
    if (!postRecord) {
      sendError(response, 404, "POST_NOT_FOUND", "Post not found.");
      return true;
    }

    const authorProfile = postRecord.authorUserId
      ? await getProfileByUserId({
          tenantId: postRecord.tenantId,
          userId: postRecord.authorUserId
        })
      : null;
    const reason = url.searchParams.get("reason")?.trim() || "identity review";

    await logSocialActivity({
      tenantId: postRecord.tenantId,
      membershipId: resolvedMembershipId,
      activityType: "anonymous.post.identity.revealed",
      entityType: "post",
      entityId: postRecord.id,
      metadata: {
        reason,
        isAnonymous: Boolean(postRecord.isAnonymous)
      },
      auditAction: "anonymous.post.identity.revealed"
    });

    sendJson(response, 200, {
      postId: postRecord.id,
      tenantId: postRecord.tenantId,
      isAnonymous: Boolean(postRecord.isAnonymous),
      author: {
        userId: postRecord.authorUserId ?? null,
        membershipId: postRecord.membershipId ?? null,
        email: postRecord.authorEmail ?? authorProfile?.primaryEmail ?? null,
        username: authorProfile?.username ?? postRecord.authorUsername ?? null,
        displayName: authorProfile?.fullName ?? postRecord.authorName ?? null
      }
    });
    return true;
  }

  const adminAnonymousCommentIdentityMatch =
    request.method === "GET" ? url.pathname.match(/^\/v1\/admin\/comments\/([^/]+)\/identity$/) : null;
  if (adminAnonymousCommentIdentityMatch) {
    if (!isAdminRole(resolved.live?.membership?.role ?? null)) {
      sendError(response, 403, "FORBIDDEN", "Admin access is required.");
      return true;
    }

    const commentRecord = await findCommentRecordById(adminAnonymousCommentIdentityMatch[1], {
      tenantId: resolvedTenantId ?? null
    });
    if (!commentRecord) {
      sendError(response, 404, "COMMENT_NOT_FOUND", "Comment not found.");
      return true;
    }

    const authorProfile = commentRecord.authorUserId
      ? await getProfileByUserId({
          tenantId: commentRecord.tenantId,
          userId: commentRecord.authorUserId
        })
      : null;
    const reason = url.searchParams.get("reason")?.trim() || "identity review";

    await logSocialActivity({
      tenantId: commentRecord.tenantId,
      membershipId: resolvedMembershipId,
      activityType: "anonymous.comment.identity.revealed",
      entityType: "comment",
      entityId: commentRecord.id,
      metadata: {
        postId: commentRecord.postId,
        reason,
        isAnonymous: Boolean(commentRecord.isAnonymous)
      },
      auditAction: "anonymous.comment.identity.revealed"
    });

    sendJson(response, 200, {
      commentId: commentRecord.id,
      postId: commentRecord.postId,
      tenantId: commentRecord.tenantId,
      isAnonymous: Boolean(commentRecord.isAnonymous),
      author: {
        userId: commentRecord.authorUserId ?? null,
        membershipId: commentRecord.membershipId ?? null,
        email: commentRecord.authorEmail ?? authorProfile?.primaryEmail ?? null,
        username: authorProfile?.username ?? null,
        displayName: authorProfile?.fullName ?? null
      }
    });
    return true;
  }

  const postLikesMatch = request.method === "GET" ? url.pathname.match(/^\/v1\/posts\/([^/]+)\/likes$/) : null;
  if (postLikesMatch) {
    const post = await findPostById(postLikesMatch[1], {
      tenantId: resolvedTenantId ?? null,
      viewerMembershipId: resolvedMembershipId,
      viewerUserId: resolvedUserId
    });
    if (!post) {
      sendError(response, 404, "POST_NOT_FOUND", "Post not found.");
      return true;
    }

    const limit = parseLimit(url.searchParams.get("limit"), 50);
    if (limit === null) {
      sendError(response, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 50.");
      return true;
    }

    const items = await buildReactionMemberItems(
      post.tenantId,
      await listPostReactions({
        postId: post.id,
        limit
      })
    );

    sendJson(response, 200, {
      postId: post.id,
      items
    });
    return true;
  }

  const repostMatch = request.method === "POST" ? url.pathname.match(/^\/v1\/posts\/([^/]+)\/repost$/) : null;
  if (repostMatch) {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const post = await findPostById(repostMatch[1], {
      tenantId: resolvedTenantId ?? null,
      viewerMembershipId: resolvedMembershipId,
      viewerUserId: resolvedUserId
    });
    if (!post) {
      sendError(response, 404, "POST_NOT_FOUND", "Post not found.");
      return true;
    }

    const profile = await getProfileByUserId({
      tenantId: post.tenantId,
      userId: resolvedUserId
    });
    if (!profile?.profileCompleted) {
      sendError(response, 403, "PROFILE_INCOMPLETE", "Complete your profile before reposting.");
      return true;
    }

    const item = await createPost({
      tenantId: post.tenantId,
      communityId: post.communityId,
      userId: resolvedUserId,
      membershipId: resolvedMembershipId ?? context.actor.id,
      authorUsername: profile.username,
      authorName: profile.fullName,
      placement: payload.placement === "vibe" ? "vibe" : payload.placement === "feed" ? "feed" : post.placement,
      kind: post.kind,
      mediaUrl: post.mediaUrl,
      location: post.location ?? profile.collegeName,
      title: requireNonEmptyString(payload.quote)
        ? `Quote repost • ${post.author.displayName}`
        : `Repost • ${post.author.displayName}`,
      body: buildRepostBody(post, payload.quote ?? null),
      viewerMembershipId: resolvedMembershipId ?? context.actor.id,
      viewerUserId: resolvedUserId
    });

    await logSocialActivity({
      tenantId: post.tenantId,
      membershipId: resolvedMembershipId,
      activityType: post.placement === "vibe" ? "vibe.reposted" : "post.reposted",
      entityType: "post",
      entityId: item.id,
      metadata: {
        sourcePostId: post.id,
        placement: item.placement
      }
    });

    emitSocialRealtimeEvent({
      tenantId: item.tenantId,
      type: "social.post.created",
      payload: {
        item: buildRealtimeFeedPayload(item)
      },
      excludeMembershipId: getRealtimeActorMembershipId(resolvedMembershipId, context)
    });

    sendJson(response, 201, { item: buildFeedPayload(item) });
    return true;
  }

  const deletePostMatch = request.method === "DELETE" ? url.pathname.match(/^\/v1\/posts\/([^/]+)$/) : null;
  if (deletePostMatch) {
    const post = await findPostRecordById(deletePostMatch[1], {
      tenantId: resolvedTenantId ?? null
    });
    if (!post) {
      sendError(response, 404, "POST_NOT_FOUND", "Post not found.");
      return true;
    }

    if (post.authorUserId !== resolvedUserId) {
      sendError(response, 403, "FORBIDDEN", "Only the post author can delete this post.");
      return true;
    }

    const item = await deletePost(post.id);

    await logSocialActivity({
      tenantId: post.tenantId,
      membershipId: resolvedMembershipId,
      activityType: post.placement === "vibe" ? "vibe.deleted" : "post.deleted",
      entityType: "post",
      entityId: post.id,
      metadata: {
        placement: post.placement
      }
    });

    emitSocialRealtimeEvent({
      tenantId: post.tenantId,
      type: "social.post.deleted",
      payload: {
        postId: post.id
      },
      excludeMembershipId: getRealtimeActorMembershipId(resolvedMembershipId, context)
    });

    sendJson(response, 200, item);
    return true;
  }

  const updatePostMatch = request.method === "PATCH" ? url.pathname.match(/^\/v1\/posts\/([^/]+)$/) : null;
  if (updatePostMatch) {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const post = await findPostRecordById(updatePostMatch[1], {
      tenantId: resolvedTenantId ?? null
    });
    if (!post) {
      sendError(response, 404, "POST_NOT_FOUND", "Post not found.");
      return true;
    }

    if (post.authorUserId !== resolvedUserId) {
      sendError(response, 403, "FORBIDDEN", "Only the post author can edit this post.");
      return true;
    }

    const nextTitle = requireNonEmptyString(payload.title) ? payload.title.trim() : post.title;
    const nextBody = requireNonEmptyString(payload.body) ? payload.body.trim() : post.body;
    const nextLocation =
      typeof payload.location === "string"
        ? payload.location.trim() || null
        : payload.location === null
          ? null
          : post.location;
    const nextAllowAnonymousComments =
      typeof payload.allowAnonymousComments === "boolean" ? payload.allowAnonymousComments : post.allowAnonymousComments !== false;

    if (!requireNonEmptyString(nextBody) && !post.mediaUrl) {
      sendError(response, 400, "INVALID_BODY", "Add a caption or keep existing media before saving.");
      return true;
    }

    const item = await updatePost(
      post.id,
      {
        title: nextTitle,
        body: nextBody,
        location: nextLocation,
        allowAnonymousComments: nextAllowAnonymousComments
      },
      {
        tenantId: post.tenantId,
        viewerMembershipId: resolvedMembershipId,
        viewerUserId: resolvedUserId
      }
    );

    await logSocialActivity({
      tenantId: post.tenantId,
      membershipId: resolvedMembershipId,
      activityType: post.placement === "vibe" ? "vibe.updated" : "post.updated",
      entityType: "post",
      entityId: post.id,
      metadata: {
        placement: post.placement,
        allowAnonymousComments: nextAllowAnonymousComments
      }
    });

    emitSocialRealtimeEvent({
      tenantId: post.tenantId,
      type: "social.post.updated",
      payload: {
        item: buildRealtimeFeedPayload(item)
      },
      excludeMembershipId: getRealtimeActorMembershipId(resolvedMembershipId, context)
    });

    sendJson(response, 200, { item: buildFeedPayload(item) });
    return true;
  }

  const listCommentMatch = request.method === "GET" ? url.pathname.match(/^\/v1\/posts\/([^/]+)\/comments$/) : null;
  if (listCommentMatch) {
    const post = await findPostById(listCommentMatch[1], {
      tenantId: resolvedTenantId ?? null,
      viewerMembershipId: resolvedMembershipId,
      viewerUserId: resolvedUserId
    });
    if (!post) {
      sendError(response, 404, "POST_NOT_FOUND", "Post not found.");
      return true;
    }

    const limit = parseLimit(url.searchParams.get("limit"), 50);
    if (limit === null) {
      sendError(response, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 50.");
      return true;
    }

    const items = await enrichCommentItems(
      post.tenantId,
      await listCommentsByPost({
        tenantId: post.tenantId,
        postId: listCommentMatch[1],
        limit,
        viewerMembershipId: resolvedMembershipId
      })
    );

    sendJson(response, 200, {
      postId: listCommentMatch[1],
      items
    });
    return true;
  }

  const commentMatch = request.method === "POST" ? url.pathname.match(/^\/v1\/posts\/([^/]+)\/comments$/) : null;
  if (commentMatch) {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const post = await findPostById(commentMatch[1], {
      tenantId: resolvedTenantId ?? null,
      viewerMembershipId: resolvedMembershipId,
      viewerUserId: resolvedUserId
    });
    if (!post) {
      sendError(response, 404, "POST_NOT_FOUND", "Post not found.");
      return true;
    }

    const membershipId = resolvedMembershipId ?? payload.membershipId ?? null;
    if (!requireNonEmptyString(membershipId)) {
      sendError(response, 400, "INVALID_MEMBERSHIP", "membershipId is required.");
      return true;
    }

    const trimmedBody = requireNonEmptyString(payload.body) ? payload.body.trim() : "";
    const trimmedMediaUrl = requireNonEmptyString(payload.mediaUrl) ? payload.mediaUrl.trim() : null;
    const mediaType = requireNonEmptyString(payload.mediaType) ? payload.mediaType.trim() : null;

    if (!trimmedBody && !trimmedMediaUrl) {
      sendError(response, 400, "INVALID_COMMENT", "Add text or GIF/sticker media before commenting.");
      return true;
    }

    if (trimmedBody && trimmedBody.length < 2) {
      sendError(response, 400, "INVALID_COMMENT", "body must be at least 2 characters long.");
      return true;
    }

    if (mediaType && !allowedCommentMediaTypes.has(mediaType)) {
      sendError(response, 400, "INVALID_MEDIA_TYPE", "Comment media must be image, gif, or sticker.");
      return true;
    }

    const isAnonymousComment = payload.isAnonymous === true;
    if (isAnonymousComment && post.allowAnonymousComments === false) {
      sendError(response, 403, "ANONYMOUS_COMMENTS_DISABLED", "Anonymous comments are disabled for this post.");
      return true;
    }

    let parentCommentId = null;
    if (requireNonEmptyString(payload.parentCommentId)) {
      const parentComment = await findCommentById(payload.parentCommentId.trim(), {
        tenantId: post.tenantId,
        viewerMembershipId: resolvedMembershipId
      });
      if (!parentComment || parentComment.postId !== post.id) {
        sendError(response, 404, "COMMENT_NOT_FOUND", "Reply target was not found.");
        return true;
      }

      parentCommentId = parentComment.id;
    }

    const authorProfile = await getProfileByUserId({
      tenantId: post.tenantId,
      userId: resolvedUserId
    });

    const item = await createComment({
      tenantId: post.tenantId,
      placement: post.placement,
      postId: commentMatch[1],
      membershipId,
      authorUserId: resolvedUserId,
      authorEmail: authorProfile?.primaryEmail ?? null,
      isAnonymous: isAnonymousComment,
      parentCommentId,
      body: trimmedBody,
      mediaUrl: trimmedMediaUrl,
      mediaType,
      mediaMimeType: requireNonEmptyString(payload.mediaMimeType) ? payload.mediaMimeType.trim() : null,
      mediaSizeBytes: Number.isFinite(Number(payload.mediaSizeBytes)) ? Number(payload.mediaSizeBytes) : null
    });
    const enrichedItem = {
      ...item,
      author: item.isAnonymous ? item.author : buildCommentAuthor(authorProfile, resolvedUserId)
    };

    await logSocialActivity({
      tenantId: post.tenantId,
      membershipId,
      activityType: "comment.created",
      entityType: "comment",
      entityId: item.id,
      metadata: {
        postId: post.id,
        placement: post.placement,
        parentCommentId,
        isAnonymous: isAnonymousComment
      }
    });

    emitSocialRealtimeEvent({
      tenantId: post.tenantId,
      type: "social.comment.created",
      payload: {
        postId: post.id,
        item: buildRealtimeCommentPayload(enrichedItem)
      },
      excludeMembershipId: membershipId
    });

    sendJson(response, 201, { item: enrichedItem });
    return true;
  }

  const deleteCommentMatch = request.method === "DELETE" ? url.pathname.match(/^\/v1\/comments\/([^/]+)$/) : null;
  if (deleteCommentMatch) {
    const comment = await findCommentRecordById(deleteCommentMatch[1], {
      tenantId: resolvedTenantId ?? null
    });
    if (!comment) {
      sendError(response, 404, "COMMENT_NOT_FOUND", "Comment not found.");
      return true;
    }

    const post = await findPostRecordById(comment.postId, {
      tenantId: resolvedTenantId ?? null
    });
    if (!post) {
      sendError(response, 404, "POST_NOT_FOUND", "Post not found.");
      return true;
    }

    const canDelete =
      comment.authorUserId === resolvedUserId ||
      comment.membershipId === resolvedMembershipId ||
      post.authorUserId === resolvedUserId ||
      post.membershipId === resolvedMembershipId;
    if (!canDelete) {
      sendError(response, 403, "COMMENT_DELETE_FORBIDDEN", "Only the comment author or post owner can delete this comment.");
      return true;
    }

    const item = await deleteComment(comment.id, {
      tenantId: post.tenantId,
      postId: post.id
    });

    await logSocialActivity({
      tenantId: post.tenantId,
      membershipId: resolvedMembershipId ?? comment.membershipId,
      activityType: "comment.deleted",
      entityType: "comment",
      entityId: comment.id,
      metadata: {
        postId: post.id,
        placement: post.placement,
        deletedCount: item.deletedCount
      }
    });

    emitSocialRealtimeEvent({
      tenantId: post.tenantId,
      type: "social.comment.deleted",
      payload: {
        postId: post.id,
        commentId: comment.id,
        deletedCount: item.deletedCount
      },
      excludeMembershipId: getRealtimeActorMembershipId(resolvedMembershipId, context)
    });

    sendJson(response, 200, item);
    return true;
  }

  const updateCommentMatch = request.method === "PATCH" ? url.pathname.match(/^\/v1\/comments\/([^/]+)$/) : null;
  if (updateCommentMatch) {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const comment = await findCommentRecordById(updateCommentMatch[1], {
      tenantId: resolvedTenantId ?? null
    });
    if (!comment) {
      sendError(response, 404, "COMMENT_NOT_FOUND", "Comment not found.");
      return true;
    }

    if (comment.membershipId !== resolvedMembershipId) {
      sendError(response, 403, "COMMENT_EDIT_FORBIDDEN", "Only the comment author can edit this comment.");
      return true;
    }

    const trimmedBody = requireNonEmptyString(payload.body) ? payload.body.trim() : "";
    if (trimmedBody.length < 2) {
      sendError(response, 400, "INVALID_COMMENT", "Comment must be at least 2 characters long.");
      return true;
    }

    const post = await findPostRecordById(comment.postId, {
      tenantId: resolvedTenantId ?? null
    });
    if (!post) {
      sendError(response, 404, "POST_NOT_FOUND", "Post not found.");
      return true;
    }

    const item = await updateComment(
      comment.id,
      { body: trimmedBody },
      {
        tenantId: post.tenantId,
        viewerMembershipId: resolvedMembershipId
      }
    );
    const enrichedItem = (await enrichCommentItems(post.tenantId, [item]))[0] ?? item;

    await logSocialActivity({
      tenantId: post.tenantId,
      membershipId: resolvedMembershipId ?? comment.membershipId,
      activityType: "comment.updated",
      entityType: "comment",
      entityId: comment.id,
      metadata: {
        postId: post.id,
        placement: post.placement
      }
    });

    emitSocialRealtimeEvent({
      tenantId: post.tenantId,
      type: "social.comment.updated",
      payload: {
        postId: post.id,
        item: buildRealtimeCommentPayload(enrichedItem)
      },
      excludeMembershipId: getRealtimeActorMembershipId(resolvedMembershipId, context)
    });

    sendJson(response, 200, { item: enrichedItem });
    return true;
  }

  const commentReactionMatch = request.method === "PUT" ? url.pathname.match(/^\/v1\/comments\/([^/]+)\/reactions$/) : null;
  if (commentReactionMatch) {
    const comment = await findCommentById(commentReactionMatch[1], {
      tenantId: resolvedTenantId ?? null,
      viewerMembershipId: resolvedMembershipId
    });
    if (!comment) {
      sendError(response, 404, "COMMENT_NOT_FOUND", "Comment not found.");
      return true;
    }

    const item = await upsertCommentReaction({
      commentId: comment.id,
      membershipId: resolvedMembershipId ?? context.actor.id,
      reactionType: "like"
    });

    await logSocialActivity({
      tenantId: resolvedTenantId,
      membershipId: resolvedMembershipId ?? context.actor.id,
      activityType: "comment.reaction.updated",
      entityType: "comment",
      entityId: comment.id,
      metadata: {
        reactionType: "like"
      }
    });

    emitSocialRealtimeEvent({
      tenantId: comment.tenantId ?? resolvedTenantId,
      type: "social.comment.reaction.updated",
      payload: {
        postId: comment.postId,
        commentId: comment.id,
        aggregateCount: item.aggregateCount
      },
      excludeMembershipId: getRealtimeActorMembershipId(resolvedMembershipId, context)
    });

    sendJson(response, 200, item);
    return true;
  }

  const reactionMatch = request.method === "PUT" ? url.pathname.match(/^\/v1\/posts\/([^/]+)\/reactions$/) : null;
  if (reactionMatch) {
    const payload = await readJson(request);
    if (payload === null) {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const post = await findPostById(reactionMatch[1], {
      tenantId: resolvedTenantId ?? null,
      viewerMembershipId: resolvedMembershipId,
      viewerUserId: resolvedUserId
    });
    if (!post) {
      sendError(response, 404, "POST_NOT_FOUND", "Post not found.");
      return true;
    }

    const reactionType = payload?.reactionType ?? "fire";
    if (!allowedReactionTypes.has(reactionType)) {
      sendError(response, 400, "INVALID_REACTION", "reactionType must be fire, support, or like.");
      return true;
    }

    const item = await upsertReaction({
      tenantId: post.tenantId,
      placement: post.placement,
      postId: post.id,
      membershipId: resolvedMembershipId ?? context.actor.id,
      reactionType
    });

    await logSocialActivity({
      tenantId: post.tenantId,
      membershipId: resolvedMembershipId ?? context.actor.id,
      activityType: "reaction.updated",
      entityType: "post",
      entityId: post.id,
      metadata: {
        placement: post.placement,
        reactionType
      }
    });
    emitSocialRealtimeEvent({
      tenantId: post.tenantId,
      type: "social.post.reaction.updated",
      payload: {
        postId: post.id,
        aggregateCount: item.aggregateCount
      },
      excludeMembershipId: getRealtimeActorMembershipId(resolvedMembershipId, context)
    });
    sendJson(response, 200, item);
    return true;
  }

  const storyReactionMatch = request.method === "PUT" ? url.pathname.match(/^\/v1\/stories\/([^/]+)\/reactions$/) : null;
  if (storyReactionMatch) {
    const story = await findStoryById(storyReactionMatch[1], {
      tenantId: resolvedTenantId ?? null,
      viewerUserId: resolvedUserId,
      viewerMembershipId: resolvedMembershipId
    });
    if (!story) {
      sendError(response, 404, "STORY_NOT_FOUND", "Story not found.");
      return true;
    }

    const item = await upsertStoryReaction({
      storyId: story.id,
      membershipId: resolvedMembershipId ?? context.actor.id,
      reactionType: "like"
    });

    await logSocialActivity({
      tenantId: story.tenantId,
      membershipId: resolvedMembershipId ?? context.actor.id,
      activityType: "story.reaction.updated",
      entityType: "story",
      entityId: story.id,
      metadata: {
        reactionType: "like"
      }
    });

    sendJson(response, 200, item);
    return true;
  }

  const storySeenMatch = request.method === "PUT" ? url.pathname.match(/^\/v1\/stories\/([^/]+)\/seen$/) : null;
  if (storySeenMatch) {
    const story = await findStoryById(storySeenMatch[1], {
      tenantId: resolvedTenantId ?? null,
      viewerUserId: resolvedUserId,
      viewerMembershipId: resolvedMembershipId
    });
    if (!story) {
      sendError(response, 404, "STORY_NOT_FOUND", "Story not found.");
      return true;
    }

    const item = await markStorySeen({
      storyId: story.id,
      membershipId: resolvedMembershipId ?? context.actor.id
    });

    await logSocialActivity({
      tenantId: story.tenantId,
      membershipId: resolvedMembershipId ?? context.actor.id,
      activityType: "story.seen",
      entityType: "story",
      entityId: story.id,
      metadata: null
    });

    sendJson(response, 200, item);
    return true;
  }

  return false;
}
