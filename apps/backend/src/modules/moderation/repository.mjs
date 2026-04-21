import { getFirebaseDataConnect } from "../../../../../packages/config/src/index.mjs";
import {
  connectorConfig as moderationConnectorConfig,
  createAuditLog as createAuditLogMutation,
  createModerationCase as createModerationCaseMutation,
  createReport as createReportMutation,
  createUserActivity as createUserActivityMutation,
  listAuditLogsByTenant as listAuditLogsByTenantQuery,
  listModerationCasesByTenant as listModerationCasesByTenantQuery,
  listReportsByTenant as listReportsByTenantQuery,
  listUserActivityByMembership as listUserActivityByMembershipQuery,
  resolveModerationCase as resolveModerationCaseMutation
} from "../../../../../packages/dataconnect/moderation-admin-sdk/esm/index.esm.js";

function getModerationDc() {
  return getFirebaseDataConnect(moderationConnectorConfig);
}

function toDate(value) {
  const parsed = new Date(value ?? Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toIsoString(value) {
  return toDate(value).toISOString();
}

function normalizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata;
}

function mapActivityRecord(item) {
  return {
    id: item.id,
    tenantId: item.tenantId,
    membershipId: item.membershipId,
    activityType: item.activityType,
    entityType: item.entityType ?? null,
    entityId: item.entityId ?? null,
    metadata: normalizeMetadata(item.metadataJson),
    createdAt: toIsoString(item.createdAt)
  };
}

function mapReportRecord(item) {
  return {
    id: item.id,
    tenantId: item.tenantId,
    membershipId: item.membershipId,
    targetType: item.targetType,
    targetId: item.targetId,
    reason: item.reason,
    status: item.status,
    createdAt: toIsoString(item.createdAt),
    updatedAt: toIsoString(item.updatedAt)
  };
}

function mapModerationCaseRecord(item) {
  return {
    id: item.id,
    tenantId: item.tenantId,
    reportId: item.reportId,
    assignedUserId: item.assignedUserId ?? null,
    decision: item.decision ?? null,
    notes: item.notes ?? null,
    resolvedAt: item.resolvedAt ? toIsoString(item.resolvedAt) : null,
    createdAt: toIsoString(item.createdAt),
    updatedAt: toIsoString(item.updatedAt)
  };
}

function mapAuditLogRecord(item) {
  return {
    id: item.id,
    tenantId: item.tenantId ?? null,
    membershipId: item.membershipId ?? null,
    action: item.action,
    entityType: item.entityType,
    entityId: item.entityId,
    metadata: normalizeMetadata(item.metadataJson),
    createdAt: toIsoString(item.createdAt),
    updatedAt: toIsoString(item.updatedAt)
  };
}

export async function listUserActivity({ tenantId, membershipId, limit = 24 }) {
  const response = await listUserActivityByMembershipQuery(getModerationDc(), {
    tenantId,
    membershipId,
    limit
  });

  return response.data.userActivities.map((item) => mapActivityRecord(item));
}

export async function recordUserActivity({
  tenantId,
  membershipId,
  activityType,
  entityType = null,
  entityId = null,
  metadata = null
}) {
  const created = await createUserActivityMutation(getModerationDc(), {
    tenantId,
    membershipId,
    activityType,
    entityType,
    entityId,
    metadataJson: normalizeMetadata(metadata)
  });

  return {
    id: created.data.userActivity_insert.id,
    tenantId,
    membershipId,
    activityType,
    entityType,
    entityId,
    metadata: normalizeMetadata(metadata),
    createdAt: new Date().toISOString()
  };
}

export async function recordAuditLog({
  tenantId = null,
  membershipId = null,
  action,
  entityType,
  entityId,
  metadata = null
}) {
  const created = await createAuditLogMutation(getModerationDc(), {
    tenantId,
    membershipId,
    action,
    entityType,
    entityId,
    metadataJson: normalizeMetadata(metadata)
  });

  return {
    id: created.data.auditLog_insert.id,
    tenantId,
    membershipId,
    action,
    entityType,
    entityId,
    metadata: normalizeMetadata(metadata),
    createdAt: new Date().toISOString()
  };
}

export async function trackActivity({
  tenantId,
  membershipId,
  activityType,
  entityType = null,
  entityId = null,
  metadata = null,
  auditAction = null
}) {
  const operations = [
    recordUserActivity({
      tenantId,
      membershipId,
      activityType,
      entityType,
      entityId,
      metadata
    })
  ];

  if (auditAction) {
    operations.push(
      recordAuditLog({
        tenantId,
        membershipId,
        action: auditAction,
        entityType: entityType ?? "unknown",
        entityId: entityId ?? "unknown",
        metadata
      })
    );
  }

  const results = await Promise.allSettled(operations);

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[moderation] activity-log-failed", {
        activityType,
        entityType,
        entityId,
        message: result.reason instanceof Error ? result.reason.message : "unknown"
      });
    }
  }
}

export async function createReportRecord({ tenantId, membershipId, targetType, targetId, reason }) {
  const created = await createReportMutation(getModerationDc(), {
    tenantId,
    membershipId,
    targetType,
    targetId,
    reason
  });

  return {
    id: created.data.report_insert.id,
    tenantId,
    membershipId,
    targetType,
    targetId,
    reason,
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export async function listReports({ tenantId, limit = 50 }) {
  const response = await listReportsByTenantQuery(getModerationDc(), {
    tenantId,
    limit
  });

  return response.data.reports.map((item) => mapReportRecord(item));
}

export async function createModerationCaseRecord({
  tenantId,
  reportId,
  assignedUserId = null,
  decision = null,
  notes = null
}) {
  const created = await createModerationCaseMutation(getModerationDc(), {
    tenantId,
    reportId,
    assignedUserId,
    decision,
    notes
  });

  return {
    id: created.data.moderationCase_insert.id,
    tenantId,
    reportId,
    assignedUserId,
    decision,
    notes,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export async function resolveModerationCaseRecord({ id, decision, notes = null }) {
  await resolveModerationCaseMutation(getModerationDc(), {
    id,
    decision,
    notes
  });

  return {
    id,
    decision,
    notes,
    resolvedAt: new Date().toISOString()
  };
}

export async function listModerationCases({ tenantId, limit = 50 }) {
  const response = await listModerationCasesByTenantQuery(getModerationDc(), {
    tenantId,
    limit
  });

  return response.data.moderationCases.map((item) => mapModerationCaseRecord(item));
}

export async function listAuditLogs({ tenantId, limit = 50 }) {
  const response = await listAuditLogsByTenantQuery(getModerationDc(), {
    tenantId,
    limit
  });

  return response.data.auditLogs.map((item) => mapAuditLogRecord(item));
}
