import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { reactToPost } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

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
        reactionType?: "fire" | "support" | "like";
      }
    | null;
  const { postId } = await context.params;

  try {
    return NextResponse.json(await reactToPost(viewer, postId, payload?.reactionType ?? "like"));
  } catch (error) {
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

