import "server-only";

import { randomUUID } from "node:crypto";
import { getFirebaseAdminStorageBucket } from "./firebase-admin-server";
import { loadWorkspaceRootEnv } from "./server-env";

const MAX_SOCIAL_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_SOCIAL_VIDEO_BYTES = 10 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function buildDownloadUrl(bucketName: string, storagePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function normalizeMimeType(value: string) {
  return value.trim().toLowerCase();
}

function getSocialMediaKind(mimeType: string) {
  const normalized = normalizeMimeType(mimeType);

  if (IMAGE_MIME_TYPES.has(normalized)) {
    return "image" as const;
  }

  if (VIDEO_MIME_TYPES.has(normalized)) {
    return "video" as const;
  }

  return null;
}

function extensionFromMimeType(mimeType: string, fallback = "bin") {
  const explicit: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov"
  };

  return explicit[mimeType] ?? mimeType.split("/")[1] ?? fallback;
}

function ensureStorageConfigured() {
  loadWorkspaceRootEnv();

  if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    throw new Error("Firebase Storage is not configured yet.");
  }
}

function validateFile(file: File) {
  const mimeType = normalizeMimeType(file.type || "application/octet-stream");
  const mediaType = getSocialMediaKind(mimeType);

  if (!mediaType) {
    throw new Error("Only image and video uploads are supported right now.");
  }

  const maxBytes = mediaType === "video" ? MAX_SOCIAL_VIDEO_BYTES : MAX_SOCIAL_IMAGE_BYTES;
  if (file.size > maxBytes) {
    throw new Error(
      mediaType === "video"
        ? "Video is still too large after optimization. Keep it under 10 MB."
        : "Image is too large right now. Keep it under 4 MB."
    );
  }

  return {
    mediaType,
    mimeType
  };
}

function resolveAssetType(intent: string | null) {
  if (intent === "story") {
    return {
      assetType: "stories",
      placement: "feed"
    } as const;
  }

  return {
    assetType: "posts",
    placement: intent === "vibe" ? "vibe" : "feed"
  } as const;
}

export async function persistSocialMediaAsset(input: {
  tenantId: string;
  userId: string;
  intent: "post" | "story" | "vibe";
  file: File;
}) {
  ensureStorageConfigured();

  const { mediaType, mimeType } = validateFile(input.file);
  const { assetType, placement } = resolveAssetType(input.intent);
  const assetId = randomUUID();
  const token = randomUUID();
  const extension = extensionFromMimeType(mimeType, mediaType === "video" ? "mp4" : "jpg");
  const storagePath = `social/${input.tenantId}/${assetType}/${placement}/${input.userId}/${assetId}.${extension}`;
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const bucket = getFirebaseAdminStorageBucket();

  await bucket.file(storagePath).save(buffer, {
    resumable: false,
    metadata: {
      contentType: mimeType,
      cacheControl: "public, max-age=31536000, immutable",
      metadata: {
        firebaseStorageDownloadTokens: token,
        originalFileName: input.file.name || `${assetType}.${extension}`
      }
    }
  });

  return {
    mediaType,
    mimeType,
    sizeBytes: buffer.byteLength,
    storagePath,
    url: buildDownloadUrl(bucket.name, storagePath, token)
  };
}
