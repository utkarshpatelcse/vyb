"use client";

import type { FeedCard } from "@vyb/contracts";
import { useEffect, useMemo, useState } from "react";
import { CampusAvatarContent } from "./campus-avatar";

type SocialPostRepostSheetProps = {
  post: FeedCard | null;
  viewerName: string;
  viewerUsername: string;
  isBusy: boolean;
  message: string | null;
  onClose: () => void;
  onSubmit: (payload: { quote: string; placement: "feed" | "vibe" }) => void;
};

function getPreviewText(post: FeedCard) {
  const title = post.title?.trim();
  const body = post.body?.trim();

  if (title && body && title !== body) {
    return `${title}\n${body}`;
  }

  return body || title || "This post has media attached.";
}

export function SocialPostRepostSheet({
  post,
  viewerName,
  viewerUsername,
  isBusy,
  message,
  onClose,
  onSubmit
}: SocialPostRepostSheetProps) {
  const [quote, setQuote] = useState("");
  const [placement, setPlacement] = useState<"feed" | "vibe">("feed");

  useEffect(() => {
    setQuote("");
    setPlacement(post?.placement === "vibe" ? "vibe" : "feed");
  }, [post?.id, post?.placement]);

  useEffect(() => {
    if (post) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [post]);

  const previewMedia = useMemo(() => {
    if (!post) {
      return null;
    }

    if (Array.isArray(post.media) && post.media.length > 0) {
      return post.media[0] ?? null;
    }

    if (post.mediaUrl) {
      return {
        url: post.mediaUrl,
        kind: post.kind === "video" ? ("video" as const) : ("image" as const)
      };
    }

    return null;
  }, [post]);

  if (!post) {
    return null;
  }

  const previewText = getPreviewText(post);
  const mediaCount = Array.isArray(post.media) ? post.media.length : post.mediaUrl ? 1 : 0;

  return (
    <div className="vyb-post-actions-backdrop" role="presentation" onClick={isBusy ? undefined : onClose}>
      <div
        className="vyb-post-actions-sheet vyb-post-repost-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Repost this post"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vyb-post-actions-head">
          <div>
            <strong>Repost</strong>
            <span>Add your take, or leave it blank and repost as-is.</span>
          </div>
          <button type="button" className="vyb-campus-compose-secondary" onClick={onClose} disabled={isBusy}>
            Close
          </button>
        </div>

        <div className="vyb-post-repost-summary">
          <div className="vyb-post-repost-viewer">
            <div className="vyb-post-repost-avatar" aria-hidden="true">
              <CampusAvatarContent
                userId={`viewer-${viewerUsername}`}
                username={viewerUsername}
                displayName={viewerName}
                fallback={(viewerName.trim() || viewerUsername).slice(0, 2).toUpperCase()}
                decorative
              />
            </div>
            <div className="vyb-post-repost-viewer-copy">
              <strong>{viewerName}</strong>
              <span>@{viewerUsername}</span>
            </div>

            <div className="vyb-post-repost-placement" role="tablist" aria-label="Choose where to repost">
              <button
                type="button"
                className={placement === "feed" ? "is-active" : ""}
                onClick={() => setPlacement("feed")}
                disabled={isBusy}
              >
                Post
              </button>
              <button
                type="button"
                className={placement === "vibe" ? "is-active" : ""}
                onClick={() => setPlacement("vibe")}
                disabled={isBusy}
              >
                Vibe
              </button>
            </div>
          </div>

          <label className="vyb-post-actions-field">
            <span>Your note</span>
            <textarea
              value={quote}
              onChange={(event) => setQuote(event.target.value)}
              placeholder="Add something about this post... or leave blank."
              rows={4}
              disabled={isBusy}
            />
          </label>

          <div className="vyb-post-repost-origin">
            <div className="vyb-post-repost-origin-head">
              <div>
                <strong>Original post</strong>
                <span>@{post.author.username}</span>
              </div>
              {mediaCount > 1 ? <span>{mediaCount} media</span> : null}
            </div>

            {previewMedia ? (
              <div className="vyb-post-repost-origin-media">
                {previewMedia.kind === "video" ? (
                  <video src={previewMedia.url} muted playsInline preload="metadata" />
                ) : (
                  <img src={previewMedia.url} alt={post.title || post.body || "Shared post preview"} loading="lazy" />
                )}
              </div>
            ) : null}

            <div className="vyb-post-repost-origin-copy">
              <strong>{post.author.displayName || post.author.username}</strong>
              <p>{previewText}</p>
            </div>
          </div>
        </div>

        <div className="vyb-post-actions-footer">
          <button type="button" className="vyb-campus-compose-secondary" onClick={onClose} disabled={isBusy}>
            Cancel
          </button>
          <button
            type="button"
            className="vyb-campus-compose-primary"
            onClick={() => onSubmit({ quote, placement })}
            disabled={isBusy}
          >
            {isBusy ? "Posting..." : placement === "vibe" ? "Post vibe" : "Post repost"}
          </button>
        </div>

        {message ? <p className="vyb-post-actions-message">{message}</p> : null}
      </div>
    </div>
  );
}
