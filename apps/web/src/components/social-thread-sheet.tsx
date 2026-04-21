"use client";

import type { CommentItem, FeedCard } from "@vyb/contracts";

type SocialThreadSheetProps = {
  post: FeedCard | null;
  comments: CommentItem[];
  draft: string;
  message: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
};

export function SocialThreadSheet({
  post,
  comments,
  draft,
  message,
  isLoading,
  isSubmitting,
  onClose,
  onDraftChange,
  onSubmit
}: SocialThreadSheetProps) {
  if (!post) {
    return null;
  }

  return (
    <div className="vyb-thread-backdrop" role="presentation" onClick={onClose}>
      <div className="vyb-thread-sheet" role="dialog" aria-modal="true" aria-label="Post comments" onClick={(event) => event.stopPropagation()}>
        <div className="vyb-thread-head">
          <div>
            <strong>@{post.author.username}</strong>
            <span>{post.title || "Campus thread"}</span>
          </div>
          <button type="button" className="vyb-campus-compose-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="vyb-thread-post-preview">
          <strong>{post.title || "Campus update"}</strong>
          <p>{post.body}</p>
        </div>

        <div className="vyb-thread-list">
          {isLoading ? <p className="vyb-thread-state">Loading comments...</p> : null}
          {!isLoading && comments.length === 0 ? <p className="vyb-thread-state">No comments yet. Start the conversation.</p> : null}

          {comments.map((comment) => (
            <article key={comment.id} className="vyb-thread-comment">
              <div className="vyb-thread-comment-copy">
                <strong>@{comment.author?.username ?? "vyb_user"}</strong>
                <p>{comment.body}</p>
              </div>
              <span>{new Date(comment.createdAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            </article>
          ))}
        </div>

        <label className="vyb-thread-field">
          <span>Add comment</span>
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Write something thoughtful..."
            rows={3}
            disabled={isSubmitting}
          />
        </label>

        {message ? <p className="vyb-thread-message">{message}</p> : null}

        <div className="vyb-thread-actions">
          <button type="button" className="vyb-campus-compose-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="button" className="vyb-campus-compose-primary" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Posting..." : "Post comment"}
          </button>
        </div>
      </div>
    </div>
  );
}
