import { createServer } from "node:http";
import { ensureMembershipContext, getFirebaseDataConnect, loadRootEnv } from "../../../packages/config/src/index.mjs";
import {
  connectorConfig as resourcesConnectorConfig,
  createResource as createResourceMutation,
  getResourceDetail as getResourceDetailQuery,
  listResourcesByCourse,
  listResourcesByTenant
} from "../../../packages/dataconnect/resources-admin-sdk/esm/index.esm.js";
import { createResource, getResourceDetail, listResources } from "./repository.mjs";

const port = Number(process.env.PORT ?? 4104);
const allowedResourceTypes = new Set(["notes", "pyq", "guide"]);
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
      service: "resources-service",
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

  if (request.method === "GET" && url.pathname === "/v1/resources") {
    const tenantId = url.searchParams.get("tenantId");
    const courseId = url.searchParams.get("courseId");
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
        const data = courseId
          ? await listResourcesByCourse(getFirebaseDataConnect(resourcesConnectorConfig), {
              courseId,
              limit
            })
          : await listResourcesByTenant(getFirebaseDataConnect(resourcesConnectorConfig), {
              tenantId: live.tenant.id,
              limit
            });

        sendJson(response, 200, {
          tenantId: live.tenant.id,
          courseId,
          items: data.data.resources.map((item) => ({
            id: item.id,
            tenantId: item.tenantId,
            membershipId: item.membershipId,
            courseId: item.courseId ?? null,
            title: item.title,
            description: item.description ?? "",
            type: item.type,
            downloads: 0,
            status: item.status,
            createdAt: item.createdAt
          })),
          nextCursor: null
        });
        return;
      } catch {
        // fall through to local dev store
      }
    }

    const items = await listResources({ tenantId, courseId, limit });

    sendJson(response, 200, {
      tenantId,
      courseId,
      items,
      nextCursor: null
    });
    return;
  }

  const detailMatch = request.method === "GET" ? url.pathname.match(/^\/v1\/resources\/([^/]+)$/) : null;
  if (detailMatch) {
    const live = await resolveLiveContext(actor);
    if (live) {
      try {
        const data = await getResourceDetailQuery(getFirebaseDataConnect(resourcesConnectorConfig), {
          resourceId: detailMatch[1]
        });

        if (data.data.resource) {
          sendJson(response, 200, {
            item: {
              id: data.data.resource.id,
              tenantId: data.data.resource.tenantId,
              membershipId: data.data.resource.membershipId,
              courseId: data.data.resource.courseId ?? null,
              title: data.data.resource.title,
              description: data.data.resource.description ?? "",
              type: data.data.resource.type,
              downloads: 0,
              status: data.data.resource.status,
              createdAt: data.data.resource.createdAt,
              files: data.data.resourceFiles.map((file) => ({
                id: file.id,
                resourceId: file.resourceId,
                fileName: file.fileName,
                mimeType: file.mimeType,
                sizeBytes: Number(file.sizeBytes)
              }))
            }
          });
          return;
        }
      } catch {
        // fall through to local dev store
      }
    }

    const item = await getResourceDetail(detailMatch[1]);
    if (!item) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", "Resource not found.");
      return;
    }

    sendJson(response, 200, {
      item
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/resources") {
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

    if (!allowedResourceTypes.has(payload.type ?? "notes")) {
      sendError(response, 400, "INVALID_TYPE", "type must be notes, pyq, or guide.");
      return;
    }

    if (!requireNonEmptyString(payload.title) || payload.title.trim().length < 4) {
      sendError(response, 400, "INVALID_TITLE", "title must be at least 4 characters long.");
      return;
    }

    const live = await resolveLiveContext(actor);
    if (live) {
      try {
        const created = await createResourceMutation(getFirebaseDataConnect(resourcesConnectorConfig), {
          tenantId: live.tenant.id,
          membershipId: live.membership.id,
          courseId: requireNonEmptyString(payload.courseId) ? payload.courseId : null,
          title: payload.title.trim(),
          description: requireNonEmptyString(payload.description) ? payload.description.trim() : null,
          type: payload.type ?? "notes"
        });

        sendJson(response, 201, {
          item: {
            id: created.data.resource_insert.id,
            tenantId: live.tenant.id,
            membershipId: live.membership.id,
            courseId: requireNonEmptyString(payload.courseId) ? payload.courseId : null,
            title: payload.title.trim(),
            description: requireNonEmptyString(payload.description) ? payload.description.trim() : "",
            type: payload.type ?? "notes",
            downloads: 0,
            status: "pending",
            createdAt: new Date().toISOString()
          }
        });
        return;
      } catch {
        // fall through to local dev store
      }
    }

    const item = await createResource({
      tenantId: payload.tenantId,
      membershipId: payload.membershipId,
      courseId: payload.courseId ?? null,
      title: payload.title.trim(),
      description: requireNonEmptyString(payload.description) ? payload.description.trim() : "",
      type: payload.type ?? "notes"
    });
    sendJson(response, 201, { item });
    return;
  }

  sendError(response, 404, "ROUTE_NOT_FOUND", `Unknown route ${url.pathname}`);
});

server.listen(port, () => {
  console.log(`[resources-service] listening on http://localhost:${port}`);
});
