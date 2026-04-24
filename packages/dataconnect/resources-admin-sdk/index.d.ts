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

export interface Course_Key {
  id: UUIDString;
  __typename?: 'Course_Key';
}

export interface CreateCourseData {
  course_insert: Course_Key;
}

export interface CreateCourseVariables {
  tenantId: UUIDString;
  code: string;
  title: string;
  semester?: number | null;
  branch?: string | null;
}

export interface CreateResourceData {
  resource_insert: Resource_Key;
}

export interface CreateResourceFileData {
  resourceFile_insert: ResourceFile_Key;
}

export interface CreateResourceFileVariables {
  resourceFileKey: string;
  tenantId: UUIDString;
  resourceId: UUIDString;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: Int64String;
}

export interface CreateResourceVariables {
  tenantId: UUIDString;
  courseId?: UUIDString | null;
  membershipId: UUIDString;
  type: string;
  title: string;
  description?: string | null;
}

export interface Follow_Key {
  id: UUIDString;
  __typename?: 'Follow_Key';
}

export interface GetResourceDetailData {
  resource?: {
    id: UUIDString;
    tenantId: UUIDString;
    courseId?: UUIDString | null;
    membershipId: UUIDString;
    type: string;
    title: string;
    description?: string | null;
    status: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Resource_Key;
    resourceFiles: ({
      id: UUIDString;
      resourceId: UUIDString;
      fileName: string;
      mimeType: string;
      sizeBytes: Int64String;
      storagePath: string;
    } & ResourceFile_Key)[];
}

export interface GetResourceDetailVariables {
  resourceId: UUIDString;
}

export interface ListCoursesByTenantData {
  courses: ({
    id: UUIDString;
    tenantId: UUIDString;
    code: string;
    title: string;
    semester?: number | null;
    branch?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Course_Key)[];
}

export interface ListCoursesByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListResourcesByCourseData {
  resources: ({
    id: UUIDString;
    tenantId: UUIDString;
    courseId?: UUIDString | null;
    membershipId: UUIDString;
    type: string;
    title: string;
    description?: string | null;
    status: string;
    createdAt: TimestampString;
  } & Resource_Key)[];
}

export interface ListResourcesByCourseVariables {
  courseId: UUIDString;
  limit: number;
}

export interface ListResourcesByTenantData {
  resources: ({
    id: UUIDString;
    tenantId: UUIDString;
    courseId?: UUIDString | null;
    membershipId: UUIDString;
    type: string;
    title: string;
    description?: string | null;
    status: string;
    createdAt: TimestampString;
  } & Resource_Key)[];
}

export interface ListResourcesByTenantVariables {
  tenantId: UUIDString;
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

/** Generated Node Admin SDK operation action function for the 'ListCoursesByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listCoursesByTenant(dc: DataConnect, vars: ListCoursesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCoursesByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListCoursesByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listCoursesByTenant(vars: ListCoursesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCoursesByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListResourcesByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listResourcesByTenant(dc: DataConnect, vars: ListResourcesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListResourcesByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListResourcesByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listResourcesByTenant(vars: ListResourcesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListResourcesByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListResourcesByCourse' Query. Allow users to execute without passing in DataConnect. */
export function listResourcesByCourse(dc: DataConnect, vars: ListResourcesByCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListResourcesByCourseData>>;
/** Generated Node Admin SDK operation action function for the 'ListResourcesByCourse' Query. Allow users to pass in custom DataConnect instances. */
export function listResourcesByCourse(vars: ListResourcesByCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListResourcesByCourseData>>;

/** Generated Node Admin SDK operation action function for the 'GetResourceDetail' Query. Allow users to execute without passing in DataConnect. */
export function getResourceDetail(dc: DataConnect, vars: GetResourceDetailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetResourceDetailData>>;
/** Generated Node Admin SDK operation action function for the 'GetResourceDetail' Query. Allow users to pass in custom DataConnect instances. */
export function getResourceDetail(vars: GetResourceDetailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetResourceDetailData>>;

/** Generated Node Admin SDK operation action function for the 'CreateCourse' Mutation. Allow users to execute without passing in DataConnect. */
export function createCourse(dc: DataConnect, vars: CreateCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCourseData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCourse' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCourse(vars: CreateCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCourseData>>;

/** Generated Node Admin SDK operation action function for the 'CreateResource' Mutation. Allow users to execute without passing in DataConnect. */
export function createResource(dc: DataConnect, vars: CreateResourceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateResourceData>>;
/** Generated Node Admin SDK operation action function for the 'CreateResource' Mutation. Allow users to pass in custom DataConnect instances. */
export function createResource(vars: CreateResourceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateResourceData>>;

/** Generated Node Admin SDK operation action function for the 'CreateResourceFile' Mutation. Allow users to execute without passing in DataConnect. */
export function createResourceFile(dc: DataConnect, vars: CreateResourceFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateResourceFileData>>;
/** Generated Node Admin SDK operation action function for the 'CreateResourceFile' Mutation. Allow users to pass in custom DataConnect instances. */
export function createResourceFile(vars: CreateResourceFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateResourceFileData>>;

