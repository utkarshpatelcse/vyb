"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export const STORY_MUSIC_DEFAULT_CLIP_SECONDS = 15;
export const STORY_MUSIC_CLIP_OPTIONS = [15, 30, 45, 60] as const;
export const STORY_MUSIC_EXPORT_WIDTH = 1080;
export const STORY_MUSIC_EXPORT_HEIGHT = 1920;
const STORY_MUSIC_STICKER_WIDTH = 520;
const STORY_MUSIC_STICKER_HEIGHT = 136;
const FFMPEG_CORE_VERSION = "0.12.10";
const FFMPEG_CORE_BASE_URL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

export type StoryMusicTrack = {
  id: string;
  title: string;
  artistName: string;
  durationSeconds: number;
  artworkUrl: string | null;
  streamUrl: string;
};

export type StoryMusicStickerPosition = {
  x: number;
  y: number;
};

type StoryMusicCompositionInput = {
  visualFile: File;
  visualKind: "image" | "video";
  track: StoryMusicTrack;
  clipDurationSeconds: number;
  trimStartSeconds: number;
  stickerPosition: StoryMusicStickerPosition;
  onStatus?: (status: string) => void;
};

let ffmpegPromise: Promise<FFmpeg> | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeBaseName(fileName: string) {
  return (fileName.replace(/\.[^./\\]+$/, "") || "story").replace(/[^a-z0-9_-]+/gi, "-");
}

function getExportDuration(
  visualKind: "image" | "video",
  visualDurationSeconds: number,
  musicDurationSeconds: number,
  maxClipDurationSeconds: number
) {
  if (visualKind === "image") {
    return clamp(musicDurationSeconds, 1, maxClipDurationSeconds);
  }

  return clamp(Math.min(visualDurationSeconds, musicDurationSeconds, maxClipDurationSeconds), 1, maxClipDurationSeconds);
}

async function getVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const cleanup = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : STORY_MUSIC_DEFAULT_CLIP_SECONDS;
      cleanup();
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("We could not read this story video."));
    };
    video.src = url;
  });
}

async function getFFmpegInstance() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm")
      });
      return ffmpeg;
    })();
  }

  return ffmpegPromise;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

async function buildStickerFile(track: StoryMusicTrack) {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_MUSIC_STICKER_WIDTH;
  canvas.height = STORY_MUSIC_STICKER_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("We could not draw the music sticker.");
  }

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "rgba(236,72,153,0.92)");
  gradient.addColorStop(1, "rgba(99,102,241,0.92)");
  drawRoundedRect(context, 0, 0, canvas.width, canvas.height, 36);
  context.fillStyle = gradient;
  context.fill();

  context.fillStyle = "rgba(255,255,255,0.18)";
  drawRoundedRect(context, 12, 12, canvas.width - 24, canvas.height - 24, 28);
  context.fill();

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(64, 68, 30, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(17,24,39,0.92)";
  context.beginPath();
  context.arc(64, 68, 12, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = "700 38px Arial";
  context.textBaseline = "top";
  context.fillText(track.title.slice(0, 26), 116, 28);

  context.fillStyle = "rgba(255,255,255,0.82)";
  context.font = "500 26px Arial";
  context.fillText(track.artistName.slice(0, 34), 116, 76);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

  if (!blob) {
    throw new Error("We could not render the music sticker.");
  }

  return new File([blob], "music-sticker.png", { type: "image/png" });
}

function buildOverlayCoordinates(position: StoryMusicStickerPosition) {
  const maxX = STORY_MUSIC_EXPORT_WIDTH - STORY_MUSIC_STICKER_WIDTH - 32;
  const maxY = STORY_MUSIC_EXPORT_HEIGHT - STORY_MUSIC_STICKER_HEIGHT - 40;
  const x = Math.round(clamp(position.x, 0.04, 0.96) * STORY_MUSIC_EXPORT_WIDTH);
  const y = Math.round(clamp(position.y, 0.08, 0.9) * STORY_MUSIC_EXPORT_HEIGHT);
  return {
    x: clamp(x, 24, maxX),
    y: clamp(y, 24, maxY)
  };
}

export async function searchStoryMusicTracks(query: string) {
  const url = new URL("/api/story-music", window.location.origin);
  if (query.trim()) {
    url.searchParams.set("q", query.trim());
  }

  const response = await fetch(url.toString(), { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as
    | {
        items?: StoryMusicTrack[];
        error?: { message?: string };
      }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "We could not load the music library.");
  }

  return payload?.items ?? [];
}

export async function composeStoryMusicVideo({
  visualFile,
  visualKind,
  track,
  clipDurationSeconds,
  trimStartSeconds,
  stickerPosition,
  onStatus
}: StoryMusicCompositionInput) {
  const ffmpeg = await getFFmpegInstance();
  const safeBaseName = sanitizeBaseName(visualFile.name);
  const visualExtension = visualKind === "image" ? "png" : "mp4";
  const visualInputName = `story-input.${visualExtension}`;
  const musicInputName = "story-music.mp3";
  const stickerInputName = "story-sticker.png";
  const outputName = `${safeBaseName}-music-story.mp4`;

  const audioResponse = await fetch(track.streamUrl, { cache: "no-store" });
  if (!audioResponse.ok) {
    throw new Error("We could not fetch this song for your story.");
  }

  const audioBlob = await audioResponse.blob();
  const stickerFile = await buildStickerFile(track);
  const normalizedClipDuration = clamp(
    clipDurationSeconds,
    STORY_MUSIC_DEFAULT_CLIP_SECONDS,
    STORY_MUSIC_CLIP_OPTIONS[STORY_MUSIC_CLIP_OPTIONS.length - 1]
  );
  const visualDuration = visualKind === "video" ? await getVideoDuration(visualFile) : normalizedClipDuration;
  const audioDuration = clamp(track.durationSeconds - trimStartSeconds, 1, normalizedClipDuration);
  const outputDuration = getExportDuration(visualKind, visualDuration, audioDuration, normalizedClipDuration);
  const overlay = buildOverlayCoordinates(stickerPosition);

  onStatus?.("Preparing music mix...");
  await ffmpeg.writeFile(visualInputName, await fetchFile(visualFile));
  await ffmpeg.writeFile(musicInputName, await fetchFile(audioBlob));
  await ffmpeg.writeFile(stickerInputName, await fetchFile(stickerFile));

  onStatus?.("Embedding song into story...");

  const filter =
    `[0:v]scale=${STORY_MUSIC_EXPORT_WIDTH}:${STORY_MUSIC_EXPORT_HEIGHT}:force_original_aspect_ratio=decrease,` +
    `pad=${STORY_MUSIC_EXPORT_WIDTH}:${STORY_MUSIC_EXPORT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black[base];` +
    `[base][2:v]overlay=${overlay.x}:${overlay.y}:format=auto[vout]`;

  const command =
    visualKind === "image"
      ? [
          "-loop",
          "1",
          "-framerate",
          "30",
          "-i",
          visualInputName,
          "-ss",
          trimStartSeconds.toFixed(2),
          "-i",
          musicInputName,
          "-i",
          stickerInputName,
          "-filter_complex",
          filter,
          "-map",
          "[vout]",
          "-map",
          "1:a",
          "-t",
          outputDuration.toFixed(2),
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          outputName
        ]
      : [
          "-i",
          visualInputName,
          "-ss",
          trimStartSeconds.toFixed(2),
          "-i",
          musicInputName,
          "-i",
          stickerInputName,
          "-filter_complex",
          filter,
          "-map",
          "[vout]",
          "-map",
          "1:a",
          "-t",
          outputDuration.toFixed(2),
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          outputName
        ];

  await ffmpeg.exec(command);

  const bytes = await ffmpeg.readFile(outputName);
  if (typeof bytes === "string") {
    throw new Error("The music export returned an unexpected text payload.");
  }

  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  await Promise.allSettled([
    ffmpeg.deleteFile(visualInputName),
    ffmpeg.deleteFile(musicInputName),
    ffmpeg.deleteFile(stickerInputName),
    ffmpeg.deleteFile(outputName)
  ]);

  const outputBytes = new Uint8Array(data.byteLength);
  outputBytes.set(data);

  const result = new File([outputBytes.buffer], outputName, {
    type: "video/mp4",
    lastModified: Date.now()
  });

  onStatus?.("Music story ready.");
  return {
    file: result,
    durationSeconds: outputDuration
  };
}
