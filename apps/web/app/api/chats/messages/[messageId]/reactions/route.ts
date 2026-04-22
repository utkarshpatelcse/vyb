import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { reactToChatMessage } from "../../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PUT(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before reacting to a chat message.");
  }

  const payload = await request.json().catch(() => null);
  const emoji = typeof payload?.emoji === "string" ? payload.emoji.trim() : "";

  if (!emoji) {
    return buildError(400, "INVALID_EMOJI", "Choose a reaction first.");
  }

  const { messageId } = await params;

  try {
    return NextResponse.json(await reactToChatMessage(viewer, messageId, emoji));
  } catch (error) {
    return buildError(500, "CHAT_REACTION_FAILED", error instanceof Error ? error.message : "We could not react to that message.");
  }
}
