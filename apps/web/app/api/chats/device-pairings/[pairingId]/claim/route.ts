import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { claimChatDevicePairing, isBackendRequestError } from "../../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../../src/lib/dev-session";
import { notifyChatSecurityEvent } from "../../../../../../src/lib/notification-events";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PUT(
  _request: Request,
  {
    params
  }: {
    params: Promise<{ pairingId: string }>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before claiming a chat device pairing.");
  }

  const { pairingId } = await params;
  if (!pairingId) {
    return buildError(400, "INVALID_DEVICE_PAIRING", "Choose a valid device pairing session.");
  }

  try {
    const result = await claimChatDevicePairing(viewer, pairingId);
    await notifyChatSecurityEvent(viewer, {
      eventKey: "chat.security.device_pairing_claimed",
      entityId: pairingId,
      title: "Device pairing completed",
      body: "Secure chat is ready on a newly trusted device."
    }).catch((notificationError) => {
      console.warn("[notifications] chat.security.device_pairing_claimed failed", {
        pairingId,
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
      "CHAT_DEVICE_PAIRING_CLAIM_FAILED",
      error instanceof Error ? error.message : "We could not claim this chat device pairing."
    );
  }
}
