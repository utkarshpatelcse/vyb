import { createServer } from "node:http";
import { loadRootEnv } from "../../../packages/config/src/index.mjs";
import { buildCorsHeaders, sendError, sendJson } from "./lib/http.mjs";
import { createRequestContext } from "./lib/request-context.mjs";
import { launchCollege } from "./modules/identity/college-access.mjs";
import { getCampusModuleHealth, handleCampusRoute } from "./modules/campus/index.mjs";
import { getIdentityModuleHealth, handleIdentityRoute } from "./modules/identity/index.mjs";
import { getResourcesModuleHealth, handleResourcesRoute } from "./modules/resources/index.mjs";
import { getSocialModuleHealth, handleSocialRoute } from "./modules/social/index.mjs";

loadRootEnv();

const port = Number(process.env.PORT ?? 4000);
const routeHandlers = [handleIdentityRoute, handleCampusRoute, handleSocialRoute, handleResourcesRoute];

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const context = createRequestContext(request);
  const startedAt = Date.now();

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      ...buildCorsHeaders(),
      "x-request-id": context.requestId
    });
    response.end();
    return;
  }

  response.on("finish", () => {
    const actorLabel = context.actor ? `${context.actor.id}:${context.actor.email}` : "anonymous";
    console.log(
      `[backend] ${context.requestId} ${request.method} ${url.pathname} ${response.statusCode} ${Date.now() - startedAt}ms actor=${actorLabel}`
    );
  });

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
          getResourcesModuleHealth()
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
          summary:
            "Vyb is building the digital operating system for verified campus life, starting with KIET Group of Institutions Delhi-NCR."
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

  for (const handler of routeHandlers) {
    // Each module decides whether it owns the route and writes the response directly.
    if (await handler({ request, response, url, context })) {
      return;
    }
  }

  sendError(response, 404, "ROUTE_NOT_FOUND", `Unknown route ${url.pathname}`, null, {
    "x-request-id": context.requestId
  });
});

server.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
});
