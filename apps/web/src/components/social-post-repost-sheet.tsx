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
  const body = post.body?.trim();
  const title = post.title?.trim();
  if (body) return body;
  if (title) return title;
  return "Media attached";
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
  const [placement, setPlacement] = useState<"feed" | "vibe" >("feed");

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
    if (!post) return null;
    if (Array.isArray(post.media) && post.media.length > 0) return post.media[0] ?? null;
    if (post.mediaUrl) return { url: post.mediaUrl, kind: post.kind === "video" ? "video" : "image" };
    return null;
  }, [post]);

  if (!post) return null;

  return (
    <div className="vyb-repost-immersive-overlay" role="presentation" onClick={isBusy ? undefined : onClose}>
      {/* Dynamic Background Blur */}
      <div className="repost-blur-bg" aria-hidden="true">
        {previewMedia ? (
          previewMedia.kind === "video" ? (
            <video src={previewMedia.url} muted playsInline />
          ) : (
            <img src={previewMedia.url} alt="" />
          )
        ) : null}
        <div className="repost-bg-overlay" />
      </div>

      <div className="repost-immersive-shell" role="dialog" onClick={e => e.stopPropagation()}>
        <div className="repost-immersive-header">
          <div className="repost-user-meta">
            <div className="repost-user-avatar">
              <CampusAvatarContent
                userId={`v-${viewerUsername}`}
                username={viewerUsername}
                displayName={viewerName}
                fallback={(viewerName || viewerUsername).slice(0, 2).toUpperCase()}
                decorative
              />
            </div>
            <div className="repost-user-copy">
              <strong>{viewerName}</strong>
              <span>@{viewerUsername}</span>
            </div>
          </div>
          <div className="repost-type-toggle">
            <button 
              className={placement === "feed" ? "is-active" : ""} 
              onClick={() => setPlacement("feed")}
              disabled={isBusy}
            >
              Feed
            </button>
            <button 
              className={placement === "vibe" ? "is-active" : ""} 
              onClick={() => setPlacement("vibe")}
              disabled={isBusy}
            >
              Vibe
            </button>
          </div>
        </div>

        <div className="repost-immersive-body">
          <div className="repost-quote-area">
            <textarea
              value={quote}
              onChange={e => setQuote(e.target.value)}
              placeholder="Write your note..."
              disabled={isBusy}
              autoFocus
            />
          </div>

          <div className="repost-origin-card-immersive">
            {previewMedia && (
              <div className="repost-card-media">
                {previewMedia.kind === "video" ? (
                  <video src={previewMedia.url} muted playsInline />
                ) : (
                  <img src={previewMedia.url} alt="" />
                )}
              </div>
            )}
            <div className="repost-card-bottom">
              <div className="repost-card-author">
                <div className="author-avatar-mini">
                   <CampusAvatarContent
                    userId={post.author.userId}
                    username={post.author.username}
                    displayName={post.author.displayName}
                    fallback={post.author.username.slice(0, 2).toUpperCase()}
                    decorative
                  />
                </div>
                <strong>{post.author.displayName || post.author.username}</strong>
              </div>
              <p>{getPreviewText(post)}</p>
            </div>
          </div>
        </div>

        <div className="repost-immersive-footer">
          <button className="repost-cancel-btn" onClick={onClose} disabled={isBusy}>Cancel</button>
          <button 
            className="repost-submit-btn" 
            onClick={() => onSubmit({ quote, placement })}
            disabled={isBusy}
          >
            {isBusy ? "Sharing..." : `Post to ${placement}`}
          </button>
        </div>

        {message && <p className="repost-error-msg">{message}</p>}
      </div>
    </div>
  );
}
