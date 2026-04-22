import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createChatConversation, getChatInbox } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before viewing chats.");
  }

  try {
    return NextResponse.json(await getChatInbox(viewer));
  } catch (error) {
    return buildError(500, "CHAT_INBOX_FAILED", error instanceof Error ? error.message : "We could not load chats.");
  }
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before starting a chat.");
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return buildError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    return NextResponse.json(await createChatConversation(viewer, payload));
  } catch (error) {
    return buildError(500, "CHAT_CREATE_FAILED", error instanceof Error ? error.message : "We could not open this chat.");
  }
}
