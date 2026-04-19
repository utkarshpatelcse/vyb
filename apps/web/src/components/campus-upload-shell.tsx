"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { CampusUploadKind, CampusUploadMediaKind } from "../lib/campus-upload-store";

type CampusUploadShellProps = {
  collegeName: string;
  viewerEmail: string;
  viewerName: string;
};

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vyb-campus-icon">
      {children}
    </svg>
  );
}

function BackIcon() {
  return (
    <IconBase>
      <path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ImageIcon() {
  return (
    <IconBase>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zm0 9 4.5-4.5 3 3 4.5-5.5 4 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="9" r="1.6" fill="currentColor" />
    </IconBase>
  );
}

function VideoIcon() {
  return (
    <IconBase>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4H14a2.5 2.5 0 0 1 2.5 2.5v1.2l3.5-2.1v12.8l-3.5-2.1v1.2A2.5 2.5 0 0 1 14 20H7.5A2.5 2.5 0 0 1 5 17.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
      button: "Add story",
      helper: "Quick campus moments disappear after the moment, so media is required.",
      mediaHint: "Images or videos both work well for stories.",
      title: "Story upload"
    };
  }

  if (kind === "vibe") {
    return {
      button: "Publish vibe",
      helper: "Vibes need a portrait video so the full-screen feed stays clean.",
      mediaHint: "Use a 9:16 or portrait video clip.",
      title: "Vibes upload"
    };
  }

  return {
    button: "Publish post",
    helper: "Posts can be text-only, image-first, or a video update.",
    mediaHint: "Images and videos both work for posts.",
    title: "Post upload"
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

export function CampusUploadShell({ collegeName, viewerEmail, viewerName }: CampusUploadShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultKind = parseKind(searchParams.get("kind"));
  const returnTo = searchParams.get("from") || (defaultKind === "vibe" ? "/vibes" : "/home");
  const [selectedKind, setSelectedKind] = useState<CampusUploadKind>(defaultKind);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<CampusUploadMediaKind>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [isPortraitVideo, setIsPortraitVideo] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const publishTarget = selectedKind === "vibe" ? "/vibes" : "/home";

  useEffect(() => {
    setSelectedKind(defaultKind);
  }, [defaultKind]);

  const summary = useMemo(() => getSummary(selectedKind), [selectedKind]);

  async function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const nextMediaKind: CampusUploadMediaKind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;

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
    router.push(publishTarget);
  }

  async function handlePublish() {
    const trimmedTitle = title.trim();
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

    if (selectedKind === "post" && !trimmedTitle && !trimmedCaption && !mediaUrl) {
      setMessage("Add some text or media before publishing your post.");
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
      const payload =
        selectedKind === "story"
          ? {
              mediaType: mediaKind,
              mediaUrl: uploadedMediaUrl,
              caption: trimmedCaption || null
            }
          : selectedKind === "vibe"
            ? {
                title: trimmedTitle || null,
                body: trimmedCaption || "Fresh campus vibe.",
                mediaUrl: uploadedMediaUrl,
                location: collegeName
              }
            : {
                title: trimmedTitle || "",
                body:
                  trimmedCaption ||
                  (mediaKind ? "New campus post." : trimmedTitle || "New campus update."),
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
      <div className="vyb-upload-shell">
        <div className="vyb-upload-header">
          <button type="button" className="vyb-upload-back" onClick={handleClose}>
            <BackIcon />
            <span>Back</span>
          </button>
          <Link href={returnTo} className="vyb-upload-return-link">
            Return without publishing
          </Link>
        </div>

        <section className="vyb-upload-card">
          <div className="vyb-upload-card-copy">
            <span className="vyb-upload-kicker">Single media composer</span>
            <h1>{summary.title}</h1>
            <p>{summary.helper}</p>
          </div>

          <div className="vyb-upload-kind-row" role="tablist" aria-label="Select upload type">
            {(["post", "story", "vibe"] as CampusUploadKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                className={`vyb-upload-kind-chip${selectedKind === kind ? " is-active" : ""}`}
                onClick={() => setSelectedKind(kind)}
              >
                {kind === "post" ? "Post" : kind === "story" ? "Story" : "Vibes"}
              </button>
            ))}
          </div>

          <div className="vyb-upload-grid">
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
                    <strong>Add media once and decide where it goes</strong>
                    <span>{summary.mediaHint}</span>
                  </div>
                )}
              </div>

              <button type="button" className="vyb-upload-media-button" onClick={() => fileInputRef.current?.click()}>
                {mediaUrl ? "Replace media" : "Select media"}
              </button>
              <input ref={fileInputRef} type="file" accept={selectedKind === "vibe" ? "video/*" : "image/*,video/*"} className="vyb-reels-file-input" onChange={handleMediaChange} />

              <div className="vyb-upload-preview-meta">
                <span>{mediaKind === "video" ? "Video selected" : mediaKind === "image" ? "Image selected" : "No media selected"}</span>
                {durationSeconds ? <span>Duration: {formatDuration(durationSeconds)}</span> : null}
                {selectedKind === "vibe" ? <span>{isPortraitVideo === false ? "Landscape video selected" : "Portrait video ready"}</span> : null}
              </div>
            </div>

            <div className="vyb-upload-form-card">
              {selectedKind === "post" ? (
                <label className="vyb-campus-compose-field">
                  <span>Title</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Prototype Night" disabled={isPublishing} />
                </label>
              ) : null}

              <label className="vyb-campus-compose-field">
                <span>{selectedKind === "story" ? "Story text" : "Caption"}</span>
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder={
                    selectedKind === "story"
                      ? "Add a quick context line..."
                      : selectedKind === "vibe"
                        ? "Tell everyone what this vibe is about..."
                        : "What is happening on campus today?"
                  }
                  rows={selectedKind === "story" ? 4 : 6}
                  disabled={isPublishing}
                />
              </label>

              <div className="vyb-upload-guidance">
                <span>{selectedKind === "post" ? "Default from Home: Post" : selectedKind === "story" ? "Default from Story add: Story" : "Default from Vibes: Vibe"}</span>
                <span>Publish target: {publishTarget}</span>
              </div>

              {message ? <p className="vyb-campus-compose-message">{message}</p> : null}

              <div className="vyb-campus-compose-actions">
                <button type="button" className="vyb-campus-compose-secondary" onClick={handleClose} disabled={isPublishing}>
                  Cancel
                </button>
                <button type="button" className="vyb-campus-compose-primary" onClick={handlePublish} disabled={isPublishing}>
                  {isPublishing ? "Publishing..." : summary.button}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
