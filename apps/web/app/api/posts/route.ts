import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import { proxyBackendMutation } from "../../../src/lib/backend";

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before creating a post."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        title?: string;
        body?: string;
        communityId?: string | null;
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
      "/v1/posts",
      "POST",
      {
        tenantId: viewer.tenantId,
        membershipId: viewer.membershipId,
        communityId: payload.communityId ?? null,
        kind: "text",
        title: payload.title ?? "",
        body: payload.body ?? ""
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
