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

export interface CreatePostData {
  post_insert: Post_Key;
}

export interface CreatePostVariables {
  tenantId: UUIDString;
  communityId?: UUIDString | null;
  membershipId: UUIDString;
  kind: string;
  title?: string | null;
  body: string;
  status: string;
}

export interface ListCommentsByPostData {
  comments: ({
    id: UUIDString;
    postId: UUIDString;
    membershipId: UUIDString;
    parentCommentId?: UUIDString | null;
    body: string;
    status: string;
    createdAt: TimestampString;
  } & Comment_Key)[];
}

export interface ListCommentsByPostVariables {
  postId: UUIDString;
  limit: number;
}

export interface ListFeedByTenantData {
  posts: ({
    id: UUIDString;
    tenantId: UUIDString;
    communityId?: UUIDString | null;
    membershipId: UUIDString;
    kind: string;
    title?: string | null;
    body: string;
    status: string;
    createdAt: TimestampString;
  } & Post_Key)[];
}

export interface ListFeedByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ModerationCase_Key {
  id: UUIDString;
  __typename?: 'ModerationCase_Key';
}

export interface PostMedia_Key {
  id: UUIDString;
  __typename?: 'PostMedia_Key';
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

export interface SoftDeletePostData {
  post_update?: Post_Key | null;
}

export interface SoftDeletePostVariables {
  id: UUIDString;
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

/** Generated Node Admin SDK operation action function for the 'ListFeedByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listFeedByTenant(dc: DataConnect, vars: ListFeedByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFeedByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListFeedByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listFeedByTenant(vars: ListFeedByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFeedByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListCommentsByPost' Query. Allow users to execute without passing in DataConnect. */
export function listCommentsByPost(dc: DataConnect, vars: ListCommentsByPostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommentsByPostData>>;
/** Generated Node Admin SDK operation action function for the 'ListCommentsByPost' Query. Allow users to pass in custom DataConnect instances. */
export function listCommentsByPost(vars: ListCommentsByPostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommentsByPostData>>;

/** Generated Node Admin SDK operation action function for the 'CreatePost' Mutation. Allow users to execute without passing in DataConnect. */
export function createPost(dc: DataConnect, vars: CreatePostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePostData>>;
/** Generated Node Admin SDK operation action function for the 'CreatePost' Mutation. Allow users to pass in custom DataConnect instances. */
export function createPost(vars: CreatePostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePostData>>;

/** Generated Node Admin SDK operation action function for the 'SoftDeletePost' Mutation. Allow users to execute without passing in DataConnect. */
export function softDeletePost(dc: DataConnect, vars: SoftDeletePostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeletePostData>>;
/** Generated Node Admin SDK operation action function for the 'SoftDeletePost' Mutation. Allow users to pass in custom DataConnect instances. */
export function softDeletePost(vars: SoftDeletePostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeletePostData>>;

