import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { proxyBackendMutation } from "../../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../../src/lib/dev-session";

export async function GET(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before viewing post identity."
        }
      },
      { status: 401 }
    );
  }

  if (viewer.role !== "admin") {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Admin access is required."
        }
      },
      { status: 403 }
    );
  }

  const { postId } = await params;
  return proxyBackendMutation(`/v1/admin/posts/${encodeURIComponent(postId)}/identity`, "GET", null, viewer);
}
