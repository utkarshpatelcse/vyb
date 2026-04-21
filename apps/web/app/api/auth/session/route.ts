import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SessionBootstrapRequest, SessionBootstrapResponse } from "@vyb/contracts";
import { bootstrapViewerSession } from "../../../../src/lib/backend";
import { getCollegeEmailMessage, isAllowedCollegeEmail, normalizeEmail } from "../../../../src/lib/college-access";
import {
  createViewerSession,
  DEV_SESSION_COOKIE,
  encodeDevSession,
  PROFILE_COMPLETION_COOKIE
} from "../../../../src/lib/dev-session";
import { getFirebaseAdminAuth } from "../../../../src/lib/firebase-admin-server";
import { readFallbackProfile } from "../../../../src/lib/profile-fallback";

export const runtime = "nodejs";

type BootstrapRejection = Error & {
  code: string;
  status: number;
  details?: unknown;
};

function createBootstrapRejection(code: string, message: string, status: number, details?: unknown): BootstrapRejection {
  const error = new Error(message) as BootstrapRejection;
  error.code = code;
  error.status = status;
  error.details = details ?? null;
  return error;
}

function isBootstrapRejection(error: unknown): error is BootstrapRejection {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    "status" in error &&
    typeof error.status === "number"
  );
}

function getBootstrapErrorStatus(code: string) {
  return code === "INVALID_TOKEN"
    ? 401
    : code === "MISSING_TOKEN" || code === "INVALID_JSON" || code === "EMAIL_REQUIRED"
      ? 400
      : 403;
}

function looksLikeLocalApiBaseUrl() {
  const apiBase = process.env.VYB_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  if (!apiBase) {
    return false;
  }

  try {
    const parsed = new URL(apiBase);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isBackendUnavailableError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  return /fetch failed|econnrefused|enotfound|etimedout|socket hang up/i.test(error.message);
}

async function finalizeBootstrapResponse(bootstrap: SessionBootstrapResponse) {
  const session = createViewerSession({
    userId: bootstrap.session.userId,
    email: bootstrap.session.email,
    displayName: bootstrap.session.displayName,
    membershipId: bootstrap.session.membershipId,
    tenantId: bootstrap.session.tenantId,
    role: bootstrap.session.role
  });

  const cookieStore = await cookies();
  cookieStore.set(DEV_SESSION_COOKIE, encodeDevSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
  cookieStore.set(PROFILE_COMPLETION_COOKIE, bootstrap.profileCompleted ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
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

async function buildLocalBootstrap(payload: SessionBootstrapRequest): Promise<SessionBootstrapResponse> {
  let decoded;

  try {
    decoded = await getFirebaseAdminAuth().verifyIdToken(payload.idToken.trim(), true);
  } catch (error) {
    throw createBootstrapRejection("INVALID_TOKEN", "Firebase session verification failed.", 401, {
      message: error instanceof Error ? error.message : "unknown"
    });
  }

  const email = normalizeEmail(decoded.email ?? "");
  if (!email) {
    throw createBootstrapRejection("EMAIL_REQUIRED", "A verified email is required.", 400);
  }

  if (!isAllowedCollegeEmail(email)) {
    throw createBootstrapRejection("COLLEGE_DOMAIN_NOT_ALLOWED", getCollegeEmailMessage(), 403);
  }

  if (!decoded.email_verified) {
    throw createBootstrapRejection("EMAIL_NOT_VERIFIED", "Verify your college email before you continue.", 403);
  }

  const storedProfile = await readFallbackProfile(decoded.uid);
  const displayName =
    storedProfile?.fullName?.trim() ||
    payload.displayName?.trim() ||
    decoded.name?.trim() ||
    email.split("@")[0] ||
    "Vyb Student";

  const session = createViewerSession({
    userId: decoded.uid,
    email,
    displayName,
    tenantId: storedProfile?.tenantId ?? undefined,
    role: "student"
  });

  return {
    session: {
      userId: session.userId,
      email: session.email,
      displayName: session.displayName,
      membershipId: session.membershipId,
      tenantId: session.tenantId,
      role: session.role
    },
    profileCompleted: Boolean(storedProfile?.profileCompleted),
    nextPath: storedProfile?.profileCompleted ? "/home" : "/onboarding"
  };
}

export async function POST(request: Request) {
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
    return finalizeBootstrapResponse(bootstrap);
  } catch (error) {
    const fallbackMessage = "Unable to create an authenticated session.";

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

    if (looksLikeLocalApiBaseUrl() && isBackendUnavailableError(error)) {
      try {
        console.warn("[web/auth/session] bootstrap:fallback-local", {
          reason: error.message
        });
        const bootstrap = await buildLocalBootstrap(payload);
        return finalizeBootstrapResponse(bootstrap);
      } catch (fallbackError) {
        if (isBootstrapRejection(fallbackError)) {
          console.warn("[web/auth/session] bootstrap:fallback-rejected", {
            code: fallbackError.code,
            message: fallbackError.message,
            details: fallbackError.details ?? null
          });
          return NextResponse.json(
            {
              error: {
                code: fallbackError.code,
                message: fallbackError.message,
                details: fallbackError.details ?? null
              }
            },
            { status: fallbackError.status }
          );
        }

        console.error("[web/auth/session] bootstrap:fallback failed", fallbackError);
      }
    }

    console.error("[web/auth/session] bootstrap failed", error);

    return NextResponse.json(
      {
        error: {
          code: "SESSION_BOOTSTRAP_FAILED",
          message:
            error instanceof Error && error.message.includes("fetch failed")
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
  cookieStore.delete(PROFILE_COMPLETION_COOKIE);

  return NextResponse.json({
    cleared: true
  });
}
