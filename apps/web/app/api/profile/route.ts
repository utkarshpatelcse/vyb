import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { UpsertProfileRequest } from "@vyb/contracts";
import { onboardingProfileSchema } from "../../../../../packages/validation/src/index";
import { fetchBackendJson, proxyBackendMutation } from "../../../src/lib/backend";
import {
  DEV_SESSION_COOKIE,
  encodeDevSession,
  PROFILE_COMPLETION_COOKIE,
  readDevSessionFromCookieStore
} from "../../../src/lib/dev-session";

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before accessing your profile."
        }
      },
      { status: 401 }
    );
  }

  try {
    const profile = await fetchBackendJson("/v1/profile", viewer);
    return NextResponse.json(profile);
  } catch (error) {
    console.error("[web/profile] get-failed", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      {
        error: {
          code: "PROFILE_SERVICE_UNAVAILABLE",
          message: "The profile service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const viewer = readDevSessionFromCookieStore(cookieStore);

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before updating your profile."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as UpsertProfileRequest | null;
  if (!payload) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON."
        }
      },
      { status: 400 }
    );
  }

  const parsedPayload = onboardingProfileSchema.safeParse(payload);
  if (!parsedPayload.success) {
    console.warn("[web/profile] invalid-profile", {
      issues: parsedPayload.error.issues
    });
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PROFILE",
          message: parsedPayload.error.issues[0]?.message ?? "Profile data is invalid.",
          details: parsedPayload.error.flatten()
        }
      },
      { status: 400 }
    );
  }

  try {
    const upstream = await proxyBackendMutation(
      "/v1/profile",
      "PUT",
      {
        ...parsedPayload.data,
        bio: parsedPayload.data.bio?.trim() || null,
        branch: parsedPayload.data.stream
      },
      viewer
    );
    const responseText = await upstream.text();
    const parsed = responseText
      ? (() => {
          try {
            return JSON.parse(responseText) as {
              error?: {
                code?: string;
                message?: string;
                details?: unknown;
              };
              profile?: {
                fullName?: string;
              };
            };
          } catch {
            return {
              error: {
                code: "UPSTREAM_INVALID_RESPONSE",
                message: responseText
              }
            };
          }
        })()
      : {};

    if (!upstream.ok) {
      console.warn("[web/profile] upstream-save-failed", {
        status: upstream.status,
        code: parsed?.error?.code ?? null
      });
    }

    if (upstream.ok && parsed?.profile?.fullName) {
      cookieStore.set(
        DEV_SESSION_COOKIE,
        encodeDevSession({
          ...viewer,
          displayName: parsed.profile.fullName
        }),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 8
        }
      );
      cookieStore.set(PROFILE_COMPLETION_COOKIE, "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 8
      });
    }

    return NextResponse.json(parsed, { status: upstream.status });
  } catch (error) {
    console.error("[web/profile] save-failed", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      {
        error: {
          code: "PROFILE_SAVE_FAILED",
          message: "We could not save your profile right now."
        }
      },
      { status: 502 }
    );
  }
}
