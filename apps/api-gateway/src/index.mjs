import { createServer } from "node:http";
import { createRequestContext, buildUpstreamHeaders } from "./lib/auth-context.mjs";
import { buildCorsHeaders, readBody, sendError, sendJson } from "./lib/http.mjs";

const port = Number(process.env.PORT ?? 4000);
const identityServiceUrl = process.env.IDENTITY_SERVICE_URL ?? "http://localhost:4101";
const campusServiceUrl = process.env.CAMPUS_SERVICE_URL ?? "http://localhost:4102";
const socialServiceUrl = process.env.SOCIAL_SERVICE_URL ?? "http://localhost:4103";
const resourcesServiceUrl = process.env.RESOURCES_SERVICE_URL ?? "http://localhost:4104";

function notFound(response, path) {
  sendJson(response, 404, { error: `No route registered for ${path}` });
}

async function proxyJson({ request, response, targetUrl, context, requireActor = false }) {
  if (requireActor && !context.actor) {
    sendError(response, 401, "UNAUTHENTICATED", "Authenticated viewer context is required for this route.", null, {
      "x-request-id": context.requestId
    });
    return;
  }

  try {
    const body = await readBody(request);
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: buildUpstreamHeaders(request, context),
      body
    });

    const payload = await upstream.text();
    response.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      ...buildCorsHeaders(),
      "x-request-id": context.requestId
    });
    response.end(payload);
  } catch (error) {
    sendError(
      response,
      502,
      "UPSTREAM_UNAVAILABLE",
      "Unable to reach an internal service from the gateway.",
      error instanceof Error ? error.message : "unknown",
      {
        "x-request-id": context.requestId
      }
    );
  }
}

async function readServiceHealth(service, baseUrl) {
  try {
    const upstream = await fetch(`${baseUrl}/health`);
    const payload = await upstream.json();
    return { service, ok: upstream.ok, payload };
  } catch (error) {
    return {
      service,
      ok: false,
      payload: { service, status: "down", reason: error instanceof Error ? error.message : "unknown" }
    };
  }
}

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
    console.log(`[api-gateway] ${context.requestId} ${request.method} ${url.pathname} ${response.statusCode} ${Date.now() - startedAt}ms actor=${actorLabel}`);
  });

  if (request.method === "GET" && url.pathname === "/health") {
    const downstream = await Promise.all([
      readServiceHealth("identity-service", identityServiceUrl),
      readServiceHealth("campus-service", campusServiceUrl),
      readServiceHealth("social-service", socialServiceUrl),
      readServiceHealth("resources-service", resourcesServiceUrl)
    ]);

    sendJson(response, 200, {
      service: "api-gateway",
      status: "ok",
      timestamp: new Date().toISOString(),
      downstream
    }, {
      "x-request-id": context.requestId
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/client-shell") {
    sendJson(response, 200, {
      shell: "pwa-first",
      mobileInstallable: true,
      desktopResponsive: true,
      nativeReadyContracts: true
    }, {
      "x-request-id": context.requestId
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/auth/bootstrap") {
    await proxyJson({
      request,
      response,
      targetUrl: `${identityServiceUrl}/v1/auth/bootstrap`,
      context,
      requireActor: true
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/me") {
    await proxyJson({
      request,
      response,
      targetUrl: `${identityServiceUrl}/v1/me`,
      context,
      requireActor: true
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/communities/my") {
    await proxyJson({
      request,
      response,
      targetUrl: `${campusServiceUrl}/v1/communities/my`,
      context,
      requireActor: true
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/feed") {
    await proxyJson({
      request,
      response,
      targetUrl: `${socialServiceUrl}${url.pathname}${url.search}`,
      context,
      requireActor: true
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/posts") {
    await proxyJson({
      request,
      response,
      targetUrl: `${socialServiceUrl}/v1/posts`,
      context,
      requireActor: true
    });
    return;
  }

  if (request.method === "POST" && /^\/v1\/posts\/[^/]+\/comments$/.test(url.pathname)) {
    await proxyJson({
      request,
      response,
      targetUrl: `${socialServiceUrl}${url.pathname}`,
      context,
      requireActor: true
    });
    return;
  }

  if (request.method === "PUT" && /^\/v1\/posts\/[^/]+\/reactions$/.test(url.pathname)) {
    await proxyJson({
      request,
      response,
      targetUrl: `${socialServiceUrl}${url.pathname}`,
      context,
      requireActor: true
    });
    return;
  }

  if (request.method === "GET" && (url.pathname === "/v1/resources" || /^\/v1\/resources\/[^/]+$/.test(url.pathname))) {
    await proxyJson({
      request,
      response,
      targetUrl: `${resourcesServiceUrl}${url.pathname}${url.search}`,
      context,
      requireActor: true
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/resources") {
    await proxyJson({
      request,
      response,
      targetUrl: `${resourcesServiceUrl}/v1/resources`,
      context,
      requireActor: true
    });
    return;
  }

  notFound(response, url.pathname);
});

server.listen(port, () => {
  console.log(`[api-gateway] listening on http://localhost:${port}`);
});
