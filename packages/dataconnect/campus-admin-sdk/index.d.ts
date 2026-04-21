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

export interface CreateCommunityData {
  community_insert: Community_Key;
}

export interface CreateCommunityMembershipData {
  communityMembership_insert: CommunityMembership_Key;
}

export interface CreateCommunityMembershipVariables {
  communityMembershipKey: string;
  communityId: UUIDString;
  membershipId: UUIDString;
  role: string;
}

export interface CreateCommunityVariables {
  tenantId: UUIDString;
  type: string;
  name: string;
  slug: string;
  visibility: string;
}

export interface CreateTenantData {
  tenant_insert: Tenant_Key;
}

export interface CreateTenantDomainData {
  tenantDomain_insert: TenantDomain_Key;
}

export interface CreateTenantDomainVariables {
  tenantDomainKey: string;
  tenantId: UUIDString;
  domain: string;
  isPrimary: boolean;
  verificationMode: string;
}

export interface CreateTenantMembershipData {
  tenantMembership_insert: TenantMembership_Key;
}

export interface CreateTenantMembershipVariables {
  tenantMembershipKey: string;
  tenantId: UUIDString;
  userId: UUIDString;
  role: string;
  verificationStatus: string;
  branch?: string | null;
  batchYear?: number | null;
  hostel?: string | null;
}

export interface CreateTenantVariables {
  name: string;
  slug: string;
  status: string;
}

export interface Follow_Key {
  id: UUIDString;
  __typename?: 'Follow_Key';
}

export interface GetCommunityBySlugData {
  communities: ({
    id: UUIDString;
    name: string;
    slug: string;
    type: string;
    visibility: string;
    tenantId: UUIDString;
  } & Community_Key)[];
}

export interface GetCommunityBySlugVariables {
  tenantId: UUIDString;
  slug: string;
}

export interface GetMembershipContextData {
  tenantMemberships: ({
    id: UUIDString;
    role: string;
    verificationStatus: string;
    branch?: string | null;
    batchYear?: number | null;
    hostel?: string | null;
    tenant: {
      id: UUIDString;
      name: string;
      slug: string;
    } & Tenant_Key;
      user: {
        id: UUIDString;
        displayName?: string | null;
        primaryEmail: string;
      } & User_Key;
  } & TenantMembership_Key)[];
}

export interface GetMembershipContextVariables {
  userId: UUIDString;
  tenantId: UUIDString;
}

export interface GetTenantByDomainData {
  tenantDomains: ({
    id: UUIDString;
    domain: string;
    verificationMode: string;
    tenant: {
      id: UUIDString;
      name: string;
      slug: string;
      status: string;
    } & Tenant_Key;
  } & TenantDomain_Key)[];
}

export interface GetTenantByDomainVariables {
  domain: string;
}

export interface GetTenantBySlugData {
  tenants: ({
    id: UUIDString;
    name: string;
    slug: string;
    status: string;
  } & Tenant_Key)[];
}

export interface GetTenantBySlugVariables {
  slug: string;
}

export interface ListCommunitiesByTenantData {
  communities: ({
    id: UUIDString;
    name: string;
    slug: string;
    type: string;
    visibility: string;
    tenantId: UUIDString;
  } & Community_Key)[];
}

export interface ListCommunitiesByTenantVariables {
  tenantId: UUIDString;
}

export interface ListCommunitiesForMembershipData {
  communityMemberships: ({
    id: UUIDString;
    role: string;
    joinedAt: TimestampString;
    community: {
      id: UUIDString;
      name: string;
      slug: string;
      type: string;
      visibility: string;
      tenantId: UUIDString;
    } & Community_Key;
  } & CommunityMembership_Key)[];
}

export interface ListCommunitiesForMembershipVariables {
  membershipId: UUIDString;
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

/** Generated Node Admin SDK operation action function for the 'GetTenantByDomain' Query. Allow users to execute without passing in DataConnect. */
export function getTenantByDomain(dc: DataConnect, vars: GetTenantByDomainVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTenantByDomainData>>;
/** Generated Node Admin SDK operation action function for the 'GetTenantByDomain' Query. Allow users to pass in custom DataConnect instances. */
export function getTenantByDomain(vars: GetTenantByDomainVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTenantByDomainData>>;

/** Generated Node Admin SDK operation action function for the 'GetTenantBySlug' Query. Allow users to execute without passing in DataConnect. */
export function getTenantBySlug(dc: DataConnect, vars: GetTenantBySlugVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTenantBySlugData>>;
/** Generated Node Admin SDK operation action function for the 'GetTenantBySlug' Query. Allow users to pass in custom DataConnect instances. */
export function getTenantBySlug(vars: GetTenantBySlugVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTenantBySlugData>>;

/** Generated Node Admin SDK operation action function for the 'GetMembershipContext' Query. Allow users to execute without passing in DataConnect. */
export function getMembershipContext(dc: DataConnect, vars: GetMembershipContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMembershipContextData>>;
/** Generated Node Admin SDK operation action function for the 'GetMembershipContext' Query. Allow users to pass in custom DataConnect instances. */
export function getMembershipContext(vars: GetMembershipContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMembershipContextData>>;

/** Generated Node Admin SDK operation action function for the 'ListCommunitiesByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listCommunitiesByTenant(dc: DataConnect, vars: ListCommunitiesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommunitiesByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListCommunitiesByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listCommunitiesByTenant(vars: ListCommunitiesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommunitiesByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'GetCommunityBySlug' Query. Allow users to execute without passing in DataConnect. */
export function getCommunityBySlug(dc: DataConnect, vars: GetCommunityBySlugVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCommunityBySlugData>>;
/** Generated Node Admin SDK operation action function for the 'GetCommunityBySlug' Query. Allow users to pass in custom DataConnect instances. */
export function getCommunityBySlug(vars: GetCommunityBySlugVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCommunityBySlugData>>;

/** Generated Node Admin SDK operation action function for the 'ListCommunitiesForMembership' Query. Allow users to execute without passing in DataConnect. */
export function listCommunitiesForMembership(dc: DataConnect, vars: ListCommunitiesForMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommunitiesForMembershipData>>;
/** Generated Node Admin SDK operation action function for the 'ListCommunitiesForMembership' Query. Allow users to pass in custom DataConnect instances. */
export function listCommunitiesForMembership(vars: ListCommunitiesForMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommunitiesForMembershipData>>;

/** Generated Node Admin SDK operation action function for the 'CreateTenant' Mutation. Allow users to execute without passing in DataConnect. */
export function createTenant(dc: DataConnect, vars: CreateTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTenantData>>;
/** Generated Node Admin SDK operation action function for the 'CreateTenant' Mutation. Allow users to pass in custom DataConnect instances. */
export function createTenant(vars: CreateTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTenantData>>;

/** Generated Node Admin SDK operation action function for the 'CreateTenantDomain' Mutation. Allow users to execute without passing in DataConnect. */
export function createTenantDomain(dc: DataConnect, vars: CreateTenantDomainVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTenantDomainData>>;
/** Generated Node Admin SDK operation action function for the 'CreateTenantDomain' Mutation. Allow users to pass in custom DataConnect instances. */
export function createTenantDomain(vars: CreateTenantDomainVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTenantDomainData>>;

/** Generated Node Admin SDK operation action function for the 'CreateTenantMembership' Mutation. Allow users to execute without passing in DataConnect. */
export function createTenantMembership(dc: DataConnect, vars: CreateTenantMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTenantMembershipData>>;
/** Generated Node Admin SDK operation action function for the 'CreateTenantMembership' Mutation. Allow users to pass in custom DataConnect instances. */
export function createTenantMembership(vars: CreateTenantMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTenantMembershipData>>;

/** Generated Node Admin SDK operation action function for the 'CreateCommunity' Mutation. Allow users to execute without passing in DataConnect. */
export function createCommunity(dc: DataConnect, vars: CreateCommunityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommunityData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCommunity' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCommunity(vars: CreateCommunityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommunityData>>;

/** Generated Node Admin SDK operation action function for the 'CreateCommunityMembership' Mutation. Allow users to execute without passing in DataConnect. */
export function createCommunityMembership(dc: DataConnect, vars: CreateCommunityMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommunityMembershipData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCommunityMembership' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCommunityMembership(vars: CreateCommunityMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommunityMembershipData>>;

