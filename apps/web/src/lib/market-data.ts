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
  createLiveMarketContact,
  createLiveMarketPost,
  deleteLiveMarketListing,
  getLiveMarketDashboard,
  markLiveMarketListingSold,
  toggleLiveMarketSave,
  updateLiveMarketListing
} from "./market-live";
import type { MarketViewerIdentity } from "./market-types";

function logMarketFailure(scope: string, error: unknown) {
  console.error(`[market] ${scope}:failed`, {
    message: error instanceof Error ? error.message : "unknown"
  });
}

function createMarketFailure(scope: string, error: unknown) {
  logMarketFailure(scope, error);
  return error instanceof Error ? error : new Error("Market service is unavailable right now.");
}

export async function getMarketDashboard(viewer: MarketViewerIdentity): Promise<MarketDashboardResponse> {
  try {
    return await getLiveMarketDashboard(viewer);
  } catch (error) {
    throw createMarketFailure("dashboard", error);
  }
}

export async function createMarketPost(
  viewer: MarketViewerIdentity,
  payload: CreateMarketPostRequest
): Promise<CreateMarketPostResponse> {
  try {
    return await createLiveMarketPost(viewer, payload);
  } catch (error) {
    throw createMarketFailure("create", error);
  }
}

export async function updateMarketListing(
  viewer: MarketViewerIdentity,
  payload: UpdateMarketListingRequest
): Promise<UpdateMarketListingResponse> {
  try {
    return await updateLiveMarketListing(viewer, payload);
  } catch (error) {
    throw createMarketFailure("update", error);
  }
}

export async function markMarketListingSold(
  viewer: MarketViewerIdentity,
  listingId: string
): Promise<ManageMarketListingResponse> {
  try {
    return await markLiveMarketListingSold(viewer, listingId);
  } catch (error) {
    throw createMarketFailure("sold", error);
  }
}

export async function deleteMarketListing(
  viewer: MarketViewerIdentity,
  listingId: string
): Promise<ManageMarketListingResponse> {
  try {
    return await deleteLiveMarketListing(viewer, listingId);
  } catch (error) {
    throw createMarketFailure("delete", error);
  }
}

export async function toggleMarketSave(
  viewer: MarketViewerIdentity,
  listingId: string
): Promise<ToggleMarketSaveResponse> {
  try {
    return await toggleLiveMarketSave(viewer, listingId);
  } catch (error) {
    throw createMarketFailure("save", error);
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
    throw createMarketFailure("contact", error);
  }
}
