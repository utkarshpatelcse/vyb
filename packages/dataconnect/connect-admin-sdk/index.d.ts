import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

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

export interface CreateConnectLevelStoreData {
  connectLevelStore_insert: ConnectLevelStore_Key;
}

export interface CreateConnectLevelStoreVariables {
  id: string;
  payloadJson: string;
  totalLevels: number;
  launchDate?: string | null;
  checksum?: string | null;
}

export interface Follow_Key {
  id: UUIDString;
  __typename?: 'Follow_Key';
}

export interface GetConnectLevelStoreData {
  connectLevelStore?: {
    id: string;
    payloadJson: string;
    totalLevels: number;
    launchDate?: string | null;
    checksum?: string | null;
    updatedAt: TimestampString;
  } & ConnectLevelStore_Key;
}

export interface GetConnectLevelStoreVariables {
  id: string;
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

export interface UpdateConnectLevelStoreData {
  connectLevelStore_update?: ConnectLevelStore_Key | null;
}

export interface UpdateConnectLevelStoreVariables {
  id: string;
  payloadJson: string;
  totalLevels: number;
  launchDate?: string | null;
  checksum?: string | null;
}

export interface UserActivity_Key {
  id: UUIDString;
  __typename?: 'UserActivity_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface GetConnectLevelStoreRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetConnectLevelStoreVariables): QueryRef<GetConnectLevelStoreData, GetConnectLevelStoreVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetConnectLevelStoreVariables): QueryRef<GetConnectLevelStoreData, GetConnectLevelStoreVariables>;
  operationName: string;
}
export const getConnectLevelStoreRef: GetConnectLevelStoreRef;

export function getConnectLevelStore(vars: GetConnectLevelStoreVariables, options?: ExecuteQueryOptions): QueryPromise<GetConnectLevelStoreData, GetConnectLevelStoreVariables>;
export function getConnectLevelStore(dc: DataConnect, vars: GetConnectLevelStoreVariables, options?: ExecuteQueryOptions): QueryPromise<GetConnectLevelStoreData, GetConnectLevelStoreVariables>;

interface CreateConnectLevelStoreRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateConnectLevelStoreVariables): MutationRef<CreateConnectLevelStoreData, CreateConnectLevelStoreVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateConnectLevelStoreVariables): MutationRef<CreateConnectLevelStoreData, CreateConnectLevelStoreVariables>;
  operationName: string;
}
export const createConnectLevelStoreRef: CreateConnectLevelStoreRef;

export function createConnectLevelStore(vars: CreateConnectLevelStoreVariables): MutationPromise<CreateConnectLevelStoreData, CreateConnectLevelStoreVariables>;
export function createConnectLevelStore(dc: DataConnect, vars: CreateConnectLevelStoreVariables): MutationPromise<CreateConnectLevelStoreData, CreateConnectLevelStoreVariables>;

interface UpdateConnectLevelStoreRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateConnectLevelStoreVariables): MutationRef<UpdateConnectLevelStoreData, UpdateConnectLevelStoreVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateConnectLevelStoreVariables): MutationRef<UpdateConnectLevelStoreData, UpdateConnectLevelStoreVariables>;
  operationName: string;
}
export const updateConnectLevelStoreRef: UpdateConnectLevelStoreRef;

export function updateConnectLevelStore(vars: UpdateConnectLevelStoreVariables): MutationPromise<UpdateConnectLevelStoreData, UpdateConnectLevelStoreVariables>;
export function updateConnectLevelStore(dc: DataConnect, vars: UpdateConnectLevelStoreVariables): MutationPromise<UpdateConnectLevelStoreData, UpdateConnectLevelStoreVariables>;
