import type {
  ActivityListResponse,
  ChatConversationResponse,
  ChatInboxResponse,
  ClientShellResponse,
  FeedCard,
  FeedListResponse,
  ListResourcesResponse,
  MarketDashboardResponse,
  MeResponse,
  ProfileResponse,
  PublicProfileResponse,
  StoryListResponse,
  UserSearchResponse
} from "@vyb/contracts";
import { Platform } from "react-native";

import type { MobileViewerSession } from "./dev-session";

const DEFAULT_INTERNAL_API_KEY = "local-vyb-internal-key";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_VYB_API_BASE_URL?.trim();

  if (configured) {
    return trimTrailingSlash(configured);
  }

  const localDefault =
    Platform.OS === "android"
      ? "http://10.0.2.2:4000"
      : Platform.OS === "web"
        ? "http://localhost:4000"
        : "http://localhost:4000";

  return trimTrailingSlash(localDefault);
}

export function getMobileRuntimeConfig() {
  return {
    baseUrl: resolveApiBaseUrl(),
    internalApiKey: process.env.EXPO_PUBLIC_VYB_INTERNAL_API_KEY ?? DEFAULT_INTERNAL_API_KEY
  };
}

function buildHeaders(viewer?: MobileViewerSession) {
  const runtime = getMobileRuntimeConfig();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-vyb-internal-key": runtime.internalApiKey
  };

  if (viewer) {
    headers["x-demo-user-id"] = viewer.userId;
    headers["x-demo-email"] = viewer.email;
    headers["x-demo-display-name"] = viewer.displayName;
  }

  return headers;
}

async function requestJson<T>(path: string, viewer?: MobileViewerSession): Promise<T> {
  const runtime = getMobileRuntimeConfig();
  const response = await fetch(`${runtime.baseUrl}${path}`, {
    method: "GET",
    headers: buildHeaders(viewer)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed for ${path} with ${response.status}`);
  }

  return (await response.json()) as T;
}

function normalizeFeedCard(item: FeedCard): FeedCard {
  const normalizedMedia: FeedCard["media"] = Array.isArray(item.media)
    ? item.media
    : item.mediaUrl
      ? [
          {
            url: item.mediaUrl,
            kind: item.kind === "video" ? "video" : "image"
          }
        ]
      : [];

  return {
    ...item,
    media: normalizedMedia
  };
}

function normalizeFeedResponse(response: FeedListResponse): FeedListResponse {
  return {
    ...response,
    items: Array.isArray(response.items) ? response.items.map((item) => normalizeFeedCard(item)) : []
  };
}

export function getClientShellData() {
  return requestJson<ClientShellResponse>("/v1/client-shell");
}

export function getViewerProfile(viewer: MobileViewerSession) {
  return requestJson<ProfileResponse>("/v1/profile", viewer);
}

export function getViewerMe(viewer: MobileViewerSession) {
  return requestJson<MeResponse>("/v1/me", viewer);
}

export function getCampusStories(viewer: MobileViewerSession) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId
  });

  return requestJson<StoryListResponse>(`/v1/stories?${params.toString()}`, viewer);
}

export function getCampusFeed(viewer: MobileViewerSession, options?: { limit?: number }) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId,
    limit: String(options?.limit ?? 20)
  });

  return requestJson<FeedListResponse>(`/v1/feed?${params.toString()}`, viewer).then(normalizeFeedResponse);
}

export function getCampusVibes(viewer: MobileViewerSession, limit = 12) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId,
    limit: String(limit)
  });

  return requestJson<FeedListResponse>(`/v1/vibes?${params.toString()}`, viewer).then(normalizeFeedResponse);
}

export function getSuggestedCampusUsers(viewer: MobileViewerSession, limit = 5) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId,
    suggested: "1",
    limit: String(limit)
  });

  return requestJson<UserSearchResponse>(`/v1/users/search?${params.toString()}`, viewer);
}

export function searchCampusUsers(viewer: MobileViewerSession, query: string, limit = 10) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId,
    q: query,
    limit: String(limit)
  });

  return requestJson<UserSearchResponse>(`/v1/users/search?${params.toString()}`, viewer);
}

export function getChatInbox(viewer: MobileViewerSession) {
  return requestJson<ChatInboxResponse>("/v1/chats", viewer);
}

export function getChatConversation(viewer: MobileViewerSession, conversationId: string) {
  return requestJson<ChatConversationResponse>(`/v1/chats/${encodeURIComponent(conversationId)}`, viewer);
}

export function getViewerPublicProfile(viewer: MobileViewerSession, username: string) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId
  });

  return requestJson<PublicProfileResponse>(`/v1/users/${encodeURIComponent(username)}?${params.toString()}`, viewer).then(
    (response) => ({
      ...response,
      posts: Array.isArray(response.posts) ? response.posts.map((item) => normalizeFeedCard(item)) : []
    })
  );
}

export function getCampusResources(viewer: MobileViewerSession, options?: { limit?: number }) {
  const params = new URLSearchParams({
    tenantId: viewer.tenantId,
    limit: String(options?.limit ?? 4)
  });

  return requestJson<ListResourcesResponse>(`/v1/resources?${params.toString()}`, viewer);
}

export function getViewerActivity(viewer: MobileViewerSession, limit = 6) {
  const params = new URLSearchParams({
    limit: String(limit)
  });

  return requestJson<ActivityListResponse>(`/v1/activity?${params.toString()}`, viewer);
}

export function getMarketDashboard(viewer: MobileViewerSession) {
  return requestJson<MarketDashboardResponse>("/v1/market", viewer);
}
