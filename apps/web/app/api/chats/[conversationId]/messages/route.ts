import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendChatMessage } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

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
  const debugTraceId =
    typeof (payload as { debugTraceId?: unknown }).debugTraceId === "string"
      ? (payload as { debugTraceId: string }).debugTraceId.slice(0, 80)
      : "missing-trace";
  const startedAt = Date.now();

  console.info("[chat-send-debug]", {
    stage: "next-api.send.start",
    at: new Date().toISOString(),
    traceId: debugTraceId,
    conversationId,
    viewerUserId: viewer.userId,
    viewerMembershipId: viewer.membershipId,
    messageKind: typeof (payload as { messageKind?: unknown }).messageKind === "string" ? (payload as { messageKind: string }).messageKind : null,
    durationKey: typeof (payload as { durationKey?: unknown }).durationKey === "string" ? (payload as { durationKey: string }).durationKey : null,
    cipherTextLength: typeof (payload as { cipherText?: unknown }).cipherText === "string" ? (payload as { cipherText: string }).cipherText.length : null,
    cipherIvLength: typeof (payload as { cipherIv?: unknown }).cipherIv === "string" ? (payload as { cipherIv: string }).cipherIv.length : null,
    hasAttachment: Boolean((payload as { attachment?: unknown }).attachment)
  });

  try {
    const result = await sendChatMessage(viewer, conversationId, payload);
    console.info("[chat-send-debug]", {
      stage: "next-api.send.success",
      at: new Date().toISOString(),
      traceId: debugTraceId,
      conversationId,
      messageId: result.item?.id ?? null,
      durationMs: Date.now() - startedAt
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[chat-send-debug]", {
      stage: "next-api.send.failed",
      at: new Date().toISOString(),
      traceId: debugTraceId,
      conversationId,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error),
      statusCode:
        typeof error === "object" &&
        error !== null &&
        Number.isInteger((error as { statusCode?: unknown }).statusCode)
          ? (error as { statusCode: number }).statusCode
          : null
    });
    return buildChatError(error, "CHAT_SEND_FAILED", "We could not send this message.");
  }
}
