import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChatConversation, isBackendRequestError } from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function buildChatError(error: unknown, fallbackCode: string, fallbackMessage: string) {
  if (isBackendRequestError(error)) {
    return buildError(error.statusCode, error.code, error.message);
  }

  return buildError(500, fallbackCode, error instanceof Error ? error.message : fallbackMessage);
}

export async function GET(_request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before opening a chat.");
  }

  const { conversationId } = await params;

  try {
    return NextResponse.json(await getChatConversation(viewer, conversationId), {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate"
      }
    });
  } catch (error) {
    return buildChatError(error, "CHAT_DETAIL_FAILED", "We could not load that chat.");
  }
}
