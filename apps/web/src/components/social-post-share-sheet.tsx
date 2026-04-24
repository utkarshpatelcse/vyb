"use client";

import type { FeedCard, UserSearchItem } from "@vyb/contracts";
import { useEffect, useMemo, useState } from "react";
import { CampusAvatarContent } from "./campus-avatar";

type SocialPostShareSheetProps = {
  post: FeedCard | null;
  suggestedUsers: UserSearchItem[];
  busyUsername: string | null;
  message: string | null;
  onClose: () => void;
  onShare: (username: string) => void;
};

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/u, "");
}

function getPostSnippet(post: FeedCard) {
  const title = post.title?.trim();
  const body = post.body?.trim();

  if (title && body && title !== body) {
    return `${title} • ${body}`;
  }

  return body || title || `Post from @${post.author.username}`;
}

export function SocialPostShareSheet({
  post,
  suggestedUsers,
  busyUsername,
  message,
  onClose,
  onShare
}: SocialPostShareSheetProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery("");
  }, [post?.id]);

  const normalizedQuery = normalizeUsername(query).toLowerCase();
  const filteredUsers = useMemo(() => {
    const ranked = suggestedUsers.filter((item) => {
      if (!normalizedQuery) {
        return true;
      }

      return (
        item.username.toLowerCase().includes(normalizedQuery) ||
        item.displayName.toLowerCase().includes(normalizedQuery)
      );
    });

    return ranked.slice(0, 8);
  }, [normalizedQuery, suggestedUsers]);

  if (!post) {
    return null;
  }

  return (
    <div className="vyb-post-actions-backdrop" role="presentation" onClick={busyUsername ? undefined : onClose}>
      <div
        className="vyb-post-actions-sheet vyb-post-share-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Share to Vyb chats"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vyb-post-actions-head">
          <div>
            <strong>Share in chats</strong>
            <span>Pick someone and we will open this inside your Vyb chatbox.</span>
          </div>
          <button type="button" className="vyb-campus-compose-secondary" onClick={onClose} disabled={Boolean(busyUsername)}>
            Close
          </button>
        </div>

        <div className="vyb-post-share-preview">
          <div className="vyb-post-share-preview-avatar" aria-hidden="true">
            <CampusAvatarContent
              userId={post.author.userId}
              username={post.author.username}
              displayName={post.author.displayName}
              fallback={(post.author.displayName || post.author.username).slice(0, 2).toUpperCase()}
              decorative
            />
          </div>
          <div className="vyb-post-share-preview-copy">
            <strong>{post.author.displayName || post.author.username}</strong>
            <span>@{post.author.username}</span>
            <p>{getPostSnippet(post)}</p>
          </div>
        </div>

        <label className="vyb-post-actions-field">
          <span>Find a username</span>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="@username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={Boolean(busyUsername)}
          />
        </label>

        <div className="vyb-post-share-users">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => {
              const isBusy = busyUsername === user.username;

              return (
                <button
                  key={user.userId}
                  type="button"
                  className="vyb-post-share-user"
                  onClick={() => onShare(user.username)}
                  disabled={Boolean(busyUsername)}
                >
                  <div className="vyb-post-share-user-avatar" aria-hidden="true">
                    <CampusAvatarContent
                      userId={user.userId}
                      username={user.username}
                      displayName={user.displayName}
                      fallback={(user.displayName || user.username).slice(0, 2).toUpperCase()}
                      decorative
                    />
                  </div>
                  <div className="vyb-post-share-user-copy">
                    <strong>{user.displayName || user.username}</strong>
                    <span>@{user.username}</span>
                  </div>
                  <span className="vyb-post-share-user-action">{isBusy ? "Opening..." : "Open chat"}</span>
                </button>
              );
            })
          ) : (
            <div className="vyb-post-share-empty">No matches yet. Type a full username below.</div>
          )}
        </div>

        {normalizeUsername(query) ? (
          <button
            type="button"
            className="vyb-campus-compose-primary vyb-post-share-manual"
            onClick={() => onShare(normalizeUsername(query))}
            disabled={Boolean(busyUsername)}
          >
            {busyUsername === normalizeUsername(query) ? "Opening..." : `Open chat with @${normalizeUsername(query)}`}
          </button>
        ) : null}

        {message ? <p className="vyb-post-actions-message">{message}</p> : null}
      </div>
    </div>
  );
}
