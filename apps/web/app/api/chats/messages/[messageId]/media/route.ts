import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getEncryptedChatAttachmentBytes, isBackendRequestError } from "../../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before opening encrypted chat media.");
  }

  const { messageId } = await params;
  if (!messageId?.trim()) {
    return buildError(400, "INVALID_MESSAGE", "Choose a valid message first.");
  }

  try {
    const upstream = await getEncryptedChatAttachmentBytes(viewer, messageId);
    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => null);
      return buildError(
        upstream.status,
        typeof payload?.error?.code === "string" ? payload.error.code : "CHAT_MEDIA_DOWNLOAD_FAILED",
        typeof payload?.error?.message === "string" ? payload.error.message : "We could not load that encrypted media."
      );
    }

    return new Response(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": "private, no-store",
        "x-chat-attachment-mime-type": upstream.headers.get("x-chat-attachment-mime-type") ?? "application/octet-stream",
        "x-chat-attachment-size": upstream.headers.get("x-chat-attachment-size") ?? "",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    if (isBackendRequestError(error)) {
      return buildError(error.statusCode, error.code, error.message);
    }

    return buildError(
      500,
      "CHAT_MEDIA_DOWNLOAD_FAILED",
      error instanceof Error ? error.message : "We could not load that encrypted media."
    );
  }
}
