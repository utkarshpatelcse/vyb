import "server-only";

import type {
  ContactMarketPostResponse,
  CreateMarketPostRequest,
  CreateMarketPostResponse,
  ManageMarketListingResponse,
  ManageMarketRequestResponse,
  MarketDashboardResponse,
  UpdateMarketListingRequest,
  UpdateMarketListingResponse,
  UpdateMarketRequestRequest,
  UpdateMarketRequestResponse,
  ToggleMarketSaveResponse
} from "@vyb/contracts";
import {
  createMarketContact as createMarketContactRequest,
  createMarketPost as createMarketPostRequest,
  deleteMarketListing as deleteMarketListingRequest,
  deleteMarketRequest as deleteMarketRequestCall,
  getMarketDashboard as getMarketDashboardRequest,
  markMarketListingSold as markMarketListingSoldRequest,
  toggleMarketSave as toggleMarketSaveRequest,
  updateMarketListing as updateMarketListingRequest,
  updateMarketRequest as updateMarketRequestCall
} from "./backend";
import type { DevSession } from "./dev-session";

function logMarketFailure(scope: string, error: unknown) {
  console.error(`[market] ${scope}:failed`, {
    message: error instanceof Error ? error.message : "unknown"
  });
}

function createMarketFailure(scope: string, error: unknown) {
  logMarketFailure(scope, error);
  return error instanceof Error ? error : new Error("Market service is unavailable right now.");
}

export async function getMarketDashboard(viewer: DevSession): Promise<MarketDashboardResponse> {
  try {
    return await getMarketDashboardRequest(viewer);
  } catch (error) {
    throw createMarketFailure("dashboard", error);
  }
}

export async function createMarketPost(
  viewer: DevSession,
  payload: CreateMarketPostRequest
): Promise<CreateMarketPostResponse> {
  try {
    return await createMarketPostRequest(viewer, payload);
  } catch (error) {
    throw createMarketFailure("create", error);
  }
}

export async function updateMarketListing(
  viewer: DevSession,
  payload: UpdateMarketListingRequest
): Promise<UpdateMarketListingResponse> {
  try {
    return await updateMarketListingRequest(viewer, payload);
  } catch (error) {
    throw createMarketFailure("update", error);
  }
}

export async function updateMarketRequest(
  viewer: DevSession,
  payload: UpdateMarketRequestRequest
): Promise<UpdateMarketRequestResponse> {
  try {
    return await updateMarketRequestCall(viewer, payload);
  } catch (error) {
    throw createMarketFailure("request_update", error);
  }
}

export async function markMarketListingSold(
  viewer: DevSession,
  listingId: string
): Promise<ManageMarketListingResponse> {
  try {
    return await markMarketListingSoldRequest(viewer, listingId);
  } catch (error) {
    throw createMarketFailure("sold", error);
  }
}

export async function deleteMarketListing(
  viewer: DevSession,
  listingId: string
): Promise<ManageMarketListingResponse> {
  try {
    return await deleteMarketListingRequest(viewer, listingId);
  } catch (error) {
    throw createMarketFailure("delete", error);
  }
}

export async function deleteMarketRequest(
  viewer: DevSession,
  requestId: string
): Promise<ManageMarketRequestResponse> {
  try {
    return await deleteMarketRequestCall(viewer, requestId);
  } catch (error) {
    throw createMarketFailure("request_delete", error);
  }
}

export async function toggleMarketSave(
  viewer: DevSession,
  listingId: string
): Promise<ToggleMarketSaveResponse> {
  try {
    return await toggleMarketSaveRequest(viewer, { listingId });
  } catch (error) {
    throw createMarketFailure("save", error);
  }
}

export async function createMarketContact(
  viewer: DevSession,
  input: {
    targetId: string;
    targetType: "listing" | "request";
    message: string;
  }
): Promise<ContactMarketPostResponse> {
  try {
    return await createMarketContactRequest(viewer, input);
  } catch (error) {
    throw createMarketFailure("contact", error);
  }
}
