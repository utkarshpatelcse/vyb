import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteChatMessage } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before deleting a chat message.");
  }

  const payload = await request.json().catch(() => null);
  const scope = typeof payload?.scope === "string" ? payload.scope.trim() : "";
  if (scope !== "self" && scope !== "everyone") {
    return buildError(400, "INVALID_DELETE_SCOPE", "Choose whether to delete the message for you or for everyone.");
  }

  const { messageId } = await params;

  try {
    return NextResponse.json(await deleteChatMessage(viewer, messageId, { scope }));
  } catch (error) {
    return buildError(500, "CHAT_DELETE_FAILED", error instanceof Error ? error.message : "We could not delete that message.");
  }
}
