import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getViewerActivity } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";

export async function GET(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before viewing activity."
        }
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "20");

  try {
    return NextResponse.json(await getViewerActivity(viewer, Number.isInteger(limit) && limit > 0 ? limit : 20));
  } catch {
    return NextResponse.json({
      tenantId: viewer.tenantId,
      items: []
    });
  }
}

