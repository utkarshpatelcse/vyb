import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCampusVibes, proxyBackendMutation } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";

const MAX_VIBE_VIDEO_BYTES = 40 * 1024 * 1024;
const VIBE_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function normalizeMimeType(value: unknown) {
  return typeof value === "string" ? value.split(";")[0]?.trim().toLowerCase() ?? "" : "";
}

function isSafeVibeStoragePath(value: unknown, tenantId: string, userId: string) {
  if (typeof value !== "string") {
    return false;
  }

  const segments = value.split("/").filter(Boolean);
  return (
    segments.length === 6 &&
    segments[0] === "social" &&
    segments[1] === tenantId &&
    segments[2] === "posts" &&
    segments[3] === "vibe" &&
    segments[4] === userId &&
    /\.(mp4|webm|mov)$/i.test(segments[5] ?? "")
  );
}

function isSafeVibeMediaUrl(value: unknown, storagePath: string) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  const mediaUrl = value.trim();
  if (mediaUrl.startsWith("/api/social-media/files/")) {
    return mediaUrl.includes(storagePath.split("/").map(encodeURIComponent).join("/"));
  }

  try {
    const parsed = new URL(mediaUrl);
    return (
      parsed.hostname === "firebasestorage.googleapis.com" &&
      parsed.pathname.includes(`/o/${encodeURIComponent(storagePath)}`)
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
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
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? "24");
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= 50 ? rawLimit : 24;
    const cursor = url.searchParams.get("cursor");
    return NextResponse.json(await getCampusVibes(viewer, limit, cursor));
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

  const mediaStoragePath = payload.mediaStoragePath?.trim() ?? "";
  const mediaMimeType = normalizeMimeType(payload.mediaMimeType);
  const mediaSizeBytes = Number(payload.mediaSizeBytes);

  if (
    !isSafeVibeStoragePath(mediaStoragePath, viewer.tenantId, viewer.userId) ||
    !isSafeVibeMediaUrl(payload.mediaUrl, mediaStoragePath) ||
    !VIBE_VIDEO_MIME_TYPES.has(mediaMimeType) ||
    !Number.isFinite(mediaSizeBytes) ||
    mediaSizeBytes <= 0 ||
    mediaSizeBytes > MAX_VIBE_VIDEO_BYTES
  ) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_VIBE_MEDIA",
          message: "Vibes must use a verified video uploaded by your account.",
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
    mediaStoragePath,
    mediaMimeType,
    mediaSizeBytes
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
        mediaUrl: payload.mediaUrl.trim(),
        mediaStoragePath,
        mediaMimeType,
        mediaSizeBytes,
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
