import "server-only";

import type {
  CreateCampusEventRequest,
  CreateCampusEventResponse,
  ManageCampusEventResponse,
  ToggleCampusEventInterestResponse,
  ToggleCampusEventSaveResponse,
  UpdateCampusEventRequest,
  UpdateCampusEventResponse
} from "@vyb/contracts";
import type { DevSession } from "./dev-session";
import {
  cancelCampusEvent as cancelCampusEventFallback,
  createCampusEvent as createCampusEventFallback,
  deleteCampusEvent as deleteCampusEventFallback,
  getEventForViewer as getEventForViewerFallback,
  getEventsDashboard as getEventsDashboardFallback,
  toggleCampusEventInterest as toggleCampusEventInterestFallback,
  toggleCampusEventSave as toggleCampusEventSaveFallback,
  updateCampusEvent as updateCampusEventFallback
} from "./events-fallback";
import type { EventViewerIdentity } from "./events-types";

export async function getEventsDashboard(viewer: DevSession) {
  return getEventsDashboardFallback(viewer);
}

export async function getEventForViewer(viewer: DevSession, eventId: string) {
  return getEventForViewerFallback(viewer, eventId);
}

export async function createCampusEvent(
  viewer: DevSession,
  identity: EventViewerIdentity,
  payload: CreateCampusEventRequest
): Promise<CreateCampusEventResponse> {
  return createCampusEventFallback(viewer, identity, payload);
}

export async function updateCampusEvent(
  viewer: DevSession,
  payload: UpdateCampusEventRequest
): Promise<UpdateCampusEventResponse> {
  return updateCampusEventFallback(viewer, payload);
}

export async function toggleCampusEventSave(viewer: DevSession, eventId: string): Promise<ToggleCampusEventSaveResponse> {
  return toggleCampusEventSaveFallback(viewer, eventId);
}

export async function toggleCampusEventInterest(
  viewer: DevSession,
  eventId: string
): Promise<ToggleCampusEventInterestResponse> {
  return toggleCampusEventInterestFallback(viewer, eventId);
}

export async function cancelCampusEvent(viewer: DevSession, eventId: string): Promise<ManageCampusEventResponse> {
  return cancelCampusEventFallback(viewer, eventId);
}

export async function deleteCampusEvent(viewer: DevSession, eventId: string): Promise<ManageCampusEventResponse> {
  return deleteCampusEventFallback(viewer, eventId);
}
