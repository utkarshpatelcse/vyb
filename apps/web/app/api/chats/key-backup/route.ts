import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChatKeyBackup, isBackendRequestError, upsertChatKeyBackup } from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";
import { notifyChatSecurityEvent } from "../../../../src/lib/notification-events";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before opening encrypted key backup.");
  }

  try {
    return NextResponse.json(await getChatKeyBackup(viewer));
  } catch (error) {
    if (isBackendRequestError(error)) {
      return buildError(error.statusCode, error.code, error.message);
    }

    return buildError(
      500,
      "CHAT_KEY_BACKUP_FETCH_FAILED",
      error instanceof Error ? error.message : "We could not load your encrypted key backup."
    );
  }
}

export async function PUT(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before backing up encrypted chat keys.");
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return buildError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const result = await upsertChatKeyBackup(viewer, payload);
    await notifyChatSecurityEvent(viewer, {
      eventKey: "chat.security.backup_updated",
      entityId: `backup:${viewer.userId}`,
      title: "Chat backup updated",
      body: "Your encrypted chat recovery backup was updated."
    }).catch((notificationError) => {
      console.warn("[notifications] chat.security.backup_updated failed", {
        message: notificationError instanceof Error ? notificationError.message : "unknown"
      });
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isBackendRequestError(error)) {
      return buildError(error.statusCode, error.code, error.message);
    }

    return buildError(
      500,
      "CHAT_KEY_BACKUP_SAVE_FAILED",
      error instanceof Error ? error.message : "We could not save your encrypted key backup."
    );
  }
}
