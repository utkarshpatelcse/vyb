import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deletePostComment, isBackendRequestError } from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      commentId: string;
    }>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
  }

  const { commentId } = await context.params;
  if (!commentId?.trim()) {
    return NextResponse.json({ error: { code: "INVALID_COMMENT", message: "commentId is required." } }, { status: 400 });
  }

  try {
    return NextResponse.json(await deletePostComment(viewer, commentId));
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

    console.error("[api/comments] delete failed", error);
    return NextResponse.json(
      { error: { code: "COMMENT_DELETE_FAILED", message: "We could not delete that comment right now." } },
      { status: 500 }
    );
  }
}
