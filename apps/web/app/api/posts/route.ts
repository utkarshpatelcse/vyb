import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import { proxyBackendMutation } from "../../../src/lib/backend";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-vyb-debug-task-id") ?? `post-${randomUUID()}`;
  const debugStage = request.headers.get("x-vyb-debug-stage") ?? "publish";
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before creating a post.",
          requestId
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
        kind?: "text" | "image" | "video";
        mediaUrl?: string | null;
        mediaStoragePath?: string | null;
        mediaMimeType?: string | null;
        mediaSizeBytes?: number | null;
        location?: string | null;
        placement?: "feed" | "vibe";
        isAnonymous?: boolean;
        allowAnonymousComments?: boolean;
        mediaAssets?: {
          url: string;
          kind: "image" | "video";
          mimeType?: string;
          sizeBytes?: number;
          storagePath?: string;
        }[];
      }
    | null;

  if (!payload) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
          requestId
        }
      },
      { status: 400 }
    );
  }

  console.info("[web/posts] create-start", {
    requestId,
    debugStage,
    tenantId: viewer.tenantId,
    membershipId: viewer.membershipId,
    kind: payload.kind ?? "text",
    placement: payload.placement ?? "feed",
    mediaAssetCount: Array.isArray(payload.mediaAssets) ? payload.mediaAssets.length : 0,
    hasMediaUrl: Boolean(payload.mediaUrl),
    bodyLength: (payload.body ?? "").length
  });

  try {
    const upstream = await proxyBackendMutation(
      "/v1/posts",
      "POST",
      {
        tenantId: viewer.tenantId,
        membershipId: viewer.membershipId,
        communityId: payload.communityId ?? null,
        placement: payload.placement ?? "feed",
        kind: payload.kind ?? "text",
        isAnonymous: payload.isAnonymous === true,
        allowAnonymousComments: payload.allowAnonymousComments !== false,
        title: payload.title ?? "",
        body: payload.body ?? "",
        mediaUrl: payload.mediaUrl ?? null,
        mediaStoragePath: payload.mediaStoragePath ?? null,
        mediaMimeType: payload.mediaMimeType ?? null,
        mediaSizeBytes: payload.mediaSizeBytes ?? null,
        mediaAssets: payload.mediaAssets ?? null,
        location: payload.location ?? null
      },
      viewer
    );

    if (!upstream.ok) {
      const responseText = await upstream.text();
      console.error("[web/posts] create-failed-response", {
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

    console.info("[web/posts] create-success", {
      requestId,
      debugStage,
      tenantId: viewer.tenantId,
      membershipId: viewer.membershipId,
      status: upstream.status
    });
    return upstream;
  } catch (error) {
    console.error("[web/posts] create-failed", {
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
          message: "The backend is unavailable right now.",
          requestId
        }
      },
      { status: 502 }
    );
  }
}
