import { getFirebaseDataConnect } from "../../../../../packages/config/src/index.mjs";
import {
  connectorConfig as resourcesConnectorConfig,
  createResource as createResourceMutation,
  createResourceFile as createResourceFileMutation,
  getResourceDetail as getResourceDetailQuery,
  listCoursesByTenant,
  listResourcesByCourse,
  listResourcesByTenant
} from "../../../../../packages/dataconnect/resources-admin-sdk/esm/index.esm.js";
import { readJson, sendError, sendJson } from "../../lib/http.mjs";
import { trackActivity } from "../moderation/repository.mjs";
import { resolveLiveContext } from "../shared/viewer-context.mjs";

const allowedResourceTypes = new Set(["notes", "pyq", "guide"]);
const maxResourceFilesPerCreate = 6;

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

  const resolved = await resolveLiveContext(context.actor);

  if (request.method === "GET" && url.pathname === "/v1/courses") {
    const limit = parseLimit(url.searchParams.get("limit"));

    if (!resolved?.live?.tenant) {
      sendError(response, 401, "UNAUTHENTICATED", "An authenticated membership is required.");
      return true;
    }

    if (limit === null) {
      sendError(response, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 50.");
      return true;
    }

    try {
      const data = await listCoursesByTenant(getFirebaseDataConnect(resourcesConnectorConfig), {
        tenantId: resolved.live.tenant.id,
        limit
      });

      sendJson(response, 200, {
        tenantId: resolved.live.tenant.id,
        items: data.data.courses.map((item) => ({
          id: item.id,
          tenantId: item.tenantId,
          code: item.code,
          title: item.title,
          semester: typeof item.semester === "number" ? item.semester : null,
          branch: item.branch ?? null,
          createdAt: item.createdAt
        }))
      });
      return true;
    } catch (error) {
      console.error("[resources] courses-failed", {
        tenantId: resolved.live.tenant.id,
        message: error instanceof Error ? error.message : "unknown"
      });
      sendError(response, 502, "COURSES_UNAVAILABLE", "Courses are unavailable right now.");
      return true;
    }
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

    if (!resolved?.live?.tenant) {
      sendError(response, 401, "UNAUTHENTICATED", "An authenticated membership is required.");
      return true;
    }

    if (tenantId.trim() !== resolved.live.tenant.id) {
      sendError(response, 403, "FORBIDDEN", "Requested tenant does not match your active membership.");
      return true;
    }

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
        items: data.data.resources.filter((item) => item.tenantId === resolved.live.tenant.id).map((item) => ({
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
    } catch (error) {
      console.error("[resources] list-failed", {
        tenantId: resolved.live.tenant.id,
        courseId,
        message: error instanceof Error ? error.message : "unknown"
      });
      sendError(response, 502, "RESOURCES_UNAVAILABLE", "Resources are unavailable right now.");
      return true;
    }
  }

  const detailMatch = request.method === "GET" ? url.pathname.match(/^\/v1\/resources\/([^/]+)$/) : null;
  if (detailMatch) {
    if (!resolved?.live?.tenant) {
      sendError(response, 401, "UNAUTHENTICATED", "An authenticated membership is required.");
      return true;
    }

    try {
      const data = await getResourceDetailQuery(getFirebaseDataConnect(resourcesConnectorConfig), {
        resourceId: detailMatch[1]
      });

      if (!data.data.resource) {
        sendError(response, 404, "RESOURCE_NOT_FOUND", "Resource not found.");
        return true;
      }

      if (data.data.resource.tenantId !== resolved.live.tenant.id) {
        sendError(response, 404, "RESOURCE_NOT_FOUND", "Resource not found.");
        return true;
      }

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
    } catch (error) {
      console.error("[resources] detail-failed", {
        resourceId: detailMatch[1],
        message: error instanceof Error ? error.message : "unknown"
      });
      sendError(response, 502, "RESOURCES_UNAVAILABLE", "Resource details are unavailable right now.");
      return true;
    }
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

    const rawFiles = Array.isArray(payload.files) ? payload.files.slice(0, maxResourceFilesPerCreate) : [];
    const files = rawFiles
      .filter(
        (item) =>
          item &&
          typeof item === "object" &&
          requireNonEmptyString(item.storagePath) &&
          requireNonEmptyString(item.fileName) &&
          requireNonEmptyString(item.mimeType) &&
          Number.isFinite(Number(item.sizeBytes)) &&
          Number(item.sizeBytes) > 0
      )
      .map((item) => ({
        storagePath: item.storagePath.trim(),
        fileName: item.fileName.trim(),
        mimeType: item.mimeType.trim(),
        sizeBytes: Number(item.sizeBytes)
      }));

    if (!resolved?.live?.tenant || !resolved.live.membership) {
      sendError(response, 401, "UNAUTHENTICATED", "An authenticated membership is required.");
      return true;
    }

    try {
      const created = await createResourceMutation(getFirebaseDataConnect(resourcesConnectorConfig), {
        tenantId: resolved.live.tenant.id,
        membershipId: resolved.live.membership.id,
        courseId: requireNonEmptyString(payload.courseId) ? payload.courseId : null,
        title: payload.title.trim(),
        description: requireNonEmptyString(payload.description) ? payload.description.trim() : null,
        type: payload.type ?? "notes"
      });

      await Promise.all(
        files.map((file, index) =>
          createResourceFileMutation(getFirebaseDataConnect(resourcesConnectorConfig), {
            resourceFileKey: `${created.data.resource_insert.id}:${file.storagePath}:${index}`,
            tenantId: resolved.live.tenant.id,
            resourceId: created.data.resource_insert.id,
            storagePath: file.storagePath,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: String(file.sizeBytes)
          })
        )
      );

      await trackActivity({
        tenantId: resolved.live.tenant.id,
        membershipId: resolved.live.membership.id,
        activityType: "resource.created",
        entityType: "resource",
        entityId: created.data.resource_insert.id,
        metadata: {
          courseId: requireNonEmptyString(payload.courseId) ? payload.courseId : null,
          type: payload.type ?? "notes",
          fileCount: files.length
        },
        auditAction: "resource.created"
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
    } catch (error) {
      console.error("[resources] create-failed", {
        tenantId: resolved.live.tenant.id,
        membershipId: resolved.live.membership.id,
        message: error instanceof Error ? error.message : "unknown"
      });
      sendError(response, 502, "RESOURCE_CREATE_FAILED", "We could not create the resource right now.");
      return true;
    }
  }

  return false;
}
