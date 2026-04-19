import { getFirebaseDataConnect } from "../../../../../packages/config/src/index.mjs";
import {
  connectorConfig as socialConnectorConfig,
  createPost as createPostMutation,
  listFeedByTenant
} from "../../../../../packages/dataconnect/social-admin-sdk/esm/index.esm.js";
import { readJson, sendError, sendJson } from "../../lib/http.mjs";
import { resolveLiveContext } from "../shared/viewer-context.mjs";
import { createComment, createPost, findPostById, listPosts, upsertReaction } from "./repository.mjs";

const allowedPostKinds = new Set(["text", "image"]);
const allowedReactionTypes = new Set(["fire", "support", "like"]);

function requireNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseLimit(value) {
  const parsed = Number(value ?? "20");
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    return null;
  }
  return parsed;
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

  if (request.method === "GET" && url.pathname === "/v1/feed") {
    const tenantId = url.searchParams.get("tenantId");
    const communityId = url.searchParams.get("communityId");
    const limit = parseLimit(url.searchParams.get("limit"));

    if (!requireNonEmptyString(tenantId)) {
      sendError(response, 400, "INVALID_TENANT", "tenantId is required.");
      return true;
    }

    if (limit === null) {
      sendError(response, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 50.");
      return true;
    }

    const resolved = await resolveLiveContext(context.actor);
    if (resolved?.live?.tenant) {
      try {
        const data = await listFeedByTenant(getFirebaseDataConnect(socialConnectorConfig), {
          tenantId: resolved.live.tenant.id,
          limit
        });

        const items = data.data.posts
          .filter((item) => (communityId ? item.communityId === communityId : true))
          .map((item) => ({
            id: item.id,
            tenantId: item.tenantId,
            communityId: item.communityId ?? null,
            membershipId: item.membershipId,
            kind: item.kind,
            title: item.title ?? "Untitled post",
            body: item.body,
            status: item.status,
            reactions: 0,
            comments: 0,
            createdAt: item.createdAt
          }));

        sendJson(response, 200, {
          tenantId: resolved.live.tenant.id,
          communityId,
          items,
          nextCursor: null
        });
        return true;
      } catch {
        // fall through to local starter data
      }
    }

    const items = await listPosts({ tenantId, communityId, limit });
    sendJson(response, 200, {
      tenantId,
      communityId,
      items,
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

    if (!requireNonEmptyString(payload.tenantId)) {
      sendError(response, 400, "INVALID_TENANT", "tenantId is required.");
      return true;
    }

    if (!requireNonEmptyString(payload.membershipId)) {
      sendError(response, 400, "INVALID_MEMBERSHIP", "membershipId is required.");
      return true;
    }

    if (!allowedPostKinds.has(payload.kind ?? "text")) {
      sendError(response, 400, "INVALID_KIND", "kind must be one of text or image.");
      return true;
    }

    if (!requireNonEmptyString(payload.body) || payload.body.trim().length < 8) {
      sendError(response, 400, "INVALID_BODY", "body must be at least 8 characters long.");
      return true;
    }

    const resolved = await resolveLiveContext(context.actor);
    if (resolved?.live?.tenant && resolved.live.membership) {
      try {
        const created = await createPostMutation(getFirebaseDataConnect(socialConnectorConfig), {
          tenantId: resolved.live.tenant.id,
          communityId: requireNonEmptyString(payload.communityId) ? payload.communityId : null,
          membershipId: resolved.live.membership.id,
          kind: payload.kind ?? "text",
          title: requireNonEmptyString(payload.title) ? payload.title.trim() : "Untitled post",
          body: payload.body.trim(),
          status: "pending"
        });

        sendJson(response, 201, {
          item: {
            id: created.data.post_insert.id,
            tenantId: resolved.live.tenant.id,
            communityId: requireNonEmptyString(payload.communityId) ? payload.communityId : null,
            membershipId: resolved.live.membership.id,
            kind: payload.kind ?? "text",
            title: requireNonEmptyString(payload.title) ? payload.title.trim() : "Untitled post",
            body: payload.body.trim(),
            status: "pending",
            reactions: 0,
            comments: 0,
            createdAt: new Date().toISOString()
          }
        });
        return true;
      } catch {
        // fall through to local starter data
      }
    }

    const item = await createPost({
      tenantId: payload.tenantId,
      communityId: payload.communityId ?? null,
      membershipId: payload.membershipId,
      kind: payload.kind ?? "text",
      title: requireNonEmptyString(payload.title) ? payload.title.trim() : "Untitled post",
      body: payload.body.trim()
    });
    sendJson(response, 201, { item });
    return true;
  }

  const commentMatch = request.method === "POST" ? url.pathname.match(/^\/v1\/posts\/([^/]+)\/comments$/) : null;
  if (commentMatch) {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const post = await findPostById(commentMatch[1]);
    if (!post) {
      sendError(response, 404, "POST_NOT_FOUND", "Post not found.");
      return true;
    }

    if (!requireNonEmptyString(payload.membershipId)) {
      sendError(response, 400, "INVALID_MEMBERSHIP", "membershipId is required.");
      return true;
    }

    if (!requireNonEmptyString(payload.body) || payload.body.trim().length < 2) {
      sendError(response, 400, "INVALID_COMMENT", "body must be at least 2 characters long.");
      return true;
    }

    const item = await createComment({
      postId: commentMatch[1],
      membershipId: payload.membershipId,
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

    const post = await findPostById(reactionMatch[1]);
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
      postId: post.id,
      membershipId: context.actor.id,
      reactionType
    });
    sendJson(response, 200, item);
    return true;
  }

  return false;
}
