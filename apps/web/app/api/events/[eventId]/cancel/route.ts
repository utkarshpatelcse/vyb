import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { cancelCampusEvent, getCampusEventNotificationAudience } from "../../../../../src/lib/events-data";
import { notifyEventCancelled } from "../../../../../src/lib/notification-events";

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
    const audience = await getCampusEventNotificationAudience(viewer, eventId).catch(() => null);
    const result = await cancelCampusEvent(viewer, eventId);
    if (audience) {
      await notifyEventCancelled(viewer, audience.event, audience.audienceUserIds).catch((notificationError) => {
        console.warn("[notifications] event.cancelled failed", {
          eventId,
          message: notificationError instanceof Error ? notificationError.message : "unknown"
        });
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    return buildError(400, "EVENT_CANCEL_FAILED", error instanceof Error ? error.message : "We could not cancel this event.");
  }
}
