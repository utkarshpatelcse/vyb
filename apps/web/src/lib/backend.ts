import "server-only";
import type {
  ActivityListResponse,
  ChatConversationResponse,
  ChatInboxResponse,
  CreateChatConversationRequest,
  CreateChatConversationResponse,
  ClientShellResponse,
  CommentReactionResponse,
  CommentListResponse,
  CreateReportRequest,
  CreateReportResponse,
  ContactMarketPostRequest,
  ContactMarketPostResponse,
  DeleteChatMessageRequest,
  DeleteChatMessageResponse,
  CreateCommentResponse,
  CreateMarketPostRequest,
  CreateMarketPostResponse,
  CreateStoryResponse,
  DeletePostResponse,
  FeedListResponse,
  GetChatKeyBackupResponse,
  ListCoursesResponse,
  ListResourcesResponse,
  MarkChatReadResponse,
  ManageMarketListingResponse,
  ManageMarketRequestResponse,
  MigrateChatMessageEncryptionRequest,
  MigrateChatMessageEncryptionResponse,
  MarketDashboardResponse,
  MeResponse,
  ProfileConnectionsResponse,
  PublicProfileResponse,
  ProfileResponse,
  PostLikerListResponse,
  ReactionKind,
  ReactionResponse,
  ReactToChatMessageResponse,
  RepostPostRequest,
  RepostPostResponse,
  SessionBootstrapRequest,
  SessionBootstrapResponse,
  StoryListResponse,
  StorySeenResponse,
  StoryReactionResponse,
  ToggleMarketSaveRequest,
  ToggleMarketSaveResponse,
  SendChatMessageRequest,
  SendChatMessageResponse,
  UploadEncryptedChatAttachmentResponse,
  UpdateMarketListingRequest,
  UpdateMarketListingResponse,
  UpdateMarketRequestRequest,
  UpdateMarketRequestResponse,
  UpdatePostRequest,
  UpdatePostResponse,
  UpsertChatKeyBackupRequest,
  UpsertChatKeyBackupResponse,
  UpsertChatIdentityRequest,
  UpsertChatIdentityResponse,
  UpdateUsernameRequest,
  UpdateUsernameResponse,
  UserSearchResponse
} from "@vyb/contracts";
import type { DevSession } from "./dev-session";
import { invokeBackendRoute, isBackendConnectionError } from "./backend-bridge";

export type UploadedSocialMediaAsset = {
  mediaType: "image" | "video";
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  url: string;
};

const API_BASE_URL =
  process.env.VYB_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const INTERNAL_API_KEY = process.env.VYB_INTERNAL_API_KEY ?? "local-vyb-internal-key";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildBackendHeaders(viewer?: DevSession): Record<string, string> {
  if (!viewer) {
    return {
      "content-type": "application/json",
      "x-vyb-internal-key": INTERNAL_API_KEY
    };
  }

  return {
    "content-type": "application/json",
    "x-vyb-internal-key": INTERNAL_API_KEY,
    "x-demo-user-id": viewer.userId,
    "x-demo-email": viewer.email,
    "x-demo-display-name": viewer.displayName
  };
}

async function readResponseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function requestBackendResponse(
  path: string,
  {
    method = "GET",
    payload,
    viewer,
    allowBridgeFallback = true
  }: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    payload?: unknown;
    viewer?: DevSession;
    allowBridgeFallback?: boolean;
  } = {}
) {
  const headers = buildBackendHeaders(viewer);
  const body = payload === undefined ? undefined : JSON.stringify(payload);

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body,
      cache: "no-store"
    });
  } catch (error) {
    if (!isBackendConnectionError(error)) {
      throw error;
    }

    if (!allowBridgeFallback) {
      console.error("[web/backend] upstream unavailable for direct-only request", {
        method,
        path,
        apiBaseUrl: API_BASE_URL,
        message: error.message
      });
      throw error;
    }

    console.warn("[web/backend] upstream unavailable, falling back to in-process bridge", {
      method,
      path,
      apiBaseUrl: API_BASE_URL,
      message: error.message
    });

    return invokeBackendRoute({
      path,
      method,
      headers,
      body
    });
  }
}

type BackendRequestOptions = {
  allowBridgeFallback?: boolean;
};

export async function fetchBackendJson<T>(
  path: string,
  viewer?: DevSession,
  options?: BackendRequestOptions
): Promise<T> {
  const response = await requestBackendResponse(path, {
    viewer,
    allowBridgeFallback: options?.allowBridgeFallback
  });

  if (!response.ok) {
    throw new Error(`Backend request failed for ${path} with ${response.status}`);
  }

  return readResponseJson<T>(response);
}

export async function postBackendJson<TResponse>(
  path: string,
  payload: unknown,
  viewer?: DevSession,
  options?: BackendRequestOptions
): Promise<TResponse> {
  let attempt = 0;
  let lastError = null;

  while (attempt < 2) {
    try {
      const response = await requestBackendResponse(path, {
        method: "POST",
        payload,
        viewer,
        allowBridgeFallback: options?.allowBridgeFallback
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Backend request failed for ${path} with ${response.status}`);
      }

      return readResponseJson<TResponse>(response);
    } catch (error) {
      lastError = error;
      attempt += 1;

      if (attempt < 2) {
        await delay(250);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Backend request failed for ${path}.`);
}

export async function mutateBackendJson<TResponse>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  payload: unknown,
  viewer?: DevSession,
  options?: BackendRequestOptions
) {
  const response = await requestBackendResponse(path, {
    method,
    payload,
    viewer,
    allowBridgeFallback: options?.allowBridgeFallback
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Backend request failed for ${path} with ${response.status}`);
  }

  return readResponseJson<TResponse>(response);
}

export async function proxyBackendMutation(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  payload: unknown,
  viewer: DevSession
) {
  const upstream = await requestBackendResponse(path, {
    method,
    payload,
    viewer
  });

  const responseText = await upstream.text();

  return new Response(responseText, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8"
    }
  });
}

function buildClientShellFallback(): ClientShellResponse {
  const launchCampus = {
    id: "kiet",
    name: "KIET Group of Institutions Delhi-NCR",
    domain: "kiet.edu"
  } as const;

  return {
    shell: "pwa-first",
    mobileInstallable: true,
    desktopResponsive: true,
    nativeReadyContracts: true,
    backendRuntime: "modular-monolith",
    launchCampus,
    hero: {
      eyebrow: "Verified Campus Network",
      title: "One trusted home for college identity, community, and utility.",
      summary: "Vyb is a multi-tenant platform for verified campus life, built to onboard one trusted campus at a time."
    },
    pillars: [
      {
        title: "Trusted Identity",
        description: "Access begins with a verified college email so every interaction stays inside the right campus boundary."
      },
      {
        title: "Useful Community",
        description: "Students should land inside relevant college, branch, batch, and hostel spaces instead of scattered chat groups."
      },
      {
        title: "Daily Utility",
        description: "Notes, resources, and a campus feed should reinforce each other instead of living in separate tools."
      }
    ],
    phaseOne: [
      "College-scoped authentication and onboarding",
      "Verified communities and membership routing",
      "Campus feed for text and image posts",
      "Academic resource vault",
      "Moderation-aware backend foundation"
    ],
    trustPoints: [
      "Single backend runtime for a simpler Phase 1 launch",
      "Responsive web now, native-ready contracts later",
      "Strict tenant boundaries across every authenticated flow"
    ]
  };
}

export async function getClientShellData() {
  try {
    return await fetchBackendJson<ClientShellResponse>("/v1/client-shell");
  } catch {
    return buildClientShellFallback();
  }
}

export async function getViewerProfile(viewer: DevSession) {
  return fetchBackendJson<ProfileResponse>("/v1/profile", viewer);
}

export async function getViewerMe(viewer: DevSession) {
  return fetchBackendJson<MeResponse>("/v1/me", viewer);
}

export async function bootstrapViewerSession(payload: SessionBootstrapRequest) {
  return postBackendJson<SessionBootstrapResponse>("/v1/auth/session/bootstrap", payload);
}

export async function getCampusFeed(viewer: DevSession, options?: { authorUserId?: string; limit?: number }) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId,
    limit: String(options?.limit ?? 24)
  });

  if (options?.authorUserId) {
    params.set("authorUserId", options.authorUserId);
  }

  return fetchBackendJson<FeedListResponse>(`/v1/feed?${params.toString()}`, viewer);
}

export async function getCampusVibes(viewer: DevSession, limit = 24) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId,
    limit: String(limit)
  });

  return fetchBackendJson<FeedListResponse>(`/v1/vibes?${params.toString()}`, viewer);
}

export async function getCampusStories(viewer: DevSession) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId
  });

  return fetchBackendJson<StoryListResponse>(`/v1/stories?${params.toString()}`, viewer);
}

export async function searchCampusUsers(viewer: DevSession, query: string, limit = 12) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId,
    q: query,
    limit: String(limit)
  });

  return fetchBackendJson<UserSearchResponse>(`/v1/users/search?${params.toString()}`, viewer);
}

export async function getSuggestedCampusUsers(viewer: DevSession, limit = 5) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId,
    suggested: "1",
    limit: String(limit)
  });

  return fetchBackendJson<UserSearchResponse>(`/v1/users/search?${params.toString()}`, viewer);
}

export async function getCampusUserProfile(viewer: DevSession, username: string) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId
  });

  return fetchBackendJson<PublicProfileResponse>(`/v1/users/${encodeURIComponent(username)}?${params.toString()}`, viewer);
}

export async function getCampusUserConnections(
  viewer: DevSession,
  username: string,
  scope: "followers" | "following",
  limit = 50
) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId,
    limit: String(limit)
  });

  return fetchBackendJson<ProfileConnectionsResponse>(
    `/v1/users/${encodeURIComponent(username)}/${scope}?${params.toString()}`,
    viewer
  );
}

export async function updateViewerUsername(viewer: DevSession, payload: UpdateUsernameRequest) {
  const response = await requestBackendResponse("/v1/profile/username", {
    method: "PATCH",
    payload,
    viewer
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Backend request failed for /v1/profile/username with ${response.status}`);
  }

  return readResponseJson<UpdateUsernameResponse>(response);
}

export async function createCampusStory(viewer: DevSession, payload: {
  mediaType: "image" | "video";
  mediaUrl: string;
  caption?: string | null;
  mediaStoragePath?: string | null;
  mediaMimeType?: string | null;
  mediaSizeBytes?: number | null;
}) {
  return postBackendJson<CreateStoryResponse>(
    "/v1/stories",
    {
      tenantId: viewer.tenantId,
      ...payload
    },
    viewer
  );
}

export async function getPostComments(viewer: DevSession, postId: string, limit = 50) {
  const params = new URLSearchParams({
    limit: String(limit)
  });

  return fetchBackendJson<CommentListResponse>(`/v1/posts/${encodeURIComponent(postId)}/comments?${params.toString()}`, viewer);
}

export async function createPostComment(
  viewer: DevSession,
  postId: string,
  payload: {
    body?: string;
    parentCommentId?: string | null;
    mediaUrl?: string | null;
    mediaType?: "image" | "gif" | "sticker" | null;
    mediaMimeType?: string | null;
    mediaSizeBytes?: number | null;
  }
) {
  return postBackendJson<CreateCommentResponse>(
    `/v1/posts/${encodeURIComponent(postId)}/comments`,
    {
      membershipId: viewer.membershipId,
      ...payload
    },
    viewer
  );
}

export async function reactToPost(viewer: DevSession, postId: string, reactionType: ReactionKind = "like") {
  return mutateBackendJson<ReactionResponse>(
    `/v1/posts/${encodeURIComponent(postId)}/reactions`,
    "PUT",
    {
      reactionType
    },
    viewer
  );
}

export async function reactToStory(viewer: DevSession, storyId: string) {
  return mutateBackendJson<StoryReactionResponse>(
    `/v1/stories/${encodeURIComponent(storyId)}/reactions`,
    "PUT",
    {},
    viewer
  );
}

export async function reactToComment(viewer: DevSession, commentId: string) {
  return mutateBackendJson<CommentReactionResponse>(
    `/v1/comments/${encodeURIComponent(commentId)}/reactions`,
    "PUT",
    {},
    viewer
  );
}

export async function markStorySeenOnBackend(viewer: DevSession, storyId: string) {
  return mutateBackendJson<StorySeenResponse>(
    `/v1/stories/${encodeURIComponent(storyId)}/seen`,
    "PUT",
    {},
    viewer
  );
}

export async function getPostLikes(viewer: DevSession, postId: string, limit = 50) {
  const params = new URLSearchParams({
    limit: String(limit)
  });

  return fetchBackendJson<PostLikerListResponse>(`/v1/posts/${encodeURIComponent(postId)}/likes?${params.toString()}`, viewer);
}

export async function repostCampusPost(viewer: DevSession, postId: string, payload: RepostPostRequest) {
  return postBackendJson<RepostPostResponse>(`/v1/posts/${encodeURIComponent(postId)}/repost`, payload, viewer);
}

export async function deleteCampusPost(viewer: DevSession, postId: string) {
  return mutateBackendJson<DeletePostResponse>(`/v1/posts/${encodeURIComponent(postId)}`, "DELETE", {}, viewer);
}

export async function updateCampusPost(viewer: DevSession, postId: string, payload: UpdatePostRequest) {
  return mutateBackendJson<UpdatePostResponse>(`/v1/posts/${encodeURIComponent(postId)}`, "PATCH", payload, viewer);
}

export async function createContentReport(viewer: DevSession, payload: CreateReportRequest) {
  return postBackendJson<CreateReportResponse>("/v1/reports", payload, viewer);
}

export async function getCampusCourses(viewer: DevSession, limit = 20) {
  const params = new URLSearchParams({
    limit: String(limit)
  });

  return fetchBackendJson<ListCoursesResponse>(`/v1/courses?${params.toString()}`, viewer);
}

export async function getCampusResources(viewer: DevSession, options?: { courseId?: string | null; limit?: number }) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId,
    limit: String(options?.limit ?? 20)
  });

  if (options?.courseId) {
    params.set("courseId", options.courseId);
  }

  return fetchBackendJson<ListResourcesResponse>(`/v1/resources?${params.toString()}`, viewer);
}

export async function getViewerActivity(viewer: DevSession, limit = 20) {
  const params = new URLSearchParams({
    limit: String(limit)
  });

  return fetchBackendJson<ActivityListResponse>(`/v1/activity?${params.toString()}`, viewer);
}

export async function getMarketDashboard(viewer: DevSession) {
  return fetchBackendJson<MarketDashboardResponse>("/v1/market", viewer);
}

export async function createMarketPost(viewer: DevSession, payload: CreateMarketPostRequest) {
  return postBackendJson<CreateMarketPostResponse>("/v1/market", payload, viewer);
}

export async function updateMarketListing(viewer: DevSession, payload: UpdateMarketListingRequest) {
  return mutateBackendJson<UpdateMarketListingResponse>(
    `/v1/market/listings/${encodeURIComponent(payload.listingId)}`,
    "PATCH",
    payload,
    viewer
  );
}

export async function updateMarketRequest(viewer: DevSession, payload: UpdateMarketRequestRequest) {
  return mutateBackendJson<UpdateMarketRequestResponse>(
    `/v1/market/requests/${encodeURIComponent(payload.requestId)}`,
    "PATCH",
    payload,
    viewer
  );
}

export async function deleteMarketListing(viewer: DevSession, listingId: string) {
  return mutateBackendJson<ManageMarketListingResponse>(
    `/v1/market/listings/${encodeURIComponent(listingId)}`,
    "DELETE",
    {},
    viewer
  );
}

export async function deleteMarketRequest(viewer: DevSession, requestId: string) {
  return mutateBackendJson<ManageMarketRequestResponse>(
    `/v1/market/requests/${encodeURIComponent(requestId)}`,
    "DELETE",
    {},
    viewer
  );
}

export async function markMarketListingSold(viewer: DevSession, listingId: string) {
  return mutateBackendJson<ManageMarketListingResponse>(
    `/v1/market/listings/${encodeURIComponent(listingId)}/sold`,
    "POST",
    {},
    viewer
  );
}

export async function toggleMarketSave(viewer: DevSession, payload: ToggleMarketSaveRequest) {
  return postBackendJson<ToggleMarketSaveResponse>("/v1/market/save", payload, viewer);
}

export async function createMarketContact(viewer: DevSession, payload: ContactMarketPostRequest) {
  return postBackendJson<ContactMarketPostResponse>("/v1/market/contact", payload, viewer);
}

export async function uploadSocialMediaAsset(
  viewer: DevSession,
  payload: {
    intent: "post" | "story" | "vibe";
    fileName: string;
    mimeType: string;
    base64Data: string;
  }
) {
  const response = await postBackendJson<{ asset: UploadedSocialMediaAsset }>("/v1/social-media/upload", payload, viewer);
  return response.asset;
}

export async function getChatInbox(viewer: DevSession) {
  return fetchBackendJson<ChatInboxResponse>("/v1/chats", viewer);
}

export async function createChatConversation(viewer: DevSession, payload: CreateChatConversationRequest) {
  return postBackendJson<CreateChatConversationResponse>("/v1/chats", payload, viewer);
}

export async function getChatConversation(viewer: DevSession, conversationId: string) {
  return fetchBackendJson<ChatConversationResponse>(`/v1/chats/${encodeURIComponent(conversationId)}`, viewer);
}

export async function sendChatMessage(viewer: DevSession, conversationId: string, payload: SendChatMessageRequest) {
  return postBackendJson<SendChatMessageResponse>(`/v1/chats/${encodeURIComponent(conversationId)}/messages`, payload, viewer);
}

export async function migrateChatMessageEncryption(
  viewer: DevSession,
  conversationId: string,
  payload: MigrateChatMessageEncryptionRequest
) {
  return mutateBackendJson<MigrateChatMessageEncryptionResponse>(
    `/v1/chats/${encodeURIComponent(conversationId)}/messages/encryption`,
    "PUT",
    payload,
    viewer
  );
}

export async function getChatKeyBackup(viewer: DevSession) {
  return fetchBackendJson<GetChatKeyBackupResponse>("/v1/chats/key-backup", viewer);
}

export async function upsertChatKeyBackup(viewer: DevSession, payload: UpsertChatKeyBackupRequest) {
  return mutateBackendJson<UpsertChatKeyBackupResponse>("/v1/chats/key-backup", "PUT", payload, viewer);
}

export async function markChatRead(viewer: DevSession, conversationId: string, messageId: string) {
  return mutateBackendJson<MarkChatReadResponse>(
    `/v1/chats/${encodeURIComponent(conversationId)}/read`,
    "PUT",
    { messageId },
    viewer
  );
}

export async function reactToChatMessage(viewer: DevSession, messageId: string, emoji: string) {
  return mutateBackendJson<ReactToChatMessageResponse>(
    `/v1/chats/messages/${encodeURIComponent(messageId)}/reactions`,
    "PUT",
    { emoji },
    viewer
  );
}

export async function deleteChatMessage(viewer: DevSession, messageId: string, payload: DeleteChatMessageRequest) {
  return mutateBackendJson<DeleteChatMessageResponse>(
    `/v1/chats/messages/${encodeURIComponent(messageId)}`,
    "DELETE",
    payload,
    viewer
  );
}

export async function upsertChatIdentity(viewer: DevSession, payload: UpsertChatIdentityRequest) {
  return mutateBackendJson<UpsertChatIdentityResponse>("/v1/chats/keys", "PUT", payload, viewer);
}

export async function uploadEncryptedChatAttachment(
  viewer: DevSession,
  payload: {
    fileName: string;
    mimeType: string;
    base64Data: string;
    width?: number | null;
    height?: number | null;
  }
) {
  return postBackendJson<UploadEncryptedChatAttachmentResponse>("/v1/chats/media/upload", payload, viewer);
}
