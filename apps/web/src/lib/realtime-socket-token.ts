import "server-only";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { buildClientSocketUrl } from "./client-socket-url";
import { getInternalApiKey } from "./internal-api-key";

export const REALTIME_SOCKET_TOKEN_TTL_MS = 5 * 60 * 1000;
export const REALTIME_SOCKET_PATHS = {
  chat: "/ws/chat",
  social: "/ws/social",
  scribble: "/ws/games/scribble"
} as const;

type RealtimeSocketPath = (typeof REALTIME_SOCKET_PATHS)[keyof typeof REALTIME_SOCKET_PATHS];

type RealtimeSocketTokenPayload = Record<string, unknown> & {
  exp: number;
};

type RealtimeSocketTokenResponseExtras = Record<string, unknown> & {
  wsUrl?: never;
  expiresAt?: never;
  error?: never;
};

export function buildRealtimeSocketError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function withRealtimeSocketExpiry<TPayload extends Record<string, unknown>>(
  payload: TPayload,
  now = Date.now()
): TPayload & { exp: number } {
  return {
    ...payload,
    exp: now + REALTIME_SOCKET_TOKEN_TTL_MS
  };
}

function signRealtimeSocketPayload(encodedPayload: string) {
  return createHmac("sha256", getInternalApiKey()).update(encodedPayload).digest("base64url");
}

function createRealtimeSocketToken(payload: RealtimeSocketTokenPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signRealtimeSocketPayload(encodedPayload)}`;
}

export function buildRealtimeSocketTokenResponse<TExtras extends RealtimeSocketTokenResponseExtras = Record<string, never>>(
  request: Request,
  options: {
    path: RealtimeSocketPath;
    payload: RealtimeSocketTokenPayload;
    responseExtras?: TExtras;
  }
) {
  const token = createRealtimeSocketToken(options.payload);
  const socketUrl = buildClientSocketUrl(request, options.path, token);

  return {
    socketUrl,
    response: NextResponse.json({
      ...(options.responseExtras ?? {}),
      wsUrl: socketUrl.toString(),
      expiresAt: options.payload.exp
    })
  };
}
