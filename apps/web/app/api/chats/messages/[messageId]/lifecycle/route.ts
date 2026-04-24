import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { updateChatMessageLifecycle } from "../../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function buildChatError(error: unknown, fallbackCode: string, fallbackMessage: string) {
  const statusCode =
    typeof error === "object" &&
    error !== null &&
    Number.isInteger((error as { statusCode?: unknown }).statusCode)
      ? ((error as { statusCode: number }).statusCode)
      : 500;
  const code =
    typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string"
      ? ((error as { code: string }).code)
      : fallbackCode;

  return buildError(statusCode, code, error instanceof Error ? error.message : fallbackMessage);
}

export async function PUT(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before updating a chat message.");
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return buildError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const { messageId } = await params;

  try {
    return NextResponse.json(await updateChatMessageLifecycle(viewer, messageId, payload));
  } catch (error) {
    return buildChatError(error, "CHAT_LIFECYCLE_FAILED", "We could not update that message.");
  }
}
