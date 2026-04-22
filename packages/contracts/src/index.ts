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
  media: {
    url: string;
    kind: "image" | "video";
  }[];
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
  mediaAssets?: {
    url: string;
    kind: "image" | "video";
    mimeType?: string;
    sizeBytes?: number;
    storagePath?: string;
  }[];
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

export type ChatConversationKind = "direct";
export type ChatMessageKind = "text" | "image" | "vibe_card" | "deal_card" | "system";
export type ChatSeedType = "deal" | "vibe";

export interface ChatIdentitySummary {
  id: string;
  userId: string;
  membershipId: string;
  publicKey: string;
  algorithm: string;
  keyVersion: number;
  updatedAt: string;
}

export interface ChatPeerSummary {
  userId: string;
  membershipId: string;
  username: string;
  displayName: string;
  course?: string | null;
  stream?: string | null;
  avatarUrl?: string | null;
  publicKey?: ChatIdentitySummary | null;
}

export interface ChatEncryptedAttachment {
  kind: "image";
  url: string;
  storagePath: string | null;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
}

export interface ChatVibeCardPayload {
  postId: string;
  title: string;
  body: string;
  mediaUrl: string | null;
  authorUsername: string;
}

export interface ChatDealCardPayload {
  targetType: "listing" | "request";
  targetId: string;
  title: string;
  amountLabel: string;
  category: string;
  campusSpot: string;
  counterpartUsername: string;
  counterpartDisplayName: string;
}

export interface ChatMessageReactionItem {
  membershipId: string;
  emoji: string;
  createdAt: string;
}

export interface ChatMessageRecord {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderMembershipId: string;
  senderIdentityId: string;
  messageKind: ChatMessageKind;
  cipherText: string;
  cipherIv: string;
  cipherAlgorithm: string;
  replyToMessageId: string | null;
  attachment: ChatEncryptedAttachment | null;
  createdAt: string;
  reactions: ChatMessageReactionItem[];
}

export interface ChatConversationPreview {
  id: string;
  tenantId: string;
  kind: ChatConversationKind;
  peer: ChatPeerSummary;
  lastMessage: ChatMessageRecord | null;
  lastActivityAt: string;
  unreadCount: number;
}

export interface ChatInboxResponse {
  viewer: {
    userId: string;
    membershipId: string;
    activeIdentity: ChatIdentitySummary | null;
  };
  items: ChatConversationPreview[];
}

export interface ChatConversationResponse {
  viewer: {
    userId: string;
    membershipId: string;
    activeIdentity: ChatIdentitySummary | null;
  };
  conversation: {
    id: string;
    tenantId: string;
    kind: ChatConversationKind;
    peer: ChatPeerSummary;
    messages: ChatMessageRecord[];
    lastReadMessageId: string | null;
    lastReadAt: string | null;
  };
}

export interface CreateChatConversationRequest {
  recipientUserId?: string;
  recipientUsername?: string;
  seedType?: ChatSeedType | null;
  initialCipherText?: string | null;
  initialCipherIv?: string | null;
  initialCipherAlgorithm?: string | null;
}

export interface CreateChatConversationResponse {
  conversation: ChatConversationResponse["conversation"];
  created: boolean;
}

export interface SendChatMessageRequest {
  messageKind: ChatMessageKind;
  cipherText: string;
  cipherIv: string;
  cipherAlgorithm: string;
  replyToMessageId?: string | null;
  attachment?: ChatEncryptedAttachment | null;
}

export interface SendChatMessageResponse {
  item: ChatMessageRecord;
  conversationPreview: ChatConversationPreview;
}

export interface MarkChatReadResponse {
  conversationId: string;
  messageId: string;
  readAt: string;
}

export interface ReactToChatMessageResponse {
  messageId: string;
  membershipId: string;
  emoji: string | null;
  aggregate: ChatMessageReactionItem[];
}

export interface UpsertChatIdentityRequest {
  publicKey: string;
  algorithm: string;
  keyVersion: number;
}

export interface UpsertChatIdentityResponse {
  identity: ChatIdentitySummary;
}

export interface UploadEncryptedChatAttachmentRequest {
  fileName: string;
  mimeType: string;
  base64Data: string;
  width?: number | null;
  height?: number | null;
}

export interface UploadEncryptedChatAttachmentResponse {
  attachment: ChatEncryptedAttachment;
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

export type CampusEventStatus = "published" | "ended" | "cancelled" | "deleted";
export type CampusEventPassKind = "free" | "rsvp" | "paid";
export type CampusEventScope = "for-you" | "week" | "saved" | "ended";
export type CampusEventResponseMode = "interest" | "register" | "apply";
export type CampusEventEntryMode = "individual" | "team";
export type CampusEventRegistrationStatus = "submitted" | "approved" | "waitlisted" | "rejected" | "cancelled";
export type CampusEventFormFieldType = "short_text" | "long_text" | "select" | "email" | "phone" | "number";

export interface CampusEventActorSummary {
  userId: string;
  username: string;
  displayName: string;
  role: MembershipSummary["role"];
}

export interface CampusEventMediaAsset {
  id: string;
  kind: "image" | "video";
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string | null;
}

export interface CampusEventFormField {
  id: string;
  label: string;
  type: CampusEventFormFieldType;
  required: boolean;
  placeholder?: string | null;
  helpText?: string | null;
  options?: string[];
}

export interface CampusEventRegistrationConfig {
  mode: CampusEventResponseMode;
  entryMode: CampusEventEntryMode;
  closesAt: string | null;
  requiresApproval: boolean;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  allowAttachments: boolean;
  attachmentLabel?: string | null;
  formFields: CampusEventFormField[];
}

export interface CampusEventRegistrationSummary {
  total: number;
  submitted: number;
  approved: number;
  waitlisted: number;
  rejected: number;
}

export interface CampusEventRegistrationAnswer {
  fieldId: string;
  label: string;
  value: string;
}

export interface CampusEventTeamMember {
  id: string;
  name: string;
  email?: string | null;
  username?: string | null;
  phone?: string | null;
  role?: string | null;
}

export interface CampusEventViewerRegistrationSummary {
  id: string;
  status: CampusEventRegistrationStatus;
  submittedAt: string;
  updatedAt: string;
  teamName?: string | null;
  teamSize: number;
  note?: string | null;
  reviewNote?: string | null;
  attachmentCount: number;
}

export interface CampusEventRegistration {
  id: string;
  eventId: string;
  attendee: CampusEventActorSummary;
  status: CampusEventRegistrationStatus;
  submittedAt: string;
  updatedAt: string;
  teamName?: string | null;
  teamSize: number;
  teamMembers: CampusEventTeamMember[];
  answers: CampusEventRegistrationAnswer[];
  attachments: CampusEventMediaAsset[];
  note?: string | null;
  reviewNote?: string | null;
}

export interface CampusEvent {
  id: string;
  tenantId: string;
  host: CampusEventActorSummary;
  title: string;
  club: string;
  category: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  media: CampusEventMediaAsset[];
  passKind: CampusEventPassKind;
  passLabel: string;
  capacity: number | null;
  spotsLeft: number | null;
  isRegistrationOpen: boolean;
  commentCount: number;
  status: CampusEventStatus;
  createdAt: string;
  savedCount: number;
  interestCount: number;
  responseMode: CampusEventResponseMode;
  registrationConfig: CampusEventRegistrationConfig;
  registrationSummary: CampusEventRegistrationSummary;
  viewerRegistration: CampusEventViewerRegistrationSummary | null;
  isSaved: boolean;
  isInterested: boolean;
  isHostedByViewer: boolean;
}

export interface CampusEventsViewerSummary {
  userId: string;
  username: string;
  savedCount: number;
  interestedCount: number;
  hostedCount: number;
  hostedPendingCount: number;
  hostedRegistrationCount: number;
}

export interface CampusEventsDashboardResponse {
  tenantId: string;
  viewer: CampusEventsViewerSummary;
  events: CampusEvent[];
  hostedEvents: CampusEvent[];
  categories: string[];
}

export interface CreateCampusEventRequest {
  title: string;
  club: string;
  category: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt?: string | null;
  passKind: CampusEventPassKind;
  passLabel?: string | null;
  capacity?: number | null;
  responseMode: CampusEventResponseMode;
  registrationClosesAt?: string | null;
  entryMode?: CampusEventEntryMode | null;
  teamSizeMin?: number | null;
  teamSizeMax?: number | null;
  allowAttachments?: boolean;
  attachmentLabel?: string | null;
  formFields?: CampusEventFormField[];
  media?: CampusEventMediaAsset[];
}

export interface CreateCampusEventResponse {
  dashboard: CampusEventsDashboardResponse;
  eventId: string;
}

export interface UpdateCampusEventRequest {
  eventId: string;
  title: string;
  club: string;
  category: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt?: string | null;
  passKind: CampusEventPassKind;
  passLabel?: string | null;
  capacity?: number | null;
  responseMode: CampusEventResponseMode;
  registrationClosesAt?: string | null;
  entryMode?: CampusEventEntryMode | null;
  teamSizeMin?: number | null;
  teamSizeMax?: number | null;
  allowAttachments?: boolean;
  attachmentLabel?: string | null;
  formFields?: CampusEventFormField[];
  keepMediaIds?: string[];
  media?: CampusEventMediaAsset[];
}

export interface UpdateCampusEventResponse {
  dashboard: CampusEventsDashboardResponse;
  eventId: string;
}

export interface ToggleCampusEventSaveRequest {
  eventId: string;
}

export interface ToggleCampusEventSaveResponse {
  dashboard: CampusEventsDashboardResponse;
  eventId: string;
  isSaved: boolean;
}

export interface ToggleCampusEventInterestRequest {
  eventId: string;
}

export interface ToggleCampusEventInterestResponse {
  dashboard: CampusEventsDashboardResponse;
  eventId: string;
  isInterested: boolean;
}

export interface UpsertCampusEventRegistrationRequest {
  eventId: string;
  teamName?: string | null;
  note?: string | null;
  teamMembers?: CampusEventTeamMember[];
  answers?: CampusEventRegistrationAnswer[];
  keepAttachmentIds?: string[];
  attachments?: CampusEventMediaAsset[];
}

export interface UpsertCampusEventRegistrationResponse {
  dashboard: CampusEventsDashboardResponse;
  event: CampusEvent;
  registration: CampusEventViewerRegistrationSummary;
}

export interface CampusEventViewerRegistrationResponse {
  event: CampusEvent;
  registration: CampusEventRegistration | null;
}

export interface CampusEventRegistrationListResponse {
  event: CampusEvent;
  registrations: CampusEventRegistration[];
}

export interface ManageCampusEventRegistrationRequest {
  status: Extract<CampusEventRegistrationStatus, "approved" | "waitlisted" | "rejected">;
  reviewNote?: string | null;
}

export interface ManageCampusEventRegistrationResponse {
  dashboard: CampusEventsDashboardResponse;
  event: CampusEvent;
  registrations: CampusEventRegistration[];
  registrationId: string;
  status: CampusEventRegistrationStatus;
}

export interface ManageCampusEventResponse {
  dashboard: CampusEventsDashboardResponse;
  eventId: string;
  action: "cancelled" | "deleted";
}
