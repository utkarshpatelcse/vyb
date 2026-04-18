import { createServer } from "node:http";
import { ensureMembershipContext, loadRootEnv } from "../../../packages/config/src/index.mjs";

const port = Number(process.env.PORT ?? 4101);
loadRootEnv();

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function buildUserContext(request) {
  const email = request.headers["x-demo-email"];
  if (typeof email !== "string") {
    return null;
  }

  const displayNameHeader = request.headers["x-demo-display-name"];
  const fallbackName = email.split("@")[0]?.replace(/[-._]+/g, " ") ?? "Vyb Explorer";

  return {
    id: typeof request.headers["x-demo-user-id"] === "string" ? request.headers["x-demo-user-id"] : "demo-user-1",
    primaryEmail: email,
    displayName: typeof displayNameHeader === "string" ? displayNameHeader : fallbackName,
    status: "active"
  };
}

async function resolveLiveContext(request) {
  const viewer = buildUserContext(request);
  if (!viewer) {
    return null;
  }

  try {
    const live = await ensureMembershipContext({
      firebaseUid: viewer.id,
      primaryEmail: viewer.primaryEmail,
      displayName: viewer.displayName
    });

    return {
      viewer,
      live
    };
  } catch {
    return {
      viewer,
      live: null
    };
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      service: "identity-service",
      status: "ok",
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/auth/bootstrap") {
    const payload = await readJson(request);
    const resolved = await resolveLiveContext(request);
    if (!resolved) {
      sendJson(response, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Viewer context is required to bootstrap identity."
        }
      });
      return;
    }
    const user = resolved.live?.user
      ? {
          id: resolved.viewer.id,
          primaryEmail: resolved.live.user.primaryEmail,
          displayName: resolved.live.user.displayName ?? resolved.viewer.displayName,
          status: resolved.live.user.status
        }
      : resolved.viewer;
    const emailDomain = String(user.primaryEmail).split("@")[1] ?? null;

    sendJson(response, 200, {
      user,
      onboarding: {
        stage: resolved.live?.membership ? "membership-pending" : "manual-review",
        displayName: payload.displayName ?? user.displayName
      },
      verification: {
        emailVerified: true,
        emailDomain
      }
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/me") {
    const resolved = await resolveLiveContext(request);
    if (!resolved) {
      sendJson(response, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Viewer context is required."
        }
      });
      return;
    }

    if (resolved.live?.membership && resolved.live.tenant) {
      sendJson(response, 200, {
        user: {
          id: resolved.viewer.id,
          primaryEmail: resolved.live.user.primaryEmail,
          displayName: resolved.live.user.displayName ?? resolved.viewer.displayName,
          status: resolved.live.user.status
        },
        membershipSummary: {
          id: resolved.live.membership.id,
          tenantId: resolved.live.tenant.id,
          role: resolved.live.membership.role,
          verificationStatus: resolved.live.membership.verificationStatus
        }
      });
      return;
    }

    sendJson(response, 200, {
      user: resolved.viewer,
      membershipSummary: {
        id: "membership-demo-1",
        tenantId: "tenant-demo",
        role: "student",
        verificationStatus: "verified"
      }
    });
    return;
  }

  sendJson(response, 404, { error: `Unknown route ${url.pathname}` });
});

server.listen(port, () => {
  console.log(`[identity-service] listening on http://localhost:${port}`);
});
