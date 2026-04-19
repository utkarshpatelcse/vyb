export function buildCorsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers":
      "authorization,content-type,x-demo-user-id,x-demo-email,x-demo-display-name,x-request-id,x-vyb-internal-key"
  };
}

export function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...buildCorsHeaders(),
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
