import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ReactionResponse } from "@vyb/contracts";
import { isBackendRequestError, reactToPost } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import {
  notifySocialPostReactionUpdated,
  type SocialPostNotificationContext
} from "../../../../../src/lib/notification-events";

export async function PUT(
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
          message: "You must sign in before reacting."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => ({}))) as
    | {
        reactionType?: "fire" | "support" | "like" | "love" | "insight" | "funny";
      }
    | null;
  const { postId } = await context.params;

  try {
    const result = (await reactToPost(viewer, postId, payload?.reactionType ?? "like")) as ReactionResponse & {
      notificationContext?: SocialPostNotificationContext;
    };

    await notifySocialPostReactionUpdated(viewer, result, result.notificationContext ?? null).catch((notificationError) => {
      console.warn("[notifications] social.reaction.post failed", {
        postId,
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
          message: error instanceof Error ? error.message : "The reaction service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}

