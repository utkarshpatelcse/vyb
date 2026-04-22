export type HealthStatus = "ok";
export type CommunityType = "general" | "batch" | "branch" | "hostel" | "club";
export type ResourceType = "notes" | "pyq" | "guide";
export type PostKind = "text" | "image" | "video";
export type PublishStatus = "draft" | "pending" | "published" | "removed";
export type FeedPlacement = "feed" | "vibe";
export type ReactionKind = "fire" | "support" | "like";
export type StoryReactionKind = "like";

export interface ServiceHealth {
  service: string;
  status: HealthStatus;
  timestamp: string;
}

export interface CommunityLink {
  id: string;
  name: string;
  type: CommunityType;
  memberCount: number;
}

export interface FeedPreviewCard {
  id: string;
  title: string;
  body: string;
  community: string;
  reactions: number;
  comments: number;
}

export interface ResourcePreviewCard {
  id: string;
  title: string;
  course: string;
  type: ResourceType;
  downloads: number;
}

export interface MembershipSummary {
  id: string;
  tenantId: string;
  role: "student" | "faculty" | "alumni" | "moderator" | "admin";
  verificationStatus: "pending" | "verified" | "rejected";
}

export interface UserProfile {
  id: string;
  primaryEmail: string;
  displayName: string;
  status: "active" | "blocked";
}

export interface AuthBootstrapRequest {
  displayName?: string;
  avatarUrl?: string;
}

export interface AuthBootstrapResponse {
  user: UserProfile;
  onboarding: {
    stage: "membership-pending" | "manual-review";
    displayName: string;
  };
  verification: {
    emailVerified: boolean;
    emailDomain: string | null;
  };
}

export interface MeResponse {
  user: UserProfile;
  membershipSummary: MembershipSummary;
}

export interface ViewerSessionPayload {
  userId: string;
  email: string;
  displayName: string;
  membershipId: string;
  tenantId: string;
  role: MembershipSummary["role"];
}

export interface SessionBootstrapRequest {
  idToken: string;
  displayName?: string;
}

export interface SessionBootstrapResponse {
  session: ViewerSessionPayload;
  profileCompleted: boolean;
  nextPath: "/home" | "/onboarding";
}

export interface ProfileRecord {
  userId: string;
  tenantId: string;
  primaryEmail: string;
  collegeName: string;
  username: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  course: string;
  stream: string;
  branch: string;
  year: number;
  section: string;
  isHosteller: boolean;
  hostelName: string | null;
  phoneNumber: string | null;
  profileCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileResponse {
  profileCompleted: boolean;
  allowedEmailDomain: string;
  collegeName: string;
  profile: ProfileRecord | null;
}

export interface UpsertProfileRequest {
  username: string;
  firstName: string;
  lastName?: string | null;
  course: string;
  stream: string;
  year: number;
  section: string;
  isHosteller: boolean;
  hostelName?: string | null;
  phoneNumber?: string | null;
}

export interface ClientShellResponse {
  shell: "pwa-first";
  mobileInstallable: boolean;
  desktopResponsive: boolean;
  nativeReadyContracts: boolean;
  backendRuntime: "modular-monolith";
  launchCampus: {
    id: string;
    name: string;
    domain: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    summary: string;
  };
  pillars: Array<{
    title: string;
    description: string;
  }>;
  phaseOne: string[];
  trustPoints: string[];
}

export interface CommunitiesMyResponse {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  communities: CommunityLink[];
}

export interface FeedCard {
  id: string;
  tenantId: string;
  communityId: string | null;
  userId: string;
  membershipId: string;
  placement: FeedPlacement;
  kind: PostKind;
  mediaUrl: string | null;
  location: string | null;
  title: string;
  body: string;
  status: PublishStatus;
  reactions: number;
  comments: number;
  viewerReactionType: ReactionKind | null;
  createdAt: string;
  author: {
    userId: string;
    username: string;
    displayName: string;
  };
}

export interface FeedListResponse {
  tenantId: string;
  communityId: string | null;
  items: FeedCard[];
  nextCursor: string | null;
}

export interface CreatePostRequest {
  tenantId: string;
  communityId?: string | null;
  membershipId: string;
  kind: PostKind;
  placement?: FeedPlacement;
  title?: string | null;
  body: string;
  mediaUrl?: string | null;
  location?: string | null;
}

export interface CreatePostResponse {
  item: FeedCard;
}

export interface StoryCard {
  id: string;
  tenantId: string;
  userId: string;
  username: string;
  displayName: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  caption: string;
  createdAt: string;
  expiresAt: string;
  isOwn: boolean;
  reactions: number;
  viewerHasLiked: boolean;
  viewerHasSeen: boolean;
}

export interface StoryListResponse {
  items: StoryCard[];
}

export interface CreateStoryRequest {
  tenantId: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  caption?: string | null;
}

export interface CreateStoryResponse {
  item: StoryCard;
}

export interface PublicProfileSummary {
  userId: string;
  username: string;
  displayName: string;
  collegeName: string;
  course: string;
  stream: string;
}

export interface SocialProfileStats {
  posts: number;
  followers: number;
  following: number;
}

export interface UserSearchItem extends PublicProfileSummary {
  isFollowing: boolean;
  stats: SocialProfileStats;
}

export interface UserSearchResponse {
  query: string;
  items: UserSearchItem[];
}

export interface PublicProfileResponse {
  profile: PublicProfileSummary;
  stats: SocialProfileStats;
  isFollowing: boolean;
  isViewerProfile: boolean;
  posts: FeedCard[];
}

export interface UpdateUsernameRequest {
  username: string;
}

export interface UpdateUsernameResponse {
  profile: ProfileRecord;
}

export interface CommentItem {
  id: string;
  postId: string;
  membershipId: string;
  authorUserId: string;
  parentCommentId: string | null;
  body: string;
  mediaUrl: string | null;
  mediaType: "image" | "gif" | "sticker" | null;
  createdAt: string;
  reactions: number;
  viewerHasLiked: boolean;
  author: {
    userId: string;
    username: string;
    displayName: string;
  } | null;
}

export interface CommentListResponse {
  postId: string;
  items: CommentItem[];
}

export interface CreateCommentResponse {
  item: CommentItem;
}

export interface ReactionResponse {
  postId: string;
  membershipId: string;
  reactionType: ReactionKind | null;
  aggregateCount: number;
  active: boolean;
  viewerReactionType: ReactionKind | null;
}

export interface StoryReactionResponse {
  storyId: string;
  membershipId: string;
  reactionType: StoryReactionKind | null;
  aggregateCount: number;
  active: boolean;
}

export interface CommentReactionResponse {
  commentId: string;
  membershipId: string;
  reactionType: "like" | null;
  aggregateCount: number;
  active: boolean;
}

export interface StorySeenResponse {
  storyId: string;
  membershipId: string;
  viewed: boolean;
}

export interface PostLikerItem {
  membershipId: string;
  userId: string | null;
  username: string;
  displayName: string;
  reactionType: ReactionKind;
  reactedAt: string;
}

export interface PostLikerListResponse {
  postId: string;
  items: PostLikerItem[];
}

export interface DeletePostResponse {
  postId: string;
  deleted: boolean;
}

export interface UpdatePostRequest {
  title?: string | null;
  body?: string | null;
  location?: string | null;
}

export interface UpdatePostResponse {
  item: FeedCard;
}

export interface RepostPostRequest {
  quote?: string | null;
  placement?: FeedPlacement;
}

export interface RepostPostResponse {
  item: FeedCard;
}

export interface CreateReportRequest {
  targetType: string;
  targetId: string;
  reason: string;
}

export interface CreateReportResponse {
  item: {
    id: string;
    tenantId: string;
    membershipId: string;
    targetType: string;
    targetId: string;
    reason: string;
    status: string;
    createdAt: string;
  };
}

export interface CourseItem {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  semester: number | null;
  branch: string | null;
  createdAt: string;
}

export interface ListCoursesResponse {
  tenantId: string;
  items: CourseItem[];
}

export interface ResourceItem {
  id: string;
  tenantId: string;
  membershipId: string;
  courseId: string | null;
  title: string;
  description: string;
  type: ResourceType;
  downloads: number;
  status: PublishStatus;
  createdAt: string;
}

export interface ListResourcesResponse {
  tenantId: string;
  courseId: string | null;
  items: ResourceItem[];
  nextCursor: string | null;
}

export interface CreateResourceRequest {
  tenantId: string;
  membershipId: string;
  courseId?: string | null;
  title: string;
  description: string;
  type: ResourceType;
}

export interface CreateResourceResponse {
  item: ResourceItem;
}

export interface ResourceDetailResponse {
  item: ResourceItem & {
    files: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }>;
  };
}

export interface ActivityItem {
  id: string;
  tenantId: string;
  membershipId: string;
  activityType: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityListResponse {
  tenantId: string;
  items: ActivityItem[];
}

export type MarketTab = "sale" | "buying" | "lend";
export type MarketRequestTab = Exclude<MarketTab, "sale">;
export type MarketTone = "violet" | "magenta" | "cyan";
export type MarketMediaKind = "image" | "video";

export interface MarketActorSummary {
  userId: string;
  username: string;
  displayName: string;
  role: MembershipSummary["role"];
}

export interface MarketMediaAsset {
  id: string;
  kind: MarketMediaKind;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string | null;
}

export interface MarketListing {
  id: string;
  tenantId: string;
  seller: MarketActorSummary;
  title: string;
  description: string;
  category: string;
  condition: string;
  priceAmount: number;
  location: string;
  campusSpot: string;
  media: MarketMediaAsset[];
  createdAt: string;
  savedCount: number;
  inquiryCount: number;
  isSaved: boolean;
}

export interface MarketRequest {
  id: string;
  tenantId: string;
  tab: MarketRequestTab;
  requester: MarketActorSummary;
  tag: string;
  title: string;
  detail: string;
  category: string;
  campusSpot: string;
  media: MarketMediaAsset[];
  budgetLabel: string;
  budgetAmount: number | null;
  tone: MarketTone;
  createdAt: string;
  responseCount: number;
}

export interface MarketViewerSummary {
  userId: string;
  username: string;
  savedCount: number;
}

export interface MarketDashboardResponse {
  tenantId: string;
  viewer: MarketViewerSummary;
  listings: MarketListing[];
  requests: MarketRequest[];
  viewerActiveListings: MarketListing[];
  viewerActiveRequests: MarketRequest[];
}

export interface CreateMarketPostRequest {
  tab: MarketTab;
  title: string;
  category: string;
  description: string;
  location?: string | null;
  campusSpot?: string | null;
  imageUrl?: string | null;
  media?: MarketMediaAsset[];
  condition?: string | null;
  priceAmount?: number | null;
  budgetAmount?: number | null;
  budgetLabel?: string | null;
  tag?: string | null;
}

export interface CreateMarketPostResponse {
  dashboard: MarketDashboardResponse;
  itemId: string;
  itemType: "listing" | "request";
}

export interface UpdateMarketListingRequest {
  listingId: string;
  title: string;
  category: string;
  description: string;
  condition?: string | null;
  priceAmount: number;
  keepMediaIds?: string[];
  media?: MarketMediaAsset[];
}

export interface UpdateMarketListingResponse {
  dashboard: MarketDashboardResponse;
  listingId: string;
}

export interface ManageMarketListingResponse {
  dashboard: MarketDashboardResponse;
  listingId: string;
  action: "sold" | "deleted";
}

export interface ToggleMarketSaveRequest {
  listingId: string;
}

export interface ToggleMarketSaveResponse {
  dashboard: MarketDashboardResponse;
  listingId: string;
  isSaved: boolean;
}

export interface ContactMarketPostRequest {
  targetId: string;
  targetType: "listing" | "request";
  message: string;
}

export interface ContactMarketPostResponse {
  dashboard: MarketDashboardResponse;
  targetId: string;
  targetType: "listing" | "request";
}
