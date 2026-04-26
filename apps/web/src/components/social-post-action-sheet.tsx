"use client";

import type { FeedCard } from "@vyb/contracts";
import { useEffect, useState } from "react";

type SocialPostActionSheetProps = {
  post: FeedCard | null;
  isOwner: boolean;
  isBusy: boolean;
  message: string | null;
  hideReactionCount: boolean;
  hideCommentCount: boolean;
  onClose: () => void;
  onOpenDetail: () => void;
  onOpenRepostComposer: () => void;
  onToggleReactionCount: () => void;
  onToggleCommentCount: () => void;
  onEdit: (payload: { title: string | null; body: string; location: string | null }) => void;
  onDelete: () => void;
  onReport: (reason: string) => void;
  onCopyLink: () => void;
};

type SheetMode = "menu" | "report" | "edit";

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function SocialPostActionSheet({
  post,
  isOwner,
  isBusy,
  message,
  hideReactionCount,
  hideCommentCount,
  onClose,
  onOpenDetail,
  onOpenRepostComposer,
  onToggleReactionCount,
  onToggleCommentCount,
  onEdit,
  onDelete,
  onReport,
  onCopyLink
}: SocialPostActionSheetProps) {
  const [mode, setMode] = useState<SheetMode>("menu");
  const [draft, setDraft] = useState("");
  const [locationDraft, setLocationDraft] = useState("");

  useEffect(() => {
    setMode("menu");
    setDraft(post?.body ?? "");
    setLocationDraft(post?.location ?? "");
  }, [post?.id]);

  useEffect(() => {
    if (post) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [post]);

  if (!post) {
    return null;
  }

  const itemLabel = post.placement === "vibe" || post.kind === "video" ? "vibe" : "post";
  const authorHandle = post.isAnonymous ? "Anonymous" : `@${post.author.username}`;

  return (
    <div className="vyb-post-actions-backdrop" role="presentation" onClick={onClose}>
      <div className="vyb-post-actions-sheet modern-sheet" role="dialog" aria-modal="true" aria-label="Post actions" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        
        {mode === "menu" ? (
          <>
            <div className="vyb-post-actions-head">
              <div>
                <strong>Post actions</strong>
                <span>{authorHandle}</span>
              </div>
              <button type="button" className="vyb-post-share-close" onClick={onClose} aria-label="Close">✕</button>
            </div>

            <div className="vyb-post-actions-list modern-list">
              <button type="button" onClick={onOpenDetail}>
                <div className="action-icon"><EyeIcon /></div>
                <span>View full post</span>
              </button>
              <button type="button" onClick={onOpenRepostComposer} disabled={isBusy}>
                <div className="action-icon"><RepeatIcon /></div>
                <span>{isBusy ? "Working..." : "Repost this post"}</span>
              </button>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(post.body ?? "");
                    setLocationDraft(post.location ?? "");
                    setMode("edit");
                  }}
                >
                  <div className="action-icon"><EditIcon /></div>
                  <span>Edit post</span>
                </button>
              ) : null}
              {isOwner ? (
                <>
                  <button type="button" onClick={onToggleReactionCount} disabled={isBusy}>
                    <div className="action-icon"><EyeIcon /></div>
                    <span>{hideReactionCount ? `Show like count on this ${itemLabel}` : `Hide like count on this ${itemLabel}`}</span>
                  </button>
                  <button type="button" onClick={onToggleCommentCount} disabled={isBusy}>
                    <div className="action-icon"><EyeIcon /></div>
                    <span>{hideCommentCount ? `Show comment count on this ${itemLabel}` : `Hide comment count on this ${itemLabel}`}</span>
                  </button>
                </>
              ) : null}
              <button type="button" onClick={onCopyLink}>
                <div className="action-icon"><CopyIcon /></div>
                <span>Copy link</span>
              </button>
              <div className="list-divider" />
              {isOwner ? (
                <button type="button" className="is-danger-modern" onClick={onDelete} disabled={isBusy}>
                  <div className="action-icon"><TrashIcon /></div>
                  <span>Delete post</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="is-danger-modern"
                  onClick={() => {
                    setDraft("");
                    setMode("report");
                  }}
                >
                  <div className="action-icon"><AlertIcon /></div>
                  <span>Report post</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="vyb-post-actions-head">
              <div>
                <strong>{mode === "edit" ? "Edit post" : "Report post"}</strong>
                <span>
                  {mode === "edit"
                    ? "Update the caption and location for this post."
                    : "Tell us what is wrong with this post."}
                </span>
              </div>
              <button type="button" className="vyb-post-share-close" onClick={() => setMode("menu")}>←</button>
            </div>

            <div className="sheet-form-content">
              <label className="vyb-post-actions-field modern-field">
                <span>{mode === "edit" ? "Caption" : "Reason"}</span>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={mode === "edit" ? "Update your caption..." : "Explain the issue..."}
                  rows={4}
                  disabled={isBusy}
                />
              </label>

              {mode === "edit" ? (
                <label className="vyb-post-actions-field modern-field">
                  <span>Location</span>
                  <input
                    type="text"
                    value={locationDraft}
                    onChange={(event) => setLocationDraft(event.target.value)}
                    placeholder="Add or update location"
                    disabled={isBusy}
                  />
                </label>
              ) : null}

              <div className="vyb-post-actions-footer modern-footer">
                <button type="button" className="modern-btn-secondary" onClick={() => setMode("menu")} disabled={isBusy}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="modern-btn-primary"
                  onClick={() => {
                    if (mode === "edit") {
                      const nextBody = draft.trim();
                      onEdit({
                        title: nextBody ? nextBody.slice(0, 72) : post.title ?? null,
                        body: nextBody,
                        location: locationDraft.trim() || null
                      });
                      return;
                    }

                    onReport(draft);
                  }}
                  disabled={
                    isBusy ||
                    (mode === "edit" ? draft.trim().length < 2 : draft.trim().length < 3)
                  }
                >
                  {isBusy ? "Working..." : mode === "edit" ? "Save changes" : "Submit report"}
                </button>
              </div>
            </div>
          </>
        )}

        {message ? <p className="vyb-post-actions-message modern-message">{message}</p> : null}
      </div>
    </div>
  );
}
