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
    return buildRealtimeSocketError(401, "UNAUTHENTICATED", "You must sign in before opening realtime chat.");
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId")?.trim() ?? "";
  if (!conversationId) {
    return buildRealtimeSocketError(400, "INVALID_CONVERSATION", "Choose a valid conversation first.");
  }

  const payload = withRealtimeSocketExpiry({
    tenantId: viewer.tenantId,
    userId: viewer.userId,
    membershipId: viewer.membershipId,
    conversationId
  });

  return buildRealtimeSocketTokenResponse(request, {
    path: REALTIME_SOCKET_PATHS.chat,
    payload
  }).response;
}
