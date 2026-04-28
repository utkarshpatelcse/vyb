"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { getDownloadURL, ref, uploadBytesResumable, type UploadTaskSnapshot } from "firebase/storage";
import { getFirebaseClientAuth, getFirebaseClientStorage, isFirebaseClientConfigured } from "./firebase-client";

export type UploadedSocialMediaAsset = {
  mediaType: "image" | "video";
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  url: string;
  variants?: {
    label: string;
    width: number | null;
    height: number;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
    url: string;
  }[];
  processingStatus?: "ready" | "passthrough";
};

type SocialMediaDirectUploadPlan = {
  storagePath: string;
  mediaType: "image" | "video";
  mimeType: string;
  sizeBytes: number;
  cacheControl?: string;
  customMetadata?: Record<string, string>;
};

type VideoFrameCallback = (now: number, metadata: VideoFrameCallbackMetadata) => void;
type VideoFrameRequester = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
  requestVideoFrameCallback?: (callback: VideoFrameCallback) => number;
};

const DEFAULT_MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const DEFAULT_TARGET_VIDEO_BYTES = Math.floor(DEFAULT_MAX_VIDEO_BYTES * 0.96);
const SERVER_PROXY_SAFE_UPLOAD_BYTES = DEFAULT_MAX_VIDEO_BYTES;
const VIDEO_COMPRESSION_FRAME_RATE = 30;
const VIDEO_AUDIO_BITRATE = 128_000;
const MIN_VIDEO_BITRATE = 500_000;
const MAX_VIDEO_BITRATE = 6_000_000;

function getMediaType(file: File) {
  if (file.type.startsWith("video/")) {
    return "video" as const;
  }

  if (file.type.startsWith("image/")) {
    return "image" as const;
  }

  return null;
}

function replaceFileExtension(fileName: string, nextExtension: string) {
  const withoutExtension = fileName.replace(/\.[^./\\]+$/, "");
  return `${withoutExtension || "social-upload"}.${nextExtension}`;
}

function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  const supported = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  return supported.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? null;
}

function normalizeMimeType(value: string) {
  return value.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

function formatDimension(value: number) {
  return Math.max(2, Math.round(value / 2) * 2);
}

function getScaledDimensions(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: formatDimension(width * scale),
    height: formatDimension(height * scale)
  };
}

function computeVideoBitrate(targetBytes: number, durationSeconds: number, bitrateScale = 1) {
  const safeDuration = Math.max(durationSeconds, 1);
  const targetBits = targetBytes * 8 * 0.94;
  const videoBitsPerSecond = Math.floor((targetBits / safeDuration - VIDEO_AUDIO_BITRATE) * bitrateScale);
  return Math.min(MAX_VIDEO_BITRATE, Math.max(MIN_VIDEO_BITRATE, videoBitsPerSecond));
}

function canCompressVideoInBrowser() {
  return typeof document !== "undefined" && typeof MediaRecorder !== "undefined";
}

function canSafelyFallbackToServerProxy(file: File) {
  if (typeof window === "undefined") {
    return true;
  }

  const hostname = window.location.hostname.toLowerCase();
  const isPrivateNetworkHost =
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    isPrivateNetworkHost;

  return isLocalHost || file.size <= SERVER_PROXY_SAFE_UPLOAD_BYTES;
}

function isFirebasePermissionError(error: unknown) {
  return error instanceof Error && /storage\/unauthorized|permission|unauthorized/i.test(error.message);
}

async function loadVideoElement(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video") as VideoFrameRequester;
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("We could not read this video for optimization."));
  });

  return {
    video,
    cleanup() {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    }
  };
}

async function transcodeVideo(file: File, options: { maxDimension: number; targetBytes: number; bitrateScale: number }) {
  const { video, cleanup } = await loadVideoElement(file);

  try {
    const mimeType = pickRecorderMimeType();
    if (!mimeType) {
      throw new Error("This browser could not optimize the video automatically.");
    }

    const { width, height } = getScaledDimensions(video.videoWidth, video.videoHeight, options.maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("We could not prepare this video for upload.");
    }

    const sourceStream = video.captureStream?.() ?? video.mozCaptureStream?.() ?? null;
    const canvasStream = canvas.captureStream(VIDEO_COMPRESSION_FRAME_RATE);
    const combinedTracks = [...canvasStream.getVideoTracks(), ...(sourceStream?.getAudioTracks() ?? [])];

    if (combinedTracks.length === 0) {
      throw new Error("We could not prepare this video for upload.");
    }

    const recorder = new MediaRecorder(new MediaStream(combinedTracks), {
      mimeType,
      videoBitsPerSecond: computeVideoBitrate(options.targetBytes, video.duration, options.bitrateScale),
      audioBitsPerSecond: sourceStream?.getAudioTracks().length ? VIDEO_AUDIO_BITRATE : undefined
    });

    const chunks: Blob[] = [];
    const stopPromise = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = () => reject(new Error("We could not optimize this video."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    let cancelled = false;
    const drawFrame = () => {
      if (cancelled) {
        return;
      }

      context.drawImage(video, 0, 0, width, height);

      if (video.ended || video.paused) {
        return;
      }

      if (video.requestVideoFrameCallback) {
        video.requestVideoFrameCallback(() => drawFrame());
      } else {
        requestAnimationFrame(drawFrame);
      }
    };

    recorder.start(250);
    await video.play();
    drawFrame();

    await new Promise<void>((resolve, reject) => {
      video.onended = () => resolve();
      video.onerror = () => reject(new Error("We could not finish reading this video."));
    });

    cancelled = true;

    if (recorder.state !== "inactive") {
      recorder.stop();
    }

    const blob = await stopPromise;
    canvasStream.getTracks().forEach((track) => track.stop());
    sourceStream?.getTracks().forEach((track) => track.stop());

    return new File([blob], replaceFileExtension(file.name || "social-video", "webm"), {
      type: normalizeMimeType(blob.type || "video/webm"),
      lastModified: Date.now()
    });
  } finally {
    cleanup();
  }
}

async function compressVideoToTarget(file: File, targetBytes: number) {
  const attempts = [
    { maxDimension: 1920, bitrateScale: 1 },
    { maxDimension: 1600, bitrateScale: 0.92 },
    { maxDimension: 1280, bitrateScale: 0.82 },
    { maxDimension: 960, bitrateScale: 0.72 },
    { maxDimension: 720, bitrateScale: 0.62 }
  ];

  let bestFile = file;

  for (const attempt of attempts) {
    const compressed = await transcodeVideo(file, {
      maxDimension: attempt.maxDimension,
      targetBytes,
      bitrateScale: attempt.bitrateScale
    });

    if (compressed.size < bestFile.size) {
      bestFile = compressed;
    }

    if (compressed.size <= targetBytes) {
      return compressed;
    }
  }

  return bestFile;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function prepareSocialUploadFile(
  file: File,
  options?: {
    maxVideoBytes?: number;
    targetVideoBytes?: number;
    compressVideo?: boolean;
  }
) {
  const mediaType = getMediaType(file);
  if (!mediaType) {
    throw new Error("Only image and video files are supported right now.");
  }

  if (mediaType === "image") {
    return {
      file,
      mediaType,
      optimizationSummary: null as string | null
    };
  }

  const maxVideoBytes = options?.maxVideoBytes ?? DEFAULT_MAX_VIDEO_BYTES;
  const targetVideoBytes = Math.min(options?.targetVideoBytes ?? DEFAULT_TARGET_VIDEO_BYTES, maxVideoBytes);

  if (file.size <= maxVideoBytes) {
    return {
      file,
      mediaType,
      optimizationSummary: null as string | null
    };
  }

  if (options?.compressVideo === false) {
    throw new Error(`Keep this video under ${formatBytes(maxVideoBytes)} before uploading.`);
  }

  if (!canCompressVideoInBrowser()) {
    throw new Error(`This browser could not optimize the video automatically. Keep it under ${formatBytes(maxVideoBytes)}.`);
  }

  const compressedFile = await compressVideoToTarget(file, targetVideoBytes);

  if (compressedFile.size > maxVideoBytes) {
    throw new Error(`We could not shrink this video enough. Keep the final clip under ${formatBytes(maxVideoBytes)}.`);
  }

  return {
    file: compressedFile,
    mediaType,
    optimizationSummary:
      compressedFile.size < file.size
        ? `Video optimized from ${formatBytes(file.size)} to ${formatBytes(compressedFile.size)}.`
        : null
  };
}

export async function uploadSocialMediaAsset(
  file: File,
  intent: "post" | "story" | "vibe",
  options?: {
    debugTaskId?: string;
    debugStage?: string;
    onUploadProgress?: (progress: number) => void;
  }
) {
  const uploadViaServerProxy = async () => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("intent", intent);

    const response = await fetch("/api/social-media", {
      method: "POST",
      headers: {
        ...(options?.debugTaskId ? { "x-vyb-debug-task-id": options.debugTaskId } : {}),
        ...(options?.debugStage ? { "x-vyb-debug-stage": options.debugStage } : {})
      },
      body: formData
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          asset?: UploadedSocialMediaAsset;
          error?: {
            code?: string;
            message?: string;
            requestId?: string;
          };
        }
      | null;

    if (!response.ok || !payload?.asset) {
      const message =
        response.status === 413
          ? "This upload route rejected the file before it reached storage. Deploy the Firebase Storage rules for direct uploads or keep the file smaller."
          : payload?.error?.message ?? "We could not upload this media right now.";
      const requestId = payload?.error?.requestId ? `, request: ${payload.error.requestId}` : "";
      throw new Error(`${message} (stage: upload, status: ${response.status}${requestId})`);
    }

    return payload.asset;
  };

  const prepareResponse = await fetch("/api/social-media", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options?.debugTaskId ? { "x-vyb-debug-task-id": options.debugTaskId } : {}),
      ...(options?.debugStage ? { "x-vyb-debug-stage": "Prepare" } : {})
    },
    body: JSON.stringify({
      intent,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size
    })
  });

  const preparePayload = (await prepareResponse.json().catch(() => null)) as
    | {
        uploadStrategy?: "firebase-client" | "server-proxy";
        directUpload?: SocialMediaDirectUploadPlan | null;
        error?: {
          code?: string;
          message?: string;
          requestId?: string;
        };
      }
    | null;

  if (!prepareResponse.ok) {
    const message = preparePayload?.error?.message ?? "We could not prepare this media for upload.";
    const requestId = preparePayload?.error?.requestId ? `, request: ${preparePayload.error.requestId}` : "";
    throw new Error(`${message} (stage: prepare, status: ${prepareResponse.status}${requestId})`);
  }

  if (preparePayload?.uploadStrategy === "firebase-client" && preparePayload.directUpload) {
    if (!isFirebaseClientConfigured()) {
      throw new Error("Firebase web storage is not configured for direct uploads.");
    }

    const auth = await getFirebaseClientAuth();
    const currentUser =
      auth.currentUser ??
      (await new Promise<User | null>((resolve) => {
        const timeout = window.setTimeout(() => resolve(null), 4000);
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          window.clearTimeout(timeout);
          unsubscribe();
          resolve(user);
        });
      }));

    if (!currentUser) {
      console.warn("[social-media-client] direct upload skipped because Firebase auth user is unavailable; falling back to server upload.", {
        intent,
        taskId: options?.debugTaskId ?? null
      });

      if (!canSafelyFallbackToServerProxy(file)) {
        throw new Error(
          "Firebase sign-in is not ready for direct upload, and this file is too large for the upload proxy. Refresh the session and try again."
        );
      }

      return uploadViaServerProxy();
    }

    try {
      await currentUser.getIdToken(true);
      const storage = getFirebaseClientStorage();
      const storageRef = ref(storage, preparePayload.directUpload.storagePath);
      const uploadSnapshot = await new Promise<UploadTaskSnapshot>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file, {
          contentType: preparePayload.directUpload!.mimeType,
          cacheControl: preparePayload.directUpload!.cacheControl,
          customMetadata: preparePayload.directUpload!.customMetadata
        });

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            if (snapshot.totalBytes > 0) {
              options?.onUploadProgress?.(snapshot.bytesTransferred / snapshot.totalBytes);
            }
          },
          reject,
          () => resolve(uploadTask.snapshot)
        );
      });
      const url = await getDownloadURL(uploadSnapshot.ref);
      options?.onUploadProgress?.(1);

      return {
        mediaType: preparePayload.directUpload.mediaType,
        mimeType: preparePayload.directUpload.mimeType,
        sizeBytes: file.size,
        storagePath: preparePayload.directUpload.storagePath,
        url
      };
    } catch (error) {
      console.warn("[social-media-client] direct upload failed; falling back to server upload.", {
        intent,
        taskId: options?.debugTaskId ?? null,
        message: error instanceof Error ? error.message : "unknown"
      });

      if (!canSafelyFallbackToServerProxy(file)) {
        throw new Error(
          error instanceof Error
            ? `${error.message} Direct Firebase upload failed, and this file is too large for the upload proxy.`
            : "Direct Firebase upload failed, and this file is too large for the upload proxy."
        );
      }

      try {
        return await uploadViaServerProxy();
      } catch (fallbackError) {
        if (isFirebasePermissionError(error)) {
          const directErrorMessage = error instanceof Error ? error.message : "Direct Firebase upload failed.";
          throw new Error(
            fallbackError instanceof Error
              ? `${directErrorMessage} Server upload fallback also failed: ${fallbackError.message}`
              : `${directErrorMessage} Server upload fallback also failed.`
          );
        }

        throw fallbackError;
      }
    }
  }

  return uploadViaServerProxy();
}
