import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isBackendRequestError, revokeChatTrustedDevice } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { notifyChatSecurityEvent } from "../../../../../src/lib/notification-events";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function DELETE(
  _request: Request,
  {
    params
  }: {
    params: Promise<{ deviceId: string }>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before removing trusted chat devices.");
  }

  const { deviceId } = await params;
  if (!deviceId) {
    return buildError(400, "INVALID_TRUSTED_DEVICE", "Choose a valid trusted device to remove.");
  }

  try {
    const result = await revokeChatTrustedDevice(viewer, deviceId);
    await notifyChatSecurityEvent(viewer, {
      eventKey: "chat.security.trusted_device_revoked",
      entityId: deviceId,
      title: "Trusted chat device removed",
      body: "A trusted device was removed from secure chat."
    }).catch((notificationError) => {
      console.warn("[notifications] chat.security.trusted_device_revoked failed", {
        deviceId,
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
      "CHAT_TRUSTED_DEVICE_REVOKE_FAILED",
      error instanceof Error ? error.message : "We could not remove this trusted chat device."
    );
  }
}
