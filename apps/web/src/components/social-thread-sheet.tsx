"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import type { CommentItem, FeedCard } from "@vyb/contracts";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

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
  viewerName: string;
  viewerUsername: string;
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onMediaUrlChange: (value: string) => void;
  onMediaTypeChange: (value: ThreadMediaKind) => void;
  onReply: (comment: CommentItem) => void;
  onCommentLike: (commentId: string) => void;
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

const QUICK_EMOJIS = ["❤️", "🙌", "🔥", "😂", "😮", "😢", "😍"] as const;

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
  for (const comment of comments) {
    nodes.set(comment.id, {
      comment,
      replies: []
    });
  }

  const roots: CommentThreadNode[] = [];
  for (const comment of comments) {
    const node = nodes.get(comment.id);
    if (!node) {
      continue;
    }

    if (comment.parentCommentId && nodes.has(comment.parentCommentId)) {
      nodes.get(comment.parentCommentId)?.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
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
  viewerName,
  viewerUsername,
  onClose,
  onDraftChange,
  onMediaUrlChange,
  onMediaTypeChange,
  onReply,
  onCommentLike,
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

    const timeoutId = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [post?.id]);

  useEffect(() => {
    if (!post || isDesktop) {
      setIsMobileExpanded(false);
      return;
    }

    setIsMobileExpanded(false);
  }, [isDesktop, post?.id]);

  function appendEmoji(emoji: string) {
    onDraftChange(draft ? `${draft}${emoji}` : emoji);
  }

  function selectMedia(kind: ThreadMediaKind, url: string) {
    onMediaTypeChange(kind);
    onMediaUrlChange(url);
    setOpenPicker(null);
  }

  function renderComment(node: CommentThreadNode, depth = 0) {
    const { comment, replies } = node;

    return (
      <motion.article
        key={comment.id}
        className={`vyb-thread-comment${depth > 0 ? " is-reply" : ""}`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 26 }}
      >
        <div className="vyb-thread-comment-copy">
          <strong>{comment.author?.displayName ?? "Vyb Student"}</strong>
          <span className="vyb-thread-comment-handle">@{comment.author?.username ?? "vyb_user"}</span>
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
            <button type="button" className="vyb-thread-reply-button" onClick={() => onReply(comment)}>
              Reply
            </button>
          </div>
        </div>

        {replies.length > 0 ? <div className="vyb-thread-replies">{replies.map((reply) => renderComment(reply, depth + 1))}</div> : null}
      </motion.article>
    );
  }

  return (
    <AnimatePresence>
      {post ? (
        <div className="vyb-thread-backdrop" role="presentation" onClick={onClose}>
          <motion.div
            className={`vyb-thread-sheet${isDesktop ? " is-desktop" : " is-mobile"}${!isDesktop && isMobileExpanded ? " is-expanded" : ""}${openPicker ? " has-picker" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Post comments"
            onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
            initial={isDesktop ? { opacity: 0, x: 40 } : { opacity: 0, y: 120 }}
            animate={
              isDesktop
                ? { opacity: 1, x: 0, y: 0 }
                : { opacity: 1, x: 0, y: 0, height: isMobileExpanded ? "100dvh" : "84dvh" }
            }
            exit={isDesktop ? { opacity: 0, x: 40 } : { opacity: 0, y: 140 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            drag={isDesktop ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.12}
            onDragEnd={(_event, info: PanInfo) => {
              if (isDesktop) {
                return;
              }

              if (info.offset.y > 180 || info.velocity.y > 900) {
                onClose();
                return;
              }

              if (info.offset.y > 70) {
                setIsMobileExpanded(false);
                return;
              }

              if (info.offset.y < -70 || info.velocity.y < -900) {
                setIsMobileExpanded(true);
              }
            }}
          >
            <div className="vyb-thread-header">
              <button type="button" className="vyb-thread-close" onClick={onClose} aria-label="Close comments">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 7l10 10M17 7 7 17" />
                </svg>
              </button>
            </div>

            <div className="vyb-thread-list">
              <div className="vyb-thread-list-inner">
                {isLoading ? <p className="vyb-thread-state">Loading comments...</p> : null}
                {!isLoading && comments.length === 0 ? <p className="vyb-thread-state">No comments yet. Start the conversation.</p> : null}
                {!isLoading ? thread.map((node) => renderComment(node)) : null}
              </div>
            </div>

            <div className="vyb-thread-dock">
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
                  {getInitials(viewerName || viewerUsername)}
                </div>

                <div className="vyb-thread-input-shell">
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(event) => onDraftChange(event.target.value)}
                    className="vyb-thread-textarea"
                    placeholder={replyTarget ? "Write your reply..." : "Write a comment..."}
                    rows={1}
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
