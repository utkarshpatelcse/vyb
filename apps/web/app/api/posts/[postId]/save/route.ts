import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { proxyBackendMutation } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

export async function PUT(
  _request: Request,
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
          message: "You must sign in before saving posts."
        }
      },
      { status: 401 }
    );
  }

  const { postId } = await context.params;

  try {
    return await proxyBackendMutation(`/v1/posts/${encodeURIComponent(postId)}/save`, "PUT", {}, viewer);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: error instanceof Error ? error.message : "The post save service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
