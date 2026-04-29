import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChatDevicePairing, isBackendRequestError } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: Promise<{ pairingId: string }>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before viewing a chat device pairing.");
  }

  const { pairingId } = await params;
  if (!pairingId) {
    return buildError(400, "INVALID_DEVICE_PAIRING", "Choose a valid device pairing session.");
  }

  try {
    return NextResponse.json(await getChatDevicePairing(viewer, pairingId));
  } catch (error) {
    if (isBackendRequestError(error)) {
      return buildError(error.statusCode, error.code, error.message);
    }

    return buildError(
      500,
      "CHAT_DEVICE_PAIRING_FETCH_FAILED",
      error instanceof Error ? error.message : "We could not load this device pairing session."
    );
  }
}
