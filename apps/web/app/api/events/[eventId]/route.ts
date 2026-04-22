import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { CampusEventPassKind, UpdateCampusEventRequest } from "@vyb/contracts";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";
import { deleteCampusEvent, getEventForViewer, updateCampusEvent } from "../../../../src/lib/events-data";
import { deleteEventMediaAssets, persistEventMediaAssets } from "../../../../src/lib/events-media-server";

type ParsedUpdatePayload = Omit<Partial<UpdateCampusEventRequest>, "capacity"> & {
  capacity?: string | number | null;
};

type ParsedUpdateBody = {
  payload: ParsedUpdatePayload;
  files: File[];
};

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isFileEntry(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function readOptionalStringFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function readStringListFromForm(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function buildParsedUpdateBodyFromFormData(formData: FormData): ParsedUpdateBody {
  return {
    payload: {
      eventId: readOptionalStringFromForm(formData, "eventId") ?? "",
      title: readOptionalStringFromForm(formData, "title") ?? "",
      club: readOptionalStringFromForm(formData, "club") ?? "",
      category: readOptionalStringFromForm(formData, "category") ?? "",
      description: readOptionalStringFromForm(formData, "description") ?? "",
      location: readOptionalStringFromForm(formData, "location") ?? "",
      startsAt: readOptionalStringFromForm(formData, "startsAt") ?? "",
      endsAt: readOptionalStringFromForm(formData, "endsAt"),
      passKind: readOptionalStringFromForm(formData, "passKind") as CampusEventPassKind,
      passLabel: readOptionalStringFromForm(formData, "passLabel"),
      capacity: readOptionalStringFromForm(formData, "capacity"),
      keepMediaIds: readStringListFromForm(formData, "keepMediaIds")
    },
    files: formData.getAll("media").filter(isFileEntry).filter((file) => file.size > 0)
  };
}

async function parseUpdateBody(request: Request): Promise<ParsedUpdateBody | null> {
  const contentType = request.headers.get("content-type") ?? "";
  const formRequest = request.clone();
  const jsonRequest = request.clone();

  if (!contentType.includes("application/json")) {
    const formData = await formRequest.formData().catch(() => null);

    if (formData) {
      return buildParsedUpdateBodyFromFormData(formData);
    }
  }

  const payload = (await jsonRequest.json().catch(() => null)) as ParsedUpdatePayload | null;

  if (!payload) {
    return null;
  }

  return {
    payload,
    files: []
  };
}

function parsePassKind(value: unknown): CampusEventPassKind | null {
  return value === "free" || value === "rsvp" || value === "paid" ? value : null;
}

function parseCapacity(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? Math.max(1, Math.round(amount)) : Number.NaN;
}

function isValidDateTime(value: string) {
  return Number.isFinite(new Date(value).getTime());
}

export async function GET(_: Request, context: { params: Promise<{ eventId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before viewing event details.");
  }

  const { eventId } = await context.params;
  const event = await getEventForViewer(viewer, eventId);

  if (!event) {
    return buildError(404, "EVENT_NOT_FOUND", "This event could not be found.");
  }

  return NextResponse.json({ item: event });
}

export async function PATCH(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before editing an event.");
  }

  const { eventId } = await context.params;
  const parsedBody = await parseUpdateBody(request);

  if (!parsedBody) {
    return buildError(400, "INVALID_BODY", "Request body must be valid JSON or multipart form data.");
  }

  const { payload, files } = parsedBody;
  const title = payload.title?.trim() ?? "";
  const club = payload.club?.trim() ?? "";
  const category = payload.category?.trim() ?? "";
  const description = payload.description?.trim() ?? "";
  const location = payload.location?.trim() ?? "";
  const startsAt = payload.startsAt?.trim() ?? "";
  const endsAt = payload.endsAt?.trim() ?? "";
  const passKind = parsePassKind(payload.passKind);
  const capacity = parseCapacity(payload.capacity);

  if (!title || !club || !category || !description || !location) {
    return buildError(400, "INVALID_FIELDS", "Complete all required event fields before saving.");
  }

  if (!startsAt || !isValidDateTime(startsAt)) {
    return buildError(400, "INVALID_STARTS_AT", "Choose a valid event start time.");
  }

  if (endsAt && (!isValidDateTime(endsAt) || new Date(endsAt).getTime() <= new Date(startsAt).getTime())) {
    return buildError(400, "INVALID_ENDS_AT", "End time must be after the start time.");
  }

  if (!passKind) {
    return buildError(400, "INVALID_PASS_KIND", "Choose a valid event access type.");
  }

  if (capacity !== null && Number.isNaN(capacity)) {
    return buildError(400, "INVALID_CAPACITY", "Capacity must be a positive number.");
  }

  if ((payload.keepMediaIds?.length ?? 0) === 0 && files.length === 0) {
    return buildError(400, "MISSING_MEDIA", "Keep at least one event poster or upload a new file.");
  }

  let uploadedMedia = [] as Awaited<ReturnType<typeof persistEventMediaAssets>>;

  try {
    uploadedMedia = await persistEventMediaAssets({
      tenantId: viewer.tenantId,
      userId: viewer.userId,
      eventId: randomUUID(),
      files
    });

    const response = await updateCampusEvent(viewer, {
      eventId,
      title,
      club,
      category,
      description,
      location,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      passKind,
      passLabel: payload.passLabel?.trim() || null,
      capacity,
      keepMediaIds: payload.keepMediaIds ?? [],
      media: uploadedMedia
    });

    return NextResponse.json(response);
  } catch (error) {
    if (uploadedMedia.length > 0) {
      await deleteEventMediaAssets(uploadedMedia).catch(() => undefined);
    }

    return buildError(400, "EVENT_UPDATE_FAILED", error instanceof Error ? error.message : "We could not update the event.");
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ eventId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before deleting an event.");
  }

  const { eventId } = await context.params;

  try {
    return NextResponse.json(await deleteCampusEvent(viewer, eventId));
  } catch (error) {
    return buildError(400, "EVENT_DELETE_FAILED", error instanceof Error ? error.message : "We could not delete the event.");
  }
}
