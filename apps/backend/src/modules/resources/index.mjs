import { getFirebaseDataConnect } from "../../../../../packages/config/src/index.mjs";
import {
  connectorConfig as resourcesConnectorConfig,
  createResource as createResourceMutation,
  getResourceDetail as getResourceDetailQuery,
  listResourcesByCourse,
  listResourcesByTenant
} from "../../../../../packages/dataconnect/resources-admin-sdk/esm/index.esm.js";
import { readJson, sendError, sendJson } from "../../lib/http.mjs";
import { resolveLiveContext } from "../shared/viewer-context.mjs";
import { createResource, getResourceDetail, listResources } from "./repository.mjs";

const allowedResourceTypes = new Set(["notes", "pyq", "guide"]);

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

export function getResourcesModuleHealth() {
  return {
    module: "resources",
    status: "ok"
  };
}

export async function handleResourcesRoute({ request, response, url, context }) {
  if (!context.actor) {
    return false;
  }

  if (request.method === "GET" && url.pathname === "/v1/resources") {
    const tenantId = url.searchParams.get("tenantId");
    const courseId = url.searchParams.get("courseId");
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
        const data = courseId
          ? await listResourcesByCourse(getFirebaseDataConnect(resourcesConnectorConfig), {
              courseId,
              limit
            })
          : await listResourcesByTenant(getFirebaseDataConnect(resourcesConnectorConfig), {
              tenantId: resolved.live.tenant.id,
              limit
            });

        sendJson(response, 200, {
          tenantId: resolved.live.tenant.id,
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
        return true;
      } catch {
        // fall through to local starter data
      }
    }

    const items = await listResources({ tenantId, courseId, limit });
    sendJson(response, 200, {
      tenantId,
      courseId,
      items,
      nextCursor: null
    });
    return true;
  }

  const detailMatch = request.method === "GET" ? url.pathname.match(/^\/v1\/resources\/([^/]+)$/) : null;
  if (detailMatch) {
    const resolved = await resolveLiveContext(context.actor);
    if (resolved?.live?.tenant) {
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
          return true;
        }
      } catch {
        // fall through to local starter data
      }
    }

    const item = await getResourceDetail(detailMatch[1]);
    if (!item) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", "Resource not found.");
      return true;
    }

    sendJson(response, 200, { item });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/resources") {
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

    if (!allowedResourceTypes.has(payload.type ?? "notes")) {
      sendError(response, 400, "INVALID_TYPE", "type must be notes, pyq, or guide.");
      return true;
    }

    if (!requireNonEmptyString(payload.title) || payload.title.trim().length < 4) {
      sendError(response, 400, "INVALID_TITLE", "title must be at least 4 characters long.");
      return true;
    }

    const resolved = await resolveLiveContext(context.actor);
    if (resolved?.live?.tenant && resolved.live.membership) {
      try {
        const created = await createResourceMutation(getFirebaseDataConnect(resourcesConnectorConfig), {
          tenantId: resolved.live.tenant.id,
          membershipId: resolved.live.membership.id,
          courseId: requireNonEmptyString(payload.courseId) ? payload.courseId : null,
          title: payload.title.trim(),
          description: requireNonEmptyString(payload.description) ? payload.description.trim() : null,
          type: payload.type ?? "notes"
        });

        sendJson(response, 201, {
          item: {
            id: created.data.resource_insert.id,
            tenantId: resolved.live.tenant.id,
            membershipId: resolved.live.membership.id,
            courseId: requireNonEmptyString(payload.courseId) ? payload.courseId : null,
            title: payload.title.trim(),
            description: requireNonEmptyString(payload.description) ? payload.description.trim() : "",
            type: payload.type ?? "notes",
            downloads: 0,
            status: "pending",
            createdAt: new Date().toISOString()
          }
        });
        return true;
      } catch {
        // fall through to local starter data
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
    return true;
  }

  return false;
}
