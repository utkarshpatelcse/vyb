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

export interface CreateUserData {
  user_insert: User_Key;
}

export interface CreateUserVariables {
  firebaseUid: string;
  primaryEmail: string;
  emailVerified: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface Follow_Key {
  id: UUIDString;
  __typename?: 'Follow_Key';
}

export interface GetUserByFirebaseUidData {
  users: ({
    id: UUIDString;
    firebaseUid: string;
    primaryEmail: string;
    emailVerified: boolean;
    displayName?: string | null;
    avatarUrl?: string | null;
    status: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & User_Key)[];
}

export interface GetUserByFirebaseUidVariables {
  firebaseUid: string;
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

export interface UpdateUserProfileData {
  user_update?: User_Key | null;
}

export interface UpdateUserProfileVariables {
  id: UUIDString;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface UserActivity_Key {
  id: UUIDString;
  __typename?: 'UserActivity_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

/** Generated Node Admin SDK operation action function for the 'GetUserByFirebaseUid' Query. Allow users to execute without passing in DataConnect. */
export function getUserByFirebaseUid(dc: DataConnect, vars: GetUserByFirebaseUidVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserByFirebaseUidData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserByFirebaseUid' Query. Allow users to pass in custom DataConnect instances. */
export function getUserByFirebaseUid(vars: GetUserByFirebaseUidVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserByFirebaseUidData>>;

/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to execute without passing in DataConnect. */
export function createUser(dc: DataConnect, vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;
/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function createUser(vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUserProfile' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUserProfile(dc: DataConnect, vars: UpdateUserProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserProfileData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUserProfile' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUserProfile(vars: UpdateUserProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserProfileData>>;

