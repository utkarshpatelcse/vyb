import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { CampusEventRegistrationStatus } from "@vyb/contracts";
import { exportCampusEventRegistrationsCsv } from "../../../../../../src/lib/events-data";
import { readDevSessionFromCookieStore } from "../../../../../../src/lib/dev-session";

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
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "You must sign in before exporting registrations." } }, { status: 401 });
  }

  const { eventId } = (await context.params) as { eventId: string };
  const url = new URL(request.url);

  try {
    const csv = await exportCampusEventRegistrationsCsv(viewer, eventId, {
      query: url.searchParams.get("query"),
      statuses: parseStatuses(url.searchParams)
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="event-${eventId}-registrations.csv"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "EVENT_REGISTRATION_EXPORT_FAILED", message: error instanceof Error ? error.message : "We could not export registrations." } },
      { status: 400 }
    );
  }
}
