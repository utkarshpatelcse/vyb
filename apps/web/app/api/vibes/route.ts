import { randomUUID } from "node:crypto";
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
  const requestId = request.headers.get("x-vyb-debug-task-id") ?? `vibe-${randomUUID()}`;
  const debugStage = request.headers.get("x-vyb-debug-stage") ?? "publish";
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before uploading a vibe.",
          requestId
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
        mediaStoragePath?: string | null;
        mediaMimeType?: string | null;
        mediaSizeBytes?: number | null;
        location?: string | null;
      }
    | null;

  if (!payload?.mediaUrl) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_VIBE",
          message: "Add a video before publishing your vibe.",
          requestId
        }
      },
      { status: 400 }
    );
  }

  console.info("[web/vibes] create-start", {
    requestId,
    debugStage,
    tenantId: viewer.tenantId,
    membershipId: viewer.membershipId,
    hasMediaUrl: Boolean(payload.mediaUrl),
    mediaStoragePath: payload.mediaStoragePath ?? null,
    mediaMimeType: payload.mediaMimeType ?? null,
    mediaSizeBytes: payload.mediaSizeBytes ?? null
  });

  try {
    const upstream = await proxyBackendMutation(
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
        mediaStoragePath: payload.mediaStoragePath ?? null,
        mediaMimeType: payload.mediaMimeType ?? null,
        mediaSizeBytes: payload.mediaSizeBytes ?? null,
        location: payload.location ?? null
      },
      viewer
    );

    if (!upstream.ok) {
      const responseText = await upstream.text();
      console.error("[web/vibes] create-failed-response", {
        requestId,
        debugStage,
        tenantId: viewer.tenantId,
        membershipId: viewer.membershipId,
        status: upstream.status,
        body: responseText
      });

      return new Response(responseText, {
        status: upstream.status,
        headers: {
          "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8"
        }
      });
    }

    console.info("[web/vibes] create-success", {
      requestId,
      debugStage,
      tenantId: viewer.tenantId,
      membershipId: viewer.membershipId,
      status: upstream.status
    });
    return upstream;
  } catch (error) {
    console.error("[web/vibes] create-failed", {
      requestId,
      debugStage,
      tenantId: viewer.tenantId,
      membershipId: viewer.membershipId,
      message: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "The vibe service is unavailable right now.",
          requestId
        }
      },
      { status: 502 }
    );
  }
}
