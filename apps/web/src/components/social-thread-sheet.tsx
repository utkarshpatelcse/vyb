"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { CommentItem, FeedCard } from "@vyb/contracts";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { CampusAvatarContent } from "./campus-avatar";

type ThreadMediaKind = "gif" | "sticker";

type SocialThreadSheetProps = {
  post: FeedCard | null;
  comments: CommentItem[];
  draft: string;
  mediaUrl: string;
  mediaType: ThreadMediaKind;
  replyTarget: CommentItem | null;
  message: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  deletingCommentId: string | null;
  viewerName: string;
  viewerUsername: string;
  desktopInsetLeft?: string;
  desktopInsetRight?: string;
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onMediaUrlChange: (value: string) => void;
  onMediaTypeChange: (value: ThreadMediaKind) => void;
  onReply: (comment: CommentItem) => void;
  onCommentLike: (commentId: string) => void;
  onDeleteComment: (comment: CommentItem) => void;
  onClearReply: () => void;
  onSubmit: () => void;
};

type CommentThreadNode = {
  comment: CommentItem;
  replies: CommentThreadNode[];
};

type MediaSuggestion = {
  id: string;
  label: string;
  url: string;
};

const QUICK_EMOJIS = [
  "\u2764\uFE0F",
  "\uD83D\uDE4C",
  "\uD83D\uDD25",
  "\uD83D\uDE02",
  "\uD83D\uDE2E",
  "\uD83D\uDE22",
  "\uD83D\uDE0D",
  "\uD83D\uDC4D",
  "\uD83D\uDC4F",
  "\uD83E\uDD29",
  "\uD83E\uDD2F",
  "\uD83D\uDE0E",
  "\uD83C\uDF89",
  "\uD83D\uDE4F",
  "\uD83D\uDC40",
  "\uD83D\uDCAF"
] as const;

const TRENDING_GIFS: MediaSuggestion[] = [
  { id: "gif-cheer", label: "Cheer", url: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif" },
  { id: "gif-fire", label: "Fire", url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif" },
  { id: "gif-laugh", label: "Laugh", url: "https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif" },
  { id: "gif-clap", label: "Clap", url: "https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif" },
  { id: "gif-love", label: "Love", url: "https://media.giphy.com/media/26FLdmIp6wJr91JAI/giphy.gif" },
  { id: "gif-wow", label: "Wow", url: "https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif" }
];

const CAMPUS_STICKERS: MediaSuggestion[] = [
  { id: "sticker-study", label: "Study Mode", url: "https://media.giphy.com/media/3o6ZtaO9BZHcOjmErm/giphy.gif" },
  { id: "sticker-notes", label: "Notes", url: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif" },
  { id: "sticker-coffee", label: "Coffee", url: "https://media.giphy.com/media/3oEduSbSGpGaRX2Vri/giphy.gif" },
  { id: "sticker-lab", label: "Lab", url: "https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif" },
  { id: "sticker-party", label: "Campus Vibe", url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif" },
  { id: "sticker-exam", label: "Exam", url: "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif" }
];

function formatCommentDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function buildCommentThread(comments: CommentItem[]) {
  const nodes = new Map<string, CommentThreadNode>();

  comments.forEach((comment, index) => {
    const key = comment.id?.trim() || `comment-${index}`;
    nodes.set(key, {
      comment: {
        ...comment,
        id: key
      },
      replies: []
    });
  });

  const roots: CommentThreadNode[] = [];
  comments.forEach((comment, index) => {
    const key = comment.id?.trim() || `comment-${index}`;
    const node = nodes.get(key);
    if (!node) {
      return;
    }

    const parentKey = comment.parentCommentId?.trim();
    if (parentKey && nodes.has(parentKey)) {
      nodes.get(parentKey)?.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function getReplyTargetLabel(comment: CommentItem, comments: CommentItem[]) {
  if (!comment.parentCommentId) {
    return null;
  }

  const parentComment = comments.find((item) => item.id === comment.parentCommentId) ?? null;
  return parentComment?.author?.username ?? null;
}

function getCommentRenderKey(comment: CommentItem, fallback: string) {
  const primaryId = comment.id?.trim();
  if (primaryId) {
    return primaryId;
  }

  const authorId = comment.authorUserId?.trim() || comment.membershipId?.trim() || "anonymous";
  const createdAt = comment.createdAt?.trim() || "now";
  return `${fallback}-${authorId}-${createdAt}`;
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() ?? "")
    .join("");
}

function GifIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vyb-thread-icon">
      <rect x="3.5" y="5" width="17" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.5 12.5h2.5v2H7.8A2.3 2.3 0 0 1 5.5 12v-.1A2.4 2.4 0 0 1 7.9 9.5H10M12 9.5v5M15 9.5h3.5M15 12h2.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StickerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vyb-thread-icon">
      <path d="M7 4.5h10a2.5 2.5 0 0 1 2.5 2.5v10A2.5 2.5 0 0 1 17 19.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14.5 4.5V8a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SocialThreadSheet({
  post,
  comments,
  draft,
  mediaUrl,
  mediaType,
  replyTarget,
  message,
  isLoading,
  isSubmitting,
  deletingCommentId,
  viewerName,
  viewerUsername,
  desktopInsetLeft = "0px",
  desktopInsetRight = "0px",
  onClose,
  onDraftChange,
  onMediaUrlChange,
  onMediaTypeChange,
  onReply,
  onCommentLike,
  onDeleteComment,
  onClearReply,
  onSubmit
}: SocialThreadSheetProps) {
  const thread = useMemo(() => buildCommentThread(comments), [comments]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [openPicker, setOpenPicker] = useState<ThreadMediaKind | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const canSubmit = draft.trim().length > 0 || mediaUrl.trim().length > 0;
  const mediaSuggestions = openPicker === "sticker" ? CAMPUS_STICKERS : TRENDING_GIFS;
  const backdropStyle = {
    "--vyb-thread-desktop-left": desktopInsetLeft,
    "--vyb-thread-desktop-right": desktopInsetRight
  } as CSSProperties;

  function focusComposer(delay = 0) {
    const timeoutId = window.setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      textarea.focus({ preventScroll: true });
      const cursorPosition = textarea.value.length;
      textarea.setSelectionRange(cursorPosition, cursorPosition);
      textarea.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, delay);

    return timeoutId;
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 960px)");
    const applyDesktopState = () => setIsDesktop(mediaQuery.matches);
    applyDesktopState();
    mediaQuery.addEventListener("change", applyDesktopState);
    return () => mediaQuery.removeEventListener("change", applyDesktopState);
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 132);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 132 ? "auto" : "hidden";
  }, [draft]);

  useEffect(() => {
    if (!post) {
      return;
    }

    const timeoutId = focusComposer(160);

    return () => window.clearTimeout(timeoutId);
  }, [post?.id]);

  useEffect(() => {
    if (!post || !replyTarget) {
      return;
    }

    const timeoutId = focusComposer(40);
    return () => window.clearTimeout(timeoutId);
  }, [post, replyTarget?.id]);

  useEffect(() => {
    if (!post || isDesktop) {
      setIsMobileExpanded(false);
      return;
    }

    setIsMobileExpanded(false);
  }, [isDesktop, post?.id]);

  useEffect(() => {
    if (post) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [post]);

  function appendEmoji(emoji: string) {
    onDraftChange(draft ? `${draft}${emoji}` : emoji);
  }

  function selectMedia(kind: ThreadMediaKind, url: string) {
    onMediaTypeChange(kind);
    onMediaUrlChange(url);
    setOpenPicker(null);
    focusComposer();
  }

  function renderComment(node: CommentThreadNode, depth = 0, fallbackKey = "comment") {
    const { comment, replies } = node;
    const replyTargetLabel = getReplyTargetLabel(comment, comments);
    const commentKey = getCommentRenderKey(comment, fallbackKey);
    const canDeleteComment = Boolean(
      comment.author?.username === viewerUsername || post?.author.username === viewerUsername
    );
    const isDeletingComment = deletingCommentId === comment.id;

    return (
      <motion.div
        key={commentKey}
        className={`vyb-thread-comment-node${depth > 0 ? " is-reply-node" : ""}`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 26 }}
      >
        <article className={`vyb-thread-comment${depth > 0 ? " is-reply" : ""}`}>
          <div className="vyb-thread-comment-avatar" aria-hidden="true">
             <CampusAvatarContent
               userId={comment.author?.userId}
               username={comment.author?.username}
               displayName={comment.author?.displayName ?? "Vyb Student"}
               avatarUrl={comment.author?.avatarUrl ?? null}
               fallback={getInitials(comment.author?.displayName ?? "Vyb Student")}
               decorative
             />
          </div>
          <div className="vyb-thread-comment-body">
            <div className="vyb-thread-comment-copy">
              <div className="vyb-thread-comment-head">
                <strong>{comment.author?.displayName ?? "Vyb Student"}</strong>
                <span className="vyb-thread-comment-handle">@{comment.author?.username ?? "vyb_user"}</span>
              </div>
              {replyTargetLabel ? (
                <div className="vyb-thread-comment-context">
                  <span className="vyb-thread-comment-context-chip">Replying to @{replyTargetLabel}</span>
                </div>
              ) : null}
              {comment.body ? <p>{comment.body}</p> : null}
              {comment.mediaUrl ? (
                <div className="vyb-thread-comment-media">
                  <img src={comment.mediaUrl} alt={comment.mediaType ?? "comment media"} />
                  <span className="vyb-thread-comment-media-badge">{comment.mediaType === "sticker" ? "Sticker" : "GIF"}</span>
                </div>
              ) : null}
            </div>
            <div className="vyb-thread-comment-meta">
              <span>{formatCommentDate(comment.createdAt)}</span>
              <div className="vyb-thread-comment-actions">
                <button
                  type="button"
                  className={`vyb-thread-comment-like${comment.viewerHasLiked ? " is-active" : ""}`}
                  onClick={() => onCommentLike(comment.id)}
                >
                  {comment.viewerHasLiked ? "Liked" : "Like"}
                  {comment.reactions > 0 ? ` • ${comment.reactions}` : ""}
                </button>
                <button
                  type="button"
                  className="vyb-thread-reply-button"
                  onClick={() => {
                    onReply(comment);
                    focusComposer(20);
                  }}
                >
                  Reply
                </button>
                {canDeleteComment ? (
                  <button
                    type="button"
                    className="vyb-thread-delete-button"
                    onClick={() => onDeleteComment(comment)}
                    disabled={isDeletingComment}
                  >
                    {isDeletingComment ? "Deleting..." : "Delete"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </article>

        {replies.length > 0 ? (
          <div className="vyb-thread-reply-branch">
            <div className="vyb-thread-reply-rail" aria-hidden="true" />
            <div className="vyb-thread-replies">{replies.map((reply, index) => renderComment(reply, depth + 1, `${commentKey}-reply-${index}`))}</div>
          </div>
        ) : null}
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {post ? (
        <div className="vyb-thread-backdrop" role="presentation" onClick={onClose} style={backdropStyle}>
          <motion.div
            key={post.id || "thread-sheet"}
            className={`vyb-thread-sheet${isDesktop ? " is-desktop" : " is-mobile"}${!isDesktop && isMobileExpanded ? " is-expanded" : ""}${openPicker ? " has-picker" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Post comments"
            onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
            initial={{ opacity: 0, y: 96 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 120 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
          >
            <div className="vyb-thread-header">
              <button type="button" className="vyb-thread-close" onClick={onClose} aria-label="Close comments">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 7l10 10M17 7 7 17" />
                </svg>
              </button>
            </div>

            <div
              className="vyb-thread-list" 
              style={{ scrollbarWidth: "none", msOverflowStyle: "none", overflowY: "auto", touchAction: "pan-y" }}
            >
              <div className={`vyb-thread-list-inner${!isLoading && comments.length > 0 ? " has-comments" : ""}`}>
                {isLoading ? <p className="vyb-thread-state">Loading comments...</p> : null}
                {!isLoading && comments.length === 0 ? <p className="vyb-thread-state">No comments yet. Start the conversation.</p> : null}
                {!isLoading ? thread.map((node, index) => renderComment(node, 0, `root-${index}`)) : null}
              </div>
            </div>

            <div className="vyb-thread-dock" style={{ zIndex: 100 }}>
              <div className="vyb-thread-emoji-row" aria-label="Quick emoji row">
                {QUICK_EMOJIS.map((emoji) => (
                  <button key={emoji} type="button" className="vyb-thread-emoji-button" onClick={() => appendEmoji(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {openPicker ? (
                  <motion.div
                    className="vyb-thread-picker"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ type: "spring", stiffness: 240, damping: 24 }}
                  >
                    <div className="vyb-thread-picker-head">
                      <strong>{openPicker === "gif" ? "Trending GIFs" : "Campus stickers"}</strong>
                      <button type="button" onClick={() => setOpenPicker(null)}>
                        Close
                      </button>
                    </div>
                    <div className="vyb-thread-picker-grid">
                      {mediaSuggestions.map((item) => (
                        <button key={item.id} type="button" className="vyb-thread-picker-card" onClick={() => selectMedia(openPicker, item.url)}>
                          <img src={item.url} alt={item.label} />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {replyTarget ? (
                <div className="vyb-thread-reply-pill">
                  <span>Replying to @{replyTarget.author?.username ?? "vyb_user"}</span>
                  <button type="button" onClick={onClearReply}>
                    Clear
                  </button>
                </div>
              ) : null}

              <div className="vyb-thread-composer">
                <div className="vyb-thread-composer-avatar" aria-hidden="true">
                  <CampusAvatarContent
                    username={viewerUsername}
                    displayName={viewerName}
                    fallback={getInitials(viewerName || viewerUsername)}
                    decorative
                  />
                </div>

                <div className="vyb-thread-input-shell">
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(event) => onDraftChange(event.target.value)}
                    className="vyb-thread-textarea"
                    placeholder={replyTarget ? "Write your reply..." : "Write a comment..."}
                    rows={1}
                    autoFocus
                    disabled={isSubmitting}
                  />

                  <div className="vyb-thread-input-bar">
                    <div className="vyb-thread-input-actions">
                      <button
                        type="button"
                        className={`vyb-thread-ghost-button${openPicker === "gif" ? " is-active" : ""}`}
                        onClick={() => setOpenPicker((current) => (current === "gif" ? null : "gif"))}
                        disabled={isSubmitting}
                        aria-label="Open GIF tray"
                        title="GIF"
                      >
                        <GifIcon />
                        <span className="vyb-thread-icon-label">GIF</span>
                      </button>
                      <button
                        type="button"
                        className={`vyb-thread-ghost-button${openPicker === "sticker" ? " is-active" : ""}`}
                        onClick={() => setOpenPicker((current) => (current === "sticker" ? null : "sticker"))}
                        disabled={isSubmitting}
                        aria-label="Open sticker tray"
                        title="Sticker"
                      >
                        <StickerIcon />
                      </button>
                    </div>

                    <button
                      type="button"
                      className={`vyb-thread-post-button${canSubmit ? " is-ready" : ""}`}
                      onClick={onSubmit}
                      disabled={isSubmitting || !canSubmit}
                    >
                      {isSubmitting ? "Posting..." : "Post"}
                    </button>
                  </div>

                  {mediaUrl ? (
                    <div className="vyb-thread-media-preview">
                      <img src={mediaUrl} alt={`${mediaType} preview`} />
                      <div className="vyb-thread-media-preview-copy">
                        <span>{mediaType === "gif" ? "GIF selected" : "Sticker selected"}</span>
                        <button type="button" onClick={() => onMediaUrlChange("")}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {message ? <p className="vyb-thread-message">{message}</p> : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
