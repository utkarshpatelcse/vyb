import { readJson, sendError, sendJson } from "../../lib/http.mjs";
import {
  getProfileByUsername,
  getProfileByUserId,
  listProfilesByTenant,
  searchProfiles
} from "../identity/profile-repository.mjs";
import { resolveLiveContext } from "../shared/viewer-context.mjs";
import {
  countPostsByUser,
  createComment,
  createPost,
  createStory,
  findPostById,
  followUser,
  getFollowStats,
  isFollowing,
  listPosts,
  listPostsByUser,
  listStories,
  unfollowUser,
  upsertReaction
} from "./repository.mjs";

const allowedPostKinds = new Set(["text", "image", "video"]);
const allowedReactionTypes = new Set(["fire", "support", "like"]);
const allowedStoryMediaTypes = new Set(["image", "video"]);

function requireNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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

function resolveTenantScope({ requestedTenantId, resolvedTenantId, routeLabel }) {
  if (resolvedTenantId && requestedTenantId && requestedTenantId !== resolvedTenantId) {
    console.warn(`[social] ${routeLabel}:tenant-mismatch`, {
      requestedTenantId,
      resolvedTenantId
    });
  }

  return resolvedTenantId ?? requestedTenantId ?? null;
}

async function buildUserSearchItems({ tenantId, viewerUserId, query, limit }) {
  const profiles = await searchProfiles({
    tenantId,
    query,
    limit,
    excludedUserId: viewerUserId
  });

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
        collegeName: profile.collegeName,
        course: profile.course,
        stream: profile.stream,
        isFollowing: await isFollowing({
          tenantId,
          followerUserId: viewerUserId,
          followingUserId: profile.userId
        }),
        stats: {
          posts: await countPostsByUser({
            tenantId,
            userId: profile.userId,
            placement: "feed"
          }),
          followers: followStats.followers,
          following: followStats.following
        }
      };
    })
  );
}

async function buildSuggestedUserItems({ tenantId, viewerUserId, limit }) {
  const profiles = (await listProfilesByTenant(tenantId))
    .filter((profile) => profile.userId !== viewerUserId)
    .slice(0, limit);

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
        collegeName: profile.collegeName,
        course: profile.course,
        stream: profile.stream,
        isFollowing: await isFollowing({
          tenantId,
          followerUserId: viewerUserId,
          followingUserId: profile.userId
        }),
        stats: {
          posts: await countPostsByUser({
            tenantId,
            userId: profile.userId,
            placement: "feed"
          }),
          followers: followStats.followers,
          following: followStats.following
        }
      };
    })
  );
}

export function getSocialModuleHealth() {
  return {
    module: "social",
    status: "ok"
  };
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
      userId: authorUserId ?? null
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
      limit,
      placement: "vibe"
    });

    sendJson(response, 200, {
      tenantId,
      communityId: null,
      items: items.map(buildFeedPayload),
      nextCursor: null
    });
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

    if (!requireNonEmptyString(payload.body) && !requireNonEmptyString(payload.mediaUrl)) {
      sendError(response, 400, "INVALID_BODY", "Add a caption, message, or media before publishing.");
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
      placement: payload.placement === "vibe" ? "vibe" : "feed",
      kind: payload.kind ?? "text",
      mediaUrl: requireNonEmptyString(payload.mediaUrl) ? payload.mediaUrl.trim() : null,
      mediaStoragePath: requireNonEmptyString(payload.mediaStoragePath) ? payload.mediaStoragePath.trim() : null,
      mediaMimeType: requireNonEmptyString(payload.mediaMimeType) ? payload.mediaMimeType.trim() : null,
      mediaSizeBytes: Number.isFinite(Number(payload.mediaSizeBytes)) ? Number(payload.mediaSizeBytes) : null,
      location: requireNonEmptyString(payload.location) ? payload.location.trim() : profile.collegeName,
      title: requireNonEmptyString(payload.title) ? payload.title.trim() : "Campus update",
      body: requireNonEmptyString(payload.body) ? payload.body.trim() : ""
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
      viewerUserId: resolvedUserId
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
    const posts = await listPostsByUser({
      tenantId,
      userId: profile.userId,
      limit: 24,
      placement: "feed"
    });

    sendJson(response, 200, {
      profile: {
        userId: profile.userId,
        username: profile.username,
        displayName: profile.fullName,
        collegeName: profile.collegeName,
        course: profile.course,
        stream: profile.stream
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
    } else {
      await unfollowUser({
        tenantId,
        followerUserId: resolvedUserId,
        followingUserId: target.userId
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

  const commentMatch = request.method === "POST" ? url.pathname.match(/^\/v1\/posts\/([^/]+)\/comments$/) : null;
  if (commentMatch) {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const post = await findPostById(commentMatch[1], {
      tenantId: resolvedTenantId ?? null
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

    if (!requireNonEmptyString(payload.body) || payload.body.trim().length < 2) {
      sendError(response, 400, "INVALID_COMMENT", "body must be at least 2 characters long.");
      return true;
    }

    const item = await createComment({
      tenantId: post.tenantId,
      placement: post.placement,
      postId: commentMatch[1],
      membershipId,
      authorUserId: resolvedUserId,
      body: payload.body.trim()
    });

    sendJson(response, 201, { item });
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
      tenantId: resolvedTenantId ?? null
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
    sendJson(response, 200, item);
    return true;
  }

  return false;
}
