import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCampusVibes, proxyBackendMutation } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";

const MAX_VIBE_VIDEO_BYTES = 40 * 1024 * 1024;
const VIBE_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

type VibeMediaVariant = {
  label?: unknown;
  width?: unknown;
  height?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
  storagePath?: unknown;
  url?: unknown;
};

type VibeMediaAssetInput = {
  url?: unknown;
  kind?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
  storagePath?: unknown;
  variants?: unknown;
  processingStatus?: unknown;
};

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

function decodeStorageObjectPath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getLocalMediaObjectPath(mediaUrl: string) {
  const localPrefix = "/api/social-media/files/";
  let pathname = mediaUrl.split(/[?#]/)[0] ?? "";

  try {
    pathname = new URL(mediaUrl).pathname;
  } catch {
    // Relative local URLs are expected in development fallback mode.
  }

  if (!pathname.startsWith(localPrefix)) {
    return null;
  }

  return decodeStorageObjectPath(pathname.slice(localPrefix.length));
}

function getFirebaseStorageObjectPath(pathname: string) {
  const objectMarker = "/o/";
  const markerIndex = pathname.indexOf(objectMarker);

  if (markerIndex === -1) {
    return null;
  }

  return decodeStorageObjectPath(pathname.slice(markerIndex + objectMarker.length));
}

function isSafeVibeMediaUrl(value: unknown, storagePath: string) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  const mediaUrl = value.trim();
  const localObjectPath = getLocalMediaObjectPath(mediaUrl);

  if (localObjectPath) {
    return localObjectPath === storagePath;
  }

  try {
    const parsed = new URL(mediaUrl);
    const firebaseObjectPath = getFirebaseStorageObjectPath(parsed.pathname);

    return parsed.hostname === "firebasestorage.googleapis.com" && firebaseObjectPath === storagePath;
  } catch {
    return false;
  }
}

function sanitizeVibeVariant(value: VibeMediaVariant, tenantId: string, userId: string) {
  const storagePath = typeof value.storagePath === "string" ? value.storagePath.trim() : "";
  const mimeType = normalizeMimeType(value.mimeType);
  const sizeBytes = Number(value.sizeBytes);

  if (
    !isSafeVibeStoragePath(storagePath, tenantId, userId) ||
    !isSafeVibeMediaUrl(value.url, storagePath) ||
    !VIBE_VIDEO_MIME_TYPES.has(mimeType) ||
    !Number.isFinite(sizeBytes) ||
    sizeBytes <= 0
  ) {
    return null;
  }

  return {
    label: typeof value.label === "string" ? value.label.slice(0, 24) : null,
    width: Number.isFinite(Number(value.width)) ? Number(value.width) : null,
    height: Number.isFinite(Number(value.height)) ? Number(value.height) : null,
    mimeType,
    sizeBytes,
    storagePath,
    url: typeof value.url === "string" ? value.url.trim() : ""
  };
}

function sanitizeVibeMediaAssets(value: unknown, tenantId: string, userId: string) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const asset = item as VibeMediaAssetInput;
      const storagePath = typeof asset.storagePath === "string" ? asset.storagePath.trim() : "";
      const mimeType = normalizeMimeType(asset.mimeType);
      const sizeBytes = Number(asset.sizeBytes);

      if (
        asset.kind !== "video" ||
        !isSafeVibeStoragePath(storagePath, tenantId, userId) ||
        !isSafeVibeMediaUrl(asset.url, storagePath) ||
        !VIBE_VIDEO_MIME_TYPES.has(mimeType) ||
        !Number.isFinite(sizeBytes) ||
        sizeBytes <= 0
      ) {
        return null;
      }

      const variants = Array.isArray(asset.variants)
        ? asset.variants
            .map((variant) =>
              variant && typeof variant === "object"
                ? sanitizeVibeVariant(variant as VibeMediaVariant, tenantId, userId)
                : null
            )
            .filter(Boolean)
        : [];

      return {
        url: typeof asset.url === "string" ? asset.url.trim() : "",
        kind: "video" as const,
        mimeType,
        sizeBytes,
        storagePath,
        variants,
        processingStatus: asset.processingStatus === "passthrough" ? "passthrough" : "ready"
      };
    })
    .filter(Boolean);
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
        isAnonymous?: boolean;
        allowAnonymousComments?: boolean;
        mediaAssets?: VibeMediaAssetInput[];
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
  const mediaAssets = sanitizeVibeMediaAssets(payload.mediaAssets, viewer.tenantId, viewer.userId);
  const mediaChecks = {
    safeStoragePath: isSafeVibeStoragePath(mediaStoragePath, viewer.tenantId, viewer.userId),
    safeMediaUrl: isSafeVibeMediaUrl(payload.mediaUrl, mediaStoragePath),
    allowedMimeType: VIBE_VIDEO_MIME_TYPES.has(mediaMimeType),
    safeSize:
      Number.isFinite(mediaSizeBytes) && mediaSizeBytes > 0 && mediaSizeBytes <= MAX_VIBE_VIDEO_BYTES
  };

  if (
    !mediaChecks.safeStoragePath ||
    !mediaChecks.safeMediaUrl ||
    !mediaChecks.allowedMimeType ||
    !mediaChecks.safeSize
  ) {
    console.warn("[web/vibes] invalid-media", {
      requestId,
      debugStage,
      tenantId: viewer.tenantId,
      userId: viewer.userId,
      mediaStoragePath,
      mediaMimeType,
      mediaSizeBytes,
      mediaChecks
    });

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
        isAnonymous: payload.isAnonymous === true,
        allowAnonymousComments: payload.allowAnonymousComments !== false,
        title: payload.title ?? "",
        body: payload.body ?? "",
        mediaUrl: payload.mediaUrl.trim(),
        mediaStoragePath,
        mediaMimeType,
        mediaSizeBytes,
        mediaAssets,
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
