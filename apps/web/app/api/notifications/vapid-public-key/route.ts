import { NextResponse } from "next/server";
import { getNotificationVapidPublicKey } from "../../../../src/lib/notifications";

export async function GET() {
  const publicKey = getNotificationVapidPublicKey();

  return NextResponse.json({
    publicKey,
    enabled: Boolean(publicKey)
  });
}
