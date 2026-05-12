import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { approveChatDevicePairing, isBackendRequestError } from "../../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../../src/lib/dev-session";
import { notifyChatSecurityEvent } from "../../../../../../src/lib/notification-events";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PUT(
  request: Request,
  {
    params
  }: {
    params: Promise<{ pairingId: string }>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before approving a chat device.");
  }

  const { pairingId } = await params;
  const payload = await request.json().catch(() => null);
  if (!pairingId || !payload || typeof payload !== "object") {
    return buildError(400, "INVALID_DEVICE_PAIRING_APPROVAL", "Device pairing approval is incomplete.");
  }

  try {
    const result = await approveChatDevicePairing(viewer, pairingId, payload);
    await notifyChatSecurityEvent(viewer, {
      eventKey: "chat.security.device_pairing_approved",
      entityId: pairingId,
      title: "Device pairing approved",
      body: "A trusted device approved secure chat access."
    }).catch((notificationError) => {
      console.warn("[notifications] chat.security.device_pairing_approved failed", {
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
      "CHAT_DEVICE_PAIRING_APPROVE_FAILED",
      error instanceof Error ? error.message : "We could not approve this chat device."
    );
  }
}
