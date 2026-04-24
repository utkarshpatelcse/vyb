"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type {
  CampusUploadKind,
  CampusUploadMediaKind,
} from "../lib/campus-upload-store";
import { formatBytes } from "../lib/social-media-client";
import { enqueueBackgroundPublish } from "../lib/background-publish";
import {
  STORY_MUSIC_CLIP_OPTIONS,
  STORY_MUSIC_DEFAULT_CLIP_SECONDS,
  searchStoryMusicTracks,
  type StoryMusicStickerPosition,
  type StoryMusicTrack,
} from "../lib/story-music";
import { CampusAvatarContent } from "./campus-avatar";

/* ─── Types ─────────────────────────────────────────────────────────────── */
type CampusUploadShellProps = {
  collegeName: string;
  viewerEmail: string;
  viewerName: string;
  viewerUsername: string;
};

type CreationMode = "choice" | "story" | "vibe" | "moment";
type PublishableCreationMode = Exclude<CreationMode, "choice">;

type StoryComposerAsset = {
  id: string;
  url: string;
  file: File;
  kind: "image" | "video";
  durationSeconds: number | null;
};

/* ─── Constants ─────────────────────────────────────────────────────────── */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const STORY_IMAGE_DURATION_SECONDS = 15;
const STORY_MAX_TOTAL_SECONDS = 60;
const STORY_MAX_IMAGES = STORY_MAX_TOTAL_SECONDS / STORY_IMAGE_DURATION_SECONDS;

const CREATION_MODE_OPTIONS: Array<{ value: PublishableCreationMode; label: string }> = [
  { value: "story", label: "Story" },
  { value: "moment", label: "Post" },
  { value: "vibe", label: "Vibe" }
];

/* ─── Icon components ────────────────────────────────────────────────────── */
function Ico({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="cs-icon">
      {children}
    </svg>
  );
}

function IcoClose() {
  return (
    <Ico>
      <path
        d="m7 7 10 10M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Ico>
  );
}

function IcoVideo() {
  return (
    <Ico>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4H14a2.5 2.5 0 0 1 2.5 2.5v1.2l3.5-2.1v12.8l-3.5-2.1v1.2A2.5 2.5 0 0 1 14 20H7.5A2.5 2.5 0 0 1 5 17.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Ico>
  );
}

function IcoImage() {
  return (
    <Ico>
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zm0 9 4.5-4.5 3 3 4.5-5.5 4 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="1.6" fill="currentColor" />
    </Ico>
  );
}

function IcoMusic() {
  return (
    <Ico>
      <path
        d="M15 5v9.2a2.8 2.8 0 1 1-1.8-2.63V7.3L8 8.5V16a2.8 2.8 0 1 1-1.8-2.63V6.9z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Ico>
  );
}

function IcoSearch() {
  return (
    <Ico>
      <path
        d="m21 21-4.35-4.35M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Ico>
  );
}

function IcoUpload() {
  return (
    <Ico>
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Ico>
  );
}

function IcoPlus() {
  return (
    <Ico>
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Ico>
  );
}

function IcoChevronDown() {
  return (
    <Ico>
      <path
        d="m6 9 6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Ico>
  );
}

function IcoTrash() {
  return (
    <Ico>
      <path
        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Ico>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function getInitials(name: string, username: string) {
  const source = name.trim() || username.trim();
  const tokens = source.split(/\s+/u).filter(Boolean);
  if (tokens.length >= 2) {
    return `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatDuration(seconds: number) {
  const total = Math.max(1, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function loadVideoMetadata(file: File) {
  return new Promise<{ duration: number; height: number; width: number }>(
    (resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      const cleanup = () => {
        v.removeAttribute("src");
        v.load();
        URL.revokeObjectURL(url);
      };
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        resolve({ duration: v.duration, height: v.videoHeight, width: v.videoWidth });
        cleanup();
      };
      v.onerror = () => { cleanup(); reject(new Error("Unable to read this video.")); };
      v.src = url;
    }
  );
}

function parseKind(value: string | null): CampusUploadKind {
  if (value === "story" || value === "vibe") return value;
  return "post";
}

function makeComposerAssetId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `asset-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function getModeLabel(mode: CreationMode) {
  if (mode === "choice") {
    return "Creation Studio";
  }

  return CREATION_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? "Post";
}

function getPublishLabel(mode: PublishableCreationMode) {
  if (mode === "vibe") {
    return "Publish Vibe";
  }

  if (mode === "story") {
    return "Publish Story";
  }

  return "Publish Post";
}

/* ─── Shimmer skeleton ───────────────────────────────────────────────────── */
/* ─── Progress bar ───────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════════════════
   CampusUploadShell — main export
   ══════════════════════════════════════════════════════════════════════════ */
export function CampusUploadShell({
  collegeName,
  viewerEmail,
  viewerName,
  viewerUsername,
}: CampusUploadShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultKind = parseKind(searchParams.get("kind"));
  const returnTo =
    searchParams.get("from") || (defaultKind === "vibe" ? "/vibes" : "/home");

  /* ── Creation mode (choice / vibe / moment) ──────────────────────────── */
  const [mode, setMode] = useState<CreationMode>(() =>
    defaultKind === "vibe"
      ? "vibe"
      : defaultKind === "story"
        ? "story"
        : defaultKind === "post"
          ? "moment"
          : "choice"
  );

  /* ── Form state ──────────────────────────────────────────────────────── */
  const [caption, setCaption] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  /* ── Vibe (single video) ─────────────────────────────────────────────── */
  const [vibeVideoUrl, setVibeVideoUrl] = useState<string | null>(null);
  const [vibeVideoFile, setVibeVideoFile] = useState<File | null>(null);
  const [vibeDuration, setVibeDuration] = useState<number | null>(null);
  const [vibeIsPortrait, setVibeIsPortrait] = useState<boolean | null>(null);
  const [vibeIsDragOver, setVibeIsDragOver] = useState(false);
  const vibeInputRef = useRef<HTMLInputElement | null>(null);
  const vibeVideoRef = useRef<HTMLVideoElement | null>(null);

  /* ── Story / Moment media ────────────────────────────────────────────── */
  const [storyAssets, setStoryAssets] = useState<StoryComposerAsset[]>([]);
  const [activeStoryAssetId, setActiveStoryAssetId] = useState<string | null>(null);
  const [momentImages, setMomentImages] = useState<{ id: string; url: string; file: File }[]>([]);
  const [isStoryMusicLibraryOpen, setIsStoryMusicLibraryOpen] = useState(false);
  const [storyMusicQuery, setStoryMusicQuery] = useState("");
  const [storyMusicTracks, setStoryMusicTracks] = useState<StoryMusicTrack[]>([]);
  const [isStoryMusicLoading, setIsStoryMusicLoading] = useState(false);
  const [storyMusicTrack, setStoryMusicTrack] = useState<StoryMusicTrack | null>(null);
  const [storyMusicClipDurationSeconds, setStoryMusicClipDurationSeconds] = useState(
    STORY_MUSIC_DEFAULT_CLIP_SECONDS
  );
  const [storyMusicTrimSeconds, setStoryMusicTrimSeconds] = useState(0);
  const [storyMusicStatus, setStoryMusicStatus] = useState<string | null>(null);
  const [storyMusicStickerPosition, setStoryMusicStickerPosition] = useState<StoryMusicStickerPosition>({
    x: 0.18,
    y: 0.72
  });
  const [isDraggingMusicSticker, setIsDraggingMusicSticker] = useState(false);
  const [isStoryMusicPreviewPlaying, setIsStoryMusicPreviewPlaying] = useState(false);
  const [storyMusicPreviewCurrentTime, setStoryMusicPreviewCurrentTime] = useState(0);
  const momentInputRef = useRef<HTMLInputElement | null>(null);
  const storyPreviewRef = useRef<HTMLDivElement | null>(null);
  const storyMusicPreviewRef = useRef<HTMLAudioElement | null>(null);
  const storyMusicPreviewTimeoutRef = useRef<number | null>(null);
  const stickerDragOffsetRef = useRef({ x: 0, y: 0 });

  /* ── Derived ─────────────────────────────────────────────────────────── */
  const avatarInitials = useMemo(
    () => getInitials(viewerName, viewerUsername),
    [viewerName, viewerUsername]
  );

  const activeStoryAsset = useMemo(
    () => storyAssets.find((asset) => asset.id === activeStoryAssetId) ?? storyAssets[0] ?? null,
    [activeStoryAssetId, storyAssets]
  );

  const canAddStoryMusic = mode === "story" && storyAssets.length === 1;
  const storyMusicTrimMax = useMemo(() => {
    if (!storyMusicTrack) {
      return 0;
    }

    return Math.max(0, Math.floor(storyMusicTrack.durationSeconds - storyMusicClipDurationSeconds));
  }, [storyMusicClipDurationSeconds, storyMusicTrack]);

  const storyMusicPreviewEndSeconds = useMemo(() => {
    return storyMusicTrimSeconds + storyMusicClipDurationSeconds;
  }, [storyMusicClipDurationSeconds, storyMusicTrimSeconds]);

  const canPublish = useMemo(() => {
    if (mode === "vibe") {
      return Boolean(vibeVideoUrl && vibeIsPortrait !== false);
    }
    if (mode === "story") {
      return storyAssets.length > 0;
    }
    if (mode === "moment") {
      return Boolean(caption.trim() || momentImages.length > 0);
    }
    return false;
  }, [mode, vibeVideoUrl, vibeIsPortrait, caption, momentImages, storyAssets]);

  /* ── progress simulator for demo (real upload doesn't expose events) ─── */
  useEffect(() => {
    if (storyAssets.length === 0) {
      setActiveStoryAssetId(null);
      if (storyMusicTrack) {
        setStoryMusicTrack(null);
        setStoryMusicClipDurationSeconds(STORY_MUSIC_DEFAULT_CLIP_SECONDS);
        setStoryMusicTrimSeconds(0);
        setStoryMusicStatus(null);
      }
      return;
    }

    if (!storyAssets.some((asset) => asset.id === activeStoryAssetId)) {
      setActiveStoryAssetId(storyAssets[0]?.id ?? null);
    }

    if (storyAssets.length > 1 && storyMusicTrack) {
      setStoryMusicTrack(null);
      setStoryMusicClipDurationSeconds(STORY_MUSIC_DEFAULT_CLIP_SECONDS);
      setStoryMusicTrimSeconds(0);
      setStoryMusicStatus("Music export works with one story item at a time right now.");
    }
  }, [activeStoryAssetId, storyAssets, storyMusicTrack]);

  useEffect(() => {
    setStoryMusicTrimSeconds((current) => clamp(current, 0, storyMusicTrimMax));
  }, [storyMusicTrimMax]);

  useEffect(() => {
    return () => {
      if (storyMusicPreviewTimeoutRef.current !== null) {
        window.clearTimeout(storyMusicPreviewTimeoutRef.current);
      }
      storyMusicPreviewRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      if (!isStoryMusicLibraryOpen) {
        return;
      }

      setIsStoryMusicLoading(true);
      try {
        const items = await searchStoryMusicTracks(storyMusicQuery);
        if (!ignore) {
          setStoryMusicTracks(items);
        }
      } catch (error) {
        if (!ignore) {
          setStoryMusicTracks([]);
          setStoryMusicStatus(error instanceof Error ? error.message : "We could not load the music library.");
        }
      } finally {
        if (!ignore) {
          setIsStoryMusicLoading(false);
        }
      }
    }, 220);

    return () => {
      ignore = true;
      controller.abort();
      window.clearTimeout(id);
    };
  }, [isStoryMusicLibraryOpen, storyMusicQuery]);

  useEffect(() => {
    return () => {
      if (vibeVideoUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(vibeVideoUrl);
      }

      storyAssets.forEach((asset) => {
        if (asset.url.startsWith("blob:")) {
          URL.revokeObjectURL(asset.url);
        }
      });

      momentImages.forEach((entry) => {
        if (entry.url.startsWith("blob:")) {
          URL.revokeObjectURL(entry.url);
        }
      });
    };
  }, [momentImages, storyAssets, vibeVideoUrl]);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function handleClose() {
    router.push(returnTo);
  }

  function handleModeChange(nextMode: PublishableCreationMode) {
    stopStoryMusicPreview();
    setIsStoryMusicLibraryOpen(false);
    setMessage(null);
    setMode(nextMode);
  }

  /* ── Vibe video pick ─────────────────────────────────────────────────── */
  async function processVibeFile(file: File) {
    if (!file.type.startsWith("video/")) {
      setMessage("Vibes only accept video files.");
      return;
    }
    setMessage(null);

    try {
      const objectUrl = URL.createObjectURL(file);
      if (vibeVideoUrl?.startsWith("blob:")) URL.revokeObjectURL(vibeVideoUrl);
      setVibeVideoUrl(objectUrl);
      setVibeVideoFile(file);

      const meta = await loadVideoMetadata(file);
      setVibeDuration(meta.duration);
      setVibeIsPortrait(meta.height > meta.width);
      setMessage(
        file.size > MAX_VIDEO_BYTES
          ? `Large video detected (${formatBytes(file.size)}). We'll optimize it in background after you post.`
          : null
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load video preview.");
    }
  }

  function handleVibeInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void processVibeFile(file);
  }

  function handleVibeDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setVibeIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processVibeFile(file);
  }

  /* ── Story / Moment media pick ──────────────────────────────────────── */
  async function handleStoryInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";

    const valid = files.filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
    );

    if (valid.length === 0) {
      setMessage("Stories support image and video files only.");
      return;
    }

    const videoFile = valid.find((file) => file.type.startsWith("video/"));
    if (videoFile) {
      if (valid.length > 1 || storyAssets.length > 0) {
        setMessage("Story video works one clip at a time. Remove other media first.");
        return;
      }

      setMessage(null);

      try {
        const meta = await loadVideoMetadata(videoFile);
        const entry: StoryComposerAsset = {
          id: makeComposerAssetId(),
          url: URL.createObjectURL(videoFile),
          file: videoFile,
          kind: "video",
          durationSeconds: meta.duration
        };

        setStoryAssets([entry]);
        setActiveStoryAssetId(entry.id);
        setStoryMusicStatus(
          videoFile.size > MAX_VIDEO_BYTES
            ? `Large story video detected (${formatBytes(videoFile.size)}). We'll optimize it in background after you post.`
            : "Music stories export a 15-second MP4 clip."
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "We could not load this story video.");
      }
      return;
    }

    const imageFiles = valid.filter((file) => file.type.startsWith("image/"));
    const hasVideoStory = storyAssets.some((asset) => asset.kind === "video");
    if (hasVideoStory) {
      setMessage("Remove the current story video before adding photos.");
      return;
    }

    const availableSlots = Math.max(0, STORY_MAX_IMAGES - storyAssets.length);
    const nextFiles = imageFiles.slice(0, availableSlots);
    const entries = nextFiles.map((file) => ({
      id: makeComposerAssetId(),
      url: URL.createObjectURL(file),
      file,
      kind: "image" as const,
      durationSeconds: STORY_IMAGE_DURATION_SECONDS
    }));

    setStoryAssets((prev) => [...prev, ...entries]);
    setActiveStoryAssetId((current) => current ?? entries[0]?.id ?? null);
    setMessage(
      imageFiles.length > availableSlots
        ? `Stories support up to ${STORY_MAX_IMAGES} photos so the full sequence stays within ${STORY_MAX_TOTAL_SECONDS} seconds.`
        : null
    );
  }

  function handleMomentInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const valid = files.filter((file) => file.type.startsWith("image/"));
    if (valid.length === 0) {
      setMessage("Only image files are supported for posts.");
      return;
    }

    const availableSlots = Math.max(0, 6 - momentImages.length);
    const nextFiles = valid.slice(0, availableSlots);
    const entries = nextFiles.map((file) => ({
      id: makeComposerAssetId(),
      url: URL.createObjectURL(file),
      file
    }));

    setMomentImages((prev) => [...prev, ...entries]);
    setMessage(valid.length > availableSlots ? "Posts support up to 6 photos." : null);
  }

  function removeStoryAsset(id: string) {
    setStoryAssets((prev) => {
      const next = prev.filter((asset) => asset.id !== id);
      const removed = prev.find((asset) => asset.id === id);
      if (removed?.url.startsWith("blob:")) {
        URL.revokeObjectURL(removed.url);
      }
      return next;
    });
  }

  function removeMomentImage(index: number) {
    setMomentImages((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed?.url.startsWith("blob:")) URL.revokeObjectURL(removed.url);
      return next;
    });
  }

  function openStoryMusicLibrary() {
    if (storyAssets.length === 0) {
      setMessage("Pick one story photo or video before adding music.");
      return;
    }

    if (storyAssets.length !== 1) {
      setMessage("Music export currently works with one story photo or video at a time.");
      return;
    }

    setStoryMusicStatus(null);
    setIsStoryMusicLibraryOpen(true);
  }

  function stopStoryMusicPreview() {
    if (storyMusicPreviewTimeoutRef.current !== null) {
      window.clearTimeout(storyMusicPreviewTimeoutRef.current);
      storyMusicPreviewTimeoutRef.current = null;
    }
    if (storyMusicPreviewRef.current) {
      storyMusicPreviewRef.current.pause();
    }
    setIsStoryMusicPreviewPlaying(false);
  }

  async function playSelectedStoryMusicClip() {
    if (!storyMusicTrack || !storyMusicPreviewRef.current) {
      return;
    }

    stopStoryMusicPreview();
    const audio = storyMusicPreviewRef.current;
    audio.currentTime = storyMusicTrimSeconds;

    try {
      await audio.play();
      setIsStoryMusicPreviewPlaying(true);
      storyMusicPreviewTimeoutRef.current = window.setTimeout(() => {
        stopStoryMusicPreview();
      }, storyMusicClipDurationSeconds * 1000);
    } catch (error) {
      setStoryMusicStatus(
        error instanceof Error ? error.message : "We could not play this song preview right now."
      );
    }
  }

  function selectStoryMusicTrack(track: StoryMusicTrack) {
    stopStoryMusicPreview();
    setStoryMusicTrack(track);
    setStoryMusicClipDurationSeconds(STORY_MUSIC_DEFAULT_CLIP_SECONDS);
    setStoryMusicTrimSeconds(0);
    setStoryMusicPreviewCurrentTime(0);
    setStoryMusicStatus(`Selected ${track.title} by ${track.artistName}.`);
    setIsStoryMusicLibraryOpen(false);
  }

  function handleStoryStickerPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!storyPreviewRef.current) {
      return;
    }

    const previewRect = storyPreviewRef.current.getBoundingClientRect();
    const currentX = storyMusicStickerPosition.x * previewRect.width;
    const currentY = storyMusicStickerPosition.y * previewRect.height;
    stickerDragOffsetRef.current = {
      x: event.clientX - currentX,
      y: event.clientY - currentY
    };
    setIsDraggingMusicSticker(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleStoryStickerPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!isDraggingMusicSticker || !storyPreviewRef.current) {
      return;
    }

    const previewRect = storyPreviewRef.current.getBoundingClientRect();
    const nextX = (event.clientX - previewRect.left - stickerDragOffsetRef.current.x) / previewRect.width;
    const nextY = (event.clientY - previewRect.top - stickerDragOffsetRef.current.y) / previewRect.height;
    setStoryMusicStickerPosition({
      x: clamp(nextX, 0.05, 0.78),
      y: clamp(nextY, 0.08, 0.82)
    });
  }

  function handleStoryStickerPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDraggingMusicSticker(false);
  }

  /* ── Publish ────────────────────────────────────────────────────────── */
  async function handlePublish() {
    if (mode === "vibe") {
      if (!vibeVideoFile) {
        setMessage("Add a portrait video before posting.");
        return;
      }
      if (!vibeIsPortrait) {
        setMessage("Use a 9:16 portrait video for Vibes.");
        return;
      }
    }

    if (mode === "moment" && !caption.trim() && momentImages.length === 0) {
      setMessage("Add a caption or photo before posting.");
      return;
    }
    if (mode === "story" && storyAssets.length === 0) {
      setMessage("Add at least one photo or video before posting your Story.");
      return;
    }

    setIsPublishing(true);
    setMessage("Posting will continue in background.");

    try {
      if (mode === "vibe" && vibeVideoFile) {
        enqueueBackgroundPublish({
          kind: "vibe",
          caption,
          collegeName,
          videoFile: vibeVideoFile
        });
      } else if (mode === "story") {
        enqueueBackgroundPublish({
          kind: "story",
          caption,
          storyAssets: storyAssets.map((asset) => ({
            file: asset.file,
            mediaType: asset.kind,
            mimeType: asset.file.type || null
          })),
          storyMusic:
            storyMusicTrack && activeStoryAsset
              ? {
                  visualFile: activeStoryAsset.file,
                  visualKind: activeStoryAsset.kind,
                  track: storyMusicTrack,
                  clipDurationSeconds: storyMusicClipDurationSeconds,
                  trimStartSeconds: storyMusicTrimSeconds,
                  stickerPosition: storyMusicStickerPosition
                }
              : null
        });
      } else {
        enqueueBackgroundPublish({
          kind: "post",
          caption,
          collegeName,
          mediaFiles: momentImages.map((asset) => asset.file)
        });
      }

      router.push(returnTo);
    } catch (err) {
      setIsPublishing(false);
      setMessage(err instanceof Error ? err.message : "Could not queue this post right now.");
    }
  }

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="cs-overlay">
      {/* backdrop blur */}
      <div className="cs-backdrop" onClick={handleClose} aria-hidden="true" />

      <div
        className={`cs-shell cs-shell--${mode}`}
        role="dialog"
        aria-modal="true"
        aria-label="Creation Studio"
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="cs-header">
          <div className="cs-header-brand">
            {mode !== "choice" && (
              <button
                type="button"
                className="cs-back-btn"
                onClick={() => setMode("choice")}
                aria-label="Back to choice"
              >
                <svg viewBox="0 0 24 24" className="cs-icon" aria-hidden="true">
                  <path d="M19 12H5M12 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <span className="cs-header-label">{getModeLabel(mode)}</span>
          </div>

          <div className="cs-header-actions">
            {mode !== "choice" && (
              <div className="cs-mode-switch">
                <select
                  className="cs-mode-select"
                  value={mode}
                  onChange={(event) => handleModeChange(event.target.value as PublishableCreationMode)}
                  disabled={isPublishing}
                  aria-label="Choose what to create"
                >
                  {CREATION_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="cs-mode-select-chevron" aria-hidden="true">
                  <IcoChevronDown />
                </span>
              </div>
            )}
            <button type="button" className="cs-close-btn" onClick={handleClose} aria-label="Close">
              <IcoClose />
            </button>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}

        {/* ─── CHOICE SCREEN ─────────────────────────────────────────── */}
        {mode === "choice" && (
          <div className="cs-choice-screen">
            <p className="cs-choice-sub">What do you want to share today?</p>
            <div className="cs-choice-cards">

              <button
                type="button"
                className="cs-choice-card cs-choice-card--moment"
                onClick={() => setMode("story")}
              >
                <div className="cs-choice-card-glow cs-choice-card-glow--moment" />
                <div className="cs-choice-icon-wrap cs-choice-icon-wrap--moment">
                  <IcoImage />
                </div>
                <strong className="cs-choice-title">Story</strong>
                <span className="cs-choice-desc">Photo sequence for your campus story ring</span>
                <span className="cs-choice-badge cs-choice-badge--teal">Story</span>
              </button>

              <button
                type="button"
                className="cs-choice-card cs-choice-card--vibe"
                onClick={() => setMode("vibe")}
              >
                <div className="cs-choice-card-glow cs-choice-card-glow--vibe" />
                <div className="cs-choice-icon-wrap cs-choice-icon-wrap--vibe">
                  <IcoVideo />
                </div>
                <strong className="cs-choice-title">Vibe</strong>
                <span className="cs-choice-desc">9:16 portrait video · Campus reel</span>
                <span className="cs-choice-badge">Video</span>
              </button>

              <button
                type="button"
                className="cs-choice-card cs-choice-card--moment"
                onClick={() => setMode("moment")}
              >
                <div className="cs-choice-card-glow cs-choice-card-glow--moment" />
                <div className="cs-choice-icon-wrap cs-choice-icon-wrap--moment">
                  <IcoImage />
                </div>
                <strong className="cs-choice-title">Post</strong>
                <span className="cs-choice-desc">Photo or text · Campus feed post</span>
                <span className="cs-choice-badge cs-choice-badge--teal">Photo / Text</span>
              </button>

            </div>
          </div>
        )}

        {/* ─── VIBE SCREEN ───────────────────────────────────────────── */}
        {mode === "vibe" && (
          <div className="cs-vibe-screen">
            {/* Left: 9:16 video area */}
            <div className="cs-vibe-left">
              <div
                className={`cs-vibe-dropzone${vibeIsDragOver ? " cs-vibe-dropzone--drag" : ""}${vibeVideoUrl ? " cs-vibe-dropzone--has-media" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setVibeIsDragOver(true); }}
                onDragLeave={() => setVibeIsDragOver(false)}
                onDrop={handleVibeDrop}
                onClick={() => !vibeVideoUrl && vibeInputRef.current?.click()}
              >
                {vibeVideoUrl ? (
                  <>
                    <video
                      ref={vibeVideoRef}
                      src={vibeVideoUrl}
                      className="cs-vibe-preview-video"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                    <div className="cs-vibe-video-overlay">
                      <button
                        type="button"
                        className="cs-vibe-replace-btn"
                        onClick={(e) => { e.stopPropagation(); vibeInputRef.current?.click(); }}
                      >
                        Replace video
                      </button>
                      {vibeDuration && (
                        <span className="cs-vibe-duration">{formatDuration(vibeDuration)}</span>
                      )}
                    </div>
                    {vibeIsPortrait === false && (
                      <div className="cs-vibe-warning">
                        ⚠ Use a portrait (9:16) video for Vibes
                      </div>
                    )}
                  </>
                ) : (
                  <div className="cs-vibe-empty">
                    <div className="cs-vibe-empty-icon">
                      <IcoUpload />
                    </div>
                    <strong>Drop your video here</strong>
                    <span>or click to browse</span>
                    <span className="cs-vibe-empty-hint">9:16 portrait · MP4 / MOV / WEBM · Max 40 MB</span>
                  </div>
                )}
              </div>
              <input
                ref={vibeInputRef}
                type="file"
                accept="video/*"
                className="cs-file-input"
                disabled={isPublishing}
                onChange={handleVibeInputChange}
              />
            </div>

            {/* Right: caption + details */}
            <div className="cs-vibe-right">
              {/* User pill */}
              <div className="cs-user-row">
                  <div className="cs-avatar" aria-hidden="true">
                    <CampusAvatarContent
                      username={viewerUsername}
                      email={viewerEmail}
                      displayName={viewerName}
                      fallback={avatarInitials}
                      decorative
                    />
                  </div>
                <div className="cs-user-info">
                  <strong>{viewerName}</strong>
                  <span>@{viewerUsername}</span>
                </div>
                <span className="cs-user-pill">Public Vibe</span>
              </div>

              {/* Caption */}
              <div className="cs-caption-wrap">
                <textarea
                  className="cs-caption-area"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Tell everyone what this vibe is about… #campus @friends"
                  rows={6}
                  disabled={isPublishing}
                />
              </div>

              {/* Meta info */}
              {vibeVideoFile && (
                <div className="cs-vibe-meta">
                  <span>{formatBytes(vibeVideoFile.size)}</span>
                  {vibeDuration && <span>{formatDuration(vibeDuration)}</span>}
                  <span className={vibeIsPortrait === false ? "cs-meta-warn" : "cs-meta-ok"}>
                    {vibeIsPortrait === false ? "Landscape — not ideal" : vibeIsPortrait ? "Portrait ✓" : "—"}
                  </span>
                </div>
              )}

              {message && <p className="cs-message">{message}</p>}
            </div>
          </div>
        )}

        {/* ─── STORY / MOMENT SCREEN ─────────────────────────────────── */}
        {(mode === "story" || mode === "moment") && (
          <div className="cs-moment-screen">
            <div className="cs-user-row cs-user-row--moment">
                <div className="cs-avatar" aria-hidden="true">
                  <CampusAvatarContent
                    username={viewerUsername}
                    email={viewerEmail}
                    displayName={viewerName}
                    fallback={avatarInitials}
                    decorative
                  />
                </div>
              <div className="cs-user-info">
                <strong>{viewerName}</strong>
                <span>@{viewerUsername}</span>
              </div>
              <span className="cs-user-pill cs-user-pill--moment">{mode === "story" ? "Story" : "Post"}</span>
            </div>

            {mode === "story" ? (
              <>
                <div className="cs-story-editor">
                  <div className="cs-story-preview-shell">
                    <div className="cs-story-preview-stage" ref={storyPreviewRef}>
                      {activeStoryAsset ? (
                        <>
                          {activeStoryAsset.kind === "video" ? (
                            <video
                              src={activeStoryAsset.url}
                              className="cs-story-preview-media"
                              autoPlay
                              loop
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={activeStoryAsset.url}
                              alt="Story preview"
                              className="cs-story-preview-media"
                            />
                          )}
                          <div className="cs-story-preview-gradient" />
                          <div className="cs-story-preview-meta">
                            <span>{activeStoryAsset.kind === "video" ? "Story clip" : "Story photo"}</span>
                            <strong>
                              {activeStoryAsset.kind === "video"
                                ? `${Math.min(
                                    storyMusicTrack
                                      ? storyMusicClipDurationSeconds
                                      : Math.max(
                                          1,
                                          Math.round(
                                            activeStoryAsset.durationSeconds ?? STORY_MUSIC_DEFAULT_CLIP_SECONDS
                                          )
                                        ),
                                    Math.max(
                                      1,
                                      Math.round(
                                        activeStoryAsset.durationSeconds ?? STORY_MUSIC_DEFAULT_CLIP_SECONDS
                                      )
                                    )
                                  )}s`
                                : `${storyMusicTrack ? storyMusicClipDurationSeconds : STORY_IMAGE_DURATION_SECONDS}s`}
                            </strong>
                          </div>
                          <button
                            type="button"
                            className="cs-story-music-trigger"
                            onClick={openStoryMusicLibrary}
                            disabled={isPublishing}
                          >
                            <IcoMusic />
                            <span>{storyMusicTrack ? "Change music" : "Add music"}</span>
                          </button>
                          {storyMusicTrack && (
                            <button
                              type="button"
                              className={`cs-story-music-sticker${isDraggingMusicSticker ? " cs-story-music-sticker--dragging" : ""}`}
                              style={{
                                left: `${storyMusicStickerPosition.x * 100}%`,
                                top: `${storyMusicStickerPosition.y * 100}%`
                              }}
                              onPointerDown={handleStoryStickerPointerDown}
                              onPointerMove={handleStoryStickerPointerMove}
                              onPointerUp={handleStoryStickerPointerUp}
                              onPointerCancel={handleStoryStickerPointerUp}
                            >
                              <IcoMusic />
                              <span>{storyMusicTrack.title}</span>
                              <small>{storyMusicTrack.artistName}</small>
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          className="cs-story-preview-empty"
                          onClick={() => momentInputRef.current?.click()}
                        >
                          <div className="cs-story-preview-empty-icon">
                            <IcoPlus />
                          </div>
                          <strong>Build your story scene</strong>
                          <span>Add a photo or a short video, then layer music on top.</span>
                        </button>
                      )}
                    </div>

                    {storyMusicTrack && (
                        <div className="cs-story-music-panel">
                        <audio
                          ref={storyMusicPreviewRef}
                          className="cs-story-music-audio"
                          src={storyMusicTrack.streamUrl}
                          preload="metadata"
                          controls
                          onPlay={() => setIsStoryMusicPreviewPlaying(true)}
                          onPause={() => setIsStoryMusicPreviewPlaying(false)}
                          onEnded={stopStoryMusicPreview}
                          onTimeUpdate={(event) => {
                            setStoryMusicPreviewCurrentTime(event.currentTarget.currentTime);
                          }}
                        />
                        <div className="cs-story-music-panel-head">
                          <div>
                            <strong>{storyMusicTrack.title}</strong>
                            <span>{storyMusicTrack.artistName}</span>
                          </div>
                          <button
                            type="button"
                            className="cs-story-music-reset"
                            onClick={() => {
                              stopStoryMusicPreview();
                              setStoryMusicTrack(null);
                              setStoryMusicClipDurationSeconds(STORY_MUSIC_DEFAULT_CLIP_SECONDS);
                              setStoryMusicTrimSeconds(0);
                              setStoryMusicStatus("Music removed from this story.");
                            }}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="cs-story-music-clip-options" role="group" aria-label="Choose clip duration">
                          {STORY_MUSIC_CLIP_OPTIONS.filter((seconds) => seconds <= storyMusicTrack.durationSeconds).map((seconds) => (
                            <button
                              key={seconds}
                              type="button"
                              className={`cs-story-music-clip-chip${storyMusicClipDurationSeconds === seconds ? " is-active" : ""}`}
                              onClick={() => {
                                stopStoryMusicPreview();
                                setStoryMusicClipDurationSeconds(seconds);
                              }}
                            >
                              {seconds}s
                            </button>
                          ))}
                        </div>
                        <div className="cs-story-music-preview-actions">
                          <button
                            type="button"
                            className={`cs-story-music-preview-btn${isStoryMusicPreviewPlaying ? " is-active" : ""}`}
                            onClick={() => {
                              if (isStoryMusicPreviewPlaying) {
                                stopStoryMusicPreview();
                                return;
                              }
                              void playSelectedStoryMusicClip();
                            }}
                          >
                            {isStoryMusicPreviewPlaying ? "Stop selected clip" : "Play selected clip"}
                          </button>
                          <span className="cs-story-music-preview-meta">
                            {formatDuration(storyMusicTrimSeconds)} to {formatDuration(storyMusicPreviewEndSeconds)}
                          </span>
                        </div>
                        <label className="cs-story-trim-wrap">
                          <span>Pick the {storyMusicClipDurationSeconds}s song window</span>
                          <input
                            type="range"
                            min={0}
                            max={storyMusicTrimMax}
                            step={1}
                            value={storyMusicTrimSeconds}
                            onChange={(event) => {
                              stopStoryMusicPreview();
                              setStoryMusicTrimSeconds(Number(event.target.value));
                            }}
                            className="cs-story-trim-slider"
                          />
                          <div className="cs-story-trim-meta">
                            <span>Start at {formatDuration(storyMusicTrimSeconds)}</span>
                            <span>{storyMusicClipDurationSeconds}s clip</span>
                          </div>
                        </label>
                        <span className="cs-story-music-playback-readout">
                          Live preview: {formatDuration(Math.floor(storyMusicPreviewCurrentTime))} / {formatDuration(storyMusicTrack.durationSeconds)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="cs-story-editor-side">
                    <div className="cs-moment-caption-wrap">
                      <textarea
                        className="cs-moment-caption"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Add a caption for your story..."
                        rows={5}
                        disabled={isPublishing}
                      />
                    </div>

                    <div className="cs-moment-images cs-moment-images--story">
                      {storyAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className={`cs-moment-img-thumb cs-moment-img-thumb--story${activeStoryAsset?.id === asset.id ? " cs-moment-img-thumb--active" : ""}`}
                        >
                          <button
                            type="button"
                            className="cs-story-thumb-select"
                            onClick={() => setActiveStoryAssetId(asset.id)}
                          >
                            {asset.kind === "video" ? (
                              <video src={asset.url} muted playsInline />
                            ) : (
                              <img src={asset.url} alt="Story asset" />
                            )}
                            <span className="cs-story-thumb-badge">{asset.kind === "video" ? "Video" : "Photo"}</span>
                          </button>
                          <button
                            type="button"
                            className="cs-moment-img-remove"
                            onClick={() => removeStoryAsset(asset.id)}
                            aria-label="Remove story media"
                          >
                            <IcoTrash />
                          </button>
                        </div>
                      ))}
                      {storyAssets.length > 0 && storyAssets.length < STORY_MAX_IMAGES && !storyAssets.some((asset) => asset.kind === "video") && (
                        <button
                          type="button"
                          className="cs-moment-img-add"
                          onClick={() => momentInputRef.current?.click()}
                          aria-label="Add story media"
                        >
                          <IcoPlus />
                          <span>{storyAssets.length === 0 ? "Add story" : "More"}</span>
                        </button>
                      )}
                      {storyAssets.length === 0 && (
                        <button
                          type="button"
                          className="cs-moment-img-add"
                          onClick={() => momentInputRef.current?.click()}
                          aria-label="Add story media"
                        >
                          <IcoPlus />
                          <span>Add story</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {storyMusicStatus && <p className="cs-story-music-status">{storyMusicStatus}</p>}
                {message && <p className="cs-message">{message}</p>}

                <input
                  ref={momentInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="cs-file-input"
                  disabled={isPublishing}
                  onChange={handleStoryInputChange}
                />
              </>
            ) : (
              <>
                <div className="cs-moment-caption-wrap">
                  <textarea
                    className="cs-moment-caption"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="What's on your mind? #hashtag @mention"
                    rows={5}
                    disabled={isPublishing}
                  />
                </div>

                <div className="cs-moment-images">
                  {momentImages.map((img, i) => (
                    <div key={img.id} className="cs-moment-img-thumb">
                      <img src={img.url} alt={`Upload ${i + 1}`} />
                      <button
                        type="button"
                        className="cs-moment-img-remove"
                        onClick={() => removeMomentImage(i)}
                        aria-label="Remove image"
                      >
                        <IcoTrash />
                      </button>
                    </div>
                  ))}
                  {momentImages.length < 6 && (
                    <button
                      type="button"
                      className="cs-moment-img-add"
                      onClick={() => momentInputRef.current?.click()}
                      aria-label="Add photo"
                    >
                      <IcoPlus />
                      <span>{momentImages.length === 0 ? "Add photo" : "More"}</span>
                    </button>
                  )}
                </div>

                {message && <p className="cs-message">{message}</p>}

                <input
                  ref={momentInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="cs-file-input"
                  disabled={isPublishing}
                  onChange={handleMomentInputChange}
                />
              </>
            )}
          </div>
        )}

        {mode === "story" && isStoryMusicLibraryOpen && (
          <div className="cs-story-music-modal" role="dialog" aria-modal="true" aria-label="Music library">
            <button
              type="button"
              className="cs-story-music-backdrop"
              onClick={() => setIsStoryMusicLibraryOpen(false)}
              aria-label="Close music library"
            />
            <div className="cs-story-music-dialog">
              <div className="cs-story-music-dialog-head">
                <div>
                  <strong>Music library</strong>
                  <span>Royalty-free tracks for your next story drop.</span>
                </div>
                <button
                  type="button"
                  className="cs-story-music-close"
                  onClick={() => setIsStoryMusicLibraryOpen(false)}
                  aria-label="Close music library"
                >
                  <IcoClose />
                </button>
              </div>

              <label className="cs-story-music-search">
                <IcoSearch />
                <input
                  type="search"
                  value={storyMusicQuery}
                  onChange={(event) => setStoryMusicQuery(event.target.value)}
                  placeholder="Search by song or artist"
                />
              </label>

              <div className="cs-story-music-results">
                {isStoryMusicLoading ? (
                  <p className="cs-story-music-empty">Loading tracks...</p>
                ) : storyMusicTracks.length === 0 ? (
                  <p className="cs-story-music-empty">No tracks found yet. Try another search.</p>
                ) : (
                  storyMusicTracks.map((track) => (
                    <button
                      type="button"
                      key={track.id}
                      className="cs-story-music-item"
                      onClick={() => selectStoryMusicTrack(track)}
                    >
                      <div className="cs-story-music-item-art">
                        {track.artworkUrl ? (
                          <img src={track.artworkUrl} alt="" />
                        ) : (
                          <IcoMusic />
                        )}
                      </div>
                      <div className="cs-story-music-item-copy">
                        <strong>{track.title}</strong>
                        <span>{track.artistName}</span>
                      </div>
                      <span className="cs-story-music-item-duration">
                        {formatDuration(track.durationSeconds)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Footer (always visible in story/vibe/moment) ───────────────── */}
        {mode !== "choice" && (
          <div className="cs-footer">
            <div className="cs-footer-hint">
                {mode === "vibe"
                  ? "Portrait 9:16 clip fills the Vibes feed perfectly"
                : mode === "story"
                  ? "Stories support photos or one video · music clips can export at 15s, 30s, 45s, or 60s"
                  : "Up to 6 photos · Text-only posts are fine too"}
            </div>
            <div className="cs-footer-actions">
              <button
                type="button"
                className="cs-cancel-btn"
                onClick={handleClose}
                disabled={isPublishing}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`cs-post-btn${canPublish ? " cs-post-btn--active" : ""}`}
                onClick={handlePublish}
                disabled={!canPublish || isPublishing}
              >
                {isPublishing ? "Queueing..." : `${getPublishLabel(mode)} ✦`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
