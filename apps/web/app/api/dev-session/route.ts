import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "No active browser session was found."
        }
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    session: {
      userId: viewer.userId,
      email: viewer.email,
      displayName: viewer.displayName,
      membershipId: viewer.membershipId,
      tenantId: viewer.tenantId
    }
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: "ROUTE_DISABLED",
        message: "This route has been disabled."
      }
    },
    { status: 410 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: {
        code: "ROUTE_DISABLED",
        message: "This route has been disabled."
      }
    },
    { status: 410 }
  );
}
