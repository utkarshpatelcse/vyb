"use client";

import type { CommentItem, FeedCard } from "@vyb/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";

type SocialPostLightboxProps = {
  post: FeedCard | null;
  comments: CommentItem[];
  isCommentsLoading: boolean;
  viewerUsername: string;
  isLiking: boolean;
  showHeartBurst: boolean;
  onClose: () => void;
  onLike: () => void;
  onOpenComments: () => void;
  onOpenLikes: () => void;
  onOpenActions: () => void;
};

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: value > 999 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

export function SocialPostLightbox({
  post,
  comments,
  isCommentsLoading,
  viewerUsername,
  isLiking,
  showHeartBurst,
  onClose,
  onLike,
  onOpenComments,
  onOpenLikes,
  onOpenActions
}: SocialPostLightboxProps) {
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setIsZoomed(false);
  }, [post?.id]);

  if (!post) {
    return null;
  }

  const previewComments = comments.slice(0, 3);
  const profileHref = post.author.username === viewerUsername ? "/dashboard" : `/u/${encodeURIComponent(post.author.username)}`;
  const canZoomImage = Boolean(post.mediaUrl && post.kind !== "video");

  return (
    <div className="vyb-post-lightbox-backdrop" role="presentation" onClick={onClose}>
      <div className="vyb-post-lightbox" role="dialog" aria-modal="true" aria-label="Full post view" onClick={(event) => event.stopPropagation()}>
        <div className={`vyb-post-lightbox-media-shell${isZoomed ? " is-zoomed" : ""}`} onDoubleClick={onLike}>
          {post.mediaUrl ? (
            post.kind === "video" ? (
              <video src={post.mediaUrl} className="vyb-post-lightbox-media" controls autoPlay muted playsInline loop />
            ) : (
              <img
                src={post.mediaUrl}
                alt={post.body || post.title}
                className={`vyb-post-lightbox-media${canZoomImage ? " is-zoomable" : ""}`}
                onClick={() => {
                  if (canZoomImage) {
                    setIsZoomed((current) => !current);
                  }
                }}
              />
            )
          ) : (
            <div className="vyb-post-lightbox-copy-panel">
              <strong>{post.title}</strong>
              <p>{post.body}</p>
            </div>
          )}

          {showHeartBurst ? (
            <div className="vyb-post-heart-burst" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="M12 20.4s-6.6-4.3-8.6-8A4.8 4.8 0 0 1 11 6.9L12 8l1-1.1a4.8 4.8 0 0 1 7.6 5.5c-2 3.7-8.6 8-8.6 8Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          ) : null}
        </div>

        <aside className="vyb-post-lightbox-side">
          <div className="vyb-post-lightbox-top">
            <div>
              <Link href={profileHref}>
                <strong>{post.author.displayName}</strong>
              </Link>
              <span>
                @{post.author.username} {post.location ? `• ${post.location}` : ""}
              </span>
            </div>
            <button type="button" className="vyb-campus-compose-secondary" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="vyb-post-lightbox-actions">
            <button
              type="button"
              className={`vyb-campus-compose-primary vyb-post-lightbox-pill${post.viewerReactionType ? " is-active" : ""}`}
              disabled={isLiking}
              onClick={onLike}
            >
              {post.viewerReactionType ? "Reacted" : "React"}
            </button>
            <button type="button" className="vyb-campus-compose-secondary vyb-post-lightbox-pill" onClick={onOpenComments}>
              Comments
            </button>
            {canZoomImage ? (
              <button
                type="button"
                className="vyb-campus-compose-secondary vyb-post-lightbox-pill"
                onClick={() => setIsZoomed((current) => !current)}
              >
                {isZoomed ? "Zoom out" : "Zoom in"}
              </button>
            ) : null}
            <button type="button" className="vyb-campus-compose-secondary vyb-post-lightbox-pill" onClick={onOpenActions}>
              More
            </button>
          </div>

          <div className="vyb-post-lightbox-copy">
            <button type="button" className="vyb-post-lightbox-stat" onClick={onOpenLikes}>
              {formatMetric(post.reactions)} reactions
            </button>
            <span>{formatMetric(post.comments)} comments</span>
            <p>
              <strong>{post.author.username}</strong> {post.body}
            </p>
          </div>

          <div className="vyb-post-lightbox-comments">
            <div className="vyb-post-lightbox-comments-head">
              <strong>Conversation</strong>
              <button type="button" onClick={onOpenComments}>
                Open thread
              </button>
            </div>

            {isCommentsLoading ? <p className="vyb-post-lightbox-state">Loading comments...</p> : null}
            {!isCommentsLoading && previewComments.length === 0 ? (
              <p className="vyb-post-lightbox-state">No comments yet. Start the thread.</p>
            ) : null}

            {previewComments.map((comment) => (
              <article key={comment.id} className="vyb-post-lightbox-comment">
                <strong>@{comment.author?.username ?? "vyb_user"}</strong>
                {comment.body ? <p>{comment.body}</p> : null}
                {comment.mediaUrl ? (
                  <div className="vyb-post-lightbox-comment-media">
                    <img src={comment.mediaUrl} alt={comment.mediaType ?? "comment media"} />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
