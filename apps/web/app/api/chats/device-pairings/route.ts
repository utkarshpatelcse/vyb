import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createChatDevicePairing, getChatDevicePairingByCode, isBackendRequestError } from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";
import { notifyChatSecurityEvent } from "../../../../src/lib/notification-events";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before pairing a chat device.");
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return buildError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const result = await createChatDevicePairing(viewer, payload);
    await notifyChatSecurityEvent(viewer, {
      eventKey: "chat.security.device_pairing_requested",
      entityId: result.pairing.id,
      title: "Device pairing started",
      body: "A new browser requested access to secure chat."
    }).catch((notificationError) => {
      console.warn("[notifications] chat.security.device_pairing_requested failed", {
        pairingId: result.pairing.id,
        message: notificationError instanceof Error ? notificationError.message : "unknown"
      });
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isBackendRequestError(error)) {
      return buildError(error.statusCode, error.code, error.message);
    }

    return buildError(
      500,
      "CHAT_DEVICE_PAIRING_CREATE_FAILED",
      error instanceof Error ? error.message : "We could not create this device pairing session."
    );
  }
}

export async function GET(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before viewing a chat device pairing.");
  }

  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!/^\d{6}$/u.test(code)) {
    return buildError(400, "INVALID_DEVICE_PAIRING_CODE", "Enter the 6-digit pairing code.");
  }

  try {
    return NextResponse.json(await getChatDevicePairingByCode(viewer, code));
  } catch (error) {
    if (isBackendRequestError(error)) {
      return buildError(error.statusCode, error.code, error.message);
    }

    return buildError(
      500,
      "CHAT_DEVICE_PAIRING_CODE_FETCH_FAILED",
      error instanceof Error ? error.message : "We could not find this device pairing code."
    );
  }
}
