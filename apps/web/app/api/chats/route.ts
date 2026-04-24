import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createChatConversation, getChatInbox, isBackendRequestError } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function buildChatError(error: unknown, fallbackCode: string, fallbackMessage: string) {
  if (isBackendRequestError(error)) {
    return buildError(error.statusCode, error.code, error.message);
  }

  return buildError(500, fallbackCode, error instanceof Error ? error.message : fallbackMessage);
}

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before viewing chats.");
  }

  try {
    return NextResponse.json(await getChatInbox(viewer), {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate"
      }
    });
  } catch (error) {
    return buildChatError(error, "CHAT_INBOX_FAILED", "We could not load chats.");
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
    return buildChatError(error, "CHAT_CREATE_FAILED", "We could not open this chat.");
  }
}
