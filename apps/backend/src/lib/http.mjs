function isLocalDevelopmentOrigin(origin) {
  try {
    const parsed = new URL(origin);
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function getConfiguredCorsOrigins() {
  return (process.env.VYB_CORS_ALLOWED_ORIGINS ?? process.env.VYB_WEB_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function resolveCorsAllowOrigin(origin) {
  if (typeof origin !== "string" || !origin.trim()) {
    return null;
  }

  const normalized = origin.trim();
  const allowedOrigins = getConfiguredCorsOrigins();

  if (allowedOrigins.includes(normalized)) {
    return normalized;
  }

  if (process.env.NODE_ENV !== "production" && isLocalDevelopmentOrigin(normalized)) {
    return normalized;
  }

  return null;
}

export function attachCorsContext(response, request) {
  response.__vybCorsAllowOrigin = resolveCorsAllowOrigin(request.headers.origin);
}

export function buildCorsHeaders(allowOrigin = null) {
  const headers = {
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers":
      "authorization,content-type,x-demo-user-id,x-demo-email,x-demo-display-name,x-request-id,x-vyb-internal-key"
  };

  if (allowOrigin) {
    headers["access-control-allow-origin"] = allowOrigin;
    headers.vary = "Origin";
  }

  return headers;
}

export function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...buildCorsHeaders(response.__vybCorsAllowOrigin ?? null),
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

export function sendError(response, statusCode, code, message, details = null, extraHeaders = {}) {
  sendJson(
    response,
    statusCode,
    {
      error: {
        code,
        message,
        details
      }
    },
    extraHeaders
  );
}

export async function readTextBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return "";
  }

  return Buffer.concat(chunks).toString("utf8");
}

export async function readJson(request) {
  const body = await readTextBody(request);
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
