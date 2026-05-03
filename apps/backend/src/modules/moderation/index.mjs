import { readJson, sendError, sendJson } from "../../lib/http.mjs";
import { resolveLiveContext } from "../shared/viewer-context.mjs";
import {
  createModerationCaseRecord,
  createReportRecord,
  listAuditLogs,
  listModerationCases,
  listReports,
  listUserActivity,
  resolveModerationCaseRecord,
  trackActivity
} from "./repository.mjs";

function requireNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseLimit(value, fallback = 20) {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    return null;
  }
  return parsed;
}

function hasModerationAccess(role) {
  return role === "admin" || role === "moderator";
}

function sendModerationMutationError(response, error) {
  if (Number.isInteger(error?.statusCode) && typeof error?.code === "string") {
    sendError(response, error.statusCode, error.code, error.message);
    return true;
  }

  throw error;
}

export function getModerationModuleHealth() {
  return {
    module: "moderation",
    status: "ok"
  };
}

export async function handleModerationRoute({ request, response, url, context }) {
  if (!context.actor) {
    return false;
  }

  const resolved = await resolveLiveContext(context.actor);
  if (!resolved?.live?.tenant || !resolved.live.membership) {
    return false;
  }

  const tenantId = resolved.live.tenant.id;
  const membershipId = resolved.live.membership.id;
  const membershipRole = resolved.live.membership.role;

  if (request.method === "GET" && url.pathname === "/v1/activity") {
    const limit = parseLimit(url.searchParams.get("limit"), 24);

    if (limit === null) {
      sendError(response, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 100.");
      return true;
    }

    const items = await listUserActivity({
      tenantId,
      membershipId,
      limit
    });

    sendJson(response, 200, {
      tenantId,
      items
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/reports") {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    if (!requireNonEmptyString(payload.targetType) || !requireNonEmptyString(payload.targetId) || !requireNonEmptyString(payload.reason)) {
      sendError(response, 400, "INVALID_REPORT", "targetType, targetId, and reason are required.");
      return true;
    }

    const item = await createReportRecord({
      tenantId,
      membershipId,
      targetType: payload.targetType.trim(),
      targetId: payload.targetId.trim(),
      reason: payload.reason.trim()
    });

    await trackActivity({
      tenantId,
      membershipId,
      activityType: "report.created",
      entityType: item.targetType,
      entityId: item.targetId,
      metadata: {
        reportId: item.id,
        reason: item.reason
      },
      auditAction: "report.created"
    });

    sendJson(response, 201, { item });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/reports") {
    if (!hasModerationAccess(membershipRole)) {
      sendError(response, 403, "FORBIDDEN", "Moderator access is required.");
      return true;
    }

    const limit = parseLimit(url.searchParams.get("limit"), 50);
    if (limit === null) {
      sendError(response, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 100.");
      return true;
    }

    sendJson(response, 200, {
      tenantId,
      items: await listReports({ tenantId, limit })
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/audit-logs") {
    if (!hasModerationAccess(membershipRole)) {
      sendError(response, 403, "FORBIDDEN", "Moderator access is required.");
      return true;
    }

    const limit = parseLimit(url.searchParams.get("limit"), 50);
    if (limit === null) {
      sendError(response, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 100.");
      return true;
    }

    sendJson(response, 200, {
      tenantId,
      items: await listAuditLogs({ tenantId, limit })
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/moderation/cases") {
    if (!hasModerationAccess(membershipRole)) {
      sendError(response, 403, "FORBIDDEN", "Moderator access is required.");
      return true;
    }

    const limit = parseLimit(url.searchParams.get("limit"), 50);
    if (limit === null) {
      sendError(response, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 100.");
      return true;
    }

    sendJson(response, 200, {
      tenantId,
      items: await listModerationCases({ tenantId, limit })
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/moderation/cases") {
    if (!hasModerationAccess(membershipRole)) {
      sendError(response, 403, "FORBIDDEN", "Moderator access is required.");
      return true;
    }

    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    if (!requireNonEmptyString(payload.reportId)) {
      sendError(response, 400, "INVALID_REPORT", "reportId is required.");
      return true;
    }

    let item;
    try {
      item = await createModerationCaseRecord({
        tenantId,
        reportId: payload.reportId.trim(),
        assignedUserId: requireNonEmptyString(payload.assignedUserId) ? payload.assignedUserId.trim() : null,
        decision: requireNonEmptyString(payload.decision) ? payload.decision.trim() : null,
        notes: requireNonEmptyString(payload.notes) ? payload.notes.trim() : null
      });
    } catch (error) {
      return sendModerationMutationError(response, error);
    }

    await trackActivity({
      tenantId,
      membershipId,
      activityType: "moderation.case.created",
      entityType: "moderation_case",
      entityId: item.id,
      metadata: {
        reportId: item.reportId,
        assignedUserId: item.assignedUserId
      },
      auditAction: "moderation.case.created"
    });

    sendJson(response, 201, { item });
    return true;
  }

  const resolveCaseMatch = request.method === "PATCH" ? url.pathname.match(/^\/v1\/moderation\/cases\/([^/]+)$/) : null;
  if (resolveCaseMatch) {
    if (!hasModerationAccess(membershipRole)) {
      sendError(response, 403, "FORBIDDEN", "Moderator access is required.");
      return true;
    }

    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    if (!requireNonEmptyString(payload.decision)) {
      sendError(response, 400, "INVALID_DECISION", "decision is required.");
      return true;
    }

    let item;
    try {
      item = await resolveModerationCaseRecord({
        tenantId,
        id: resolveCaseMatch[1],
        decision: payload.decision.trim(),
        notes: requireNonEmptyString(payload.notes) ? payload.notes.trim() : null
      });
    } catch (error) {
      return sendModerationMutationError(response, error);
    }

    await trackActivity({
      tenantId,
      membershipId,
      activityType: "moderation.case.resolved",
      entityType: "moderation_case",
      entityId: item.id,
      metadata: {
        decision: item.decision
      },
      auditAction: "moderation.case.resolved"
    });

    sendJson(response, 200, { item });
    return true;
  }

  return false;
}
