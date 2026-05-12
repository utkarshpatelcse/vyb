import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { RegisterNotificationDeviceRequest } from "@vyb/contracts";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";
import { registerNotificationDevice } from "../../../../src/lib/notifications";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before registering notification devices.");
  }

  const payload = (await request.json().catch(() => null)) as RegisterNotificationDeviceRequest | null;
  if (!payload || typeof payload !== "object") {
    return buildError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    return NextResponse.json(await registerNotificationDevice(viewer, payload), { status: 201 });
  } catch (error) {
    return buildError(
      400,
      "NOTIFICATION_DEVICE_REGISTER_FAILED",
      error instanceof Error ? error.message : "We could not register this notification device."
    );
  }
}
