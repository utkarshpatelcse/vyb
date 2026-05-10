import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../lib/dev-session";
import { ChatPresenceHeartbeat } from "./chat-presence-heartbeat";

export async function AuthenticatedChatPresenceHeartbeat() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return null;
  }

  return <ChatPresenceHeartbeat />;
}
