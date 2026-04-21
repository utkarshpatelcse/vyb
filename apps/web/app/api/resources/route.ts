import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCampusResources } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import { proxyBackendMutation } from "../../../src/lib/backend";

export async function GET(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before viewing resources."
        }
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");
  const limit = Number(searchParams.get("limit") ?? "20");

  try {
    return NextResponse.json(
      await getCampusResources(viewer, {
        courseId,
        limit: Number.isInteger(limit) && limit > 0 ? limit : 20
      })
    );
  } catch {
    return NextResponse.json({
      tenantId: viewer.tenantId,
      courseId,
      items: [],
      nextCursor: null
    });
  }
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before creating a resource."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        title?: string;
        description?: string;
        courseId?: string | null;
        type?: string;
        files?: Array<{
          storagePath?: string;
          fileName?: string;
          mimeType?: string;
          sizeBytes?: number;
        }>;
      }
    | null;

  if (!payload) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON."
        }
      },
      { status: 400 }
    );
  }

  try {
    return await proxyBackendMutation(
      "/v1/resources",
      "POST",
      {
        tenantId: viewer.tenantId,
        membershipId: viewer.membershipId,
        courseId: payload.courseId ?? null,
        title: payload.title ?? "",
        description: payload.description ?? "",
        type: payload.type ?? "notes",
        files: payload.files ?? []
      },
      viewer
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "The backend is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
