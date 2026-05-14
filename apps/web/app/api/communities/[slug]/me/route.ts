import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getCommunityViewerState,
  isBackendRequestError,
  updateCommunityViewerState
} from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before viewing community settings."
        }
      },
      { status: 401 }
    );
  }

  const { slug } = await context.params;

  try {
    return NextResponse.json(await getCommunityViewerState(viewer, slug));
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
          code: "COMMUNITY_STATE_UNAVAILABLE",
          message: "Community settings are unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before changing community settings."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        muted?: boolean;
        pinned?: boolean;
        membershipAction?: "leave" | "request_join" | "cancel_request";
      }
    | null;

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

  const { slug } = await context.params;

  try {
    return NextResponse.json(await updateCommunityViewerState(viewer, slug, payload));
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
          code: "COMMUNITY_STATE_UNAVAILABLE",
          message: "Community settings are unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
