import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { CommentReactionResponse } from "@vyb/contracts";
import { isBackendRequestError, reactToComment } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import {
  notifySocialCommentReactionUpdated,
  type SocialCommentNotificationContext
} from "../../../../../src/lib/notification-events";

export async function PUT(
  _request: Request,
  context: {
    params: Promise<{
      commentId: string;
    }>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before reacting to a comment."
        }
      },
      { status: 401 }
    );
  }

  const { commentId } = await context.params;

  try {
    const result = (await reactToComment(viewer, commentId)) as CommentReactionResponse & {
      notificationContext?: SocialCommentNotificationContext;
    };

    await notifySocialCommentReactionUpdated(viewer, result, result.notificationContext ?? null).catch((notificationError) => {
      console.warn("[notifications] social.reaction.comment failed", {
        commentId,
        message: notificationError instanceof Error ? notificationError.message : "unknown"
      });
    });

    return NextResponse.json(result);
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
          code: "BACKEND_UNAVAILABLE",
          message: error instanceof Error ? error.message : "The comment reaction service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
