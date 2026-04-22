import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendChatMessage } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before sending a chat message.");
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return buildError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const { conversationId } = await params;

  try {
    return NextResponse.json(await sendChatMessage(viewer, conversationId, payload), { status: 201 });
  } catch (error) {
    return buildError(500, "CHAT_SEND_FAILED", error instanceof Error ? error.message : "We could not send this message.");
  }
}
