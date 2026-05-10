import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";
import {
  REALTIME_SOCKET_PATHS,
  buildRealtimeSocketError,
  buildRealtimeSocketTokenResponse,
  withRealtimeSocketExpiry
} from "../../../../src/lib/realtime-socket-token";

export async function GET(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return buildRealtimeSocketError(401, "UNAUTHENTICATED", "You must sign in before opening realtime social updates.");
  }

  const payload = withRealtimeSocketExpiry({
    tenantId: viewer.tenantId,
    userId: viewer.userId,
    membershipId: viewer.membershipId,
    email: viewer.email
  });

  return buildRealtimeSocketTokenResponse(request, {
    path: REALTIME_SOCKET_PATHS.social,
    payload
  }).response;
}
