import { createHmac, timingSafeEqual } from "node:crypto";
import { WebSocketServer } from "ws";
import { canExposeChatTyping, getChatPrivacySettings } from "./privacy-settings-store.mjs";

const CHAT_SOCKET_PATH = "/ws/chat";
const subscriptionsByConversation = new Map();

function getSocketSecret() {
  return process.env.VYB_INTERNAL_API_KEY ?? "local-vyb-internal-key";
}

function signPayload(encodedPayload) {
  return createHmac("sha256", getSocketSecret()).update(encodedPayload).digest("base64url");
}

function verifyChatSocketToken(token) {
  if (typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (
      typeof payload?.tenantId !== "string" ||
      typeof payload?.userId !== "string" ||
      typeof payload?.membershipId !== "string" ||
      typeof payload?.conversationId !== "string" ||
      typeof payload?.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function rejectUpgrade(socket, statusCode, statusText) {
  socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function addSubscription(ws, auth) {
  const key = auth.conversationId;
  const current = subscriptionsByConversation.get(key) ?? new Set();
  ws.__chatAuth = auth;
  current.add(ws);
  subscriptionsByConversation.set(key, current);

  ws.on("message", (rawMessage) => {
    void handleSocketMessage(auth, rawMessage, ws);
  });

  ws.on("close", () => {
    const listeners = subscriptionsByConversation.get(key);
    if (!listeners) {
      return;
    }

    listeners.delete(ws);
    if (listeners.size === 0) {
      subscriptionsByConversation.delete(key);
    }
  });
}

async function handleSocketMessage(auth, rawMessage, ws) {
  let payload = null;

  try {
    payload = JSON.parse(String(rawMessage));
  } catch {
    return;
  }

  if (!payload?.type || !payload.payload || typeof payload.payload !== "object") {
    return;
  }

  const conversationId =
    typeof payload.payload.conversationId === "string" ? payload.payload.conversationId : auth.conversationId;
  if (conversationId !== auth.conversationId) {
    return;
  }

  if (payload.type === "chat.ping") {
    if (ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "chat.pong",
          conversationId: auth.conversationId,
          payload: {
            conversationId: auth.conversationId,
            pongAt: new Date().toISOString()
          }
        })
      );
    }
    return;
  }

  if (payload.type === "chat.delivered") {
    const rawMessageIds = Array.isArray(payload.payload.messageIds)
      ? payload.payload.messageIds
      : typeof payload.payload.messageId === "string"
        ? [payload.payload.messageId]
        : [];
    const messageIds = [...new Set(rawMessageIds.filter((messageId) => typeof messageId === "string" && messageId.trim().length > 0))]
      .slice(0, 50);

    if (messageIds.length === 0) {
      return;
    }

    emitChatRealtimeEvent({
      conversationId: auth.conversationId,
      type: "chat.delivered",
      payload: {
        conversationId: auth.conversationId,
        userId: auth.userId,
        membershipId: auth.membershipId,
        messageIds,
        deliveredAt: new Date().toISOString()
      }
    });
    return;
  }

  if (payload.type !== "chat.typing") {
    return;
  }

  const isTyping = typeof payload.payload.isTyping === "boolean" ? payload.payload.isTyping : null;
  if (isTyping === null) {
    return;
  }

  if (isTyping) {
    const settings = await getChatPrivacySettings({
      tenantId: auth.tenantId,
      userId: auth.userId
    });
    if (!canExposeChatTyping(settings)) {
      return;
    }
  }

  emitChatRealtimeEvent({
    conversationId: auth.conversationId,
    type: "chat.typing",
    payload: {
      conversationId: auth.conversationId,
      userId: auth.userId,
      membershipId: auth.membershipId,
      isTyping,
      typedAt: new Date().toISOString()
    }
  });
}

export function attachChatWebSocketServer(server, { authorizeConnection }) {
  const wsServer = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname !== CHAT_SOCKET_PATH) {
      return;
    }

    const auth = verifyChatSocketToken(url.searchParams.get("token"));
    if (!auth) {
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }

    try {
      const allowed = await authorizeConnection(auth);
      if (!allowed) {
        rejectUpgrade(socket, 403, "Forbidden");
        return;
      }

      wsServer.handleUpgrade(request, socket, head, (ws) => {
        addSubscription(ws, auth);
        ws.send(
          JSON.stringify({
            type: "chat.connected",
            conversationId: auth.conversationId
          })
        );
      });
    } catch (error) {
      console.error("[chat] websocket-upgrade-failed", {
        conversationId: auth.conversationId,
        userId: auth.userId,
        message: error instanceof Error ? error.message : "unknown"
      });
      rejectUpgrade(socket, 500, "Internal Server Error");
    }
  });
}

export function emitChatRealtimeEvent({ conversationId, type, payload }) {
  const listeners = subscriptionsByConversation.get(conversationId);
  if (!listeners || listeners.size === 0) {
    return;
  }

  const message = JSON.stringify({
    type,
    conversationId,
    payload
  });

  for (const ws of listeners) {
    if (ws.readyState === 1) {
      ws.send(message);
    }
  }
}
