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

export interface CreateMarketListingContactData {
  marketListingContact_insert: MarketListingContact_Key;
}

export interface CreateMarketListingContactVariables {
  id: string;
  tenantId: UUIDString;
  listingId: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  createdAt: TimestampString;
}

export interface CreateMarketListingData {
  marketListing_insert: MarketListing_Key;
}

export interface CreateMarketListingMediaData {
  marketListingMedia_insert: MarketListingMedia_Key;
}

export interface CreateMarketListingMediaVariables {
  id: string;
  tenantId: UUIDString;
  listingId: string;
  kind: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: Int64String;
  storagePath?: string | null;
  createdAt: TimestampString;
}

export interface CreateMarketListingSaveData {
  marketListingSave_insert: MarketListingSave_Key;
}

export interface CreateMarketListingSaveVariables {
  id: string;
  tenantId: UUIDString;
  listingId: string;
  userId: string;
  createdAt: TimestampString;
}

export interface CreateMarketListingVariables {
  id: string;
  tenantId: UUIDString;
  sellerUserId: string;
  sellerUsername: string;
  sellerName: string;
  sellerRole: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  priceAmount: number;
  location: string;
  campusSpot: string;
  createdAt: TimestampString;
}

export interface CreateMarketRequestContactData {
  marketRequestContact_insert: MarketRequestContact_Key;
}

export interface CreateMarketRequestContactVariables {
  id: string;
  tenantId: UUIDString;
  requestId: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  createdAt: TimestampString;
}

export interface CreateMarketRequestData {
  marketRequest_insert: MarketRequest_Key;
}

export interface CreateMarketRequestMediaData {
  marketRequestMedia_insert: MarketRequestMedia_Key;
}

export interface CreateMarketRequestMediaVariables {
  id: string;
  tenantId: UUIDString;
  requestId: string;
  kind: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: Int64String;
  storagePath?: string | null;
  createdAt: TimestampString;
}

export interface CreateMarketRequestVariables {
  id: string;
  tenantId: UUIDString;
  requesterUserId: string;
  requesterUsername: string;
  requesterName: string;
  requesterRole: string;
  tab: string;
  tag: string;
  title: string;
  detail: string;
  category: string;
  campusSpot: string;
  budgetLabel: string;
  budgetAmount?: number | null;
  tone: string;
  createdAt: TimestampString;
}

export interface Follow_Key {
  id: UUIDString;
  __typename?: 'Follow_Key';
}

export interface GameLevel_Key {
  id: string;
  __typename?: 'GameLevel_Key';
}

export interface GetMarketListingByIdData {
  marketListing?: {
    id: string;
    tenantId: UUIDString;
    sellerUserId: string;
    sellerUsername: string;
    sellerName: string;
    sellerRole: string;
    title: string;
    description: string;
    category: string;
    condition: string;
    priceAmount: number;
    location: string;
    campusSpot: string;
    status: string;
    createdAt: TimestampString;
    deletedAt?: TimestampString | null;
  } & MarketListing_Key;
}

export interface GetMarketListingByIdVariables {
  listingId: string;
}

export interface GetMarketRequestByIdData {
  marketRequest?: {
    id: string;
    tenantId: UUIDString;
    requesterUserId: string;
    requesterUsername: string;
    requesterName: string;
    requesterRole: string;
    tab: string;
    tag: string;
    title: string;
    detail: string;
    category: string;
    campusSpot: string;
    budgetLabel: string;
    budgetAmount?: number | null;
    tone: string;
    status: string;
    createdAt: TimestampString;
    deletedAt?: TimestampString | null;
  } & MarketRequest_Key;
}

export interface GetMarketRequestByIdVariables {
  requestId: string;
}

export interface ListActiveMarketListingContactsByTenantData {
  marketListingContacts: ({
    id: string;
    tenantId: UUIDString;
    listingId: string;
    fromUserId: string;
    toUserId: string;
    message: string;
    createdAt: TimestampString;
  } & MarketListingContact_Key)[];
}

export interface ListActiveMarketListingContactsByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListActiveMarketListingSavesByTenantData {
  marketListingSaves: ({
    id: string;
    tenantId: UUIDString;
    listingId: string;
    userId: string;
    createdAt: TimestampString;
  } & MarketListingSave_Key)[];
}

export interface ListActiveMarketListingSavesByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListActiveMarketListingSavesByUserAndListingData {
  marketListingSaves: ({
    id: string;
    listingId: string;
    userId: string;
    createdAt: TimestampString;
  } & MarketListingSave_Key)[];
}

export interface ListActiveMarketListingSavesByUserAndListingVariables {
  tenantId: UUIDString;
  listingId: string;
  userId: string;
  limit: number;
}

export interface ListActiveMarketRequestContactsByTenantData {
  marketRequestContacts: ({
    id: string;
    tenantId: UUIDString;
    requestId: string;
    fromUserId: string;
    toUserId: string;
    message: string;
    createdAt: TimestampString;
  } & MarketRequestContact_Key)[];
}

export interface ListActiveMarketRequestContactsByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListMarketListingMediaByTenantData {
  marketListingMediaRecords: ({
    id: string;
    tenantId: UUIDString;
    listingId: string;
    kind: string;
    url: string;
    fileName: string;
    mimeType: string;
    sizeBytes: Int64String;
    storagePath?: string | null;
    createdAt: TimestampString;
  } & MarketListingMedia_Key)[];
}

export interface ListMarketListingMediaByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListMarketListingsByTenantData {
  marketListings: ({
    id: string;
    tenantId: UUIDString;
    sellerUserId: string;
    sellerUsername: string;
    sellerName: string;
    sellerRole: string;
    title: string;
    description: string;
    category: string;
    condition: string;
    priceAmount: number;
    location: string;
    campusSpot: string;
    status: string;
    createdAt: TimestampString;
  } & MarketListing_Key)[];
}

export interface ListMarketListingsByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListMarketRequestMediaByTenantData {
  marketRequestMediaRecords: ({
    id: string;
    tenantId: UUIDString;
    requestId: string;
    kind: string;
    url: string;
    fileName: string;
    mimeType: string;
    sizeBytes: Int64String;
    storagePath?: string | null;
    createdAt: TimestampString;
  } & MarketRequestMedia_Key)[];
}

export interface ListMarketRequestMediaByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListMarketRequestsByTenantData {
  marketRequests: ({
    id: string;
    tenantId: UUIDString;
    requesterUserId: string;
    requesterUsername: string;
    requesterName: string;
    requesterRole: string;
    tab: string;
    tag: string;
    title: string;
    detail: string;
    category: string;
    campusSpot: string;
    budgetLabel: string;
    budgetAmount?: number | null;
    tone: string;
    status: string;
    createdAt: TimestampString;
  } & MarketRequest_Key)[];
}

export interface ListMarketRequestsByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface MarkMarketListingSoldData {
  marketListing_update?: MarketListing_Key | null;
}

export interface MarkMarketListingSoldVariables {
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

export interface SoftDeleteMarketListingData {
  marketListing_update?: MarketListing_Key | null;
}

export interface SoftDeleteMarketListingMediaData {
  marketListingMedia_update?: MarketListingMedia_Key | null;
}

export interface SoftDeleteMarketListingMediaVariables {
  id: string;
}

export interface SoftDeleteMarketListingSaveData {
  marketListingSave_update?: MarketListingSave_Key | null;
}

export interface SoftDeleteMarketListingSaveVariables {
  id: string;
}

export interface SoftDeleteMarketListingVariables {
  id: string;
}

export interface SoftDeleteMarketRequestData {
  marketRequest_update?: MarketRequest_Key | null;
}

export interface SoftDeleteMarketRequestMediaData {
  marketRequestMedia_update?: MarketRequestMedia_Key | null;
}

export interface SoftDeleteMarketRequestMediaVariables {
  id: string;
}

export interface SoftDeleteMarketRequestVariables {
  id: string;
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

export interface UpdateMarketListingDetailsData {
  marketListing_update?: MarketListing_Key | null;
}

export interface UpdateMarketListingDetailsVariables {
  id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  priceAmount: number;
  location: string;
  campusSpot: string;
}

export interface UpdateMarketRequestDetailsData {
  marketRequest_update?: MarketRequest_Key | null;
}

export interface UpdateMarketRequestDetailsVariables {
  id: string;
  tag: string;
  title: string;
  detail: string;
  category: string;
  campusSpot: string;
  budgetLabel: string;
  budgetAmount?: number | null;
  tone: string;
}

export interface UserActivity_Key {
  id: UUIDString;
  __typename?: 'UserActivity_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

/** Generated Node Admin SDK operation action function for the 'ListMarketListingsByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listMarketListingsByTenant(dc: DataConnect, vars: ListMarketListingsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMarketListingsByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListMarketListingsByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listMarketListingsByTenant(vars: ListMarketListingsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMarketListingsByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'GetMarketListingById' Query. Allow users to execute without passing in DataConnect. */
export function getMarketListingById(dc: DataConnect, vars: GetMarketListingByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMarketListingByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetMarketListingById' Query. Allow users to pass in custom DataConnect instances. */
export function getMarketListingById(vars: GetMarketListingByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMarketListingByIdData>>;

/** Generated Node Admin SDK operation action function for the 'ListMarketListingMediaByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listMarketListingMediaByTenant(dc: DataConnect, vars: ListMarketListingMediaByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMarketListingMediaByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListMarketListingMediaByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listMarketListingMediaByTenant(vars: ListMarketListingMediaByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMarketListingMediaByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListMarketRequestsByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listMarketRequestsByTenant(dc: DataConnect, vars: ListMarketRequestsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMarketRequestsByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListMarketRequestsByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listMarketRequestsByTenant(vars: ListMarketRequestsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMarketRequestsByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'GetMarketRequestById' Query. Allow users to execute without passing in DataConnect. */
export function getMarketRequestById(dc: DataConnect, vars: GetMarketRequestByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMarketRequestByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetMarketRequestById' Query. Allow users to pass in custom DataConnect instances. */
export function getMarketRequestById(vars: GetMarketRequestByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMarketRequestByIdData>>;

/** Generated Node Admin SDK operation action function for the 'ListMarketRequestMediaByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listMarketRequestMediaByTenant(dc: DataConnect, vars: ListMarketRequestMediaByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMarketRequestMediaByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListMarketRequestMediaByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listMarketRequestMediaByTenant(vars: ListMarketRequestMediaByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMarketRequestMediaByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListActiveMarketListingSavesByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listActiveMarketListingSavesByTenant(dc: DataConnect, vars: ListActiveMarketListingSavesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActiveMarketListingSavesByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListActiveMarketListingSavesByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listActiveMarketListingSavesByTenant(vars: ListActiveMarketListingSavesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActiveMarketListingSavesByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListActiveMarketListingSavesByUserAndListing' Query. Allow users to execute without passing in DataConnect. */
export function listActiveMarketListingSavesByUserAndListing(dc: DataConnect, vars: ListActiveMarketListingSavesByUserAndListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActiveMarketListingSavesByUserAndListingData>>;
/** Generated Node Admin SDK operation action function for the 'ListActiveMarketListingSavesByUserAndListing' Query. Allow users to pass in custom DataConnect instances. */
export function listActiveMarketListingSavesByUserAndListing(vars: ListActiveMarketListingSavesByUserAndListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActiveMarketListingSavesByUserAndListingData>>;

/** Generated Node Admin SDK operation action function for the 'ListActiveMarketListingContactsByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listActiveMarketListingContactsByTenant(dc: DataConnect, vars: ListActiveMarketListingContactsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActiveMarketListingContactsByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListActiveMarketListingContactsByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listActiveMarketListingContactsByTenant(vars: ListActiveMarketListingContactsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActiveMarketListingContactsByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListActiveMarketRequestContactsByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listActiveMarketRequestContactsByTenant(dc: DataConnect, vars: ListActiveMarketRequestContactsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActiveMarketRequestContactsByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListActiveMarketRequestContactsByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listActiveMarketRequestContactsByTenant(vars: ListActiveMarketRequestContactsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActiveMarketRequestContactsByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'CreateMarketListing' Mutation. Allow users to execute without passing in DataConnect. */
export function createMarketListing(dc: DataConnect, vars: CreateMarketListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketListingData>>;
/** Generated Node Admin SDK operation action function for the 'CreateMarketListing' Mutation. Allow users to pass in custom DataConnect instances. */
export function createMarketListing(vars: CreateMarketListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketListingData>>;

/** Generated Node Admin SDK operation action function for the 'CreateMarketListingMedia' Mutation. Allow users to execute without passing in DataConnect. */
export function createMarketListingMedia(dc: DataConnect, vars: CreateMarketListingMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketListingMediaData>>;
/** Generated Node Admin SDK operation action function for the 'CreateMarketListingMedia' Mutation. Allow users to pass in custom DataConnect instances. */
export function createMarketListingMedia(vars: CreateMarketListingMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketListingMediaData>>;

/** Generated Node Admin SDK operation action function for the 'CreateMarketRequest' Mutation. Allow users to execute without passing in DataConnect. */
export function createMarketRequest(dc: DataConnect, vars: CreateMarketRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketRequestData>>;
/** Generated Node Admin SDK operation action function for the 'CreateMarketRequest' Mutation. Allow users to pass in custom DataConnect instances. */
export function createMarketRequest(vars: CreateMarketRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketRequestData>>;

/** Generated Node Admin SDK operation action function for the 'CreateMarketRequestMedia' Mutation. Allow users to execute without passing in DataConnect. */
export function createMarketRequestMedia(dc: DataConnect, vars: CreateMarketRequestMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketRequestMediaData>>;
/** Generated Node Admin SDK operation action function for the 'CreateMarketRequestMedia' Mutation. Allow users to pass in custom DataConnect instances. */
export function createMarketRequestMedia(vars: CreateMarketRequestMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketRequestMediaData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateMarketListingDetails' Mutation. Allow users to execute without passing in DataConnect. */
export function updateMarketListingDetails(dc: DataConnect, vars: UpdateMarketListingDetailsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateMarketListingDetailsData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateMarketListingDetails' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateMarketListingDetails(vars: UpdateMarketListingDetailsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateMarketListingDetailsData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateMarketRequestDetails' Mutation. Allow users to execute without passing in DataConnect. */
export function updateMarketRequestDetails(dc: DataConnect, vars: UpdateMarketRequestDetailsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateMarketRequestDetailsData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateMarketRequestDetails' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateMarketRequestDetails(vars: UpdateMarketRequestDetailsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateMarketRequestDetailsData>>;

/** Generated Node Admin SDK operation action function for the 'MarkMarketListingSold' Mutation. Allow users to execute without passing in DataConnect. */
export function markMarketListingSold(dc: DataConnect, vars: MarkMarketListingSoldVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkMarketListingSoldData>>;
/** Generated Node Admin SDK operation action function for the 'MarkMarketListingSold' Mutation. Allow users to pass in custom DataConnect instances. */
export function markMarketListingSold(vars: MarkMarketListingSoldVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkMarketListingSoldData>>;

/** Generated Node Admin SDK operation action function for the 'SoftDeleteMarketListing' Mutation. Allow users to execute without passing in DataConnect. */
export function softDeleteMarketListing(dc: DataConnect, vars: SoftDeleteMarketListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeleteMarketListingData>>;
/** Generated Node Admin SDK operation action function for the 'SoftDeleteMarketListing' Mutation. Allow users to pass in custom DataConnect instances. */
export function softDeleteMarketListing(vars: SoftDeleteMarketListingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeleteMarketListingData>>;

/** Generated Node Admin SDK operation action function for the 'SoftDeleteMarketRequest' Mutation. Allow users to execute without passing in DataConnect. */
export function softDeleteMarketRequest(dc: DataConnect, vars: SoftDeleteMarketRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeleteMarketRequestData>>;
/** Generated Node Admin SDK operation action function for the 'SoftDeleteMarketRequest' Mutation. Allow users to pass in custom DataConnect instances. */
export function softDeleteMarketRequest(vars: SoftDeleteMarketRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeleteMarketRequestData>>;

/** Generated Node Admin SDK operation action function for the 'SoftDeleteMarketListingMedia' Mutation. Allow users to execute without passing in DataConnect. */
export function softDeleteMarketListingMedia(dc: DataConnect, vars: SoftDeleteMarketListingMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeleteMarketListingMediaData>>;
/** Generated Node Admin SDK operation action function for the 'SoftDeleteMarketListingMedia' Mutation. Allow users to pass in custom DataConnect instances. */
export function softDeleteMarketListingMedia(vars: SoftDeleteMarketListingMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeleteMarketListingMediaData>>;

/** Generated Node Admin SDK operation action function for the 'SoftDeleteMarketRequestMedia' Mutation. Allow users to execute without passing in DataConnect. */
export function softDeleteMarketRequestMedia(dc: DataConnect, vars: SoftDeleteMarketRequestMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeleteMarketRequestMediaData>>;
/** Generated Node Admin SDK operation action function for the 'SoftDeleteMarketRequestMedia' Mutation. Allow users to pass in custom DataConnect instances. */
export function softDeleteMarketRequestMedia(vars: SoftDeleteMarketRequestMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeleteMarketRequestMediaData>>;

/** Generated Node Admin SDK operation action function for the 'CreateMarketListingSave' Mutation. Allow users to execute without passing in DataConnect. */
export function createMarketListingSave(dc: DataConnect, vars: CreateMarketListingSaveVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketListingSaveData>>;
/** Generated Node Admin SDK operation action function for the 'CreateMarketListingSave' Mutation. Allow users to pass in custom DataConnect instances. */
export function createMarketListingSave(vars: CreateMarketListingSaveVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketListingSaveData>>;

/** Generated Node Admin SDK operation action function for the 'SoftDeleteMarketListingSave' Mutation. Allow users to execute without passing in DataConnect. */
export function softDeleteMarketListingSave(dc: DataConnect, vars: SoftDeleteMarketListingSaveVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeleteMarketListingSaveData>>;
/** Generated Node Admin SDK operation action function for the 'SoftDeleteMarketListingSave' Mutation. Allow users to pass in custom DataConnect instances. */
export function softDeleteMarketListingSave(vars: SoftDeleteMarketListingSaveVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeleteMarketListingSaveData>>;

/** Generated Node Admin SDK operation action function for the 'CreateMarketListingContact' Mutation. Allow users to execute without passing in DataConnect. */
export function createMarketListingContact(dc: DataConnect, vars: CreateMarketListingContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketListingContactData>>;
/** Generated Node Admin SDK operation action function for the 'CreateMarketListingContact' Mutation. Allow users to pass in custom DataConnect instances. */
export function createMarketListingContact(vars: CreateMarketListingContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketListingContactData>>;

/** Generated Node Admin SDK operation action function for the 'CreateMarketRequestContact' Mutation. Allow users to execute without passing in DataConnect. */
export function createMarketRequestContact(dc: DataConnect, vars: CreateMarketRequestContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketRequestContactData>>;
/** Generated Node Admin SDK operation action function for the 'CreateMarketRequestContact' Mutation. Allow users to pass in custom DataConnect instances. */
export function createMarketRequestContact(vars: CreateMarketRequestContactVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMarketRequestContactData>>;

