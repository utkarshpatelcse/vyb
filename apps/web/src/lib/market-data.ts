import "server-only";

import type {
  ContactMarketPostResponse,
  CreateMarketPostRequest,
  CreateMarketPostResponse,
  ManageMarketListingResponse,
  MarketDashboardResponse,
  UpdateMarketListingRequest,
  UpdateMarketListingResponse,
  ToggleMarketSaveResponse
} from "@vyb/contracts";
import {
  createFallbackMarketContact,
  createFallbackMarketPost,
  deleteFallbackMarketListing,
  getFallbackMarketDashboard,
  markFallbackMarketListingSold,
  toggleFallbackMarketSave,
  updateFallbackMarketListing,
  type MarketViewerIdentity
} from "./market-fallback";
import {
  createLiveMarketContact,
  createLiveMarketPost,
  deleteLiveMarketListing,
  getLiveMarketDashboard,
  markLiveMarketListingSold,
  toggleLiveMarketSave,
  updateLiveMarketListing
} from "./market-live";

function logFallback(scope: string, error: unknown) {
  console.warn(`[market] ${scope}:fallback`, {
    message: error instanceof Error ? error.message : "unknown"
  });
}

export async function getMarketDashboard(viewer: MarketViewerIdentity): Promise<MarketDashboardResponse> {
  try {
    return await getLiveMarketDashboard(viewer);
  } catch (error) {
    logFallback("dashboard", error);
    return getFallbackMarketDashboard(viewer);
  }
}

export async function createMarketPost(
  viewer: MarketViewerIdentity,
  payload: CreateMarketPostRequest
): Promise<CreateMarketPostResponse> {
  try {
    return await createLiveMarketPost(viewer, payload);
  } catch (error) {
    logFallback("create", error);
    return createFallbackMarketPost(viewer, payload);
  }
}

export async function updateMarketListing(
  viewer: MarketViewerIdentity,
  payload: UpdateMarketListingRequest
): Promise<UpdateMarketListingResponse> {
  try {
    return await updateLiveMarketListing(viewer, payload);
  } catch (error) {
    logFallback("update", error);
    return updateFallbackMarketListing(viewer, payload);
  }
}

export async function markMarketListingSold(
  viewer: MarketViewerIdentity,
  listingId: string
): Promise<ManageMarketListingResponse> {
  try {
    return await markLiveMarketListingSold(viewer, listingId);
  } catch (error) {
    logFallback("sold", error);
    return markFallbackMarketListingSold(viewer, listingId);
  }
}

export async function deleteMarketListing(
  viewer: MarketViewerIdentity,
  listingId: string
): Promise<ManageMarketListingResponse> {
  try {
    return await deleteLiveMarketListing(viewer, listingId);
  } catch (error) {
    logFallback("delete", error);
    return deleteFallbackMarketListing(viewer, listingId);
  }
}

export async function toggleMarketSave(
  viewer: MarketViewerIdentity,
  listingId: string
): Promise<ToggleMarketSaveResponse> {
  try {
    return await toggleLiveMarketSave(viewer, listingId);
  } catch (error) {
    logFallback("save", error);
    return toggleFallbackMarketSave(viewer, listingId);
  }
}

export async function createMarketContact(
  viewer: MarketViewerIdentity,
  input: {
    targetId: string;
    targetType: "listing" | "request";
    message: string;
  }
): Promise<ContactMarketPostResponse> {
  try {
    return await createLiveMarketContact(viewer, input);
  } catch (error) {
    logFallback("contact", error);
    return createFallbackMarketContact(viewer, input);
  }
}
