"use client";

export type UploadedSocialMediaAsset = {
  mediaType: "image" | "video";
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  url: string;
};

type VideoFrameCallback = (now: number, metadata: VideoFrameCallbackMetadata) => void;
type VideoFrameRequester = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
  requestVideoFrameCallback?: (callback: VideoFrameCallback) => number;
};

const DEFAULT_MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const DEFAULT_TARGET_VIDEO_BYTES = Math.floor(DEFAULT_MAX_VIDEO_BYTES * 0.96);
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
      type: blob.type || "video/webm",
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
  }
) {
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
    const message = payload?.error?.message ?? "We could not upload this media right now.";
    const requestId = payload?.error?.requestId ? `, request: ${payload.error.requestId}` : "";
    throw new Error(`${message} (stage: upload, status: ${response.status}${requestId})`);
  }

  return payload.asset;
}
