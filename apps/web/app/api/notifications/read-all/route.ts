import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { MarkAllNotificationsReadRequest } from "@vyb/contracts";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";
import { markAllNotificationsRead } from "../../../../src/lib/notifications";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before updating notifications.");
  }

  const payload = (await request.json().catch(() => ({}))) as MarkAllNotificationsReadRequest | null;

  try {
    return NextResponse.json(
      await markAllNotificationsRead(viewer, {
        category: typeof payload?.category === "string" ? payload.category : null
      })
    );
  } catch (error) {
    return buildError(
      500,
      "NOTIFICATIONS_READ_ALL_FAILED",
      error instanceof Error ? error.message : "We could not update your notifications."
    );
  }
}
