import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SessionBootstrapRequest, SessionBootstrapResponse } from "@vyb/contracts";
import { bootstrapViewerSession } from "../../../../src/lib/backend";
import {
  createViewerSession,
  DEV_SESSION_COOKIE,
  encodeDevSession,
  PROFILE_COMPLETION_COOKIE
} from "../../../../src/lib/dev-session";

export const runtime = "nodejs";

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
  cookieStore.delete(PROFILE_COMPLETION_COOKIE);

  return NextResponse.json({
    cleared: true
  });
}
