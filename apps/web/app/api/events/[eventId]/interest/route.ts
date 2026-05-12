import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { toggleCampusEventInterest } from "../../../../../src/lib/events-data";
import { scheduleEventLiveNowNotification } from "../../../../../src/lib/notification-events";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(_: Request, context: { params: Promise<{ eventId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before responding to an event.");
  }

  const { eventId } = await context.params;

  try {
    const result = await toggleCampusEventInterest(viewer, eventId);
    const event = result.dashboard.events.find((candidate) => candidate.id === eventId);
    if (result.isInterested && event) {
      await scheduleEventLiveNowNotification(viewer, event).catch((notificationError) => {
        console.warn("[notifications] event.live_now schedule failed", {
          eventId,
          message: notificationError instanceof Error ? notificationError.message : "unknown"
        });
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    return buildError(400, "EVENT_INTEREST_FAILED", error instanceof Error ? error.message : "We could not update your RSVP.");
  }
}
