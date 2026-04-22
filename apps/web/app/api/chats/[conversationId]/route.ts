import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChatConversation } from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before opening a chat.");
  }

  const { conversationId } = await params;

  try {
    return NextResponse.json(await getChatConversation(viewer, conversationId));
  } catch (error) {
    return buildError(500, "CHAT_DETAIL_FAILED", error instanceof Error ? error.message : "We could not load that chat.");
  }
}
