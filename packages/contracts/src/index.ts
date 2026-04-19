export type HealthStatus = "ok";
export type CommunityType = "general" | "batch" | "branch" | "hostel" | "club";
export type ResourceType = "notes" | "pyq" | "guide";
export type PostKind = "text" | "image" | "video";
export type PublishStatus = "draft" | "pending" | "published" | "removed";
export type FeedPlacement = "feed" | "vibe";

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
  body: string;
  createdAt: string;
}

export interface CreateCommentResponse {
  item: CommentItem;
}

export interface ReactionResponse {
  postId: string;
  membershipId: string;
  reactionType: "fire" | "support" | "like";
  aggregateCount: number;
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
