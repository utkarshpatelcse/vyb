import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { repostCampusPost } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

export async function POST(
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
          message: "You must sign in before reposting."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => ({}))) as
    | {
        quote?: string | null;
        placement?: "feed" | "vibe";
      }
    | null;
  const { postId } = (await context.params) as { postId: string };

  try {
    return NextResponse.json(
      await repostCampusPost(viewer, postId, {
        quote: payload?.quote ?? null,
        placement: payload?.placement
      }),
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: error instanceof Error ? error.message : "The repost service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
