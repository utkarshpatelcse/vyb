import { createHmac, timingSafeEqual } from "node:crypto";
import { WebSocketServer } from "ws";
import { getConfiguredInternalApiKey } from "../../lib/internal-auth.mjs";

const SOCIAL_SOCKET_PATH = "/ws/social";
const subscriptionsByTenant = new Map();

function signPayload(encodedPayload) {
  const secret = getConfiguredInternalApiKey();
  return secret ? createHmac("sha256", secret).update(encodedPayload).digest("base64url") : null;
}

function verifySocialSocketToken(token) {
  if (typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  if (!expectedSignature) {
    return null;
  }
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
      typeof payload?.email !== "string" ||
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
  const key = auth.tenantId;
  const current = subscriptionsByTenant.get(key) ?? new Set();
  ws.__socialAuth = auth;
  current.add(ws);
  subscriptionsByTenant.set(key, current);

  ws.on("close", () => {
    const listeners = subscriptionsByTenant.get(key);
    if (!listeners) {
      return;
    }

    listeners.delete(ws);
    if (listeners.size === 0) {
      subscriptionsByTenant.delete(key);
    }
  });
}

export function attachSocialWebSocketServer(server, { authorizeConnection }) {
  const wsServer = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname !== SOCIAL_SOCKET_PATH) {
      return;
    }

    const auth = verifySocialSocketToken(url.searchParams.get("token"));
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
            type: "social.connected",
            tenantId: auth.tenantId
          })
        );
      });
    } catch (error) {
      console.error("[social] websocket-upgrade-failed", {
        tenantId: auth.tenantId,
        userId: auth.userId,
        message: error instanceof Error ? error.message : "unknown"
      });
      rejectUpgrade(socket, 500, "Internal Server Error");
    }
  });
}

export function emitSocialRealtimeEvent({ tenantId, type, payload, excludeMembershipId = null }) {
  if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
    return;
  }

  const listeners = subscriptionsByTenant.get(tenantId);
  if (!listeners || listeners.size === 0) {
    return;
  }

  const message = JSON.stringify({
    type,
    tenantId,
    payload
  });

  for (const ws of listeners) {
    if (ws.readyState !== 1) {
      continue;
    }

    if (excludeMembershipId && ws.__socialAuth?.membershipId === excludeMembershipId) {
      continue;
    }

    ws.send(message);
  }
}
