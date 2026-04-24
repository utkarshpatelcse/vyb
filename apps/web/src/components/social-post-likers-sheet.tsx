"use client";

import type { FeedCard, PostLikerItem } from "@vyb/contracts";
import { CampusAvatarContent } from "./campus-avatar";

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

  function getReactionSymbol(reactionType: PostLikerItem["reactionType"]) {
    switch (reactionType) {
      case "fire":
        return "🔥";
      case "support":
        return "👏";
      case "love":
        return "❤️";
      case "insight":
        return "💡";
      case "funny":
        return "😂";
      default:
        return "👍";
    }
  }

  return (
    <div className="vyb-post-likers-backdrop" role="presentation" onClick={onClose}>
      <div className="vyb-post-likers-sheet" role="dialog" aria-modal="true" aria-label="Post reactions" onClick={(event) => event.stopPropagation()}>
        <div className="vyb-post-likers-head">
          <div>
            <strong>Reactions from campus</strong>
            <span>{post.title || "Campus post"}</span>
          </div>
          <button type="button" className="vyb-campus-compose-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="vyb-post-likers-list">
          {isLoading ? <p className="vyb-post-likers-state">Loading reactions...</p> : null}
          {!isLoading && items.length === 0 ? <p className="vyb-post-likers-state">No reactions yet.</p> : null}

          {items.map((item) => (
            <article key={`${item.membershipId}-${item.reactedAt}`} className="vyb-post-likers-item">
              <span className="vyb-post-likers-avatar">
                <CampusAvatarContent
                  userId={item.userId}
                  username={item.username}
                  displayName={item.displayName}
                  fallback={item.displayName.slice(0, 1).toUpperCase()}
                  decorative
                />
              </span>
              <div>
                <strong>{item.displayName}</strong>
                <span>@{item.username}</span>
              </div>
              <span className="vyb-post-likers-reaction" aria-label={item.reactionType}>
                {getReactionSymbol(item.reactionType)}
              </span>
            </article>
          ))}
        </div>

        {message ? <p className="vyb-post-likers-message">{message}</p> : null}
      </div>
    </div>
  );
}
