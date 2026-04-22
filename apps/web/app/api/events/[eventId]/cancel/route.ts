import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { cancelCampusEvent } from "../../../../../src/lib/events-data";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(_: Request, context: { params: Promise<{ eventId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before managing an event.");
  }

  const { eventId } = await context.params;

  try {
    return NextResponse.json(await cancelCampusEvent(viewer, eventId));
  } catch (error) {
    return buildError(400, "EVENT_CANCEL_FAILED", error instanceof Error ? error.message : "We could not cancel this event.");
  }
}
