import { randomUUID } from "node:crypto";
import { getFirebaseAdminAuth } from "../../../../packages/config/src/index.mjs";
import { isTrustedInternalApiKey } from "./internal-auth.mjs";

function buildActor({ id, email, displayName = null }) {
  return {
    id,
    email,
    displayName
  };
}

function readBearerToken(request) {
  const authorization = request.headers.authorization;

  if (typeof authorization !== "string") {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/iu);
  return match?.[1]?.trim() || null;
}

export async function createRequestContext(request) {
  const requestId =
    typeof request.headers["x-request-id"] === "string" && request.headers["x-request-id"].trim()
      ? request.headers["x-request-id"]
      : randomUUID();

  const providedInternalKey = request.headers["x-vyb-internal-key"];
  const isTrustedInternalRequest = isTrustedInternalApiKey(providedInternalKey);

  if (isTrustedInternalRequest) {
    const actorId = request.headers["x-demo-user-id"];
    const actorEmail = request.headers["x-demo-email"];
    const actorDisplayName = request.headers["x-demo-display-name"];

    const actor =
      typeof actorId === "string" && typeof actorEmail === "string"
        ? buildActor({
            id: actorId,
            email: actorEmail,
            displayName: typeof actorDisplayName === "string" ? actorDisplayName : null
          })
        : null;

    return {
      requestId,
      actor,
      isTrustedInternalRequest,
      authSource: actor ? "internal" : "anonymous"
    };
  }

  const bearerToken = readBearerToken(request);
  if (!bearerToken) {
    return {
      requestId,
      actor: null,
      isTrustedInternalRequest,
      authSource: "anonymous"
    };
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(bearerToken, true);
    const email = typeof decoded.email === "string" ? decoded.email.trim().toLowerCase() : null;

    if (!email) {
      return {
        requestId,
        actor: null,
        isTrustedInternalRequest,
        authSource: "firebase",
        authError: "EMAIL_REQUIRED"
      };
    }

    return {
      requestId,
      actor: buildActor({
        id: decoded.uid,
        email,
        displayName: typeof decoded.name === "string" ? decoded.name : null
      }),
      isTrustedInternalRequest,
      authSource: "firebase"
    };
  } catch (error) {
    return {
      requestId,
      actor: null,
      isTrustedInternalRequest,
      authSource: "firebase",
      authError: error instanceof Error ? error.message : "unknown"
    };
  }
}
