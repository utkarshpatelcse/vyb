"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { CampusUploadKind, CampusUploadMediaKind } from "../lib/campus-upload-store";

type CampusUploadShellProps = {
  collegeName: string;
  viewerEmail: string;
  viewerName: string;
  viewerUsername: string;
};

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vyb-campus-icon">
      {children}
    </svg>
  );
}

function ImageIcon() {
  return (
    <IconBase>
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zm0 9 4.5-4.5 3 3 4.5-5.5 4 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="1.6" fill="currentColor" />
    </IconBase>
  );
}

function VideoIcon() {
  return (
    <IconBase>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4H14a2.5 2.5 0 0 1 2.5 2.5v1.2l3.5-2.1v12.8l-3.5-2.1v1.2A2.5 2.5 0 0 1 14 20H7.5A2.5 2.5 0 0 1 5 17.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function StoryIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </IconBase>
  );
}

function SparkIcon() {
  return (
    <IconBase>
      <path
        d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function FeedIcon() {
  return (
    <IconBase>
      <path
        d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5zM9 10h6M9 14h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function GlobeIcon() {
  return (
    <IconBase>
      <path
        d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-6.5 8h13M12 4a12.5 12.5 0 0 1 0 16M12 4a12.5 12.5 0 0 0 0 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function CloseIcon() {
  return (
    <IconBase>
      <path
        d="m7 7 10 10M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function parseKind(value: string | null): CampusUploadKind {
  if (value === "story" || value === "vibe") {
    return value;
  }

  return "post";
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("We could not read this file."));
    reader.readAsDataURL(file);
  });
}

function getSummary(kind: CampusUploadKind) {
  if (kind === "story") {
    return {
      kicker: "Campus Story",
      title: "Create story",
      subtitle: "Share a quick moment with followers and let it disappear after the day.",
      button: "Share story",
      accentLabel: "Followers only",
      captionLabel: "Caption",
      captionPlaceholder: "Add a short line before you post this story...",
      mediaHint: "Stories need one image or video.",
      footerHint: "Stories show up in the top rail for people who follow you."
    };
  }

  if (kind === "vibe") {
    return {
      kicker: "Vibes Clip",
      title: "Create vibe",
      subtitle: "Drop a portrait video and push it into the live campus vibes stream.",
      button: "Publish vibe",
      accentLabel: "Public vibe",
      captionLabel: "Caption",
      captionPlaceholder: "Tell everyone what this vibe is about...",
      mediaHint: "Vibes work best with a 9:16 portrait video.",
      footerHint: "Choose a portrait clip so it fills the Vibes feed cleanly."
    };
  }

    return {
      kicker: "Live Feed",
      title: "Create post",
      subtitle: "Publish instantly to the live campus feed.",
      button: "Publish post",
      accentLabel: "Public post",
      captionLabel: "Caption",
      captionPlaceholder: "What's on your mind?",
      mediaHint: "Posts can be text-only, image-first, or video-first.",
      footerHint: "Need image or video? Add it from the media panel."
    };
  }

function loadVideoMetadata(file: File) {
  return new Promise<{ duration: number; height: number; width: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        height: video.videoHeight,
        width: video.videoWidth
      });
      cleanup();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Unable to read this video."));
    };

    video.src = objectUrl;
  });
}

function getInitials(name: string, username: string) {
  const source = name.trim() || username.trim();
  const tokens = source.split(/\s+/u).filter(Boolean);

  if (tokens.length >= 2) {
    return `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function CampusUploadShell({
  collegeName,
  viewerEmail,
  viewerName,
  viewerUsername
}: CampusUploadShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultKind = parseKind(searchParams.get("kind"));
  const returnTo = searchParams.get("from") || (defaultKind === "vibe" ? "/vibes" : "/home");
  const [selectedKind, setSelectedKind] = useState<CampusUploadKind>(defaultKind);
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<CampusUploadMediaKind>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [isPortraitVideo, setIsPortraitVideo] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelectedKind(defaultKind);
  }, [defaultKind]);

  const summary = useMemo(() => getSummary(selectedKind), [selectedKind]);
  const avatarInitials = useMemo(() => getInitials(viewerName, viewerUsername), [viewerName, viewerUsername]);

  const canPublish = useMemo(() => {
    const trimmedCaption = caption.trim();

    if (selectedKind === "story") {
      return Boolean(mediaUrl && mediaKind);
    }

    if (selectedKind === "vibe") {
      return Boolean(mediaUrl && mediaKind === "video" && isPortraitVideo !== false);
    }

    return Boolean(trimmedCaption || mediaUrl);
  }, [caption, isPortraitVideo, mediaKind, mediaUrl, selectedKind]);

  async function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const nextMediaKind: CampusUploadMediaKind = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
        ? "image"
        : null;

    if (!nextMediaKind) {
      setMessage("Only image and video files are supported right now.");
      return;
    }

    if (mediaUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(mediaUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setMediaUrl(objectUrl);
    setSelectedFile(file);
    setMediaKind(nextMediaKind);
    setDurationSeconds(null);
    setIsPortraitVideo(null);
    setMessage(null);

    if (nextMediaKind === "video") {
      try {
        const metadata = await loadVideoMetadata(file);
        setDurationSeconds(metadata.duration);
        setIsPortraitVideo(metadata.height > metadata.width);
      } catch {
        setMessage("We could not read that video. Try a different file.");
      }
      return;
    }

    setIsPortraitVideo(null);
  }

  function handleClose() {
    router.push(returnTo);
  }

  async function handlePublish() {
    const trimmedCaption = caption.trim();

    if (selectedKind !== "post" && !mediaUrl) {
      setMessage("Story and Vibes uploads need media before publishing.");
      return;
    }

    if (selectedKind === "vibe") {
      if (mediaKind !== "video") {
        setMessage("Vibes only support video uploads.");
        return;
      }

      if (!isPortraitVideo) {
        setMessage("Choose a portrait video for Vibes so it fills the feed correctly.");
        return;
      }
    }

    if (selectedKind === "post" && !trimmedCaption && !mediaUrl) {
      setMessage("Add a caption or media before publishing your post.");
      return;
    }

    if (selectedFile) {
      const maxBytes = mediaKind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

      if (selectedFile.size > maxBytes) {
        setMessage(
          mediaKind === "video"
            ? "Video is too large right now. Keep it under 10 MB."
            : "Image is too large right now. Keep it under 4 MB."
        );
        return;
      }
    }

    setIsPublishing(true);
    setMessage(null);

    try {
      const uploadedMediaUrl = selectedFile ? await fileToDataUrl(selectedFile) : null;
        const route = selectedKind === "story" ? "/api/stories" : selectedKind === "vibe" ? "/api/vibes" : "/api/posts";
      const inferredTitle = trimmedCaption ? trimmedCaption.slice(0, 72) : "";
      const payload =
        selectedKind === "story"
          ? {
              mediaType: mediaKind,
              mediaUrl: uploadedMediaUrl,
              caption: trimmedCaption || null
            }
          : selectedKind === "vibe"
            ? {
                title: inferredTitle || null,
                body: trimmedCaption || "Fresh campus vibe.",
                mediaUrl: uploadedMediaUrl,
                location: collegeName
              }
            : {
                title: inferredTitle,
                body: trimmedCaption || "",
                kind: mediaKind ?? "text",
                mediaUrl: uploadedMediaUrl,
                location: collegeName
              };

      const response = await fetch(route, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const responsePayload = (await response.json().catch(() => null)) as
        | {
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok) {
        setMessage(responsePayload?.error?.message ?? "We could not publish this right now.");
        return;
      }

      router.push(returnTo);
      router.refresh();
    } catch {
      setMessage("We could not publish this right now.");
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <main className="vyb-upload-page">
      <section className="vyb-upload-modal">
        <div className="vyb-upload-drawer-handle" aria-hidden="true" />

        <header className="vyb-upload-modal-header">
          <div className="vyb-upload-modal-copy">
            <span className="vyb-upload-kicker">{summary.kicker}</span>
            <h1>{summary.title}</h1>
            <p>{summary.subtitle}</p>
          </div>

          <div className="vyb-upload-header-actions">
            <button
              type="button"
              className={`vyb-upload-submit-top${canPublish ? " is-active" : ""}`}
              onClick={handlePublish}
              disabled={!canPublish || isPublishing}
            >
              {isPublishing ? "Posting..." : summary.button}
            </button>
            <button type="button" className="vyb-upload-close" onClick={handleClose} aria-label="Close composer">
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="vyb-upload-kind-row" role="tablist" aria-label="Select composer type">
          {(["post", "story", "vibe"] as CampusUploadKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={selectedKind === kind}
              className={`vyb-upload-kind-chip${selectedKind === kind ? " is-active" : ""}`}
              onClick={() => setSelectedKind(kind)}
            >
              {kind === "post" ? "Post" : kind === "story" ? "Story" : "Vibe"}
            </button>
          ))}
        </div>

        <div className="vyb-upload-modal-body">
          <div className="vyb-upload-main-pane">
            <div className="vyb-upload-user-card">
              <div className="vyb-upload-avatar" aria-hidden="true">
                {avatarInitials}
              </div>

              <div className="vyb-upload-user-copy">
                <strong>{viewerName}</strong>
                <span>@{viewerUsername}</span>
              </div>

              <span className="vyb-upload-user-pill">{summary.accentLabel}</span>
            </div>

            <label className="vyb-upload-field is-textarea">
              <span>{summary.captionLabel}</span>
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder={summary.captionPlaceholder}
                rows={selectedKind === "story" ? 6 : 7}
                disabled={isPublishing}
              />
            </label>

            {message ? <p className="vyb-upload-message">{message}</p> : null}
          </div>

          <aside className="vyb-upload-side-pane">
            <div className="vyb-upload-side-header">
              <h2>Tools</h2>
            </div>

            <div className="vyb-upload-option-grid">
              <button type="button" className={`vyb-upload-option-card${mediaUrl ? " is-active" : ""}`} onClick={() => fileInputRef.current?.click()}>
                <div className="vyb-upload-option-copy">
                  <span className="vyb-upload-option-icon ic-media">
                    {mediaKind === "video" ? <VideoIcon /> : <ImageIcon />}
                  </span>
                  <strong>{mediaUrl ? "Replace" : "Media"}</strong>
                </div>
              </button>

              <button
                type="button"
                className={`vyb-upload-option-card${selectedKind === "story" ? " is-active" : ""}`}
                onClick={() => setSelectedKind("story")}
              >
                <div className="vyb-upload-option-copy">
                  <span className="vyb-upload-option-icon ic-story">
                    <StoryIcon />
                  </span>
                  <strong>Story</strong>
                </div>
              </button>

              <button
                type="button"
                className={`vyb-upload-option-card${selectedKind === "vibe" ? " is-active" : ""}`}
                onClick={() => setSelectedKind("vibe")}
              >
                <div className="vyb-upload-option-copy">
                  <span className="vyb-upload-option-icon ic-vibe">
                    <SparkIcon />
                  </span>
                  <strong>Vibe</strong>
                </div>
              </button>

              <div className="vyb-upload-option-card is-static">
                <div className="vyb-upload-option-copy">
                  <span className="vyb-upload-option-icon ic-feed">
                    {selectedKind === "post" ? <FeedIcon /> : <GlobeIcon />}
                  </span>
                  <strong>{selectedKind === "story" ? "Followers" : "Campus"}</strong>
                </div>
              </div>
            </div>

            <div className="vyb-upload-preview-card">
              <div className="vyb-upload-preview-frame">
                {mediaUrl ? (
                  mediaKind === "video" ? (
                    <video src={mediaUrl} className="vyb-upload-preview-media" controls muted playsInline />
                  ) : (
                    <img src={mediaUrl} alt="Upload preview" className="vyb-upload-preview-media" />
                  )
                ) : (
                  <div className="vyb-upload-preview-empty">
                    <div className="vyb-upload-preview-icons">
                      <ImageIcon />
                      <VideoIcon />
                    </div>
                    <strong>{selectedKind === "story" ? "Your story needs media" : "Media preview"}</strong>
                    <span>{summary.mediaHint}</span>
                  </div>
                )}
              </div>

              <div className="vyb-upload-preview-meta">
                <span>{mediaKind === "video" ? "Video selected" : mediaKind === "image" ? "Image selected" : "No media selected"}</span>
                {durationSeconds ? <span>Duration: {formatDuration(durationSeconds)}</span> : null}
                {selectedKind === "vibe" ? (
                  <span>{isPortraitVideo === false ? "Landscape video selected" : "Portrait-ready clip"}</span>
                ) : null}
                <span>{viewerEmail}</span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={selectedKind === "vibe" ? "video/*" : "image/*,video/*"}
              className="vyb-reels-file-input"
              onChange={handleMediaChange}
            />
          </aside>
        </div>

        <footer className="vyb-upload-footer">
          <div className="vyb-upload-footer-copy">
            <span>{summary.footerHint}</span>
            <button type="button" className="vyb-upload-footer-link" onClick={() => fileInputRef.current?.click()}>
              Open media picker
            </button>
          </div>

          <div className="vyb-upload-footer-actions">
            <button type="button" className="vyb-upload-secondary-button" onClick={handleClose} disabled={isPublishing}>
              Cancel
            </button>
            <button type="button" className="vyb-upload-primary-button" onClick={handlePublish} disabled={!canPublish || isPublishing}>
              {isPublishing ? "Publishing..." : summary.button}
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
