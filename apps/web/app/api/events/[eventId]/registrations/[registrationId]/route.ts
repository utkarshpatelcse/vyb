import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ManageCampusEventRegistrationRequest } from "@vyb/contracts";
import { manageCampusEventRegistration } from "../../../../../../src/lib/events-data";
import { readDevSessionFromCookieStore } from "../../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function parseStatus(value: unknown): ManageCampusEventRegistrationRequest["status"] | null {
  return value === "approved" || value === "waitlisted" || value === "rejected" ? value : null;
}

export async function PATCH(request: Request, context: { params: Promise<unknown> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before managing registrations.");
  }

  const body = (await request.json().catch(() => null)) as ManageCampusEventRegistrationRequest | null;
  const status = parseStatus(body?.status);

  if (!status) {
    return buildError(400, "INVALID_STATUS", "Choose a valid registration decision.");
  }

  const { eventId, registrationId } = (await context.params) as { eventId: string; registrationId: string };

  try {
    return NextResponse.json(
      await manageCampusEventRegistration(viewer, eventId, registrationId, {
        status,
        reviewNote: typeof body?.reviewNote === "string" ? body.reviewNote : null
      })
    );
  } catch (error) {
    return buildError(400, "EVENT_REGISTRATION_MANAGE_FAILED", error instanceof Error ? error.message : "We could not update this registration.");
  }
}
