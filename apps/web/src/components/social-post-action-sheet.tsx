"use client";

import type { FeedCard } from "@vyb/contracts";
import { useEffect, useState } from "react";

type SocialPostActionSheetProps = {
  post: FeedCard | null;
  isOwner: boolean;
  isBusy: boolean;
  message: string | null;
  onClose: () => void;
  onOpenDetail: () => void;
  onDirectRepost: () => void;
  onQuoteRepost: (quote: string) => void;
  onEdit: (payload: { title: string | null; body: string; location: string | null }) => void;
  onDelete: () => void;
  onReport: (reason: string) => void;
  onCopyLink: () => void;
};

type SheetMode = "menu" | "quote" | "report" | "edit";

export function SocialPostActionSheet({
  post,
  isOwner,
  isBusy,
  message,
  onClose,
  onOpenDetail,
  onDirectRepost,
  onQuoteRepost,
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

  if (!post) {
    return null;
  }

  return (
    <div className="vyb-post-actions-backdrop" role="presentation" onClick={onClose}>
      <div className="vyb-post-actions-sheet" role="dialog" aria-modal="true" aria-label="Post actions" onClick={(event) => event.stopPropagation()}>
        {mode === "menu" ? (
          <>
            <div className="vyb-post-actions-head">
              <div>
                <strong>Post actions</strong>
                <span>@{post.author.username}</span>
              </div>
              <button type="button" className="vyb-campus-compose-secondary" onClick={onClose}>
                Close
              </button>
            </div>

            <div className="vyb-post-actions-list">
              <button type="button" onClick={onOpenDetail}>
                View full post
              </button>
              <button type="button" onClick={onDirectRepost} disabled={isBusy}>
                {isBusy ? "Working..." : "Direct repost"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  setMode("quote");
                }}
              >
                Quote repost
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
                  Edit post
                </button>
              ) : null}
              <button type="button" onClick={onCopyLink}>
                Copy page link
              </button>
              {isOwner ? (
                <button type="button" className="is-danger" onClick={onDelete} disabled={isBusy}>
                  Delete post
                </button>
              ) : (
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => {
                    setDraft("");
                    setMode("report");
                  }}
                >
                  Report post
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="vyb-post-actions-head">
              <div>
                <strong>{mode === "quote" ? "Quote repost" : mode === "edit" ? "Edit post" : "Report post"}</strong>
                <span>
                  {mode === "quote"
                    ? "Add your take before reposting."
                    : mode === "edit"
                      ? "Update the caption and location for this post."
                      : "Tell us what is wrong with this post."}
                </span>
              </div>
              <button type="button" className="vyb-campus-compose-secondary" onClick={() => setMode("menu")}>
                Back
              </button>
            </div>

            <label className="vyb-post-actions-field">
              <span>{mode === "quote" ? "Your caption" : mode === "edit" ? "Caption" : "Reason"}</span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={mode === "quote" ? "Write your quote..." : mode === "edit" ? "Update your caption..." : "Explain the issue..."}
                rows={4}
                disabled={isBusy}
              />
            </label>

            {mode === "edit" ? (
              <label className="vyb-post-actions-field">
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

            <div className="vyb-post-actions-footer">
              <button type="button" className="vyb-campus-compose-secondary" onClick={() => setMode("menu")} disabled={isBusy}>
                Cancel
              </button>
              <button
                type="button"
                className="vyb-campus-compose-primary"
                onClick={() => {
                  if (mode === "quote") {
                    onQuoteRepost(draft);
                    return;
                  }

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
                {isBusy ? "Working..." : mode === "quote" ? "Repost now" : mode === "edit" ? "Save changes" : "Submit report"}
              </button>
            </div>
          </>
        )}

        {message ? <p className="vyb-post-actions-message">{message}</p> : null}
      </div>
    </div>
  );
}
