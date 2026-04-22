import "server-only";

import type {
  CampusEventRegistrationStatus,
  CampusEventViewerRegistrationResponse,
  CampusEventRegistrationListResponse,
  CreateCampusEventRequest,
  CreateCampusEventResponse,
  ManageCampusEventRegistrationRequest,
  ManageCampusEventRegistrationResponse,
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
  exportCampusEventRegistrationsCsv as exportCampusEventRegistrationsCsvFallback,
  getCampusEventRegistrations as getCampusEventRegistrationsFallback,
  getCampusEventRegistrationsFiltered as getCampusEventRegistrationsFilteredFallback,
  getEventForViewer as getEventForViewerFallback,
  getEventsDashboard as getEventsDashboardFallback,
  getViewerCampusEventRegistration as getViewerCampusEventRegistrationFallback,
  manageCampusEventRegistration as manageCampusEventRegistrationFallback,
  toggleCampusEventInterest as toggleCampusEventInterestFallback,
  toggleCampusEventSave as toggleCampusEventSaveFallback,
  updateCampusEvent as updateCampusEventFallback,
  upsertCampusEventRegistration as upsertCampusEventRegistrationFallback
} from "./events-fallback";
import type { EventViewerIdentity } from "./events-types";
import type { UpsertCampusEventRegistrationRequest, UpsertCampusEventRegistrationResponse } from "@vyb/contracts";

export async function getEventsDashboard(viewer: DevSession) {
  return getEventsDashboardFallback(viewer);
}

export async function getEventForViewer(viewer: DevSession, eventId: string) {
  return getEventForViewerFallback(viewer, eventId);
}

export async function getViewerCampusEventRegistration(viewer: DevSession, eventId: string): Promise<CampusEventViewerRegistrationResponse> {
  return getViewerCampusEventRegistrationFallback(viewer, eventId);
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

export async function upsertCampusEventRegistration(
  viewer: DevSession,
  identity: EventViewerIdentity,
  payload: UpsertCampusEventRegistrationRequest
): Promise<UpsertCampusEventRegistrationResponse> {
  return upsertCampusEventRegistrationFallback(viewer, identity, payload);
}

export async function getCampusEventRegistrations(
  viewer: DevSession,
  eventId: string,
  filters?: {
    query?: string | null;
    statuses?: CampusEventRegistrationStatus[];
  }
): Promise<CampusEventRegistrationListResponse> {
  return filters ? getCampusEventRegistrationsFilteredFallback(viewer, eventId, filters) : getCampusEventRegistrationsFallback(viewer, eventId);
}

export async function manageCampusEventRegistration(
  viewer: DevSession,
  eventId: string,
  registrationId: string,
  payload: ManageCampusEventRegistrationRequest
): Promise<ManageCampusEventRegistrationResponse> {
  return manageCampusEventRegistrationFallback(viewer, eventId, registrationId, payload);
}

export async function exportCampusEventRegistrationsCsv(
  viewer: DevSession,
  eventId: string,
  filters?: {
    query?: string | null;
    statuses?: CampusEventRegistrationStatus[];
  }
) {
  return exportCampusEventRegistrationsCsvFallback(viewer, eventId, filters);
}

export async function cancelCampusEvent(viewer: DevSession, eventId: string): Promise<ManageCampusEventResponse> {
  return cancelCampusEventFallback(viewer, eventId);
}

export async function deleteCampusEvent(viewer: DevSession, eventId: string): Promise<ManageCampusEventResponse> {
  return deleteCampusEventFallback(viewer, eventId);
}
