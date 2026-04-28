import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface AuditLog_Key {
  id: UUIDString;
  __typename?: 'AuditLog_Key';
}

export interface CampusEventStore_Key {
  id: UUIDString;
  __typename?: 'CampusEventStore_Key';
}

export interface ChatConversation_Key {
  id: UUIDString;
  __typename?: 'ChatConversation_Key';
}

export interface ChatIdentity_Key {
  id: UUIDString;
  __typename?: 'ChatIdentity_Key';
}

export interface ChatMessageReaction_Key {
  id: UUIDString;
  __typename?: 'ChatMessageReaction_Key';
}

export interface ChatMessage_Key {
  id: UUIDString;
  __typename?: 'ChatMessage_Key';
}

export interface ChatParticipant_Key {
  id: UUIDString;
  __typename?: 'ChatParticipant_Key';
}

export interface CommentReaction_Key {
  id: UUIDString;
  __typename?: 'CommentReaction_Key';
}

export interface Comment_Key {
  id: UUIDString;
  __typename?: 'Comment_Key';
}

export interface CommunityMembership_Key {
  id: UUIDString;
  __typename?: 'CommunityMembership_Key';
}

export interface Community_Key {
  id: UUIDString;
  __typename?: 'Community_Key';
}

export interface ConnectLevelStore_Key {
  id: string;
  __typename?: 'ConnectLevelStore_Key';
}

export interface Course_Key {
  id: UUIDString;
  __typename?: 'Course_Key';
}

export interface CreateAuditLogData {
  auditLog_insert: AuditLog_Key;
}

export interface CreateAuditLogVariables {
  tenantId?: UUIDString | null;
  membershipId?: UUIDString | null;
  action: string;
  entityType: string;
  entityId: string;
  metadataJson?: unknown | null;
}

export interface CreateModerationCaseData {
  moderationCase_insert: ModerationCase_Key;
}

export interface CreateModerationCaseVariables {
  tenantId: UUIDString;
  reportId: UUIDString;
  assignedUserId?: UUIDString | null;
  decision?: string | null;
  notes?: string | null;
}

export interface CreateReportData {
  report_insert: Report_Key;
}

export interface CreateReportVariables {
  tenantId: UUIDString;
  membershipId: UUIDString;
  targetType: string;
  targetId: string;
  reason: string;
}

export interface CreateUserActivityData {
  userActivity_insert: UserActivity_Key;
}

export interface CreateUserActivityVariables {
  tenantId: UUIDString;
  membershipId: UUIDString;
  activityType: string;
  entityType?: string | null;
  entityId?: string | null;
  metadataJson?: unknown | null;
}

export interface Follow_Key {
  id: UUIDString;
  __typename?: 'Follow_Key';
}

export interface ListAuditLogsByTenantData {
  auditLogs: ({
    id: UUIDString;
    tenantId?: UUIDString | null;
    membershipId?: UUIDString | null;
    action: string;
    entityType: string;
    entityId: string;
    metadataJson?: unknown | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & AuditLog_Key)[];
}

export interface ListAuditLogsByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListModerationCasesByTenantData {
  moderationCases: ({
    id: UUIDString;
    tenantId: UUIDString;
    reportId: UUIDString;
    assignedUserId?: UUIDString | null;
    decision?: string | null;
    notes?: string | null;
    resolvedAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & ModerationCase_Key)[];
}

export interface ListModerationCasesByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListReportsByTenantData {
  reports: ({
    id: UUIDString;
    tenantId: UUIDString;
    membershipId: UUIDString;
    targetType: string;
    targetId: string;
    reason: string;
    status: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Report_Key)[];
}

export interface ListReportsByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListUserActivityByMembershipData {
  userActivities: ({
    id: UUIDString;
    tenantId: UUIDString;
    membershipId: UUIDString;
    activityType: string;
    entityType?: string | null;
    entityId?: string | null;
    metadataJson?: unknown | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & UserActivity_Key)[];
}

export interface ListUserActivityByMembershipVariables {
  tenantId: UUIDString;
  membershipId: UUIDString;
  limit: number;
}

export interface MarketListingContact_Key {
  id: string;
  __typename?: 'MarketListingContact_Key';
}

export interface MarketListingMedia_Key {
  id: string;
  __typename?: 'MarketListingMedia_Key';
}

export interface MarketListingSave_Key {
  id: string;
  __typename?: 'MarketListingSave_Key';
}

export interface MarketListing_Key {
  id: string;
  __typename?: 'MarketListing_Key';
}

export interface MarketRequestContact_Key {
  id: string;
  __typename?: 'MarketRequestContact_Key';
}

export interface MarketRequestMedia_Key {
  id: string;
  __typename?: 'MarketRequestMedia_Key';
}

export interface MarketRequest_Key {
  id: string;
  __typename?: 'MarketRequest_Key';
}

export interface ModerationCase_Key {
  id: UUIDString;
  __typename?: 'ModerationCase_Key';
}

export interface PostMedia_Key {
  id: UUIDString;
  __typename?: 'PostMedia_Key';
}

export interface PostSave_Key {
  id: UUIDString;
  __typename?: 'PostSave_Key';
}

export interface Post_Key {
  id: UUIDString;
  __typename?: 'Post_Key';
}

export interface Reaction_Key {
  id: UUIDString;
  __typename?: 'Reaction_Key';
}

export interface Report_Key {
  id: UUIDString;
  __typename?: 'Report_Key';
}

export interface ResolveModerationCaseData {
  moderationCase_update?: ModerationCase_Key | null;
}

export interface ResolveModerationCaseVariables {
  id: UUIDString;
  decision: string;
  notes?: string | null;
}

export interface ResourceFile_Key {
  id: UUIDString;
  __typename?: 'ResourceFile_Key';
}

export interface Resource_Key {
  id: UUIDString;
  __typename?: 'Resource_Key';
}

export interface StoryReaction_Key {
  id: UUIDString;
  __typename?: 'StoryReaction_Key';
}

export interface StoryView_Key {
  id: UUIDString;
  __typename?: 'StoryView_Key';
}

export interface Story_Key {
  id: UUIDString;
  __typename?: 'Story_Key';
}

export interface TenantDomain_Key {
  id: UUIDString;
  __typename?: 'TenantDomain_Key';
}

export interface TenantMembership_Key {
  id: UUIDString;
  __typename?: 'TenantMembership_Key';
}

export interface Tenant_Key {
  id: UUIDString;
  __typename?: 'Tenant_Key';
}

export interface UserActivity_Key {
  id: UUIDString;
  __typename?: 'UserActivity_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

/** Generated Node Admin SDK operation action function for the 'ListUserActivityByMembership' Query. Allow users to execute without passing in DataConnect. */
export function listUserActivityByMembership(dc: DataConnect, vars: ListUserActivityByMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListUserActivityByMembershipData>>;
/** Generated Node Admin SDK operation action function for the 'ListUserActivityByMembership' Query. Allow users to pass in custom DataConnect instances. */
export function listUserActivityByMembership(vars: ListUserActivityByMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListUserActivityByMembershipData>>;

/** Generated Node Admin SDK operation action function for the 'ListReportsByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listReportsByTenant(dc: DataConnect, vars: ListReportsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListReportsByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListReportsByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listReportsByTenant(vars: ListReportsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListReportsByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListModerationCasesByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listModerationCasesByTenant(dc: DataConnect, vars: ListModerationCasesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListModerationCasesByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListModerationCasesByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listModerationCasesByTenant(vars: ListModerationCasesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListModerationCasesByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListAuditLogsByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listAuditLogsByTenant(dc: DataConnect, vars: ListAuditLogsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAuditLogsByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListAuditLogsByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listAuditLogsByTenant(vars: ListAuditLogsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAuditLogsByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'CreateUserActivity' Mutation. Allow users to execute without passing in DataConnect. */
export function createUserActivity(dc: DataConnect, vars: CreateUserActivityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserActivityData>>;
/** Generated Node Admin SDK operation action function for the 'CreateUserActivity' Mutation. Allow users to pass in custom DataConnect instances. */
export function createUserActivity(vars: CreateUserActivityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserActivityData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAuditLog' Mutation. Allow users to execute without passing in DataConnect. */
export function createAuditLog(dc: DataConnect, vars: CreateAuditLogVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAuditLogData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAuditLog' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAuditLog(vars: CreateAuditLogVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAuditLogData>>;

/** Generated Node Admin SDK operation action function for the 'CreateReport' Mutation. Allow users to execute without passing in DataConnect. */
export function createReport(dc: DataConnect, vars: CreateReportVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateReportData>>;
/** Generated Node Admin SDK operation action function for the 'CreateReport' Mutation. Allow users to pass in custom DataConnect instances. */
export function createReport(vars: CreateReportVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateReportData>>;

/** Generated Node Admin SDK operation action function for the 'CreateModerationCase' Mutation. Allow users to execute without passing in DataConnect. */
export function createModerationCase(dc: DataConnect, vars: CreateModerationCaseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateModerationCaseData>>;
/** Generated Node Admin SDK operation action function for the 'CreateModerationCase' Mutation. Allow users to pass in custom DataConnect instances. */
export function createModerationCase(vars: CreateModerationCaseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateModerationCaseData>>;

/** Generated Node Admin SDK operation action function for the 'ResolveModerationCase' Mutation. Allow users to execute without passing in DataConnect. */
export function resolveModerationCase(dc: DataConnect, vars: ResolveModerationCaseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResolveModerationCaseData>>;
/** Generated Node Admin SDK operation action function for the 'ResolveModerationCase' Mutation. Allow users to pass in custom DataConnect instances. */
export function resolveModerationCase(vars: ResolveModerationCaseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResolveModerationCaseData>>;

