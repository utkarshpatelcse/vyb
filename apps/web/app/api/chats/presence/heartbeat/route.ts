import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { sendChatPresenceHeartbeat } from "../../../../../src/lib/backend";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST() {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before updating presence.");
  }

  try {
    return NextResponse.json(await sendChatPresenceHeartbeat(viewer, {}));
  } catch (error) {
    return buildError(
      500,
      "CHAT_PRESENCE_HEARTBEAT_FAILED",
      error instanceof Error ? error.message : "We could not update presence."
    );
  }
}
