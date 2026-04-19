import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import { searchCampusUsers } from "../../../src/lib/backend";

export async function GET(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before searching campus users."
        }
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";

  try {
    return NextResponse.json(await searchCampusUsers(viewer, query));
  } catch {
    return NextResponse.json({ query, items: [] });
  }
}
