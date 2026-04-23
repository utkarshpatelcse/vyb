import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

const API_BASE_URL =
  process.env.VYB_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const INTERNAL_API_KEY = process.env.VYB_INTERNAL_API_KEY ?? "local-vyb-internal-key";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", INTERNAL_API_KEY).update(encodedPayload).digest("base64url");
}

export async function GET(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before opening realtime chat.");
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId")?.trim() ?? "";
  if (!conversationId) {
    return buildError(400, "INVALID_CONVERSATION", "Choose a valid conversation first.");
  }

  const payload = {
    tenantId: viewer.tenantId,
    userId: viewer.userId,
    membershipId: viewer.membershipId,
    conversationId,
    exp: Date.now() + 5 * 60 * 1000
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const token = `${encodedPayload}.${signPayload(encodedPayload)}`;
  const socketUrl = new URL("/ws/chat", API_BASE_URL);
  socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
  socketUrl.searchParams.set("token", token);

  return NextResponse.json({
    wsUrl: socketUrl.toString(),
    expiresAt: payload.exp
  });
}
