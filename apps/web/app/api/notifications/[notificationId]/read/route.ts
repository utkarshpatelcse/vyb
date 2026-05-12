import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { markNotificationRead } from "../../../../../src/lib/notifications";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PATCH(_: Request, context: { params: Promise<{ notificationId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before updating notifications.");
  }

  const { notificationId } = await context.params;
  if (!notificationId?.trim()) {
    return buildError(400, "INVALID_NOTIFICATION", "Choose a valid notification.");
  }

  try {
    return NextResponse.json(await markNotificationRead(viewer, notificationId));
  } catch (error) {
    return buildError(
      404,
      "NOTIFICATION_NOT_FOUND",
      error instanceof Error ? error.message : "We could not find this notification."
    );
  }
}
