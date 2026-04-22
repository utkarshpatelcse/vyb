import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type {
  CampusEventRegistrationAnswer,
  CampusEventTeamMember,
  UpsertCampusEventRegistrationRequest
} from "@vyb/contracts";
import { getViewerProfile } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { getViewerCampusEventRegistration, upsertCampusEventRegistration } from "../../../../../src/lib/events-data";
import { deleteEventMediaAssets, persistEventRegistrationAssets } from "../../../../../src/lib/events-media-server";

type RegistrationBody = Omit<UpsertCampusEventRegistrationRequest, "answers" | "teamMembers" | "attachments" | "keepAttachmentIds"> & {
  answers?: CampusEventRegistrationAnswer[];
  teamMembers?: CampusEventTeamMember[];
  keepAttachmentIds?: string[];
};

type ParsedRegistrationBody = {
  payload: RegistrationBody;
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

function readJsonFromForm<T>(formData: FormData, key: string, fallback: T) {
  const value = readOptionalStringFromForm(formData, key);

  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function buildParsedRegistrationBodyFromFormData(formData: FormData): ParsedRegistrationBody {
  return {
    payload: {
      eventId: readOptionalStringFromForm(formData, "eventId") ?? "",
      teamName: readOptionalStringFromForm(formData, "teamName"),
      note: readOptionalStringFromForm(formData, "note"),
      teamMembers: readJsonFromForm<CampusEventTeamMember[]>(formData, "teamMembers", []),
      answers: readJsonFromForm<CampusEventRegistrationAnswer[]>(formData, "answers", []),
      keepAttachmentIds: formData
        .getAll("keepAttachmentIds")
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    },
    files: formData.getAll("attachments").filter(isFileEntry).filter((file) => file.size > 0)
  };
}

async function parseRegistrationBody(request: Request): Promise<ParsedRegistrationBody | null> {
  const contentType = request.headers.get("content-type") ?? "";
  const formRequest = request.clone();
  const jsonRequest = request.clone();

  if (!contentType.includes("application/json")) {
    const formData = await formRequest.formData().catch(() => null);
    if (formData) {
      return buildParsedRegistrationBodyFromFormData(formData);
    }
  }

  const payload = (await jsonRequest.json().catch(() => null)) as RegistrationBody | null;
  if (!payload) {
    return null;
  }

  return {
    payload,
    files: []
  };
}

export async function GET(_: Request, context: { params: Promise<unknown> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before opening registrations.");
  }

  const { eventId } = (await context.params) as { eventId: string };

  try {
    return NextResponse.json(await getViewerCampusEventRegistration(viewer, eventId));
  } catch (error) {
    return buildError(400, "EVENT_REGISTRATION_LOOKUP_FAILED", error instanceof Error ? error.message : "We could not load your registration.");
  }
}

export async function POST(request: Request, context: { params: Promise<unknown> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before responding to an event.");
  }

  const profile = await getViewerProfile(viewer).catch(() => null);

  if (!profile?.profileCompleted || !profile.profile) {
    return buildError(403, "PROFILE_INCOMPLETE", "Complete your profile before registering for events.");
  }

  const { eventId } = (await context.params) as { eventId: string };
  const parsedBody = await parseRegistrationBody(request);

  if (!parsedBody) {
    return buildError(400, "INVALID_BODY", "Request body must be valid JSON or multipart form data.");
  }

  let uploadedAttachments = [] as Awaited<ReturnType<typeof persistEventRegistrationAssets>>;

  try {
    uploadedAttachments = await persistEventRegistrationAssets({
      tenantId: viewer.tenantId,
      userId: viewer.userId,
      eventId,
      registrationId: randomUUID(),
      files: parsedBody.files
    });

    return NextResponse.json(
      await upsertCampusEventRegistration(
        viewer,
        {
          userId: viewer.userId,
          tenantId: viewer.tenantId,
          username: profile.profile.username,
          displayName: profile.profile.fullName || viewer.displayName,
          role: viewer.role
        },
        {
          eventId,
          teamName: parsedBody.payload.teamName ?? null,
          note: parsedBody.payload.note ?? null,
          teamMembers: parsedBody.payload.teamMembers ?? [],
          answers: parsedBody.payload.answers ?? [],
          keepAttachmentIds: parsedBody.payload.keepAttachmentIds ?? [],
          attachments: uploadedAttachments
        }
      )
    );
  } catch (error) {
    if (uploadedAttachments.length > 0) {
      await deleteEventMediaAssets(uploadedAttachments).catch(() => undefined);
    }

    return buildError(400, "EVENT_REGISTRATION_FAILED", error instanceof Error ? error.message : "We could not submit this registration.");
  }
}
