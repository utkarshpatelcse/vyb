import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCampusVibes, proxyBackendMutation } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before viewing vibes."
        }
      },
      { status: 401 }
    );
  }

  try {
    return NextResponse.json(await getCampusVibes(viewer));
  } catch {
    return NextResponse.json({ tenantId: viewer.tenantId, communityId: null, items: [], nextCursor: null });
  }
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before uploading a vibe."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        title?: string | null;
        body?: string;
        mediaUrl?: string | null;
        location?: string | null;
      }
    | null;

  if (!payload?.mediaUrl) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_VIBE",
          message: "Add a video before publishing your vibe."
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
        communityId: null,
        placement: "vibe",
        kind: "video",
        title: payload.title ?? "",
        body: payload.body ?? "",
        mediaUrl: payload.mediaUrl,
        location: payload.location ?? null
      },
      viewer
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "The vibe service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
