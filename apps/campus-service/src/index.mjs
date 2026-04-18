import { createServer } from "node:http";
import { ensureMembershipContext, loadRootEnv } from "../../../packages/config/src/index.mjs";

const port = Number(process.env.PORT ?? 4102);
loadRootEnv();

const communities = [
  { id: "community-general", name: "Campus Square", type: "general", memberCount: 1480 },
  { id: "community-batch", name: "CS Batch 2028", type: "batch", memberCount: 184 },
  { id: "community-hostel", name: "Boys Hostel A", type: "hostel", memberCount: 96 }
];

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

function hasActor(request) {
  return typeof request.headers["x-demo-user-id"] === "string" && typeof request.headers["x-demo-email"] === "string";
}

function buildViewer(request) {
  if (!hasActor(request)) {
    return null;
  }

  return {
    firebaseUid: request.headers["x-demo-user-id"],
    primaryEmail: request.headers["x-demo-email"],
    displayName:
      typeof request.headers["x-demo-display-name"] === "string"
        ? request.headers["x-demo-display-name"]
        : "Vyb Explorer"
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      service: "campus-service",
      status: "ok",
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/communities/my") {
    if (!hasActor(request)) {
      sendJson(response, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Viewer context is required."
        }
      });
      return;
    }

    const viewer = buildViewer(request);
    if (viewer) {
      try {
        const live = await ensureMembershipContext(viewer);
        if (live.tenant && live.membership) {
          sendJson(response, 200, {
            tenant: {
              id: live.tenant.id,
              name: live.tenant.name,
              slug: live.tenant.slug
            },
            communities: live.communities.map((item) => ({
              id: item.community.id,
              name: item.community.name,
              type: item.community.type,
              memberCount: 1
            }))
          });
          return;
        }
      } catch {
        // fall through to starter response
      }
    }

    sendJson(response, 200, {
      tenant: {
        id: "tenant-demo",
        name: "Vyb Demo Institute",
        slug: "vyb-demo"
      },
      communities
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/internal/memberships/bootstrap") {
    const payload = await readJson(request);
    sendJson(response, 200, {
      tenantMatch: payload.emailDomain === "vyb.local" ? "matched" : "manual-review",
      membership: {
        tenantId: "tenant-demo",
        verificationStatus: payload.emailDomain === "vyb.local" ? "verified" : "pending"
      }
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/internal/access/resolve") {
    const payload = await readJson(request);
    sendJson(response, 200, {
      allowed: Boolean(payload.tenantId),
      context: {
        tenantId: payload.tenantId ?? "tenant-demo",
        communityId: payload.communityId ?? null,
        action: payload.action ?? "read"
      }
    });
    return;
  }

  sendJson(response, 404, { error: `Unknown route ${url.pathname}` });
});

server.listen(port, () => {
  console.log(`[campus-service] listening on http://localhost:${port}`);
});
