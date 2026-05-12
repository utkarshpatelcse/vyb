import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { sendChatPresenceHeartbeat } from "../../../../../src/lib/backend";
import { recordNotificationLiveMode } from "../../../../../src/lib/notifications";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function getConversationIdFromPath(path: string | null | undefined) {
  const match = path?.match(/\/messages\/([^/?#]+)/u);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before updating presence.");
  }

  const payload = (await request.json().catch(() => ({}))) as { path?: string | null } | null;

  try {
    const result = await sendChatPresenceHeartbeat(viewer, {
      path: typeof payload?.path === "string" ? payload.path : null
    });
    await recordNotificationLiveMode(viewer, {
      mode: "chat",
      contextId: getConversationIdFromPath(result.activePath)
    }).catch(() => undefined);
    return NextResponse.json(result);
  } catch (error) {
    return buildError(
      500,
      "CHAT_PRESENCE_HEARTBEAT_FAILED",
      error instanceof Error ? error.message : "We could not update presence."
    );
  }
}
