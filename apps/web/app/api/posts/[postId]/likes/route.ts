import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPostLikes } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

export async function GET(
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
          message: "You must sign in before viewing likes."
        }
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "50");
  const { postId } = (await context.params) as { postId: string };

  try {
    return NextResponse.json(await getPostLikes(viewer, postId, Number.isInteger(limit) && limit > 0 ? limit : 50));
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: error instanceof Error ? error.message : "The likes service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
