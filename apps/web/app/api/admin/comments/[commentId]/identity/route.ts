import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { proxyBackendMutation } from "../../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../../src/lib/dev-session";

export async function GET(request: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before viewing comment identity."
        }
      },
      { status: 401 }
    );
  }

  const { commentId } = await params;
  const { searchParams } = new URL(request.url);
  const reason = searchParams.get("reason")?.trim();
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  return proxyBackendMutation(`/v1/admin/comments/${encodeURIComponent(commentId)}/identity${query}`, "GET", null, viewer);
}
