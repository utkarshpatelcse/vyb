"use client";

import type { FeedCard, PostLikerItem } from "@vyb/contracts";

type SocialPostLikersSheetProps = {
  post: FeedCard | null;
  items: PostLikerItem[];
  isLoading: boolean;
  message: string | null;
  onClose: () => void;
};

export function SocialPostLikersSheet({ post, items, isLoading, message, onClose }: SocialPostLikersSheetProps) {
  if (!post) {
    return null;
  }

  return (
    <div className="vyb-post-likers-backdrop" role="presentation" onClick={onClose}>
      <div className="vyb-post-likers-sheet" role="dialog" aria-modal="true" aria-label="Liked by" onClick={(event) => event.stopPropagation()}>
        <div className="vyb-post-likers-head">
          <div>
            <strong>Liked by campus</strong>
            <span>{post.title || "Campus post"}</span>
          </div>
          <button type="button" className="vyb-campus-compose-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="vyb-post-likers-list">
          {isLoading ? <p className="vyb-post-likers-state">Loading likes...</p> : null}
          {!isLoading && items.length === 0 ? <p className="vyb-post-likers-state">No likes yet.</p> : null}

          {items.map((item) => (
            <article key={`${item.membershipId}-${item.reactedAt}`} className="vyb-post-likers-item">
              <span className="vyb-post-likers-avatar">{item.displayName.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{item.displayName}</strong>
                <span>@{item.username}</span>
              </div>
            </article>
          ))}
        </div>

        {message ? <p className="vyb-post-likers-message">{message}</p> : null}
      </div>
    </div>
  );
}
