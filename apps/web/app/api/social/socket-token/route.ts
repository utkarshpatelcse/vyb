import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";
import { buildClientSocketUrl } from "../../../../src/lib/client-socket-url";
import { getInternalApiKey } from "../../../../src/lib/internal-api-key";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getInternalApiKey()).update(encodedPayload).digest("base64url");
}

export async function GET(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before opening realtime social updates.");
  }

  const payload = {
    tenantId: viewer.tenantId,
    userId: viewer.userId,
    membershipId: viewer.membershipId,
    email: viewer.email,
    exp: Date.now() + 5 * 60 * 1000
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const token = `${encodedPayload}.${signPayload(encodedPayload)}`;
  const socketUrl = buildClientSocketUrl(request, "/ws/social", token);

  return NextResponse.json({
    wsUrl: socketUrl.toString(),
    expiresAt: payload.exp
  });
}
