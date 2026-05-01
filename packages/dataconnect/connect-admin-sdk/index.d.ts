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

export interface ConnectScore_Key {
  id: string;
  __typename?: 'ConnectScore_Key';
}

export interface ConnectSession_Key {
  id: string;
  __typename?: 'ConnectSession_Key';
}

export interface Course_Key {
  id: UUIDString;
  __typename?: 'Course_Key';
}

export interface CreateConnectScoreData {
  connectScore_insert: ConnectScore_Key;
}

export interface CreateConnectScoreVariables {
  id: string;
  scoreKey: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  username: string;
  displayName: string;
  levelId: number;
  dailyIndex: number;
  dailyKey: string;
  startedAt: TimestampString;
  completedAt: TimestampString;
  elapsedCentiseconds: number;
  hintsUsed: number;
  adjustedCentiseconds: number;
}

export interface CreateConnectSessionData {
  connectSession_insert: ConnectSession_Key;
}

export interface CreateConnectSessionVariables {
  id: string;
  sessionKey: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  username: string;
  displayName: string;
  levelId: number;
  dailyIndex: number;
  dailyKey: string;
  startedAt: TimestampString;
  lastHintAt?: TimestampString | null;
  hintsUsed: number;
  completedAt?: TimestampString | null;
  elapsedCentiseconds?: number | null;
  adjustedCentiseconds?: number | null;
}

export interface CreateGameLevelData {
  gamesLevel_insert: GameLevel_Key;
}

export interface CreateGameLevelVariables {
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

export interface GameLevel_Key {
  id: string;
  __typename?: 'GameLevel_Key';
}

export interface GetConnectScoreByKeyData {
  connectScores: ({
    id: string;
    adjustedCentiseconds: number;
    elapsedCentiseconds: number;
    hintsUsed: number;
    completedAt: TimestampString;
  } & ConnectScore_Key)[];
}

export interface GetConnectScoreByKeyVariables {
  scoreKey: string;
}

export interface GetConnectSessionByKeyData {
  connectSessions: ({
    id: string;
  } & ConnectSession_Key)[];
}

export interface GetConnectSessionByKeyVariables {
  sessionKey: string;
}

export interface GetGameLevelData {
  gamesLevel?: {
    id: string;
    payloadJson: string;
    totalLevels: number;
    launchDate?: string | null;
    checksum?: string | null;
    updatedAt: TimestampString;
  } & GameLevel_Key;
}

export interface GetGameLevelVariables {
  id: string;
}

export interface ListConnectScoresByTenantData {
  connectScores: ({
    id: string;
    scoreKey: string;
    sessionId: string;
    tenantId: string;
    userId: string;
    username: string;
    displayName: string;
    levelId: number;
    dailyIndex: number;
    dailyKey: string;
    startedAt: TimestampString;
    completedAt: TimestampString;
    elapsedCentiseconds: number;
    hintsUsed: number;
    adjustedCentiseconds: number;
  } & ConnectScore_Key)[];
}

export interface ListConnectScoresByTenantVariables {
  tenantId: string;
  limit: number;
}

export interface ListConnectSessionsByTenantData {
  connectSessions: ({
    id: string;
    sessionKey: string;
    sessionId: string;
    tenantId: string;
    userId: string;
    username: string;
    displayName: string;
    levelId: number;
    dailyIndex: number;
    dailyKey: string;
    startedAt: TimestampString;
    lastHintAt?: TimestampString | null;
    hintsUsed: number;
    completedAt?: TimestampString | null;
    elapsedCentiseconds?: number | null;
    adjustedCentiseconds?: number | null;
  } & ConnectSession_Key)[];
}

export interface ListConnectSessionsByTenantVariables {
  tenantId: string;
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

export interface UpdateConnectScoreData {
  connectScore_update?: ConnectScore_Key | null;
}

export interface UpdateConnectScoreVariables {
  id: string;
  sessionId: string;
  username: string;
  displayName: string;
  startedAt: TimestampString;
  completedAt: TimestampString;
  elapsedCentiseconds: number;
  hintsUsed: number;
  adjustedCentiseconds: number;
}

export interface UpdateConnectSessionData {
  connectSession_update?: ConnectSession_Key | null;
}

export interface UpdateConnectSessionVariables {
  id: string;
  sessionId: string;
  username: string;
  displayName: string;
  lastHintAt?: TimestampString | null;
  hintsUsed: number;
  completedAt?: TimestampString | null;
  elapsedCentiseconds?: number | null;
  adjustedCentiseconds?: number | null;
}

export interface UpdateGameLevelData {
  gamesLevel_update?: GameLevel_Key | null;
}

export interface UpdateGameLevelVariables {
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

interface GetGameLevelRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetGameLevelVariables): QueryRef<GetGameLevelData, GetGameLevelVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetGameLevelVariables): QueryRef<GetGameLevelData, GetGameLevelVariables>;
  operationName: string;
}
export const getGameLevelRef: GetGameLevelRef;

export function getGameLevel(vars: GetGameLevelVariables, options?: ExecuteQueryOptions): QueryPromise<GetGameLevelData, GetGameLevelVariables>;
export function getGameLevel(dc: DataConnect, vars: GetGameLevelVariables, options?: ExecuteQueryOptions): QueryPromise<GetGameLevelData, GetGameLevelVariables>;

interface CreateGameLevelRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateGameLevelVariables): MutationRef<CreateGameLevelData, CreateGameLevelVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateGameLevelVariables): MutationRef<CreateGameLevelData, CreateGameLevelVariables>;
  operationName: string;
}
export const createGameLevelRef: CreateGameLevelRef;

export function createGameLevel(vars: CreateGameLevelVariables): MutationPromise<CreateGameLevelData, CreateGameLevelVariables>;
export function createGameLevel(dc: DataConnect, vars: CreateGameLevelVariables): MutationPromise<CreateGameLevelData, CreateGameLevelVariables>;

interface UpdateGameLevelRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateGameLevelVariables): MutationRef<UpdateGameLevelData, UpdateGameLevelVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateGameLevelVariables): MutationRef<UpdateGameLevelData, UpdateGameLevelVariables>;
  operationName: string;
}
export const updateGameLevelRef: UpdateGameLevelRef;

export function updateGameLevel(vars: UpdateGameLevelVariables): MutationPromise<UpdateGameLevelData, UpdateGameLevelVariables>;
export function updateGameLevel(dc: DataConnect, vars: UpdateGameLevelVariables): MutationPromise<UpdateGameLevelData, UpdateGameLevelVariables>;

interface ListConnectSessionsByTenantRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListConnectSessionsByTenantVariables): QueryRef<ListConnectSessionsByTenantData, ListConnectSessionsByTenantVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListConnectSessionsByTenantVariables): QueryRef<ListConnectSessionsByTenantData, ListConnectSessionsByTenantVariables>;
  operationName: string;
}
export const listConnectSessionsByTenantRef: ListConnectSessionsByTenantRef;

export function listConnectSessionsByTenant(vars: ListConnectSessionsByTenantVariables, options?: ExecuteQueryOptions): QueryPromise<ListConnectSessionsByTenantData, ListConnectSessionsByTenantVariables>;
export function listConnectSessionsByTenant(dc: DataConnect, vars: ListConnectSessionsByTenantVariables, options?: ExecuteQueryOptions): QueryPromise<ListConnectSessionsByTenantData, ListConnectSessionsByTenantVariables>;

interface ListConnectScoresByTenantRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListConnectScoresByTenantVariables): QueryRef<ListConnectScoresByTenantData, ListConnectScoresByTenantVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListConnectScoresByTenantVariables): QueryRef<ListConnectScoresByTenantData, ListConnectScoresByTenantVariables>;
  operationName: string;
}
export const listConnectScoresByTenantRef: ListConnectScoresByTenantRef;

export function listConnectScoresByTenant(vars: ListConnectScoresByTenantVariables, options?: ExecuteQueryOptions): QueryPromise<ListConnectScoresByTenantData, ListConnectScoresByTenantVariables>;
export function listConnectScoresByTenant(dc: DataConnect, vars: ListConnectScoresByTenantVariables, options?: ExecuteQueryOptions): QueryPromise<ListConnectScoresByTenantData, ListConnectScoresByTenantVariables>;

interface GetConnectSessionByKeyRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetConnectSessionByKeyVariables): QueryRef<GetConnectSessionByKeyData, GetConnectSessionByKeyVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetConnectSessionByKeyVariables): QueryRef<GetConnectSessionByKeyData, GetConnectSessionByKeyVariables>;
  operationName: string;
}
export const getConnectSessionByKeyRef: GetConnectSessionByKeyRef;

export function getConnectSessionByKey(vars: GetConnectSessionByKeyVariables, options?: ExecuteQueryOptions): QueryPromise<GetConnectSessionByKeyData, GetConnectSessionByKeyVariables>;
export function getConnectSessionByKey(dc: DataConnect, vars: GetConnectSessionByKeyVariables, options?: ExecuteQueryOptions): QueryPromise<GetConnectSessionByKeyData, GetConnectSessionByKeyVariables>;

interface GetConnectScoreByKeyRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetConnectScoreByKeyVariables): QueryRef<GetConnectScoreByKeyData, GetConnectScoreByKeyVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetConnectScoreByKeyVariables): QueryRef<GetConnectScoreByKeyData, GetConnectScoreByKeyVariables>;
  operationName: string;
}
export const getConnectScoreByKeyRef: GetConnectScoreByKeyRef;

export function getConnectScoreByKey(vars: GetConnectScoreByKeyVariables, options?: ExecuteQueryOptions): QueryPromise<GetConnectScoreByKeyData, GetConnectScoreByKeyVariables>;
export function getConnectScoreByKey(dc: DataConnect, vars: GetConnectScoreByKeyVariables, options?: ExecuteQueryOptions): QueryPromise<GetConnectScoreByKeyData, GetConnectScoreByKeyVariables>;

interface CreateConnectSessionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateConnectSessionVariables): MutationRef<CreateConnectSessionData, CreateConnectSessionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateConnectSessionVariables): MutationRef<CreateConnectSessionData, CreateConnectSessionVariables>;
  operationName: string;
}
export const createConnectSessionRef: CreateConnectSessionRef;

export function createConnectSession(vars: CreateConnectSessionVariables): MutationPromise<CreateConnectSessionData, CreateConnectSessionVariables>;
export function createConnectSession(dc: DataConnect, vars: CreateConnectSessionVariables): MutationPromise<CreateConnectSessionData, CreateConnectSessionVariables>;

interface UpdateConnectSessionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateConnectSessionVariables): MutationRef<UpdateConnectSessionData, UpdateConnectSessionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateConnectSessionVariables): MutationRef<UpdateConnectSessionData, UpdateConnectSessionVariables>;
  operationName: string;
}
export const updateConnectSessionRef: UpdateConnectSessionRef;

export function updateConnectSession(vars: UpdateConnectSessionVariables): MutationPromise<UpdateConnectSessionData, UpdateConnectSessionVariables>;
export function updateConnectSession(dc: DataConnect, vars: UpdateConnectSessionVariables): MutationPromise<UpdateConnectSessionData, UpdateConnectSessionVariables>;

interface CreateConnectScoreRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateConnectScoreVariables): MutationRef<CreateConnectScoreData, CreateConnectScoreVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateConnectScoreVariables): MutationRef<CreateConnectScoreData, CreateConnectScoreVariables>;
  operationName: string;
}
export const createConnectScoreRef: CreateConnectScoreRef;

export function createConnectScore(vars: CreateConnectScoreVariables): MutationPromise<CreateConnectScoreData, CreateConnectScoreVariables>;
export function createConnectScore(dc: DataConnect, vars: CreateConnectScoreVariables): MutationPromise<CreateConnectScoreData, CreateConnectScoreVariables>;

interface UpdateConnectScoreRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateConnectScoreVariables): MutationRef<UpdateConnectScoreData, UpdateConnectScoreVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateConnectScoreVariables): MutationRef<UpdateConnectScoreData, UpdateConnectScoreVariables>;
  operationName: string;
}
export const updateConnectScoreRef: UpdateConnectScoreRef;

export function updateConnectScore(vars: UpdateConnectScoreVariables): MutationPromise<UpdateConnectScoreData, UpdateConnectScoreVariables>;
export function updateConnectScore(dc: DataConnect, vars: UpdateConnectScoreVariables): MutationPromise<UpdateConnectScoreData, UpdateConnectScoreVariables>;

