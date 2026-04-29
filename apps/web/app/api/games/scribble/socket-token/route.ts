import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

const API_BASE_URL =
  process.env.VYB_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const INTERNAL_API_KEY = process.env.VYB_INTERNAL_API_KEY ?? "local-vyb-internal-key";

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
  return createHmac("sha256", INTERNAL_API_KEY).update(encodedPayload).digest("base64url");
}

function getViewerUsername(email: string) {
  return email.split("@")[0]?.trim().toLowerCase().replace(/[^a-z0-9._-]+/gu, "") || "vyb-student";
}

export async function GET() {
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
  const socketUrl = new URL("/ws/games/scribble", API_BASE_URL);
  socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
  socketUrl.searchParams.set("token", token);

  scribbleTokenLog("request.accepted", {
    apiBaseUrl: API_BASE_URL,
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
