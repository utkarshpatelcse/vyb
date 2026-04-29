import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getChatTrustedDevices,
  isBackendRequestError,
  registerChatTrustedDevice
} from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before viewing trusted chat devices.");
  }

  const url = new URL(request.url);

  try {
    return NextResponse.json(await getChatTrustedDevices(viewer, url.searchParams.get("deviceId")));
  } catch (error) {
    if (isBackendRequestError(error)) {
      return buildError(error.statusCode, error.code, error.message);
    }

    return buildError(
      500,
      "CHAT_TRUSTED_DEVICES_FETCH_FAILED",
      error instanceof Error ? error.message : "We could not load your trusted chat devices."
    );
  }
}

export async function PUT(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before trusting this device.");
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return buildError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    return NextResponse.json(await registerChatTrustedDevice(viewer, payload));
  } catch (error) {
    if (isBackendRequestError(error)) {
      return buildError(error.statusCode, error.code, error.message);
    }

    return buildError(
      500,
      "CHAT_TRUSTED_DEVICE_REGISTER_FAILED",
      error instanceof Error ? error.message : "We could not trust this chat device."
    );
  }
}
