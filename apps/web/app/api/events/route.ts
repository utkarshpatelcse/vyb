import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { CampusEventEntryMode, CampusEventFormField, CampusEventPassKind, CampusEventResponseMode, CreateCampusEventRequest } from "@vyb/contracts";
import { getViewerProfile } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import { createCampusEvent, getEventsDashboard } from "../../../src/lib/events-data";
import { deleteEventMediaAssets, persistEventMediaAssets } from "../../../src/lib/events-media-server";

type ParsedCreatePayload = Omit<Partial<CreateCampusEventRequest>, "capacity" | "teamSizeMin" | "teamSizeMax" | "formFields"> & {
  capacity?: string | number | null;
  teamSizeMin?: string | number | null;
  teamSizeMax?: string | number | null;
  formFields?: CampusEventFormField[];
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

function readOptionalJsonFromForm<T>(formData: FormData, key: string) {
  const value = readOptionalStringFromForm(formData, key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
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
      capacity: readOptionalStringFromForm(formData, "capacity"),
      responseMode: readOptionalStringFromForm(formData, "responseMode") as CampusEventResponseMode,
      registrationClosesAt: readOptionalStringFromForm(formData, "registrationClosesAt"),
      entryMode: readOptionalStringFromForm(formData, "entryMode") as CampusEventEntryMode,
      teamSizeMin: readOptionalStringFromForm(formData, "teamSizeMin"),
      teamSizeMax: readOptionalStringFromForm(formData, "teamSizeMax"),
      allowAttachments: readOptionalStringFromForm(formData, "allowAttachments") === "true",
      attachmentLabel: readOptionalStringFromForm(formData, "attachmentLabel"),
      formFields: readOptionalJsonFromForm<CampusEventFormField[]>(formData, "formFields") ?? undefined
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

function parseResponseMode(value: unknown): CampusEventResponseMode | null {
  return value === "interest" || value === "register" || value === "apply" ? value : null;
}

function parseEntryMode(value: unknown): CampusEventEntryMode | null {
  return value === "individual" || value === "team" ? value : null;
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

function validateFormFields(fields: CampusEventFormField[] | undefined, responseMode: CampusEventResponseMode | null) {
  if (!fields || responseMode === "interest") {
    return null;
  }

  for (const field of fields) {
    if (!field.label?.trim()) {
      return "Each registration question needs a label.";
    }

    if (field.type === "select" && (field.options?.filter((option) => option.trim()).length ?? 0) < 2) {
      return `Add at least 2 options for "${field.label.trim()}" before publishing.`;
    }
  }

  return null;
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
  const responseMode = parseResponseMode(payload.responseMode);
  const entryMode = parseEntryMode(payload.entryMode);
  const capacity = parseCapacity(payload.capacity);
  const teamSizeMin = parseCapacity(payload.teamSizeMin);
  const teamSizeMax = parseCapacity(payload.teamSizeMax);
  const registrationClosesAt = payload.registrationClosesAt?.trim() ?? "";

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

  if (new Date(startsAt).getTime() <= Date.now()) {
    return buildError(400, "START_IN_PAST", "Choose a future start date and time.");
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

  if (!responseMode) {
    return buildError(400, "INVALID_RESPONSE_MODE", "Choose whether students should show interest, register, or apply.");
  }

  if (capacity !== null && Number.isNaN(capacity)) {
    return buildError(400, "INVALID_CAPACITY", "Capacity must be a positive whole number.");
  }

  if (teamSizeMin !== null && Number.isNaN(teamSizeMin)) {
    return buildError(400, "INVALID_TEAM_SIZE_MIN", "Minimum team size must be a positive whole number.");
  }

  if (teamSizeMax !== null && Number.isNaN(teamSizeMax)) {
    return buildError(400, "INVALID_TEAM_SIZE_MAX", "Maximum team size must be a positive whole number.");
  }

  if (registrationClosesAt && !isValidDateTime(registrationClosesAt)) {
    return buildError(400, "INVALID_REGISTRATION_CLOSES_AT", "Choose a valid registration close time.");
  }

  if (registrationClosesAt && new Date(registrationClosesAt).getTime() > new Date(startsAt).getTime()) {
    return buildError(400, "INVALID_REGISTRATION_CLOSE_WINDOW", "Registration should close on or before the event start time.");
  }

  const formFieldError = validateFormFields(payload.formFields, responseMode);
  if (formFieldError) {
    return buildError(400, "INVALID_FORM_FIELDS", formFieldError);
  }

  if (responseMode !== "interest" && !entryMode) {
    return buildError(400, "INVALID_ENTRY_MODE", "Choose whether this is an individual or team entry event.");
  }

  if (responseMode !== "interest" && entryMode === "team") {
    const minSize = teamSizeMin ?? 2;
    const maxSize = teamSizeMax ?? Math.max(minSize, 4);

    if (minSize < 2 || maxSize < minSize) {
      return buildError(400, "INVALID_TEAM_SIZE_RANGE", "Team size settings must be valid and at least 2 people.");
    }
  }

  if (responseMode !== "interest" && payload.allowAttachments === true && !payload.attachmentLabel?.trim()) {
    return buildError(400, "INVALID_ATTACHMENT_LABEL", "Add a short attachment label so students know what to upload.");
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
        responseMode,
        registrationClosesAt: registrationClosesAt ? new Date(registrationClosesAt).toISOString() : null,
        entryMode: responseMode === "interest" ? "individual" : entryMode,
        teamSizeMin: responseMode === "interest" ? null : teamSizeMin,
        teamSizeMax: responseMode === "interest" ? null : teamSizeMax,
        allowAttachments: responseMode === "interest" ? false : payload.allowAttachments === true,
        attachmentLabel: responseMode === "interest" ? null : payload.attachmentLabel?.trim() || null,
        formFields: payload.formFields ?? [],
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
