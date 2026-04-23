import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCampusUserConnections } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      username: string;
    }>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before viewing following."
        }
      },
      { status: 401 }
    );
  }

  const { username } = await context.params;

  try {
    return NextResponse.json(await getCampusUserConnections(viewer, username, "following"));
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "The following list is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
