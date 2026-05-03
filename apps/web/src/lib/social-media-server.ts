import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { getFirebaseAdminStorageBucket } from "./firebase-admin-server";
import { loadWorkspaceRootEnv } from "./server-env";

const MAX_SOCIAL_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_SOCIAL_VIDEO_BYTES = 40 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const SOCIAL_MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";
const VIDEO_VARIANT_TARGETS = [
  { label: "720p", height: 720, crf: 23 },
  { label: "1080p", height: 1080, crf: 22 },
  { label: "1440p", height: 1440, crf: 21 },
  { label: "4k", height: 2160, crf: 20 }
];
const FFMPEG_TIMEOUT_MS = 120000;

type SocialVideoVariant = {
  label: string;
  width: number | null;
  height: number;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  url: string;
};

type PersistedSocialMediaAsset = {
  mediaType: "image" | "video";
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  url: string;
  variants?: SocialVideoVariant[];
  processingStatus?: "ready" | "passthrough";
};

function buildDownloadUrl(bucketName: string, storagePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function buildLocalDownloadUrl(storagePath: string) {
  const encodedPath = storagePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/api/social-media/files/${encodedPath}`;
}

function normalizeMimeType(value: string) {
  return value.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

function getConfiguredStorageBucket() {
  loadWorkspaceRootEnv();
  return process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? null;
}

function getLocalMediaRoot() {
  loadWorkspaceRootEnv();

  const configuredRoot =
    process.env.VYB_LOCAL_MEDIA_ROOT ??
    process.env.TMPDIR ??
    process.env.TEMP ??
    process.env.TMP ??
    path.join(process.cwd(), ".tmp");

  return path.join(configuredRoot, "vyb-social-media");
}

export function resolveLocalSocialMediaFilePath(storagePath: string) {
  const rootPath = path.resolve(getLocalMediaRoot());
  const relativePath = storagePath
    .split("/")
    .filter(Boolean)
    .join(path.sep);
  const absolutePath = path.resolve(rootPath, relativePath);
  const relativeCheck = path.relative(rootPath, absolutePath);

  if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
    throw new Error("Invalid local media path.");
  }

  return absolutePath;
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

function resolveMaxBytesForMediaType(mediaType: "image" | "video") {
  return mediaType === "video" ? MAX_SOCIAL_VIDEO_BYTES : MAX_SOCIAL_IMAGE_BYTES;
}

export function shouldProcessSocialVideoOnServer(intent: "post" | "story" | "vibe", mediaType: "image" | "video") {
  return intent === "vibe" && mediaType === "video";
}

function ensureStorageConfigured() {
  if (!getConfiguredStorageBucket()) {
    throw new Error("Firebase Storage is not configured yet.");
  }
}

export function canDirectUploadSocialMediaFromClient() {
  loadWorkspaceRootEnv();

  if (
    process.env.VYB_DISABLE_SOCIAL_DIRECT_UPLOAD === "1" ||
    process.env.NEXT_PUBLIC_VYB_DISABLE_SOCIAL_DIRECT_UPLOAD === "1"
  ) {
    return false;
  }

  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );
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

function resolveAssetType(intent: "post" | "story" | "vibe") {
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

function sanitizeFileName(value: string, fallback: string) {
  const cleaned = value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-");

  return cleaned || fallback;
}

export function inferSocialMediaContentType(storagePath: string) {
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
    ".mov": "video/quicktime"
  };

  return byExtension[extension] ?? "application/octet-stream";
}

export function planSocialMediaAssetUpload(input: {
  tenantId: string;
  userId: string;
  intent: "post" | "story" | "vibe";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const mimeType = normalizeMimeType(input.mimeType || "application/octet-stream");
  const mediaType = getSocialMediaKind(mimeType);

  if (!mediaType) {
    throw new Error("Only image and video uploads are supported right now.");
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new Error("Upload payload is empty.");
  }

  const maxBytes = resolveMaxBytesForMediaType(mediaType);
  if (input.sizeBytes > maxBytes) {
    throw new Error(
      mediaType === "video"
        ? "Video is still too large after optimization. Keep it under 40 MB."
        : "Image is too large right now. Keep it under 4 MB."
    );
  }

  const { assetType, placement } = resolveAssetType(input.intent);
  const assetId = randomUUID();
  const extension = extensionFromMimeType(mimeType, mediaType === "video" ? "mp4" : "jpg");
  const originalFileName = sanitizeFileName(input.fileName || `${assetType}.${extension}`, `${assetType}.${extension}`);
  const storagePath = `social/${input.tenantId}/${assetType}/${placement}/${input.userId}/${assetId}.${extension}`;

  return {
    mediaType,
    mimeType,
    sizeBytes: input.sizeBytes,
    originalFileName,
    storagePath,
    cacheControl: SOCIAL_MEDIA_CACHE_CONTROL,
    customMetadata: {
      tenant_id: input.tenantId,
      uploader_id: input.userId,
      origin_module: "social",
      upload_intent: input.intent,
      original_file_name: originalFileName
    }
  };
}

async function persistLocalSocialMediaAsset(input: {
  buffer: Buffer;
  mimeType: string;
  mediaType: "image" | "video";
  storagePath: string;
}): Promise<PersistedSocialMediaAsset> {
  const filePath = resolveLocalSocialMediaFilePath(input.storagePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, input.buffer);

  return {
    mediaType: input.mediaType,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.byteLength,
    storagePath: input.storagePath,
    url: buildLocalDownloadUrl(input.storagePath)
  };
}

async function persistPreparedSocialMediaBuffer(input: {
  buffer: Buffer;
  mimeType: string;
  mediaType: "image" | "video";
  storagePath: string;
  cacheControl?: string;
  customMetadata?: Record<string, string>;
}): Promise<PersistedSocialMediaAsset> {
  const token = randomUUID();

  try {
    ensureStorageConfigured();

    const bucket = getFirebaseAdminStorageBucket();
    await bucket.file(input.storagePath).save(input.buffer, {
      resumable: false,
      metadata: {
        contentType: input.mimeType,
        cacheControl: input.cacheControl ?? SOCIAL_MEDIA_CACHE_CONTROL,
        metadata: {
          firebaseStorageDownloadTokens: token,
          ...(input.customMetadata ?? {})
        }
      }
    });

    return {
      mediaType: input.mediaType,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.byteLength,
      storagePath: input.storagePath,
      url: buildDownloadUrl(bucket.name, input.storagePath, token)
    };
  } catch (error) {
    if (!isFirebaseStorageFailure(error)) {
      throw error;
    }

    return persistLocalSocialMediaAsset({
      buffer: input.buffer,
      mimeType: input.mimeType,
      mediaType: input.mediaType,
      storagePath: input.storagePath
    });
  }
}

function buildVariantStoragePath(storagePath: string, label: string) {
  const extension = path.extname(storagePath);
  const basePath = storagePath.slice(0, storagePath.length - extension.length);
  return `${basePath}-${label}.mp4`;
}

function parseFfmpegMetadata(stderr: string) {
  const durationMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  const dimensionMatch = stderr.match(/,\s*(\d{2,5})x(\d{2,5})(?:[,\s]|\[)/);

  const durationSeconds = durationMatch
    ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    : null;

  return {
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    width: dimensionMatch ? Number(dimensionMatch[1]) : null,
    height: dimensionMatch ? Number(dimensionMatch[2]) : null
  };
}

function runFfmpeg(args: string[], options?: { allowNonZeroExit?: boolean; timeoutMs?: number }) {
  const binaryPath = typeof ffmpegPath === "string" ? ffmpegPath : null;

  if (!binaryPath) {
    throw new Error("FFmpeg binary is not available.");
  }

  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    const timeout = setTimeout(() => {
      finish(() => {
        child.kill("SIGKILL");
        reject(new Error("FFmpeg timed out while processing media."));
      });
    }, options?.timeoutMs ?? FFMPEG_TIMEOUT_MS);

    function finish(callback: () => void) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      callback();
    }

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => {
      finish(() => {
        const result = {
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: Buffer.concat(stderrChunks).toString("utf8")
        };

        if (code === 0 || options?.allowNonZeroExit) {
          resolve(result);
          return;
        }

        reject(new Error(result.stderr || `FFmpeg failed with exit code ${code}.`));
      });
    });
  });
}

async function readVideoMetadata(inputPath: string) {
  const result = await runFfmpeg(["-hide_banner", "-i", inputPath], { allowNonZeroExit: true });
  return parseFfmpegMetadata(result.stderr);
}

function resolveVideoVariantTargets(sourceHeight: number | null) {
  if (!sourceHeight || sourceHeight < 720) {
    return [{ label: "source", height: sourceHeight ?? 720, crf: 22 }];
  }

  const targets = VIDEO_VARIANT_TARGETS.filter((target) => target.height <= sourceHeight);
  const highestTarget = targets[targets.length - 1] ?? null;

  if (!highestTarget || highestTarget.height < sourceHeight) {
    const normalizedHeight = Math.min(sourceHeight, 2160);
    targets.push({
      label: `${normalizedHeight}p`,
      height: normalizedHeight,
      crf: normalizedHeight >= 1440 ? 20 : 21
    });
  }

  return targets;
}

async function transcodeVideoVariant(input: {
  inputPath: string;
  outputPath: string;
  height: number;
  crf: number;
}) {
  await runFfmpeg([
    "-y",
    "-hide_banner",
    "-i",
    input.inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-vf",
    `scale=-2:${Math.max(2, input.height)}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    String(input.crf),
    "-pix_fmt",
    "yuv420p",
    "-profile:v",
    "high",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-max_muxing_queue_size",
    "1024",
    input.outputPath
  ]);
}

async function persistProcessedVibeVideo(input: {
  buffer: Buffer;
  uploadPlan: ReturnType<typeof planSocialMediaAssetUpload>;
}): Promise<PersistedSocialMediaAsset> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vyb-vibe-"));
  const inputPath = path.join(tempRoot, input.uploadPlan.originalFileName);

  try {
    await writeFile(inputPath, input.buffer);
    const sourceMetadata = await readVideoMetadata(inputPath);
    const targets = resolveVideoVariantTargets(sourceMetadata.height);
    const variants: SocialVideoVariant[] = [];

    for (const target of targets) {
      const outputPath = path.join(tempRoot, `${target.label}.mp4`);
      const outputStoragePath = buildVariantStoragePath(input.uploadPlan.storagePath, target.label);

      await transcodeVideoVariant({
        inputPath,
        outputPath,
        height: target.height,
        crf: target.crf
      });

      const outputBuffer = await readFile(outputPath);
      const persisted = await persistPreparedSocialMediaBuffer({
        buffer: outputBuffer,
        mimeType: "video/mp4",
        mediaType: "video",
        storagePath: outputStoragePath,
        cacheControl: input.uploadPlan.cacheControl,
        customMetadata: {
          ...input.uploadPlan.customMetadata,
          video_variant: target.label,
          source_deleted_after_processing: "true"
        }
      });

      variants.push({
        label: target.label,
        width: sourceMetadata.width && sourceMetadata.height
          ? Math.round((sourceMetadata.width / sourceMetadata.height) * target.height)
          : null,
        height: target.height,
        mimeType: persisted.mimeType,
        sizeBytes: persisted.sizeBytes,
        storagePath: persisted.storagePath,
        url: persisted.url
      });
    }

    const preferredVariant =
      [...variants].sort((left, right) => {
        const leftScore = Math.abs(left.height - 1080);
        const rightScore = Math.abs(right.height - 1080);
        return leftScore - rightScore || right.height - left.height;
      })[0] ?? variants[0];

    if (!preferredVariant) {
      throw new Error("No playable video variant was generated.");
    }

    return {
      mediaType: "video",
      mimeType: preferredVariant.mimeType,
      sizeBytes: preferredVariant.sizeBytes,
      storagePath: preferredVariant.storagePath,
      url: preferredVariant.url,
      variants,
      processingStatus: "ready"
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function persistSocialMediaAsset(input: {
  tenantId: string;
  userId: string;
  intent: "post" | "story" | "vibe";
  file: File;
}) {
  const uploadPlan = planSocialMediaAssetUpload({
    tenantId: input.tenantId,
    userId: input.userId,
    intent: input.intent,
    fileName: input.file.name,
    mimeType: input.file.type || "application/octet-stream",
    sizeBytes: input.file.size
  });

  const buffer = Buffer.from(await input.file.arrayBuffer());
  if (buffer.byteLength <= 0) {
    throw new Error("Upload payload is empty.");
  }

  const maxBytes = resolveMaxBytesForMediaType(uploadPlan.mediaType);
  if (buffer.byteLength > maxBytes) {
    throw new Error(
      uploadPlan.mediaType === "video"
        ? "Video is still too large after optimization. Keep it under 40 MB."
        : "Image is too large right now. Keep it under 4 MB."
    );
  }

  if (shouldProcessSocialVideoOnServer(input.intent, uploadPlan.mediaType)) {
    try {
      return await persistProcessedVibeVideo({
        buffer,
        uploadPlan
      });
    } catch (error) {
      console.warn("[web/social-media] vibe video processing failed", {
        tenantId: input.tenantId,
        userId: input.userId,
        intent: input.intent,
        fileName: uploadPlan.originalFileName,
        message: error instanceof Error ? error.message : "unknown"
      });
      throw new Error("Video processing failed. Try a shorter MP4 under 40 MB.");
    }
  }

  try {
    return await persistPreparedSocialMediaBuffer({
      buffer,
      mimeType: uploadPlan.mimeType,
      mediaType: uploadPlan.mediaType,
      storagePath: uploadPlan.storagePath,
      cacheControl: uploadPlan.cacheControl,
      customMetadata: uploadPlan.customMetadata
    });
  } catch (error) {
    if (!isFirebaseStorageFailure(error)) {
      throw error;
    }

    console.warn("[web/social-media] falling back to local media storage", {
      tenantId: input.tenantId,
      userId: input.userId,
      intent: input.intent,
      fileName: uploadPlan.originalFileName,
      message: error instanceof Error ? error.message : "unknown"
    });

    return persistLocalSocialMediaAsset({
      buffer,
      mimeType: uploadPlan.mimeType,
      mediaType: uploadPlan.mediaType,
      storagePath: uploadPlan.storagePath
    });
  }
}
