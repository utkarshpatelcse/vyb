import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createContentReport } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";

export async function POST(request: NextRequest) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before reporting content."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        targetType?: string;
        targetId?: string;
        reason?: string;
      }
    | null;

  if (!payload?.targetType || !payload.targetId || !payload.reason) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REPORT",
          message: "targetType, targetId, and reason are required."
        }
      },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(
      await createContentReport(viewer, {
        targetType: payload.targetType,
        targetId: payload.targetId,
        reason: payload.reason
      }),
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: error instanceof Error ? error.message : "The reporting service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
