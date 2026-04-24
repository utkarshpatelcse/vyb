import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MarketMediaAsset, MarketMediaKind, MarketTab } from "@vyb/contracts";
import sharp from "sharp";
import { getFirebaseAdminStorageBucket } from "./firebase-admin-server";
import { loadWorkspaceRootEnv } from "./server-env";

const MAX_MARKET_MEDIA_ITEMS = 6;
const MAX_MARKET_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_MARKET_VIDEO_BYTES = 40 * 1024 * 1024;
const MAX_MARKET_IMAGE_DIMENSION = 1800;
const MARKET_IMAGE_WEBP_QUALITY = 80;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"]);

function buildDownloadUrl(bucketName: string, storagePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function buildLocalDownloadUrl(storagePath: string) {
  const encodedPath = storagePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/api/market/media/${encodedPath}`;
}

function normalizeMimeType(value: string) {
  return value.trim().toLowerCase();
}

function getConfiguredStorageBucket() {
  loadWorkspaceRootEnv();
  return process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? null;
}

function getLocalMarketMediaRoot() {
  loadWorkspaceRootEnv();

  const configuredRoot =
    process.env.VYB_LOCAL_MEDIA_ROOT ??
    process.env.TMPDIR ??
    process.env.TEMP ??
    process.env.TMP ??
    path.join(process.cwd(), ".tmp");

  return path.join(configuredRoot, "vyb-market-media");
}

export function resolveLocalMarketMediaFilePath(storagePath: string) {
  const rootPath = path.resolve(getLocalMarketMediaRoot());
  const relativePath = storagePath
    .split("/")
    .filter(Boolean)
    .join(path.sep);
  const absolutePath = path.resolve(rootPath, relativePath);
  const relativeCheck = path.relative(rootPath, absolutePath);

  if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
    throw new Error("Invalid local market media path.");
  }

  return absolutePath;
}

export function inferLocalMarketMediaContentType(storagePath: string) {
  const extension = path.extname(storagePath).toLowerCase();
  const byExtension: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska"
  };

  return byExtension[extension] ?? "application/octet-stream";
}

function getMarketMediaKind(mimeType: string): MarketMediaKind | null {
  const normalized = normalizeMimeType(mimeType);

  if (IMAGE_MIME_TYPES.has(normalized)) {
    return "image";
  }

  if (VIDEO_MIME_TYPES.has(normalized)) {
    return "video";
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

  return cleaned || "market-media";
}

function replaceFileExtension(fileName: string, nextExtension: string) {
  const withoutExtension = fileName.replace(/\.[^./\\]+$/, "");
  return `${withoutExtension || "market-media"}.${nextExtension}`;
}

function validateFile(file: File) {
  const mimeType = normalizeMimeType(file.type || "application/octet-stream");
  const kind = getMarketMediaKind(mimeType);

  if (!kind) {
    throw new Error(`"${file.name}" is not a supported image or video format.`);
  }

  const maxBytes = kind === "video" ? MAX_MARKET_VIDEO_BYTES : MAX_MARKET_IMAGE_BYTES;

  if (file.size > maxBytes) {
    throw new Error(
      kind === "video"
        ? `"${file.name}" is too large. Keep each video under 40 MB.`
        : `"${file.name}" is too large. Keep each image under 8 MB.`
    );
  }

  return {
    kind,
    mimeType
  };
}

function ensureStorageConfigured() {
  if (!getConfiguredStorageBucket()) {
    throw new Error("Firebase Storage is not configured yet. Add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET before uploading market media.");
  }
}

function isFirebaseStorageFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("default credentials") ||
    message.includes("could not load the default credentials") ||
    message.includes("firebase storage is not configured") ||
    message.includes("enoent") ||
    message.includes("permission") ||
    message.includes("unauthorized") ||
    message.includes("invalid_grant")
  );
}

export function getMaxMarketMediaItems() {
  return MAX_MARKET_MEDIA_ITEMS;
}

export function getMaxMarketImageBytes() {
  return MAX_MARKET_IMAGE_BYTES;
}

export function getMaxMarketVideoBytes() {
  return MAX_MARKET_VIDEO_BYTES;
}

export async function deleteMarketMediaAssets(assets: MarketMediaAsset[]) {
  const removable = assets.filter((asset) => typeof asset.storagePath === "string" && asset.storagePath.length > 0);

  if (removable.length === 0) {
    return;
  }

  const localAssets = removable.filter((asset) => asset.url.startsWith("/api/market/media/"));
  const remoteAssets = removable.filter((asset) => !asset.url.startsWith("/api/market/media/"));

  await Promise.allSettled(
    localAssets.map((asset) =>
      rm(resolveLocalMarketMediaFilePath(asset.storagePath as string), {
        force: true
      }).catch(() => null)
    )
  );

  if (remoteAssets.length === 0) {
    return;
  }

  try {
    ensureStorageConfigured();
    const bucket = getFirebaseAdminStorageBucket();
    await Promise.allSettled(remoteAssets.map((asset) => bucket.file(asset.storagePath as string).delete({ ignoreNotFound: true })));
  } catch (error) {
    if (!isFirebaseStorageFailure(error)) {
      throw error;
    }
  }
}

async function compressMarketImageBuffer(buffer: Buffer, mimeType: string, fileName: string) {
  if (mimeType === "image/gif") {
    return {
      buffer,
      mimeType,
      extension: extensionFromMimeType(mimeType, "gif"),
      fileName,
      compressed: false
    };
  }

  try {
    const pipeline = sharp(buffer, { animated: true, failOn: "none" });
    const metadata = await pipeline.metadata();

    if ((metadata.pages ?? 1) > 1) {
      return {
        buffer,
        mimeType,
        extension: extensionFromMimeType(mimeType, "bin"),
        fileName,
        compressed: false
      };
    }

    const compressedBuffer = await pipeline
      .rotate()
      .resize({
        width: MAX_MARKET_IMAGE_DIMENSION,
        height: MAX_MARKET_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({
        quality: MARKET_IMAGE_WEBP_QUALITY,
        effort: 4
      })
      .toBuffer();

    if (compressedBuffer.byteLength >= buffer.byteLength) {
      return {
        buffer,
        mimeType,
        extension: extensionFromMimeType(mimeType, "bin"),
        fileName,
        compressed: false
      };
    }

    return {
      buffer: compressedBuffer,
      mimeType: "image/webp",
      extension: "webp",
      fileName: replaceFileExtension(fileName, "webp"),
      compressed: true
    };
  } catch {
    return {
      buffer,
      mimeType,
      extension: extensionFromMimeType(mimeType, "bin"),
      fileName,
      compressed: false
    };
  }
}

async function persistLocalMarketMediaAsset(input: {
  buffer: Buffer;
  kind: MarketMediaKind;
  mimeType: string;
  fileName: string;
  storagePath: string;
}) {
  const filePath = resolveLocalMarketMediaFilePath(input.storagePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, input.buffer);

  return {
    id: path.basename(input.storagePath, path.extname(input.storagePath)),
    kind: input.kind,
    url: buildLocalDownloadUrl(input.storagePath),
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.byteLength,
    storagePath: input.storagePath
  } satisfies MarketMediaAsset;
}

export async function persistMarketMediaAssets(input: {
  tenantId: string;
  userId: string;
  postId: string;
  tab: MarketTab;
  files: File[];
}): Promise<MarketMediaAsset[]> {
  if (input.files.length === 0) {
    return [];
  }

  if (input.files.length > MAX_MARKET_MEDIA_ITEMS) {
    throw new Error(`You can upload up to ${MAX_MARKET_MEDIA_ITEMS} files in one market post.`);
  }

  const assets = await Promise.all(
    input.files.map(async (file) => {
      const { kind, mimeType } = validateFile(file);
      const assetId = randomUUID();
      const token = randomUUID();
      const sourceBuffer = Buffer.from(await file.arrayBuffer());
      const sourceFileName = sanitizeFileName(file.name || `${kind}.${extensionFromMimeType(mimeType, kind === "video" ? "mp4" : "jpg")}`);
      const prepared =
        kind === "image"
          ? await compressMarketImageBuffer(sourceBuffer, mimeType, sourceFileName)
          : {
              buffer: sourceBuffer,
              mimeType,
              extension: extensionFromMimeType(mimeType, "mp4"),
              fileName: sourceFileName,
              compressed: false
            };
      const storagePath = `market/${input.tenantId}/${input.tab}/${input.userId}/${input.postId}/${assetId}.${prepared.extension}`;
      try {
        ensureStorageConfigured();

        const bucket = getFirebaseAdminStorageBucket();
        const storageFile = bucket.file(storagePath);

        await storageFile.save(prepared.buffer, {
          resumable: false,
          metadata: {
            contentType: prepared.mimeType,
            cacheControl: "public, max-age=31536000, immutable",
            metadata: {
              firebaseStorageDownloadTokens: token,
              originalFileName: sourceFileName,
              sourceMimeType: mimeType,
              compressed: prepared.compressed ? "true" : "false"
            }
          }
        });

        return {
          id: assetId,
          kind,
          url: buildDownloadUrl(bucket.name, storagePath, token),
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          sizeBytes: prepared.buffer.byteLength,
          storagePath
        } satisfies MarketMediaAsset;
      } catch (error) {
        if (!isFirebaseStorageFailure(error)) {
          throw error;
        }

        console.warn("[web/market-media] falling back to local media storage", {
          tenantId: input.tenantId,
          userId: input.userId,
          tab: input.tab,
          fileName: sourceFileName,
          message: error instanceof Error ? error.message : "unknown"
        });

        return persistLocalMarketMediaAsset({
          buffer: prepared.buffer,
          kind,
          mimeType: prepared.mimeType,
          fileName: prepared.fileName,
          storagePath
        });
      }
    })
  );

  return assets;
}
