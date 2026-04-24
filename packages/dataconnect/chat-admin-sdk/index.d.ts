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

export interface CreateChatMessageData {
  chatMessage_insert: ChatMessage_Key;
}

export interface CreateChatMessageVariables {
  id: UUIDString;
  tenantId: UUIDString;
  conversationId: UUIDString;
  senderMembershipId: UUIDString;
  senderUserId: UUIDString;
  senderIdentityId: UUIDString;
  messageKind: string;
  cipherText: string;
  cipherIv: string;
  cipherAlgorithm: string;
  replyToMessageId?: UUIDString | null;
  attachmentUrl?: string | null;
  attachmentStoragePath?: string | null;
  attachmentMimeType?: string | null;
  attachmentSizeBytes?: Int64String | null;
  attachmentWidth?: number | null;
  attachmentHeight?: number | null;
  attachmentDurationMs?: number | null;
  expiresAt?: TimestampString | null;
  isSaved: boolean;
}

export interface Follow_Key {
  id: UUIDString;
  __typename?: 'Follow_Key';
}

export interface ListChatConversationsByTenantData {
  chatConversations: ({
    id: UUIDString;
    tenantId: UUIDString;
    conversationKey: string;
    kind: string;
    createdByUserId: UUIDString;
    lastMessageId?: UUIDString | null;
    lastMessageAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & ChatConversation_Key)[];
}

export interface ListChatConversationsByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListChatIdentitiesByTenantData {
  chatIdentities: ({
    id: UUIDString;
    tenantId: UUIDString;
    userId: UUIDString;
    membershipId: UUIDString;
    publicKey: string;
    algorithm: string;
    keyVersion: number;
    updatedAt: TimestampString;
  } & ChatIdentity_Key)[];
}

export interface ListChatIdentitiesByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListChatMessageReactionsByConversationData {
  chatMessageReactions: ({
    id: UUIDString;
    tenantId: UUIDString;
    messageId: UUIDString;
    membershipId: UUIDString;
    emoji: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & ChatMessageReaction_Key)[];
}

export interface ListChatMessageReactionsByConversationVariables {
  conversationId: UUIDString;
  limit: number;
}

export interface ListChatMessagesByConversationData {
  chatMessages: ({
    id: UUIDString;
    tenantId: UUIDString;
    conversationId: UUIDString;
    senderMembershipId: UUIDString;
    senderUserId: UUIDString;
    senderIdentityId: UUIDString;
    messageKind: string;
    cipherText: string;
    cipherIv: string;
    cipherAlgorithm: string;
    replyToMessageId?: UUIDString | null;
    attachmentUrl?: string | null;
    attachmentStoragePath?: string | null;
    attachmentMimeType?: string | null;
    attachmentSizeBytes?: Int64String | null;
    attachmentWidth?: number | null;
    attachmentHeight?: number | null;
    attachmentDurationMs?: number | null;
    expiresAt?: TimestampString | null;
    isStarred: boolean;
    isSaved: boolean;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & ChatMessage_Key)[];
}

export interface ListChatMessagesByConversationVariables {
  conversationId: UUIDString;
  limit: number;
}

export interface ListChatParticipantsByConversationData {
  chatParticipants: ({
    id: UUIDString;
    tenantId: UUIDString;
    conversationId: UUIDString;
    membershipId: UUIDString;
    userId: UUIDString;
    lastReadMessageId?: UUIDString | null;
    lastReadAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & ChatParticipant_Key)[];
}

export interface ListChatParticipantsByConversationVariables {
  conversationId: UUIDString;
  limit: number;
}

export interface ListChatParticipantsByMembershipData {
  chatParticipants: ({
    id: UUIDString;
    tenantId: UUIDString;
    conversationId: UUIDString;
    membershipId: UUIDString;
    userId: UUIDString;
    lastReadMessageId?: UUIDString | null;
    lastReadAt?: TimestampString | null;
    updatedAt: TimestampString;
  } & ChatParticipant_Key)[];
}

export interface ListChatParticipantsByMembershipVariables {
  membershipId: UUIDString;
  limit: number;
}

export interface ListExpiredChatMessagesData {
  chatMessages: ({
    id: UUIDString;
    tenantId: UUIDString;
    conversationId: UUIDString;
    senderUserId: UUIDString;
    attachmentStoragePath?: string | null;
  } & ChatMessage_Key)[];
}

export interface ListExpiredChatMessagesVariables {
  now: TimestampString;
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

export interface UpdateChatMessageLifecycleData {
  chatMessage_update?: ChatMessage_Key | null;
}

export interface UpdateChatMessageLifecycleVariables {
  id: UUIDString;
  expiresAt?: TimestampString | null;
  isStarred: boolean;
  isSaved: boolean;
}

export interface UserActivity_Key {
  id: UUIDString;
  __typename?: 'UserActivity_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

/** Generated Node Admin SDK operation action function for the 'ListChatIdentitiesByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listChatIdentitiesByTenant(dc: DataConnect, vars: ListChatIdentitiesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChatIdentitiesByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListChatIdentitiesByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listChatIdentitiesByTenant(vars: ListChatIdentitiesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChatIdentitiesByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListChatConversationsByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listChatConversationsByTenant(dc: DataConnect, vars: ListChatConversationsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChatConversationsByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListChatConversationsByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listChatConversationsByTenant(vars: ListChatConversationsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChatConversationsByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListChatParticipantsByMembership' Query. Allow users to execute without passing in DataConnect. */
export function listChatParticipantsByMembership(dc: DataConnect, vars: ListChatParticipantsByMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChatParticipantsByMembershipData>>;
/** Generated Node Admin SDK operation action function for the 'ListChatParticipantsByMembership' Query. Allow users to pass in custom DataConnect instances. */
export function listChatParticipantsByMembership(vars: ListChatParticipantsByMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChatParticipantsByMembershipData>>;

/** Generated Node Admin SDK operation action function for the 'ListChatParticipantsByConversation' Query. Allow users to execute without passing in DataConnect. */
export function listChatParticipantsByConversation(dc: DataConnect, vars: ListChatParticipantsByConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChatParticipantsByConversationData>>;
/** Generated Node Admin SDK operation action function for the 'ListChatParticipantsByConversation' Query. Allow users to pass in custom DataConnect instances. */
export function listChatParticipantsByConversation(vars: ListChatParticipantsByConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChatParticipantsByConversationData>>;

/** Generated Node Admin SDK operation action function for the 'ListChatMessagesByConversation' Query. Allow users to execute without passing in DataConnect. */
export function listChatMessagesByConversation(dc: DataConnect, vars: ListChatMessagesByConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChatMessagesByConversationData>>;
/** Generated Node Admin SDK operation action function for the 'ListChatMessagesByConversation' Query. Allow users to pass in custom DataConnect instances. */
export function listChatMessagesByConversation(vars: ListChatMessagesByConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChatMessagesByConversationData>>;

/** Generated Node Admin SDK operation action function for the 'ListChatMessageReactionsByConversation' Query. Allow users to execute without passing in DataConnect. */
export function listChatMessageReactionsByConversation(dc: DataConnect, vars: ListChatMessageReactionsByConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChatMessageReactionsByConversationData>>;
/** Generated Node Admin SDK operation action function for the 'ListChatMessageReactionsByConversation' Query. Allow users to pass in custom DataConnect instances. */
export function listChatMessageReactionsByConversation(vars: ListChatMessageReactionsByConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListChatMessageReactionsByConversationData>>;

/** Generated Node Admin SDK operation action function for the 'ListExpiredChatMessages' Query. Allow users to execute without passing in DataConnect. */
export function listExpiredChatMessages(dc: DataConnect, vars: ListExpiredChatMessagesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListExpiredChatMessagesData>>;
/** Generated Node Admin SDK operation action function for the 'ListExpiredChatMessages' Query. Allow users to pass in custom DataConnect instances. */
export function listExpiredChatMessages(vars: ListExpiredChatMessagesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListExpiredChatMessagesData>>;

/** Generated Node Admin SDK operation action function for the 'CreateChatMessage' Mutation. Allow users to execute without passing in DataConnect. */
export function createChatMessage(dc: DataConnect, vars: CreateChatMessageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateChatMessageData>>;
/** Generated Node Admin SDK operation action function for the 'CreateChatMessage' Mutation. Allow users to pass in custom DataConnect instances. */
export function createChatMessage(vars: CreateChatMessageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateChatMessageData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateChatMessageLifecycle' Mutation. Allow users to execute without passing in DataConnect. */
export function updateChatMessageLifecycle(dc: DataConnect, vars: UpdateChatMessageLifecycleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateChatMessageLifecycleData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateChatMessageLifecycle' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateChatMessageLifecycle(vars: UpdateChatMessageLifecycleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateChatMessageLifecycleData>>;

