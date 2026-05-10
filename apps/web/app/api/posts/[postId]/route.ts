import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteCampusPost, isBackendRequestError, updateCampusPost } from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

function buildPostMutationError(error: unknown, fallbackCode: string, fallbackMessage: string) {
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

  console.error("[api/posts] mutation failed", error);
  return NextResponse.json(
    {
      error: {
        code: fallbackCode,
        message: fallbackMessage
      }
    },
    { status: 500 }
  );
}

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
    return buildPostMutationError(error, "POST_DELETE_FAILED", "We could not delete this post right now.");
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
        allowAnonymousComments?: boolean;
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
        location: payload.location ?? null,
        allowAnonymousComments: payload.allowAnonymousComments
      })
    );
  } catch (error) {
    return buildPostMutationError(error, "POST_UPDATE_FAILED", "We could not edit this post right now.");
  }
}
