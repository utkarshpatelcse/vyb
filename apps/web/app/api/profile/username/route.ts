import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { usernameSchema } from "../../../../../../packages/validation/src/index";
import { proxyBackendMutation } from "../../../../src/lib/backend";
import {
  DEV_SESSION_COOKIE,
  encodeDevSession,
  readDevSessionFromCookieStore
} from "../../../../src/lib/dev-session";

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const viewer = readDevSessionFromCookieStore(cookieStore);

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before changing your user ID."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        username?: string;
      }
    | null;

  const parsed = usernameSchema.safeParse(payload?.username ?? "");
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_USERNAME",
          message: parsed.error.issues[0]?.message ?? "User ID is invalid."
        }
      },
      { status: 400 }
    );
  }

  try {
    const upstream = await proxyBackendMutation(
      "/v1/profile/username",
      "PATCH",
      {
        username: parsed.data
      },
      viewer
    );

    const body = await upstream.text();
    const parsedBody = body
      ? (() => {
          try {
            return JSON.parse(body);
          } catch {
            return {
              error: {
                message: body
              }
            };
          }
        })()
      : {};

    if (upstream.ok && parsedBody?.profile?.fullName) {
      cookieStore.set(
        DEV_SESSION_COOKIE,
        encodeDevSession({
          ...viewer,
          displayName: parsedBody.profile.fullName
        }),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 8
        }
      );
    }

    return NextResponse.json(parsedBody, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "The profile service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
