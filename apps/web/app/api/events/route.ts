import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { CampusEventPassKind, CreateCampusEventRequest } from "@vyb/contracts";
import { getViewerProfile } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import { createCampusEvent, getEventsDashboard } from "../../../src/lib/events-data";
import { deleteEventMediaAssets, persistEventMediaAssets } from "../../../src/lib/events-media-server";

type ParsedCreatePayload = Omit<Partial<CreateCampusEventRequest>, "capacity"> & {
  capacity?: string | number | null;
};

type ParsedCreateBody = {
  payload: ParsedCreatePayload;
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

function buildParsedCreateBodyFromFormData(formData: FormData): ParsedCreateBody {
  return {
    payload: {
      title: readOptionalStringFromForm(formData, "title") ?? "",
      club: readOptionalStringFromForm(formData, "club") ?? "",
      category: readOptionalStringFromForm(formData, "category") ?? "",
      description: readOptionalStringFromForm(formData, "description") ?? "",
      location: readOptionalStringFromForm(formData, "location") ?? "",
      startsAt: readOptionalStringFromForm(formData, "startsAt") ?? "",
      endsAt: readOptionalStringFromForm(formData, "endsAt"),
      passKind: readOptionalStringFromForm(formData, "passKind") as CampusEventPassKind,
      passLabel: readOptionalStringFromForm(formData, "passLabel"),
      capacity: readOptionalStringFromForm(formData, "capacity")
    },
    files: formData.getAll("media").filter(isFileEntry).filter((file) => file.size > 0)
  };
}

async function parseCreateBody(request: Request): Promise<ParsedCreateBody | null> {
  const contentType = request.headers.get("content-type") ?? "";
  const formRequest = request.clone();
  const jsonRequest = request.clone();

  if (!contentType.includes("application/json")) {
    const formData = await formRequest.formData().catch(() => null);

    if (formData) {
      return buildParsedCreateBodyFromFormData(formData);
    }
  }

  const payload = (await jsonRequest.json().catch(() => null)) as ParsedCreatePayload | null;

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

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before opening events.");
  }

  return NextResponse.json(await getEventsDashboard(viewer));
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before hosting an event.");
  }

  const parsedBody = await parseCreateBody(request);

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

  if (!title) {
    return buildError(400, "INVALID_TITLE", "Add an event title.");
  }

  if (!club) {
    return buildError(400, "INVALID_CLUB", "Add the club or host name.");
  }

  if (!category) {
    return buildError(400, "INVALID_CATEGORY", "Choose a category for the event.");
  }

  if (!description) {
    return buildError(400, "INVALID_DESCRIPTION", "Add a short event description.");
  }

  if (!location) {
    return buildError(400, "INVALID_LOCATION", "Add the event location.");
  }

  if (!startsAt || !isValidDateTime(startsAt)) {
    return buildError(400, "INVALID_STARTS_AT", "Choose a valid start date and time.");
  }

  if (endsAt && !isValidDateTime(endsAt)) {
    return buildError(400, "INVALID_ENDS_AT", "Choose a valid end date and time.");
  }

  if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return buildError(400, "INVALID_END_RANGE", "The event end time must be after the start time.");
  }

  if (!passKind) {
    return buildError(400, "INVALID_PASS_KIND", "Choose whether the event is free, RSVP, or paid.");
  }

  if (capacity !== null && Number.isNaN(capacity)) {
    return buildError(400, "INVALID_CAPACITY", "Capacity must be a positive whole number.");
  }

  if (files.length === 0) {
    return buildError(400, "MISSING_MEDIA", "Add at least one poster or media file before publishing the event.");
  }

  const profile = await getViewerProfile(viewer).catch(() => null);

  if (!profile?.profileCompleted || !profile.profile) {
    return buildError(403, "PROFILE_INCOMPLETE", "Complete your profile before hosting events.");
  }

  let uploadedMedia = [] as Awaited<ReturnType<typeof persistEventMediaAssets>>;

  try {
    uploadedMedia = await persistEventMediaAssets({
      tenantId: viewer.tenantId,
      userId: viewer.userId,
      eventId: randomUUID(),
      files
    });

    const response = await createCampusEvent(
      viewer,
      {
        userId: viewer.userId,
        tenantId: viewer.tenantId,
        username: profile.profile.username,
        displayName: profile.profile.fullName || viewer.displayName,
        role: viewer.role
      },
      {
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
        media: uploadedMedia
      }
    );

    return NextResponse.json(response);
  } catch (error) {
    if (uploadedMedia.length > 0) {
      await deleteEventMediaAssets(uploadedMedia).catch(() => undefined);
    }

    return buildError(400, "EVENT_CREATE_FAILED", error instanceof Error ? error.message : "We could not publish the event.");
  }
}
