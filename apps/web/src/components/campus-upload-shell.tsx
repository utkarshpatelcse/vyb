"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import type {
  CampusUploadKind,
  CampusUploadMediaKind,
} from "../lib/campus-upload-store";
import {
  formatBytes,
  prepareSocialUploadFile,
  uploadSocialMediaAsset,
} from "../lib/social-media-client";

/* ─── Types ─────────────────────────────────────────────────────────────── */
type CampusUploadShellProps = {
  collegeName: string;
  viewerEmail: string;
  viewerName: string;
  viewerUsername: string;
};

type CreationMode = "choice" | "story" | "vibe" | "moment";

/* ─── Constants ─────────────────────────────────────────────────────────── */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 10 * 1024 * 1024;
const TARGET_VIDEO_BYTES = 8 * 1024 * 1024;
const STORY_IMAGE_DURATION_SECONDS = 15;
const STORY_MAX_TOTAL_SECONDS = 60;
const STORY_MAX_IMAGES = STORY_MAX_TOTAL_SECONDS / STORY_IMAGE_DURATION_SECONDS;

const COMMUNITY_TAGS = [
  "Campus-wide",
  "CSE-A",
  "CSE-B",
  "CSE-C",
  "ECE",
  "MECH",
  "Civil",
  "MBA",
  "Music Club",
  "Drama Club",
  "Sports Club",
  "Photography Club",
  "Coding Club",
  "E-Cell",
  "NSS",
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

function IcoSpark() {
  return (
    <Ico>
      <path
        d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"
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

/* ─── Shimmer skeleton ───────────────────────────────────────────────────── */
function ShimmerBlock({ className }: { className?: string }) {
  return <div className={`cs-shimmer ${className ?? ""}`} />;
}

/* ─── Progress bar ───────────────────────────────────────────────────────── */
function UploadProgress({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="cs-progress-wrap">
      <span className="cs-progress-label">{label}</span>
      <div className="cs-progress-track">
        <div className="cs-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <span className="cs-progress-pct">{Math.round(progress * 100)}%</span>
    </div>
  );
}

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
  const [communityTag, setCommunityTag] = useState(COMMUNITY_TAGS[0]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("Optimizing video for campus feed...");

  /* ── Vibe (single video) ─────────────────────────────────────────────── */
  const [vibeVideoUrl, setVibeVideoUrl] = useState<string | null>(null);
  const [vibeVideoFile, setVibeVideoFile] = useState<File | null>(null);
  const [vibeDuration, setVibeDuration] = useState<number | null>(null);
  const [vibeIsPortrait, setVibeIsPortrait] = useState<boolean | null>(null);
  const [vibeIsDragOver, setVibeIsDragOver] = useState(false);
  const vibeInputRef = useRef<HTMLInputElement | null>(null);
  const vibeVideoRef = useRef<HTMLVideoElement | null>(null);

  /* ── Moment (text + multi-images) ────────────────────────────────────── */
  const [momentImages, setMomentImages] = useState<{ url: string; file: File }[]>([]);
  const momentInputRef = useRef<HTMLInputElement | null>(null);

  /* ── Derived ─────────────────────────────────────────────────────────── */
  const avatarInitials = useMemo(
    () => getInitials(viewerName, viewerUsername),
    [viewerName, viewerUsername]
  );

  const canPublish = useMemo(() => {
    if (mode === "vibe") {
      return Boolean(vibeVideoUrl && vibeIsPortrait !== false);
    }
    if (mode === "story") {
      return momentImages.length > 0;
    }
    if (mode === "moment") {
      return Boolean(caption.trim() || momentImages.length > 0);
    }
    return false;
  }, [mode, vibeVideoUrl, vibeIsPortrait, caption, momentImages]);

  /* ── progress simulator for demo (real upload doesn't expose events) ─── */
  useEffect(() => {
    if (!isPreparingMedia) {
      setUploadProgress(0);
      return;
    }
    setUploadProgress(0.05);
    const id = window.setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 0.9) { clearInterval(id); return 0.9; }
        return p + 0.07;
      });
    }, 220);
    return () => clearInterval(id);
  }, [isPreparingMedia]);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function handleClose() {
    router.push(returnTo);
  }

  /* ── Vibe video pick ─────────────────────────────────────────────────── */
  async function processVibeFile(file: File) {
    if (!file.type.startsWith("video/")) {
      setMessage("Vibes only accept video files.");
      return;
    }
    setIsPreparingMedia(true);
    setUploadLabel("Optimizing video for campus feed...");
    setMessage(null);

    try {
      const prepared = await prepareSocialUploadFile(file, {
        maxVideoBytes: MAX_VIDEO_BYTES,
        targetVideoBytes: TARGET_VIDEO_BYTES,
      });
      const pf = prepared.file;
      const objectUrl = URL.createObjectURL(pf);
      if (vibeVideoUrl?.startsWith("blob:")) URL.revokeObjectURL(vibeVideoUrl);
      setVibeVideoUrl(objectUrl);
      setVibeVideoFile(pf);
      setMessage(prepared.optimizationSummary);

      const meta = await loadVideoMetadata(pf);
      setVibeDuration(meta.duration);
      setVibeIsPortrait(meta.height > meta.width);
      setUploadProgress(1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not prepare video.");
    } finally {
      setIsPreparingMedia(false);
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

  /* ── Moment image pick ───────────────────────────────────────────────── */
  function handleMomentInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (valid.length === 0) {
      setMessage(mode === "story" ? "Only image files are supported for Stories." : "Only image files are supported for Moments.");
      return;
    }
    setMessage(null);

    const mediaLimit = mode === "story" ? STORY_MAX_IMAGES : 6;
    const availableSlots = Math.max(0, mediaLimit - momentImages.length);
    const nextFiles = valid.slice(0, availableSlots);
    const entries = nextFiles.map((f) => ({
      url: URL.createObjectURL(f),
      file: f,
    }));
    setMomentImages((prev) => [...prev, ...entries]);

    if (mode === "story" && valid.length > availableSlots) {
      setMessage(`Stories support up to ${STORY_MAX_IMAGES} photos so the full sequence stays within ${STORY_MAX_TOTAL_SECONDS} seconds.`);
    }
  }

  function removeMomentImage(index: number) {
    setMomentImages((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed?.url.startsWith("blob:")) URL.revokeObjectURL(removed.url);
      return next;
    });
  }

  /* ── Publish ────────────────────────────────────────────────────────── */
  async function handlePublish() {
    if (isPreparingMedia) { setMessage("Please wait until optimization finishes."); return; }

    if (mode === "vibe") {
      if (!vibeVideoFile) { setMessage("Add a portrait video before posting."); return; }
      if (!vibeIsPortrait) { setMessage("Use a 9:16 portrait video for Vibes."); return; }
    }

    if (mode === "moment" && !caption.trim() && momentImages.length === 0) {
      setMessage("Add a caption or photo before posting.");
      return;
    }
    if (mode === "story" && momentImages.length === 0) {
      setMessage("Add at least one photo before posting your Story.");
      return;
    }

    setIsPublishing(true);
    setMessage(null);

    try {
      if (mode === "vibe" && vibeVideoFile) {
        const uploadedMedia = await uploadSocialMediaAsset(vibeVideoFile, "vibe");
        const trimmedCaption = caption.trim();
        const response = await fetch("/api/vibes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: trimmedCaption ? trimmedCaption.slice(0, 72) : null,
            body: trimmedCaption || "Fresh campus vibe.",
            mediaUrl: uploadedMedia?.url ?? null,
            mediaStoragePath: uploadedMedia?.storagePath ?? null,
            mediaMimeType: uploadedMedia?.mimeType ?? null,
            mediaSizeBytes: uploadedMedia?.sizeBytes ?? null,
            location: collegeName,
          }),
        });
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        if (!response.ok) { setMessage(payload?.error?.message ?? "Could not publish Vibe."); return; }
      } else {
        // story / moment — upload all images if present
        let completed = 0;
        const total = momentImages.length;
        let uploadedMediaAssets: any[] = [];

        if (total > 0) {
          setMessage(`Uploading 0/${total}...`);
          const uploadPromises = momentImages.map(async (img) => {
            const uploaded = await uploadSocialMediaAsset(img.file, mode === "story" ? "story" : "post");
            completed++;
            setMessage(`Uploading ${completed}/${total}...`);
            return {
              url: uploaded?.url ?? "",
              kind: "image",
              storagePath: uploaded?.storagePath ?? null,
              mimeType: uploaded?.mimeType ?? null,
              sizeBytes: uploaded?.sizeBytes ?? null
            };
          });
          // Ensure all media are processed in parallel
          uploadedMediaAssets = await Promise.all(uploadPromises);
          setMessage("Optimizing layout...");
        }

        const trimmedCaption = caption.trim();
        if (mode === "story") {
          for (let index = 0; index < uploadedMediaAssets.length; index += 1) {
            setMessage(`Publishing ${index + 1}/${uploadedMediaAssets.length} stories...`);
            const asset = uploadedMediaAssets[index];
            const response = await fetch("/api/stories", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                mediaType: "image",
                mediaUrl: asset.url,
                mediaStoragePath: asset.storagePath ?? null,
                mediaMimeType: asset.mimeType ?? null,
                mediaSizeBytes: asset.sizeBytes ?? null,
                caption: trimmedCaption || null,
              }),
            });
            const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
            if (!response.ok) { setMessage(payload?.error?.message ?? "Could not publish Story."); return; }
          }
        } else {
          const response = await fetch("/api/posts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title: trimmedCaption ? trimmedCaption.slice(0, 72) : "",
              body: trimmedCaption || "",
              kind: total > 0 ? "image" : "text",
              mediaAssets: uploadedMediaAssets.length > 0 ? uploadedMediaAssets : undefined,
              location: collegeName,
            }),
          });
          const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
          if (!response.ok) { setMessage(payload?.error?.message ?? "Could not publish Moment."); return; }
        }
      }

      router.push(returnTo);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not publish right now.");
    } finally {
      setIsPublishing(false);
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
            <span className="cs-header-label">
              {mode === "choice" ? "Creation Studio" : mode === "vibe" ? "Vibe" : mode === "story" ? "Story" : "Moment"}
            </span>
          </div>

          <div className="cs-header-actions">
            {mode !== "choice" && (
              <button
                type="button"
                className={`cs-publish-top${canPublish ? " cs-publish-top--active" : ""}`}
                onClick={handlePublish}
                disabled={!canPublish || isPublishing || isPreparingMedia}
              >
                {isPublishing ? "Posting…" : mode === "vibe" ? "Post Vibe" : mode === "story" ? "Post Story" : "Post Moment"}
              </button>
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
                <strong className="cs-choice-title">Moment</strong>
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
                {isPreparingMedia ? (
                  <div className="cs-vibe-shimmer-wrap">
                    <ShimmerBlock className="cs-vibe-shimmer-full" />
                    <div className="cs-vibe-shimmer-overlay">
                      <div className="cs-vibe-shimmer-spinner" />
                      <UploadProgress progress={uploadProgress} label={uploadLabel} />
                    </div>
                  </div>
                ) : vibeVideoUrl ? (
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
                    <span className="cs-vibe-empty-hint">9:16 portrait · MP4 / MOV · Max 10 MB</span>
                  </div>
                )}
              </div>
              <input
                ref={vibeInputRef}
                type="file"
                accept="video/*"
                className="cs-file-input"
                disabled={isPreparingMedia || isPublishing}
                onChange={handleVibeInputChange}
              />
            </div>

            {/* Right: caption + community */}
            <div className="cs-vibe-right">
              {/* User pill */}
              <div className="cs-user-row">
                <div className="cs-avatar" aria-hidden="true">{avatarInitials}</div>
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

              {/* Community tag */}
              <div className="cs-community-select-wrap">
                <label className="cs-community-label" htmlFor="cs-community-vibe">
                  <IcoSpark />
                  Tag Community
                </label>
                <div className="cs-select-wrap">
                  <select
                    id="cs-community-vibe"
                    className="cs-select"
                    value={communityTag}
                    onChange={(e) => setCommunityTag(e.target.value)}
                    disabled={isPublishing}
                  >
                    {COMMUNITY_TAGS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <span className="cs-select-chevron"><IcoChevronDown /></span>
                </div>
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
            {/* User row */}
            <div className="cs-user-row cs-user-row--moment">
              <div className="cs-avatar" aria-hidden="true">{avatarInitials}</div>
              <div className="cs-user-info">
                <strong>{viewerName}</strong>
                <span>@{viewerUsername}</span>
              </div>
              <span className="cs-user-pill cs-user-pill--moment">{mode === "story" ? "Story" : "Moment"}</span>
            </div>

            {/* Caption area */}
            <div className="cs-moment-caption-wrap">
              <textarea
                className="cs-moment-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={mode === "story" ? "Add a caption for your story..." : "What's on your mind? #hashtag @mention"}
                rows={5}
                disabled={isPublishing}
              />
            </div>

            {/* Image strip */}
            <div className="cs-moment-images">
              {momentImages.map((img, i) => (
                <div key={img.url} className="cs-moment-img-thumb">
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
              {momentImages.length < (mode === "story" ? STORY_MAX_IMAGES : 6) && (
                <button
                  type="button"
                  className="cs-moment-img-add"
                  onClick={() => momentInputRef.current?.click()}
                    aria-label={mode === "story" ? "Add story photo" : "Add photo"}
                  >
                    <IcoPlus />
                    <span>{momentImages.length === 0 ? (mode === "story" ? "Add story photo" : "Add photo") : "More"}</span>
                  </button>
              )}
            </div>

            {mode === "moment" && (
              <div className="cs-community-select-wrap cs-community-select-wrap--moment">
                <label className="cs-community-label" htmlFor="cs-community-moment">
                  <IcoSpark />
                  Tag Community
                </label>
                <div className="cs-select-wrap">
                  <select
                    id="cs-community-moment"
                    className="cs-select"
                    value={communityTag}
                    onChange={(e) => setCommunityTag(e.target.value)}
                    disabled={isPublishing}
                  >
                    {COMMUNITY_TAGS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <span className="cs-select-chevron"><IcoChevronDown /></span>
                </div>
              </div>
            )}

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
          </div>
        )}

        {/* ── Footer (always visible in story/vibe/moment) ───────────────── */}
        {mode !== "choice" && (
          <div className="cs-footer">
            <div className="cs-footer-hint">
                {mode === "vibe"
                  ? "Portrait 9:16 clip fills the Vibes feed perfectly"
                : mode === "story"
                  ? `Each selected photo stays for ${STORY_IMAGE_DURATION_SECONDS} seconds · up to ${STORY_MAX_IMAGES} photos (${STORY_MAX_TOTAL_SECONDS}s max)`
                  : "Up to 6 photos · Text-only posts are fine too"}
            </div>
            <div className="cs-footer-actions">
              <button
                type="button"
                className="cs-cancel-btn"
                onClick={handleClose}
                disabled={isPublishing || isPreparingMedia}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`cs-post-btn${canPublish ? " cs-post-btn--active" : ""}`}
                onClick={handlePublish}
                disabled={!canPublish || isPublishing || isPreparingMedia}
              >
                {isPublishing
                  ? "Posting…"
                  : isPreparingMedia
                    ? "Preparing…"
                    : mode === "vibe"
                      ? "Post Vibe ✦"
                      : mode === "story"
                        ? "Post Story ✦"
                        : "Post Moment ✦"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
