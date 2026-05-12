import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCommunityMembers } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before viewing community members."
        }
      },
      { status: 401 }
    );
  }

  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "24");
  const cursor = searchParams.get("cursor");

  try {
    return NextResponse.json(
      await getCommunityMembers(viewer, slug, Number.isInteger(limit) && limit > 0 ? limit : 24, cursor)
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "COMMUNITY_MEMBERS_UNAVAILABLE",
          message: "Community members are unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
