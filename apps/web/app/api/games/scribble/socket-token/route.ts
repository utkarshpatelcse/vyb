import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import {
  REALTIME_SOCKET_PATHS,
  buildRealtimeSocketError,
  buildRealtimeSocketTokenResponse,
  withRealtimeSocketExpiry
} from "../../../../../src/lib/realtime-socket-token";

function scribbleTokenLog(event: string, details: Record<string, unknown> = {}, level: "log" | "warn" | "error" = "log") {
  console[level](`[scribble-token] ${event}`, {
    at: new Date().toISOString(),
    ...details
  });
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
    return buildRealtimeSocketError(401, "UNAUTHENTICATED", "You must sign in before opening Scribble.");
  }

  const payload = withRealtimeSocketExpiry({
    tenantId: viewer.tenantId,
    userId: viewer.userId,
    membershipId: viewer.membershipId,
    displayName: viewer.displayName || getViewerUsername(viewer.email),
    username: getViewerUsername(viewer.email)
  });
  const { response, socketUrl } = buildRealtimeSocketTokenResponse(request, {
    path: REALTIME_SOCKET_PATHS.scribble,
    payload,
    responseExtras: {
      viewer: {
        userId: payload.userId,
        membershipId: payload.membershipId,
        username: payload.username,
        displayName: payload.displayName
      }
    }
  });

  scribbleTokenLog("request.accepted", {
    wsOrigin: socketUrl.origin,
    tenantId: payload.tenantId,
    userId: payload.userId,
    membershipId: payload.membershipId,
    username: payload.username,
    displayName: payload.displayName,
    expiresAt: payload.exp
  });

  return response;
}
