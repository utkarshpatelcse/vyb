import "server-only";

import { randomUUID } from "node:crypto";
import type { CampusEventMediaAsset } from "@vyb/contracts";
import { getFirebaseAdminStorageBucket } from "./firebase-admin-server";
import { loadWorkspaceRootEnv } from "./server-env";

const MAX_EVENT_MEDIA_ITEMS = 4;
const MAX_EVENT_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_EVENT_VIDEO_BYTES = 60 * 1024 * 1024;
const MAX_REGISTRATION_MEDIA_ITEMS = 3;
const MAX_REGISTRATION_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"]);

function buildDownloadUrl(bucketName: string, storagePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function normalizeMimeType(value: string) {
  return value.trim().toLowerCase();
}

function getEventMediaKind(mimeType: string) {
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
    "video/quicktime": "mov",
    "video/x-matroska": "mkv"
  };

  return explicit[mimeType] ?? mimeType.split("/")[1] ?? fallback;
}

function sanitizeFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-");

  return cleaned || "event-media";
}

function ensureStorageConfigured() {
  loadWorkspaceRootEnv();

  if (!process.env.FIREBASE_STORAGE_BUCKET && !process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    throw new Error("Firebase Storage is not configured yet. Add FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET before uploading event media.");
  }
}

function validateFile(file: File) {
  const mimeType = normalizeMimeType(file.type || "application/octet-stream");
  const kind = getEventMediaKind(mimeType);

  if (!kind) {
    throw new Error(`"${file.name}" is not a supported event poster or video format.`);
  }

  const maxBytes = kind === "video" ? MAX_EVENT_VIDEO_BYTES : MAX_EVENT_IMAGE_BYTES;

  if (file.size > maxBytes) {
    throw new Error(
      kind === "video"
        ? `"${file.name}" is too large. Keep each event video under 60 MB.`
        : `"${file.name}" is too large. Keep each event image under 12 MB.`
    );
  }

  return {
    kind,
    mimeType
  };
}

function validateRegistrationFile(file: File) {
  const mimeType = normalizeMimeType(file.type || "application/octet-stream");
  const kind = getEventMediaKind(mimeType);

  if (kind !== "image") {
    throw new Error(`"${file.name}" is not a supported registration image format.`);
  }

  if (file.size > MAX_REGISTRATION_IMAGE_BYTES) {
    throw new Error(`"${file.name}" is too large. Keep each registration image under 10 MB.`);
  }

  return {
    kind,
    mimeType
  };
}

async function persistAssets(input: {
  tenantId: string;
  userId: string;
  scope: string;
  files: File[];
  maxItems: number;
  validate: (file: File) => { kind: "image" | "video"; mimeType: string };
}): Promise<CampusEventMediaAsset[]> {
  if (input.files.length === 0) {
    return [];
  }

  if (input.files.length > input.maxItems) {
    throw new Error(`You can upload up to ${input.maxItems} files here.`);
  }

  ensureStorageConfigured();

  const bucket = getFirebaseAdminStorageBucket();

  return Promise.all(
    input.files.map(async (file) => {
      const { kind, mimeType } = input.validate(file);
      const assetId = randomUUID();
      const token = randomUUID();
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = sanitizeFileName(file.name || `${kind}.${extensionFromMimeType(mimeType, kind === "video" ? "mp4" : "jpg")}`);
      const extension = extensionFromMimeType(mimeType, kind === "video" ? "mp4" : "jpg");
      const storagePath = `${input.scope}/${assetId}.${extension}`;

      await bucket.file(storagePath).save(buffer, {
        resumable: false,
        metadata: {
          contentType: mimeType,
          cacheControl: "public, max-age=31536000, immutable",
          metadata: {
            firebaseStorageDownloadTokens: token,
            originalFileName: fileName
          }
        }
      });

      return {
        id: assetId,
        kind,
        url: buildDownloadUrl(bucket.name, storagePath, token),
        fileName,
        mimeType,
        sizeBytes: buffer.byteLength,
        storagePath
      } satisfies CampusEventMediaAsset;
    })
  );
}

export async function deleteEventMediaAssets(assets: CampusEventMediaAsset[]) {
  const removable = assets.filter((asset) => typeof asset.storagePath === "string" && asset.storagePath.length > 0);

  if (removable.length === 0) {
    return;
  }

  ensureStorageConfigured();

  const bucket = getFirebaseAdminStorageBucket();
  await Promise.allSettled(removable.map((asset) => bucket.file(asset.storagePath as string).delete({ ignoreNotFound: true })));
}

export async function persistEventMediaAssets(input: {
  tenantId: string;
  userId: string;
  eventId: string;
  files: File[];
}): Promise<CampusEventMediaAsset[]> {
  return persistAssets({
    tenantId: input.tenantId,
    userId: input.userId,
    scope: `events/${input.tenantId}/${input.userId}/${input.eventId}`,
    files: input.files,
    maxItems: MAX_EVENT_MEDIA_ITEMS,
    validate: validateFile
  });
}

export async function persistEventRegistrationAssets(input: {
  tenantId: string;
  userId: string;
  eventId: string;
  registrationId: string;
  files: File[];
}): Promise<CampusEventMediaAsset[]> {
  return persistAssets({
    tenantId: input.tenantId,
    userId: input.userId,
    scope: `events/${input.tenantId}/${input.userId}/${input.eventId}/registrations/${input.registrationId}`,
    files: input.files,
    maxItems: MAX_REGISTRATION_MEDIA_ITEMS,
    validate: validateRegistrationFile
  });
}
