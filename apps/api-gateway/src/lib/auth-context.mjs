import { randomUUID } from "node:crypto";

export function createRequestContext(request) {
  const requestId =
    typeof request.headers["x-request-id"] === "string" && request.headers["x-request-id"].trim()
      ? request.headers["x-request-id"]
      : randomUUID();

  const actorId = request.headers["x-demo-user-id"];
  const actorEmail = request.headers["x-demo-email"];
  const actorDisplayName = request.headers["x-demo-display-name"];

  const actor =
    typeof actorId === "string" && typeof actorEmail === "string"
      ? {
          id: actorId,
          email: actorEmail,
          displayName: typeof actorDisplayName === "string" ? actorDisplayName : null
        }
      : null;

  return { requestId, actor };
}

export function buildUpstreamHeaders(request, context) {
  const headers = {
    "x-request-id": context.requestId
  };

  if (typeof request.headers.authorization === "string") {
    headers.authorization = request.headers.authorization;
  }

  if (typeof request.headers["content-type"] === "string") {
    headers["content-type"] = request.headers["content-type"];
  } else {
    headers["content-type"] = "application/json";
  }

  if (context.actor) {
    headers["x-demo-user-id"] = context.actor.id;
    headers["x-demo-email"] = context.actor.email;

    if (context.actor.displayName) {
      headers["x-demo-display-name"] = context.actor.displayName;
    }
  }

  return headers;
}
