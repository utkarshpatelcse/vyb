import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { markStorySeenOnBackend } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

export async function PUT(
  _request: Request,
  context: {
    params: Promise<{
      storyId: string;
    }>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before opening a story."
        }
      },
      { status: 401 }
    );
  }

  const { storyId } = await context.params;

  try {
    return NextResponse.json(await markStorySeenOnBackend(viewer, storyId));
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: error instanceof Error ? error.message : "The story seen service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
