"use client";

import type { CommentItem, FeedCard } from "@vyb/contracts";

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
  onClose,
  onDraftChange,
  onMediaUrlChange,
  onMediaTypeChange,
  onReply,
  onCommentLike,
  onClearReply,
  onSubmit
}: SocialThreadSheetProps) {
  if (!post) {
    return null;
  }

  const thread = buildCommentThread(comments);

  function renderComment(node: CommentThreadNode, depth = 0) {
    const { comment, replies } = node;

    return (
      <article key={comment.id} className={`vyb-thread-comment${depth > 0 ? " is-reply" : ""}`}>
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
      </article>
    );
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
          {!isLoading ? thread.map((node) => renderComment(node)) : null}
        </div>

        {replyTarget ? (
          <div className="vyb-thread-reply-pill">
            <span>Replying to @{replyTarget.author?.username ?? "vyb_user"}</span>
            <button type="button" onClick={onClearReply}>
              Clear
            </button>
          </div>
        ) : null}

        <label className="vyb-thread-field">
          <span>{replyTarget ? "Write reply" : "Add comment"}</span>
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={replyTarget ? "Write your reply..." : "Write something thoughtful..."}
            rows={3}
            disabled={isSubmitting}
          />
        </label>

        <div className="vyb-thread-media-tools">
          <div className="vyb-thread-media-type-list">
            <button
              type="button"
              className={mediaType === "gif" ? "is-active" : ""}
              onClick={() => onMediaTypeChange("gif")}
              disabled={isSubmitting}
            >
              GIF
            </button>
            <button
              type="button"
              className={mediaType === "sticker" ? "is-active" : ""}
              onClick={() => onMediaTypeChange("sticker")}
              disabled={isSubmitting}
            >
              Sticker
            </button>
          </div>
          <input
            type="url"
            value={mediaUrl}
            onChange={(event) => onMediaUrlChange(event.target.value)}
            placeholder={mediaType === "gif" ? "Paste GIF link (optional)" : "Paste sticker link (optional)"}
            disabled={isSubmitting}
          />
          {mediaUrl ? (
            <div className="vyb-thread-media-preview">
              <img src={mediaUrl} alt={`${mediaType} preview`} />
            </div>
          ) : null}
        </div>

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
