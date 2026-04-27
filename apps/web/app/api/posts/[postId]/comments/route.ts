import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createPostComment, getPostComments } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      postId: string;
    }>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before viewing comments."
        }
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "50");
  const { postId } = await context.params;

  try {
    return NextResponse.json(await getPostComments(viewer, postId, Number.isInteger(limit) && limit > 0 ? limit : 50));
  } catch {
    return NextResponse.json({
      postId,
      items: []
    });
  }
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      postId: string;
    }>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before commenting."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        body?: string;
        parentCommentId?: string | null;
        mediaUrl?: string | null;
        mediaType?: "image" | "gif" | "sticker" | null;
        mediaMimeType?: string | null;
        mediaSizeBytes?: number | null;
        isAnonymous?: boolean;
      }
    | null;

  if (!payload?.body && !payload?.mediaUrl) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_COMMENT",
          message: "Comment text or GIF/sticker media is required."
        }
      },
      { status: 400 }
    );
  }

  const { postId } = await context.params;

  try {
    return NextResponse.json(
      await createPostComment(viewer, postId, {
        body: payload.body,
        parentCommentId: payload.parentCommentId ?? null,
        mediaUrl: payload.mediaUrl ?? null,
        mediaType: payload.mediaType ?? null,
        mediaMimeType: payload.mediaMimeType ?? null,
        mediaSizeBytes: payload.mediaSizeBytes ?? null,
        isAnonymous: payload.isAnonymous === true
      }),
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: error instanceof Error ? error.message : "The comment service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}

