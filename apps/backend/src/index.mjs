import { createServer } from "node:http";
import { loadRootEnv } from "../../../packages/config/src/index.mjs";
import { buildCorsHeaders, sendError, sendJson } from "./lib/http.mjs";
import { createRequestContext } from "./lib/request-context.mjs";
import { launchCollege } from "./modules/identity/college-access.mjs";
import { getCampusModuleHealth, handleCampusRoute } from "./modules/campus/index.mjs";
import { canOpenChatRealtimeConnection, getChatModuleHealth, handleChatRoute } from "./modules/chat/index.mjs";
import { attachChatWebSocketServer } from "./modules/chat/realtime-hub.mjs";
import { getIdentityModuleHealth, handleIdentityRoute } from "./modules/identity/index.mjs";
import { getMarketModuleHealth, handleMarketRoute } from "./modules/market/index.mjs";
import { getModerationModuleHealth, handleModerationRoute } from "./modules/moderation/index.mjs";
import { getResourcesModuleHealth, handleResourcesRoute } from "./modules/resources/index.mjs";
import { canOpenSocialRealtimeConnection, getSocialModuleHealth, handleSocialRoute } from "./modules/social/index.mjs";
import { attachSocialWebSocketServer } from "./modules/social/realtime-hub.mjs";
import {
  attachScribbleWebSocketServer,
  getScribbleModuleHealth,
  handleScribblePublicRoomsRoute
} from "./modules/games/scribble-realtime-hub.mjs";

loadRootEnv();

const port = Number(process.env.PORT ?? 4000);
const routeHandlers = [handleIdentityRoute, handleCampusRoute, handleSocialRoute, handleChatRoute, handleResourcesRoute, handleMarketRoute, handleModerationRoute];

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const context = await createRequestContext(request);
  const startedAt = Date.now();
  const actorLabel = context.actor ? `${context.actor.id}:${context.actor.email}` : "anonymous";

  response.on("finish", () => {
    console.log(
      `[backend] ${context.requestId} ${request.method} ${url.pathname} ${response.statusCode} ${Date.now() - startedAt}ms actor=${actorLabel}`
    );
  });

  try {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        ...buildCorsHeaders(),
        "x-request-id": context.requestId
      });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(
        response,
        200,
        {
          service: "backend",
          runtime: "modular-monolith",
          status: "ok",
          timestamp: new Date().toISOString(),
          modules: [
            getIdentityModuleHealth(),
            getCampusModuleHealth(),
            getSocialModuleHealth(),
            getChatModuleHealth(),
            getResourcesModuleHealth(),
            getMarketModuleHealth(),
            getModerationModuleHealth(),
            getScribbleModuleHealth()
          ]
        },
        {
          "x-request-id": context.requestId
        }
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/client-shell") {
      sendJson(
        response,
        200,
        {
          shell: "pwa-first",
          mobileInstallable: true,
          desktopResponsive: true,
          nativeReadyContracts: true,
          backendRuntime: "modular-monolith",
          launchCampus: launchCollege,
          hero: {
            eyebrow: "Verified Campus Network",
            title: "One trusted home for college identity, community, and utility.",
            summary: "Vyb is a multi-tenant platform for verified campus life, built to onboard one trusted campus at a time."
          },
          pillars: [
            {
              title: "Trusted Identity",
              description: "Access begins with a verified college email so every interaction stays inside the right campus boundary."
            },
            {
              title: "Useful Community",
              description: "Students should land inside relevant college, branch, batch, and hostel spaces instead of scattered chat groups."
            },
            {
              title: "Daily Utility",
              description: "Notes, resources, and the social layer should work together so the product earns repeat use."
            }
          ],
          phaseOne: [
            "College-scoped authentication and onboarding",
            "Verified communities and membership routing",
            "Campus feed for text and image posts",
            "Academic resource vault",
            "Moderation-aware backend foundation"
          ],
          trustPoints: [
            "Single backend runtime for simpler Phase 1 delivery",
            "Responsive web now, native-ready contracts later",
            "Strict tenant boundaries across every authenticated flow"
          ]
        },
        {
          "x-request-id": context.requestId
        }
      );
      return;
    }

    if (await handleScribblePublicRoomsRoute({ request, response, url, context })) {
      return;
    }

    for (const handler of routeHandlers) {
      // Each module decides whether it owns the route and writes the response directly.
      if (await handler({ request, response, url, context })) {
        return;
      }
    }

    sendError(response, 404, "ROUTE_NOT_FOUND", `Unknown route ${url.pathname}`, null, {
      "x-request-id": context.requestId
    });
  } catch (error) {
    try {
      require("fs").appendFileSync(
        "backend_crash.log",
        "ERROR:\n" + (error instanceof Error ? error.stack : String(error)) + "\n"
      );
    } catch (e) {}

    console.error(`[backend] ${context.requestId} unhandled-request-error`, {
      method: request.method,
      path: url.pathname,
      actor: actorLabel,
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : null
    });

    if (!response.headersSent) {
      sendError(response, 500, "INTERNAL_ERROR", "We could not process this request right now.", null, {
        "x-request-id": context.requestId
      });
      return;
    }

    response.end();
  }
});

attachChatWebSocketServer(server, {
  authorizeConnection: canOpenChatRealtimeConnection
});

attachSocialWebSocketServer(server, {
  authorizeConnection: canOpenSocialRealtimeConnection
});

attachScribbleWebSocketServer(server);

server.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
});
