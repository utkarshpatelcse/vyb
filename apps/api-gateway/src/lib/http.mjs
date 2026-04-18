export function buildCorsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-demo-user-id,x-demo-email,x-demo-display-name,x-request-id"
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

export function sendError(response, statusCode, code, message, details, extraHeaders = {}) {
  sendJson(
    response,
    statusCode,
    {
      error: {
        code,
        message,
        details: details ?? null
      }
    },
    extraHeaders
  );
}

export async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks).toString("utf8");
}
