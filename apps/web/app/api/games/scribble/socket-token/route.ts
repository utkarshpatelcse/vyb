import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { buildClientSocketUrl } from "../../../../../src/lib/client-socket-url";
import { getInternalApiKey } from "../../../../../src/lib/internal-api-key";

function scribbleTokenLog(event: string, details: Record<string, unknown> = {}, level: "log" | "warn" | "error" = "log") {
  console[level](`[scribble-token] ${event}`, {
    at: new Date().toISOString(),
    ...details
  });
}

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getInternalApiKey()).update(encodedPayload).digest("base64url");
}

function getViewerUsername(email: string) {
  return email.split("@")[0]?.trim().toLowerCase().replace(/[^a-z0-9._-]+/gu, "") || "vyb-student";
}

export async function GET(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    scribbleTokenLog("request.rejected", {
      reason: "unauthenticated"
    }, "warn");
    return buildError(401, "UNAUTHENTICATED", "You must sign in before opening Scribble.");
  }

  const payload = {
    tenantId: viewer.tenantId,
    userId: viewer.userId,
    membershipId: viewer.membershipId,
    displayName: viewer.displayName || getViewerUsername(viewer.email),
    username: getViewerUsername(viewer.email),
    exp: Date.now() + 5 * 60 * 1000
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const token = `${encodedPayload}.${signPayload(encodedPayload)}`;
  const socketUrl = buildClientSocketUrl(request, "/ws/games/scribble", token);

  scribbleTokenLog("request.accepted", {
    wsOrigin: socketUrl.origin,
    tenantId: payload.tenantId,
    userId: payload.userId,
    membershipId: payload.membershipId,
    username: payload.username,
    displayName: payload.displayName,
    expiresAt: payload.exp
  });

  return NextResponse.json({
    wsUrl: socketUrl.toString(),
    expiresAt: payload.exp,
    viewer: {
      userId: payload.userId,
      membershipId: payload.membershipId,
      username: payload.username,
      displayName: payload.displayName
    }
  });
}
