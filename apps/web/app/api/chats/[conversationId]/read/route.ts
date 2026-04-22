import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { markChatRead } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PUT(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before updating read state.");
  }

  const payload = await request.json().catch(() => null);
  const messageId = typeof payload?.messageId === "string" ? payload.messageId.trim() : "";
  if (!messageId) {
    return buildError(400, "INVALID_MESSAGE", "Choose a valid message to mark as read.");
  }

  const { conversationId } = await params;

  try {
    return NextResponse.json(await markChatRead(viewer, conversationId, messageId));
  } catch (error) {
    return buildError(500, "CHAT_READ_FAILED", error instanceof Error ? error.message : "We could not update chat read state.");
  }
}
