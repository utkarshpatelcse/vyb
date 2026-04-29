import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isBackendRequestError, revokeChatTrustedDevice } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

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
    return NextResponse.json(await revokeChatTrustedDevice(viewer, deviceId));
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
