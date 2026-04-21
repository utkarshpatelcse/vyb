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

export interface CreateCommentData {
  comment_insert: Comment_Key;
}

export interface CreateCommentVariables {
  id: UUIDString;
  tenantId: UUIDString;
  postId: UUIDString;
  membershipId: UUIDString;
  authorUserId: UUIDString;
  body: string;
}

export interface CreateFollowData {
  follow_insert: Follow_Key;
}

export interface CreateFollowVariables {
  id: UUIDString;
  followKey: string;
  tenantId: UUIDString;
  followerUserId: UUIDString;
  followingUserId: UUIDString;
}

export interface CreatePostData {
  post_insert: Post_Key;
}

export interface CreatePostMediaData {
  postMedia_insert: PostMedia_Key;
}

export interface CreatePostMediaVariables {
  tenantId: UUIDString;
  postId: UUIDString;
  storagePath: string;
  mediaType: string;
  mimeType: string;
  sizeBytes: Int64String;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}

export interface CreatePostVariables {
  id?: UUIDString | null;
  tenantId: UUIDString;
  communityId?: UUIDString | null;
  membershipId: UUIDString;
  authorUserId?: UUIDString | null;
  authorUsername?: string;
  authorName?: string;
  placement?: string;
  kind: string;
  title?: string | null;
  body: string;
  mediaUrl?: string | null;
  storagePath?: string | null;
  mediaMimeType?: string | null;
  mediaSizeBytes?: Int64String | null;
  location?: string | null;
  status: string;
}

export interface CreateReactionData {
  reaction_insert: Reaction_Key;
}

export interface CreateReactionVariables {
  id: UUIDString;
  reactionKey: string;
  postId: UUIDString;
  membershipId: UUIDString;
  reactionType: string;
}

export interface CreateStoryData {
  story_insert: Story_Key;
}

export interface CreateStoryReactionData {
  storyReaction_insert: StoryReaction_Key;
}

export interface CreateStoryReactionVariables {
  id: UUIDString;
  storyReactionKey: string;
  storyId: UUIDString;
  membershipId: UUIDString;
  reactionType: string;
}

export interface CreateStoryVariables {
  id: UUIDString;
  tenantId: UUIDString;
  userId: UUIDString;
  username: string;
  displayName: string;
  mediaType: string;
  mediaUrl: string;
  storagePath?: string | null;
  mediaMimeType?: string | null;
  mediaSizeBytes?: Int64String | null;
  caption?: string | null;
  expiresAt: TimestampString;
}

export interface Follow_Key {
  id: UUIDString;
  __typename?: 'Follow_Key';
}

export interface GetFollowByKeyData {
  follows: ({
    id: UUIDString;
    tenantId: UUIDString;
    followerUserId: UUIDString;
    followingUserId: UUIDString;
    createdAt: TimestampString;
  } & Follow_Key)[];
}

export interface GetFollowByKeyVariables {
  followKey: string;
}

export interface GetPostByIdData {
  post?: {
    id: UUIDString;
    tenantId: UUIDString;
    communityId?: UUIDString | null;
    membershipId: UUIDString;
    authorUserId?: UUIDString | null;
    authorUsername?: string | null;
    authorName?: string | null;
    placement: string;
    kind: string;
    title?: string | null;
    body: string;
    mediaUrl?: string | null;
    storagePath?: string | null;
    mediaMimeType?: string | null;
    mediaSizeBytes?: Int64String | null;
    location?: string | null;
    status: string;
    createdAt: TimestampString;
  } & Post_Key;
}

export interface GetPostByIdVariables {
  id: UUIDString;
}

export interface GetReactionByKeyData {
  reactions: ({
    id: UUIDString;
    postId: UUIDString;
    membershipId: UUIDString;
    reactionType: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Reaction_Key)[];
}

export interface GetReactionByKeyVariables {
  reactionKey: string;
}

export interface GetStoryByIdData {
  story?: {
    id: UUIDString;
    tenantId: UUIDString;
    userId: UUIDString;
    username: string;
    displayName: string;
    mediaType: string;
    mediaUrl: string;
    storagePath?: string | null;
    mediaMimeType?: string | null;
    mediaSizeBytes?: Int64String | null;
    caption?: string | null;
    createdAt: TimestampString;
    expiresAt: TimestampString;
  } & Story_Key;
}

export interface GetStoryByIdVariables {
  id: UUIDString;
}

export interface GetStoryReactionByKeyData {
  storyReactions: ({
    id: UUIDString;
    storyId: UUIDString;
    membershipId: UUIDString;
    reactionType: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & StoryReaction_Key)[];
}

export interface GetStoryReactionByKeyVariables {
  storyReactionKey: string;
}

export interface ListCommentsByPostData {
  comments: ({
    id: UUIDString;
    postId: UUIDString;
    membershipId: UUIDString;
    authorUserId?: UUIDString | null;
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

export interface ListCommentsByTenantData {
  comments: ({
    id: UUIDString;
    postId: UUIDString;
    membershipId: UUIDString;
    authorUserId?: UUIDString | null;
    parentCommentId?: UUIDString | null;
    body: string;
    status: string;
    createdAt: TimestampString;
  } & Comment_Key)[];
}

export interface ListCommentsByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListFeedByTenantData {
  posts: ({
    id: UUIDString;
    tenantId: UUIDString;
    communityId?: UUIDString | null;
    membershipId: UUIDString;
    authorUserId?: UUIDString | null;
    authorUsername?: string | null;
    authorName?: string | null;
    placement: string;
    kind: string;
    title?: string | null;
    body: string;
    mediaUrl?: string | null;
    storagePath?: string | null;
    mediaMimeType?: string | null;
    mediaSizeBytes?: Int64String | null;
    location?: string | null;
    status: string;
    createdAt: TimestampString;
  } & Post_Key)[];
}

export interface ListFeedByTenantVariables {
  tenantId: UUIDString;
  placement?: string;
  limit: number;
}

export interface ListFollowersByUserData {
  follows: ({
    id: UUIDString;
    tenantId: UUIDString;
    followerUserId: UUIDString;
    followingUserId: UUIDString;
    createdAt: TimestampString;
  } & Follow_Key)[];
}

export interface ListFollowersByUserVariables {
  tenantId: UUIDString;
  followingUserId: UUIDString;
  limit: number;
}

export interface ListFollowingByUserData {
  follows: ({
    id: UUIDString;
    tenantId: UUIDString;
    followerUserId: UUIDString;
    followingUserId: UUIDString;
    createdAt: TimestampString;
  } & Follow_Key)[];
}

export interface ListFollowingByUserVariables {
  tenantId: UUIDString;
  followerUserId: UUIDString;
  limit: number;
}

export interface ListPostsByAuthorData {
  posts: ({
    id: UUIDString;
    tenantId: UUIDString;
    communityId?: UUIDString | null;
    membershipId: UUIDString;
    authorUserId?: UUIDString | null;
    authorUsername?: string | null;
    authorName?: string | null;
    placement: string;
    kind: string;
    title?: string | null;
    body: string;
    mediaUrl?: string | null;
    storagePath?: string | null;
    mediaMimeType?: string | null;
    mediaSizeBytes?: Int64String | null;
    location?: string | null;
    status: string;
    createdAt: TimestampString;
  } & Post_Key)[];
}

export interface ListPostsByAuthorVariables {
  tenantId: UUIDString;
  authorUserId: UUIDString;
  placement: string;
  limit: number;
}

export interface ListReactionsByPostData {
  reactions: ({
    id: UUIDString;
    postId: UUIDString;
    membershipId: UUIDString;
    reactionType: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Reaction_Key)[];
}

export interface ListReactionsByPostVariables {
  postId: UUIDString;
  limit: number;
}

export interface ListReactionsByTenantData {
  reactions: ({
    id: UUIDString;
    postId: UUIDString;
    membershipId: UUIDString;
    reactionType: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Reaction_Key)[];
}

export interface ListReactionsByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListStoriesByTenantData {
  stories: ({
    id: UUIDString;
    tenantId: UUIDString;
    userId: UUIDString;
    username: string;
    displayName: string;
    mediaType: string;
    mediaUrl: string;
    storagePath?: string | null;
    mediaMimeType?: string | null;
    mediaSizeBytes?: Int64String | null;
    caption?: string | null;
    createdAt: TimestampString;
    expiresAt: TimestampString;
  } & Story_Key)[];
}

export interface ListStoriesByTenantVariables {
  tenantId: UUIDString;
  limit: number;
}

export interface ListStoryReactionsByStoryData {
  storyReactions: ({
    id: UUIDString;
    storyId: UUIDString;
    membershipId: UUIDString;
    reactionType: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & StoryReaction_Key)[];
}

export interface ListStoryReactionsByStoryVariables {
  storyId: UUIDString;
  limit: number;
}

export interface ListStoryReactionsByTenantData {
  storyReactions: ({
    id: UUIDString;
    storyId: UUIDString;
    membershipId: UUIDString;
    reactionType: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & StoryReaction_Key)[];
}

export interface ListStoryReactionsByTenantVariables {
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

export interface SoftDeleteFollowData {
  follow_update?: Follow_Key | null;
}

export interface SoftDeleteFollowVariables {
  id: UUIDString;
}

export interface SoftDeletePostData {
  post_update?: Post_Key | null;
}

export interface SoftDeletePostVariables {
  id: UUIDString;
}

export interface StoryReaction_Key {
  id: UUIDString;
  __typename?: 'StoryReaction_Key';
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

export interface UpdateReactionData {
  reaction_update?: Reaction_Key | null;
}

export interface UpdateReactionVariables {
  id: UUIDString;
  reactionType: string;
}

export interface UpdateStoryReactionData {
  storyReaction_update?: StoryReaction_Key | null;
}

export interface UpdateStoryReactionVariables {
  id: UUIDString;
  reactionType: string;
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

/** Generated Node Admin SDK operation action function for the 'ListPostsByAuthor' Query. Allow users to execute without passing in DataConnect. */
export function listPostsByAuthor(dc: DataConnect, vars: ListPostsByAuthorVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPostsByAuthorData>>;
/** Generated Node Admin SDK operation action function for the 'ListPostsByAuthor' Query. Allow users to pass in custom DataConnect instances. */
export function listPostsByAuthor(vars: ListPostsByAuthorVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPostsByAuthorData>>;

/** Generated Node Admin SDK operation action function for the 'GetPostById' Query. Allow users to execute without passing in DataConnect. */
export function getPostById(dc: DataConnect, vars: GetPostByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPostByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetPostById' Query. Allow users to pass in custom DataConnect instances. */
export function getPostById(vars: GetPostByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPostByIdData>>;

/** Generated Node Admin SDK operation action function for the 'ListCommentsByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listCommentsByTenant(dc: DataConnect, vars: ListCommentsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommentsByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListCommentsByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listCommentsByTenant(vars: ListCommentsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommentsByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListCommentsByPost' Query. Allow users to execute without passing in DataConnect. */
export function listCommentsByPost(dc: DataConnect, vars: ListCommentsByPostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommentsByPostData>>;
/** Generated Node Admin SDK operation action function for the 'ListCommentsByPost' Query. Allow users to pass in custom DataConnect instances. */
export function listCommentsByPost(vars: ListCommentsByPostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCommentsByPostData>>;

/** Generated Node Admin SDK operation action function for the 'ListReactionsByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listReactionsByTenant(dc: DataConnect, vars: ListReactionsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListReactionsByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListReactionsByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listReactionsByTenant(vars: ListReactionsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListReactionsByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListReactionsByPost' Query. Allow users to execute without passing in DataConnect. */
export function listReactionsByPost(dc: DataConnect, vars: ListReactionsByPostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListReactionsByPostData>>;
/** Generated Node Admin SDK operation action function for the 'ListReactionsByPost' Query. Allow users to pass in custom DataConnect instances. */
export function listReactionsByPost(vars: ListReactionsByPostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListReactionsByPostData>>;

/** Generated Node Admin SDK operation action function for the 'GetReactionByKey' Query. Allow users to execute without passing in DataConnect. */
export function getReactionByKey(dc: DataConnect, vars: GetReactionByKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetReactionByKeyData>>;
/** Generated Node Admin SDK operation action function for the 'GetReactionByKey' Query. Allow users to pass in custom DataConnect instances. */
export function getReactionByKey(vars: GetReactionByKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetReactionByKeyData>>;

/** Generated Node Admin SDK operation action function for the 'ListStoriesByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listStoriesByTenant(dc: DataConnect, vars: ListStoriesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStoriesByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListStoriesByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listStoriesByTenant(vars: ListStoriesByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStoriesByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'GetStoryById' Query. Allow users to execute without passing in DataConnect. */
export function getStoryById(dc: DataConnect, vars: GetStoryByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetStoryByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetStoryById' Query. Allow users to pass in custom DataConnect instances. */
export function getStoryById(vars: GetStoryByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetStoryByIdData>>;

/** Generated Node Admin SDK operation action function for the 'ListStoryReactionsByTenant' Query. Allow users to execute without passing in DataConnect. */
export function listStoryReactionsByTenant(dc: DataConnect, vars: ListStoryReactionsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStoryReactionsByTenantData>>;
/** Generated Node Admin SDK operation action function for the 'ListStoryReactionsByTenant' Query. Allow users to pass in custom DataConnect instances. */
export function listStoryReactionsByTenant(vars: ListStoryReactionsByTenantVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStoryReactionsByTenantData>>;

/** Generated Node Admin SDK operation action function for the 'ListStoryReactionsByStory' Query. Allow users to execute without passing in DataConnect. */
export function listStoryReactionsByStory(dc: DataConnect, vars: ListStoryReactionsByStoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStoryReactionsByStoryData>>;
/** Generated Node Admin SDK operation action function for the 'ListStoryReactionsByStory' Query. Allow users to pass in custom DataConnect instances. */
export function listStoryReactionsByStory(vars: ListStoryReactionsByStoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStoryReactionsByStoryData>>;

/** Generated Node Admin SDK operation action function for the 'GetStoryReactionByKey' Query. Allow users to execute without passing in DataConnect. */
export function getStoryReactionByKey(dc: DataConnect, vars: GetStoryReactionByKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetStoryReactionByKeyData>>;
/** Generated Node Admin SDK operation action function for the 'GetStoryReactionByKey' Query. Allow users to pass in custom DataConnect instances. */
export function getStoryReactionByKey(vars: GetStoryReactionByKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetStoryReactionByKeyData>>;

/** Generated Node Admin SDK operation action function for the 'ListFollowingByUser' Query. Allow users to execute without passing in DataConnect. */
export function listFollowingByUser(dc: DataConnect, vars: ListFollowingByUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFollowingByUserData>>;
/** Generated Node Admin SDK operation action function for the 'ListFollowingByUser' Query. Allow users to pass in custom DataConnect instances. */
export function listFollowingByUser(vars: ListFollowingByUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFollowingByUserData>>;

/** Generated Node Admin SDK operation action function for the 'ListFollowersByUser' Query. Allow users to execute without passing in DataConnect. */
export function listFollowersByUser(dc: DataConnect, vars: ListFollowersByUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFollowersByUserData>>;
/** Generated Node Admin SDK operation action function for the 'ListFollowersByUser' Query. Allow users to pass in custom DataConnect instances. */
export function listFollowersByUser(vars: ListFollowersByUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFollowersByUserData>>;

/** Generated Node Admin SDK operation action function for the 'GetFollowByKey' Query. Allow users to execute without passing in DataConnect. */
export function getFollowByKey(dc: DataConnect, vars: GetFollowByKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetFollowByKeyData>>;
/** Generated Node Admin SDK operation action function for the 'GetFollowByKey' Query. Allow users to pass in custom DataConnect instances. */
export function getFollowByKey(vars: GetFollowByKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetFollowByKeyData>>;

/** Generated Node Admin SDK operation action function for the 'CreatePost' Mutation. Allow users to execute without passing in DataConnect. */
export function createPost(dc: DataConnect, vars: CreatePostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePostData>>;
/** Generated Node Admin SDK operation action function for the 'CreatePost' Mutation. Allow users to pass in custom DataConnect instances. */
export function createPost(vars: CreatePostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePostData>>;

/** Generated Node Admin SDK operation action function for the 'CreatePostMedia' Mutation. Allow users to execute without passing in DataConnect. */
export function createPostMedia(dc: DataConnect, vars: CreatePostMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePostMediaData>>;
/** Generated Node Admin SDK operation action function for the 'CreatePostMedia' Mutation. Allow users to pass in custom DataConnect instances. */
export function createPostMedia(vars: CreatePostMediaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePostMediaData>>;

/** Generated Node Admin SDK operation action function for the 'CreateComment' Mutation. Allow users to execute without passing in DataConnect. */
export function createComment(dc: DataConnect, vars: CreateCommentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommentData>>;
/** Generated Node Admin SDK operation action function for the 'CreateComment' Mutation. Allow users to pass in custom DataConnect instances. */
export function createComment(vars: CreateCommentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommentData>>;

/** Generated Node Admin SDK operation action function for the 'CreateReaction' Mutation. Allow users to execute without passing in DataConnect. */
export function createReaction(dc: DataConnect, vars: CreateReactionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateReactionData>>;
/** Generated Node Admin SDK operation action function for the 'CreateReaction' Mutation. Allow users to pass in custom DataConnect instances. */
export function createReaction(vars: CreateReactionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateReactionData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateReaction' Mutation. Allow users to execute without passing in DataConnect. */
export function updateReaction(dc: DataConnect, vars: UpdateReactionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateReactionData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateReaction' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateReaction(vars: UpdateReactionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateReactionData>>;

/** Generated Node Admin SDK operation action function for the 'CreateStory' Mutation. Allow users to execute without passing in DataConnect. */
export function createStory(dc: DataConnect, vars: CreateStoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateStoryData>>;
/** Generated Node Admin SDK operation action function for the 'CreateStory' Mutation. Allow users to pass in custom DataConnect instances. */
export function createStory(vars: CreateStoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateStoryData>>;

/** Generated Node Admin SDK operation action function for the 'CreateStoryReaction' Mutation. Allow users to execute without passing in DataConnect. */
export function createStoryReaction(dc: DataConnect, vars: CreateStoryReactionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateStoryReactionData>>;
/** Generated Node Admin SDK operation action function for the 'CreateStoryReaction' Mutation. Allow users to pass in custom DataConnect instances. */
export function createStoryReaction(vars: CreateStoryReactionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateStoryReactionData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateStoryReaction' Mutation. Allow users to execute without passing in DataConnect. */
export function updateStoryReaction(dc: DataConnect, vars: UpdateStoryReactionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateStoryReactionData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateStoryReaction' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateStoryReaction(vars: UpdateStoryReactionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateStoryReactionData>>;

/** Generated Node Admin SDK operation action function for the 'CreateFollow' Mutation. Allow users to execute without passing in DataConnect. */
export function createFollow(dc: DataConnect, vars: CreateFollowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateFollowData>>;
/** Generated Node Admin SDK operation action function for the 'CreateFollow' Mutation. Allow users to pass in custom DataConnect instances. */
export function createFollow(vars: CreateFollowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateFollowData>>;

/** Generated Node Admin SDK operation action function for the 'SoftDeleteFollow' Mutation. Allow users to execute without passing in DataConnect. */
export function softDeleteFollow(dc: DataConnect, vars: SoftDeleteFollowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeleteFollowData>>;
/** Generated Node Admin SDK operation action function for the 'SoftDeleteFollow' Mutation. Allow users to pass in custom DataConnect instances. */
export function softDeleteFollow(vars: SoftDeleteFollowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeleteFollowData>>;

/** Generated Node Admin SDK operation action function for the 'SoftDeletePost' Mutation. Allow users to execute without passing in DataConnect. */
export function softDeletePost(dc: DataConnect, vars: SoftDeletePostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeletePostData>>;
/** Generated Node Admin SDK operation action function for the 'SoftDeletePost' Mutation. Allow users to pass in custom DataConnect instances. */
export function softDeletePost(vars: SoftDeletePostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SoftDeletePostData>>;

