import { randomUUID } from "node:crypto";

export function createRequestContext(request) {
  const requestId =
    typeof request.headers["x-request-id"] === "string" && request.headers["x-request-id"].trim()
      ? request.headers["x-request-id"]
      : randomUUID();

  const internalApiKey = process.env.VYB_INTERNAL_API_KEY ?? "local-vyb-internal-key";
  const providedInternalKey = request.headers["x-vyb-internal-key"];
  const isTrustedInternalRequest =
    typeof providedInternalKey === "string" && providedInternalKey === internalApiKey;

  const actorId = isTrustedInternalRequest ? request.headers["x-demo-user-id"] : null;
  const actorEmail = isTrustedInternalRequest ? request.headers["x-demo-email"] : null;
  const actorDisplayName = isTrustedInternalRequest ? request.headers["x-demo-display-name"] : null;

  const actor =
    typeof actorId === "string" && typeof actorEmail === "string"
      ? {
          id: actorId,
          email: actorEmail,
          displayName: typeof actorDisplayName === "string" ? actorDisplayName : null
        }
      : null;

  return { requestId, actor, isTrustedInternalRequest };
}
