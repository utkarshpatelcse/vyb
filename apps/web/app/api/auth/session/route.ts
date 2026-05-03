import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { SessionBootstrapRequest, SessionBootstrapResponse } from "@vyb/contracts";
import { bootstrapViewerSession, isBackendRequestError } from "../../../../src/lib/backend";
import { getFirebaseAdminAuth } from "../../../../src/lib/firebase-admin-server";
import {
  createViewerSession,
  DEV_SESSION_COOKIE,
  encodeDevSession,
  FIREBASE_SESSION_COOKIE,
  PROFILE_COMPLETION_COOKIE,
  SESSION_CSRF_COOKIE
} from "../../../../src/lib/dev-session";

export const runtime = "nodejs";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function getBootstrapErrorStatus(code: string) {
  return code === "INVALID_TOKEN"
    ? 401
    : code === "MISSING_TOKEN" || code === "INVALID_JSON" || code === "EMAIL_REQUIRED"
      ? 400
      : 403;
}

function isBackendUnavailableError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  return /fetch failed|econnrefused|enotfound|etimedout|socket hang up/i.test(error.message);
}

function buildCookieOptions(httpOnly = true) {
  return {
    httpOnly,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  };
}

function createCsrfToken() {
  return randomBytes(32).toString("base64url");
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return process.env.NODE_ENV !== "production";
  }

  return origin === new URL(request.url).origin;
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function verifySessionBootstrapRequest(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_ORIGIN",
          message: "Session requests must come from this app."
        }
      },
      { status: 403 }
    );
  }

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(SESSION_CSRF_COOKIE)?.value;
  const headerToken = request.headers.get("x-vyb-session-csrf")?.trim();

  if (!cookieToken && !headerToken) {
    return null;
  }

  if (!cookieToken || !headerToken || !timingSafeStringEqual(cookieToken, headerToken)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_CSRF_TOKEN",
          message: "Session verification failed. Refresh and try again."
        }
      },
      { status: 403 }
    );
  }

  return null;
}

async function finalizeBootstrapResponse(bootstrap: SessionBootstrapResponse, idToken: string) {
  const session = createViewerSession({
    userId: bootstrap.session.userId,
    email: bootstrap.session.email,
    displayName: bootstrap.session.displayName,
    membershipId: bootstrap.session.membershipId,
    tenantId: bootstrap.session.tenantId,
    role: bootstrap.session.role
  });

  const firebaseSessionCookie = await getFirebaseAdminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_SECONDS * 1000
  });

  const cookieStore = await cookies();
  cookieStore.set(DEV_SESSION_COOKIE, encodeDevSession(session), {
    ...buildCookieOptions(),
    maxAge: SESSION_MAX_AGE_SECONDS
  });
  cookieStore.set(FIREBASE_SESSION_COOKIE, firebaseSessionCookie, {
    ...buildCookieOptions(),
    maxAge: SESSION_MAX_AGE_SECONDS
  });
  cookieStore.set(PROFILE_COMPLETION_COOKIE, bootstrap.profileCompleted ? "1" : "0", {
    ...buildCookieOptions(),
    maxAge: SESSION_MAX_AGE_SECONDS
  });

  console.info("[web/auth/session] bootstrap:success", {
    userId: bootstrap.session.userId,
    email: bootstrap.session.email,
    nextPath: bootstrap.nextPath,
    profileCompleted: bootstrap.profileCompleted
  });

  return NextResponse.json({
    session: {
      displayName: session.displayName,
      email: session.email
    },
    profileCompleted: bootstrap.profileCompleted,
    nextPath: bootstrap.nextPath
  });
}

export async function GET() {
  const csrfToken = createCsrfToken();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_CSRF_COOKIE, csrfToken, buildCookieOptions());

  return NextResponse.json({
    csrfToken
  });
}

export async function POST(request: Request) {
  const requestError = await verifySessionBootstrapRequest(request);
  if (requestError) {
    return requestError;
  }

  const payload = (await request.json().catch(() => null)) as SessionBootstrapRequest | null;

  if (!payload?.idToken?.trim()) {
    return NextResponse.json(
      {
        error: {
          code: "MISSING_TOKEN",
          message: "Firebase ID token is required."
        }
      },
      { status: 400 }
    );
  }

  try {
    console.info("[web/auth/session] bootstrap:start", {
      hasDisplayName: Boolean(payload.displayName?.trim())
    });
    const bootstrap = await bootstrapViewerSession({
      idToken: payload.idToken.trim(),
      displayName: payload.displayName?.trim()
    });
    return finalizeBootstrapResponse(bootstrap, payload.idToken.trim());
  } catch (error) {
    const fallbackMessage = "Unable to create an authenticated session.";

    if (isBackendRequestError(error)) {
      console.warn("[web/auth/session] bootstrap:backend-rejected", {
        code: error.code,
        statusCode: error.statusCode,
        message: error.message
      });
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: null
          }
        },
        { status: getBootstrapErrorStatus(error.code) }
      );
    }

    try {
      const parsed = JSON.parse(error instanceof Error ? error.message : "{}") as {
        error?: {
          code?: string;
          message?: string;
          details?: unknown;
        };
      };

      if (parsed.error?.code) {
        console.warn("[web/auth/session] bootstrap:rejected", parsed.error);
        return NextResponse.json(
          {
            error: {
              code: parsed.error.code,
              message: parsed.error.message ?? fallbackMessage,
              details: parsed.error.details ?? null
            }
          },
          { status: getBootstrapErrorStatus(parsed.error.code) }
        );
      }
    } catch {
      // Fall through to the generic error response.
    }

    console.error("[web/auth/session] bootstrap failed", error);

    return NextResponse.json(
      {
        error: {
          code: "SESSION_BOOTSTRAP_FAILED",
          message: isBackendUnavailableError(error)
            ? "The backend authentication service is temporarily unavailable."
            : fallbackMessage
        }
      },
      { status: 502 }
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(DEV_SESSION_COOKIE);
  cookieStore.delete(FIREBASE_SESSION_COOKIE);
  cookieStore.delete(PROFILE_COMPLETION_COOKIE);

  return NextResponse.json({
    cleared: true
  });
}
