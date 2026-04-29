"use client";

import type { CommentItem, FeedCard, ReactionKind } from "@vyb/contracts";
import { useEffect, useState } from "react";
import { CampusAvatarContent } from "./campus-avatar";

const POST_REACTION_OPTIONS: Array<{
  kind: ReactionKind;
  label: string;
  symbol: string;
  tone: string;
}> = [
  { kind: "like", label: "Like", symbol: "👍", tone: "like" },
  { kind: "fire", label: "Fire", symbol: "🔥", tone: "fire" },
  { kind: "support", label: "Support", symbol: "👏", tone: "support" },
  { kind: "love", label: "Love", symbol: "❤️", tone: "love" },
  { kind: "insight", label: "Insight", symbol: "💡", tone: "insight" },
  { kind: "funny", label: "Funny", symbol: "😂", tone: "funny" }
];

function getPostReactionMeta(reactionType: ReactionKind | null | undefined) {
  return POST_REACTION_OPTIONS.find((item) => item.kind === reactionType) ?? POST_REACTION_OPTIONS[0];
}

type SocialPostLightboxProps = {
  post: FeedCard | null;
  comments: CommentItem[];
  isCommentsLoading: boolean;
  viewerUsername: string;
  isLiking: boolean;
  showHeartBurst: boolean;
  hideReactionCount: boolean;
  hideCommentCount: boolean;
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

function HeartIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function RepostIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function SocialPostLightbox({
  post,
  isLiking,
  showHeartBurst,
  hideReactionCount,
  hideCommentCount,
  onClose,
  onLike,
  onOpenComments,
  onOpenActions
}: SocialPostLightboxProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);

  useEffect(() => {
    setIsZoomed(false);
    setMediaIndex(0);
  }, [post?.id]);

  useEffect(() => {
    if (post) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [post]);

  if (!post) {
    return null;
  }

  const mediaItems = post.media && post.media.length > 0
    ? post.media
    : post.mediaUrl
    ? [{ url: post.mediaUrl, kind: post.kind === "video" ? "video" as const : "image" as const }]
    : [];

  const currentMedia = mediaItems[mediaIndex];
  const canZoomImage = Boolean(currentMedia && currentMedia.kind !== "video");
  const reactionMeta = getPostReactionMeta(post.viewerReactionType);

  return (
    <div className="vyb-post-lightbox-backdrop is-immersive" role="presentation" onClick={onClose}>
      <button 
        type="button" 
        className="vyb-post-lightbox-close-btn" 
        onClick={onClose} 
        aria-label="Close"
        style={{ opacity: isZoomed ? 0 : 1, pointerEvents: isZoomed ? "none" : "auto", transition: "opacity 0.2s" }}
      >
        ✕
      </button>

      <div className="vyb-post-lightbox is-full-view" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div 
          className={`vyb-post-lightbox-media-shell${isZoomed ? " is-zoomed" : ""}`} 
          onDoubleClick={onLike}
          onTouchStart={(e) => {
            if (e.touches.length === 2 && canZoomImage) {
              const touch1 = e.touches[0];
              const touch2 = e.touches[1];
              const distance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
              setInitialPinchDistance(distance);
            } else if (e.touches.length === 1) {
              setTouchStartX(e.targetTouches[0].clientX);
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length === 2 && canZoomImage && initialPinchDistance !== null) {
              const touch1 = e.touches[0];
              const touch2 = e.touches[1];
              const distance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
              if (distance > initialPinchDistance + 20) {
                setIsZoomed(true);
              } else if (distance < initialPinchDistance - 20) {
                setIsZoomed(false);
              }
            }
          }}
          onTouchEnd={(e) => {
            if (initialPinchDistance !== null && e.touches.length < 2) {
              setInitialPinchDistance(null);
            }
            if (touchStartX !== null && mediaItems.length > 1 && e.changedTouches.length > 0) {
              const touchEndX = e.changedTouches[0].clientX;
              const distance = touchStartX - touchEndX;
              if (distance > 50 && mediaIndex < mediaItems.length - 1) {
                setMediaIndex((prev) => prev + 1);
              } else if (distance < -50 && mediaIndex > 0) {
                setMediaIndex((prev) => prev - 1);
              }
            }
            setTouchStartX(null);
          }}
        >
          {currentMedia ? (
            currentMedia.kind === "video" ? (
              <video src={currentMedia.url} className="vyb-post-lightbox-media" controls autoPlay muted playsInline loop />
            ) : (
              <img
                src={currentMedia.url}
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

          {mediaItems.length > 1 && (
            <div className="vyb-post-lightbox-nav" aria-hidden="true">
              <button
                type="button"
                className="vyb-post-lightbox-nav-btn is-prev"
                onClick={(e) => { e.stopPropagation(); setMediaIndex(i => Math.max(0, i - 1)); }}
                disabled={mediaIndex === 0}
              >
                ‹
              </button>
              <button
                type="button"
                className="vyb-post-lightbox-nav-btn is-next"
                onClick={(e) => { e.stopPropagation(); setMediaIndex(i => Math.min(mediaItems.length - 1, i + 1)); }}
                disabled={mediaIndex === mediaItems.length - 1}
              >
                ›
              </button>
              <div className="vyb-post-lightbox-dots">
                {mediaItems.map((_, i) => (
                  <span key={i} className={`vyb-post-lightbox-dot${i === mediaIndex ? " is-active" : ""}`} />
                ))}
              </div>
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

        <div className="vyb-post-lightbox-overlay-bottom" style={{ opacity: isZoomed ? 0 : 1, pointerEvents: isZoomed ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
          <div className="vyb-post-lightbox-user-info">
            <div className="vyb-post-lightbox-user-avatar">
              <CampusAvatarContent
                userId={post.author.userId}
                username={post.author.username}
                displayName={post.author.displayName}
                avatarUrl={post.author.avatarUrl ?? null}
                fallback={(post.author.displayName || post.author.username).slice(0, 2).toUpperCase()}
                decorative
              />
            </div>
            <div className="vyb-post-lightbox-user-copy">
              <strong>{post.author.displayName || post.author.username}</strong>
              <p>{post.body}</p>
            </div>
          </div>
          <div className="fc-metrics-bar">
            <div className="fc-metrics-left">
              {hideReactionCount ? null : <span>{formatMetric(post.reactions)} reactions</span>}
              {hideCommentCount ? null : <span>{formatMetric(post.comments)} comments</span>}
            </div>
            <div className="fc-metrics-right">
              <span>{formatMetric(post.savedCount || 0)} shares</span>
            </div>
          </div>

          <div className="fc-actions is-lightbox">
            <div className="fc-actions-group is-left">
              <button
                type="button"
                className={`fc-action-btn is-reaction-btn reaction-${reactionMeta.tone}${post.viewerReactionType ? " is-active" : ""}`}
                onClick={onLike}
                disabled={isLiking}
              >
                <span className="fc-action-symbol" aria-hidden="true">{reactionMeta.symbol}</span>
              </button>
              <button type="button" className="fc-action-btn" onClick={onOpenComments}>
                <CommentIcon />
              </button>
              <button type="button" className="fc-action-btn" onClick={onOpenActions}>
                <ShareIcon />
              </button>
            </div>

            <div className="fc-actions-group is-right">
              <button type="button" className="fc-action-btn" onClick={onOpenActions}>
                <RepostIcon />
              </button>
              <button type="button" className={`fc-action-btn${post.isSaved ? " is-active is-save-active" : ""}`} onClick={onOpenActions}>
                <BookmarkIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
