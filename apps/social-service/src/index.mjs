import { createServer } from "node:http";
import { ensureMembershipContext, getFirebaseDataConnect, loadRootEnv } from "../../../packages/config/src/index.mjs";
import {
  connectorConfig as socialConnectorConfig,
  createPost as createPostMutation,
  listFeedByTenant
} from "../../../packages/dataconnect/social-admin-sdk/esm/index.esm.js";
import { createComment, createPost, findPostById, listPosts, upsertReaction } from "./repository.mjs";

const port = Number(process.env.PORT ?? 4103);
const allowedPostKinds = new Set(["text", "image"]);
const allowedReactionTypes = new Set(["fire", "support", "like"]);
loadRootEnv();

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, code, message, details) {
  sendJson(response, statusCode, {
    error: {
      code,
      message,
      details: details ?? null
    }
  });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function getActorContext(request) {
  const id = request.headers["x-demo-user-id"];
  const email = request.headers["x-demo-email"];

  if (typeof id !== "string" || typeof email !== "string") {
    return null;
  }

  return { id, email };
}

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

async function resolveLiveContext(actor) {
  try {
    const live = await ensureMembershipContext({
      firebaseUid: actor.id,
      primaryEmail: actor.email,
      displayName: actor.email.split("@")[0]
    });

    if (!live.tenant || !live.membership) {
      return null;
    }

    return live;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      service: "social-service",
      status: "ok",
      timestamp: new Date().toISOString()
    });
    return;
  }

  const actor = getActorContext(request);
  if (!actor) {
    sendError(response, 401, "UNAUTHENTICATED", "Demo auth headers are required for starter service access.");
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/feed") {
    const tenantId = url.searchParams.get("tenantId");
    const communityId = url.searchParams.get("communityId");
    const limit = parseLimit(url.searchParams.get("limit"));

    if (!requireNonEmptyString(tenantId)) {
      sendError(response, 400, "INVALID_TENANT", "tenantId is required.");
      return;
    }

    if (limit === null) {
      sendError(response, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 50.");
      return;
    }

    const live = await resolveLiveContext(actor);
    if (live) {
      try {
        const data = await listFeedByTenant(getFirebaseDataConnect(socialConnectorConfig), {
          tenantId: live.tenant.id,
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
          tenantId: live.tenant.id,
          communityId,
          items,
          nextCursor: null
        });
        return;
      } catch {
        // fall through to local dev store
      }
    }

    const items = await listPosts({ tenantId, communityId, limit });

    sendJson(response, 200, {
      tenantId,
      communityId,
      items,
      nextCursor: null
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/posts") {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return;
    }

    if (!requireNonEmptyString(payload.tenantId)) {
      sendError(response, 400, "INVALID_TENANT", "tenantId is required.");
      return;
    }

    if (!requireNonEmptyString(payload.membershipId)) {
      sendError(response, 400, "INVALID_MEMBERSHIP", "membershipId is required.");
      return;
    }

    if (!allowedPostKinds.has(payload.kind ?? "text")) {
      sendError(response, 400, "INVALID_KIND", "kind must be one of text or image.");
      return;
    }

    if (!requireNonEmptyString(payload.body) || payload.body.trim().length < 8) {
      sendError(response, 400, "INVALID_BODY", "body must be at least 8 characters long.");
      return;
    }

    const live = await resolveLiveContext(actor);
    if (live) {
      try {
        const created = await createPostMutation(getFirebaseDataConnect(socialConnectorConfig), {
          tenantId: live.tenant.id,
          communityId: requireNonEmptyString(payload.communityId) ? payload.communityId : null,
          membershipId: live.membership.id,
          kind: payload.kind ?? "text",
          title: requireNonEmptyString(payload.title) ? payload.title.trim() : "Untitled post",
          body: payload.body.trim(),
          status: "pending"
        });

        sendJson(response, 201, {
          item: {
            id: created.data.post_insert.id,
            tenantId: live.tenant.id,
            communityId: requireNonEmptyString(payload.communityId) ? payload.communityId : null,
            membershipId: live.membership.id,
            kind: payload.kind ?? "text",
            title: requireNonEmptyString(payload.title) ? payload.title.trim() : "Untitled post",
            body: payload.body.trim(),
            status: "pending",
            reactions: 0,
            comments: 0,
            createdAt: new Date().toISOString()
          }
        });
        return;
      } catch {
        // fall through to local dev store
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
    return;
  }

  const commentMatch = request.method === "POST" ? url.pathname.match(/^\/v1\/posts\/([^/]+)\/comments$/) : null;
  if (commentMatch) {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return;
    }

    const post = await findPostById(commentMatch[1]);
    if (!post) {
      sendError(response, 404, "POST_NOT_FOUND", "Post not found.");
      return;
    }

    if (!requireNonEmptyString(payload.membershipId)) {
      sendError(response, 400, "INVALID_MEMBERSHIP", "membershipId is required.");
      return;
    }

    if (!requireNonEmptyString(payload.body) || payload.body.trim().length < 2) {
      sendError(response, 400, "INVALID_COMMENT", "body must be at least 2 characters long.");
      return;
    }

    const item = await createComment({
      postId: commentMatch[1],
      membershipId: payload.membershipId,
      body: payload.body.trim()
    });

    sendJson(response, 201, { item });
    return;
  }

  const reactionMatch = request.method === "PUT" ? url.pathname.match(/^\/v1\/posts\/([^/]+)\/reactions$/) : null;
  if (reactionMatch) {
    const payload = await readJson(request);
    if (payload === null) {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return;
    }

    const post = await findPostById(reactionMatch[1]);
    if (!post) {
      sendError(response, 404, "POST_NOT_FOUND", "Post not found.");
      return;
    }

    const reactionType = payload?.reactionType ?? "fire";
    if (!allowedReactionTypes.has(reactionType)) {
      sendError(response, 400, "INVALID_REACTION", "reactionType must be fire, support, or like.");
      return;
    }

    const item = await upsertReaction({
      postId: post.id,
      membershipId: actor.id,
      reactionType
    });
    sendJson(response, 200, item);
    return;
  }

  sendError(response, 404, "ROUTE_NOT_FOUND", `Unknown route ${url.pathname}`);
});

server.listen(port, () => {
  console.log(`[social-service] listening on http://localhost:${port}`);
});
