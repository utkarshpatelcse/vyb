import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteChatMessage, updateChatMessage } from "../../../../../src/lib/backend";
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

export async function PATCH(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before editing a chat message.");
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return buildError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const { messageId } = await params;

  try {
    return NextResponse.json(await updateChatMessage(viewer, messageId, {
      cipherText: typeof payload.cipherText === "string" ? payload.cipherText : "",
      cipherIv: typeof payload.cipherIv === "string" ? payload.cipherIv : "",
      cipherAlgorithm: typeof payload.cipherAlgorithm === "string" ? payload.cipherAlgorithm : ""
    }));
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      Number.isInteger((error as { statusCode?: unknown }).statusCode)
        ? ((error as { statusCode: number }).statusCode)
        : 500;
    const code =
      typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string"
        ? ((error as { code: string }).code)
        : "CHAT_EDIT_FAILED";
    return buildError(statusCode, code, error instanceof Error ? error.message : "We could not edit that message.");
  }
}
