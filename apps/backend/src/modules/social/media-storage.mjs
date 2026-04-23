import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp, loadRootEnv } from "../../../../../packages/config/src/index.mjs";

const MAX_SOCIAL_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_SOCIAL_VIDEO_BYTES = 10 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function buildDownloadUrl(bucketName, storagePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function normalizeMimeType(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getSocialMediaKind(mimeType) {
  const normalized = normalizeMimeType(mimeType);

  if (IMAGE_MIME_TYPES.has(normalized)) {
    return "image";
  }

  if (VIDEO_MIME_TYPES.has(normalized)) {
    return "video";
  }

  return null;
}

function extensionFromMimeType(mimeType, fallback = "bin") {
  const explicit = {
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
  loadRootEnv();

  if (!process.env.FIREBASE_STORAGE_BUCKET && !process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    throw new Error("Firebase Storage is not configured yet.");
  }
}

function resolveAssetType(intent) {
  if (intent === "story") {
    return {
      assetType: "stories",
      placement: "feed"
    };
  }

  return {
    assetType: "posts",
    placement: intent === "vibe" ? "vibe" : "feed"
  };
}

function sanitizeFileName(value, fallback) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-");

  return cleaned || fallback;
}

export async function persistSocialMediaAsset(input) {
  ensureStorageConfigured();

  const mimeType = normalizeMimeType(input.mimeType);
  const mediaType = getSocialMediaKind(mimeType);

  if (!mediaType) {
    throw new Error("Only image and video uploads are supported right now.");
  }

  if (typeof input.base64Data !== "string" || !input.base64Data.trim()) {
    throw new Error("Upload payload is missing media bytes.");
  }

  const buffer = Buffer.from(input.base64Data, "base64");
  if (buffer.byteLength <= 0) {
    throw new Error("Upload payload is empty.");
  }

  const maxBytes = mediaType === "video" ? MAX_SOCIAL_VIDEO_BYTES : MAX_SOCIAL_IMAGE_BYTES;
  if (buffer.byteLength > maxBytes) {
    throw new Error(
      mediaType === "video"
        ? "Video is still too large after optimization. Keep it under 10 MB."
        : "Image is too large right now. Keep it under 4 MB."
    );
  }

  const { assetType, placement } = resolveAssetType(input.intent);
  const assetId = randomUUID();
  const token = randomUUID();
  const extension = extensionFromMimeType(mimeType, mediaType === "video" ? "mp4" : "jpg");
  const originalFileName = sanitizeFileName(input.fileName, `${assetType}.${extension}`);
  const storagePath = `social/${input.tenantId}/${assetType}/${placement}/${input.userId}/${assetId}.${extension}`;
  const bucket = getStorage(getFirebaseAdminApp("backend-social-storage")).bucket();

  await bucket.file(storagePath).save(buffer, {
    resumable: false,
    metadata: {
      contentType: mimeType,
      cacheControl: "public, max-age=31536000, immutable",
      metadata: {
        firebaseStorageDownloadTokens: token,
        originalFileName
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
