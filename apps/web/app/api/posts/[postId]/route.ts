import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteCampusPost, updateCampusPost } from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

export async function DELETE(
  _request: NextRequest,
  context: {
    params: Promise<any>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before deleting a post."
        }
      },
      { status: 401 }
    );
  }

  const { postId } = (await context.params) as { postId: string };

  try {
    return NextResponse.json(await deleteCampusPost(viewer, postId));
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: error instanceof Error ? error.message : "The delete service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<any>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before editing a post."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        title?: string | null;
        body?: string | null;
        location?: string | null;
      }
    | null;

  if (!payload || typeof payload !== "object") {
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

  const { postId } = (await context.params) as { postId: string };

  try {
    return NextResponse.json(
      await updateCampusPost(viewer, postId, {
        title: payload.title ?? null,
        body: payload.body ?? null,
        location: payload.location ?? null
      })
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: error instanceof Error ? error.message : "The edit service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
