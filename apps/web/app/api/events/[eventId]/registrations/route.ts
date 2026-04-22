import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { CampusEventRegistrationStatus } from "@vyb/contracts";
import { getCampusEventRegistrations } from "../../../../../src/lib/events-data";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function parseStatuses(searchParams: URLSearchParams): CampusEventRegistrationStatus[] {
  const raw = (searchParams.get("status") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return raw.filter((value): value is CampusEventRegistrationStatus =>
    value === "submitted" || value === "approved" || value === "waitlisted" || value === "rejected" || value === "cancelled"
  );
}

export async function GET(request: Request, context: { params: Promise<unknown> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before opening registrations.");
  }

  const { eventId } = (await context.params) as { eventId: string };
  const url = new URL(request.url);

  try {
    return NextResponse.json(
      await getCampusEventRegistrations(viewer, eventId, {
        query: url.searchParams.get("query"),
        statuses: parseStatuses(url.searchParams)
      })
    );
  } catch (error) {
    return buildError(400, "EVENT_REGISTRATIONS_FAILED", error instanceof Error ? error.message : "We could not load registrations for this event.");
  }
}
