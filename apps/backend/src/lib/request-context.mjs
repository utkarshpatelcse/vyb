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

async function verifyFirebaseBearerToken(token) {
  const auth = getFirebaseAdminAuth();
  try {
    return await auth.verifyIdToken(token, true);
  } catch (idTokenError) {
    try {
      return await auth.verifySessionCookie(token, true);
    } catch (sessionCookieError) {
      throw idTokenError instanceof Error ? idTokenError : sessionCookieError;
    }
  }
}

export async function createRequestContext(request) {
  const requestId =
    typeof request.headers["x-request-id"] === "string" && request.headers["x-request-id"].trim()
      ? request.headers["x-request-id"]
      : randomUUID();

  const providedInternalKey = request.headers["x-vyb-internal-key"];
  const isTrustedInternalRequest = isTrustedInternalApiKey(providedInternalKey);
  const allowInternalHeaderActor =
    process.env.NODE_ENV !== "production" || process.env.VYB_ALLOW_INTERNAL_HEADER_AUTH === "1";

  if (isTrustedInternalRequest && allowInternalHeaderActor) {
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

  if (isTrustedInternalRequest) {
    return {
      requestId,
      actor: null,
      isTrustedInternalRequest,
      authSource: "internal"
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
    const decoded = await verifyFirebaseBearerToken(bearerToken);
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

    if (decoded.email_verified === false) {
      return {
        requestId,
        actor: null,
        isTrustedInternalRequest,
        authSource: "firebase",
        authError: "EMAIL_NOT_VERIFIED"
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
