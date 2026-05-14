import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createCommunityInvite, isBackendRequestError } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before creating an invite."
        }
      },
      { status: 401 }
    );
  }

  const { slug } = await context.params;
  const origin = new URL(request.url).origin;

  try {
    return NextResponse.json(await createCommunityInvite(viewer, slug, origin), { status: 201 });
  } catch (error) {
    if (isBackendRequestError(error)) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message
          }
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "COMMUNITY_INVITE_UNAVAILABLE",
          message: "We could not create an invite right now."
        }
      },
      { status: 502 }
    );
  }
}
