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

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ExternalShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function StoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function RepostIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
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
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    setQuery("");
    setCopyStatus(null);
  }, [post?.id]);

  useEffect(() => {
    if (post) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [post]);

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

  async function handleCopyLink() {
    if (!post) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
      setCopyStatus("Link copied!");
      setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus("Failed to copy");
    }
  }

  async function handleSystemShare() {
    if (!post || !navigator.share) return;
    try {
      await navigator.share({
        title: post.title || 'Vyb Post',
        text: getPostSnippet(post),
        url: `${window.location.origin}/post/${post.id}`
      });
    } catch (err) {
      console.error('Share failed:', err);
    }
  }

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
            <strong>Share post</strong>
            <span>Send to friends or copy the link to share elsewhere.</span>
          </div>
          <button type="button" className="vyb-campus-compose-secondary" onClick={onClose} disabled={Boolean(busyUsername)}>
            ✕
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

        <div className="vyb-post-share-primary-actions">
          <button type="button" className="vyb-post-share-primary-btn">
            <div className="vyb-post-share-primary-icon is-story"><StoryIcon /></div>
            <span>Add to Story</span>
          </button>
          <button type="button" className="vyb-post-share-primary-btn">
            <div className="vyb-post-share-primary-icon is-reshare"><RepostIcon /></div>
            <span>Reshare</span>
          </button>
        </div>

        <div className="vyb-post-share-quick-actions">
          <button type="button" className="vyb-post-share-quick-btn" onClick={handleCopyLink}>
            <div className="vyb-post-share-quick-icon"><LinkIcon /></div>
            <span>{copyStatus || "Copy Link"}</span>
          </button>
          {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
            <button type="button" className="vyb-post-share-quick-btn" onClick={handleSystemShare}>
              <div className="vyb-post-share-quick-icon"><ExternalShareIcon /></div>
              <span>System Share</span>
            </button>
          )}
        </div>

        <div className="vyb-post-share-divider">
          <span>Or send to a friend</span>
        </div>

        <label className="vyb-post-actions-field vyb-post-share-search-field">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search username..."
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={Boolean(busyUsername)}
            aria-label="Search friend by username"
          />
        </label>

        <div className="vyb-post-share-section-label">
          <span>Recents</span>
        </div>

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
                  <span className="vyb-post-share-user-action">{isBusy ? "Opening..." : "Send"}</span>
                </button>
              );
            })
          ) : (
            <div className="vyb-post-share-empty">No matches found.</div>
          )}
        </div>

        {normalizeUsername(query) && !filteredUsers.some(u => u.username.toLowerCase() === normalizeUsername(query).toLowerCase()) ? (
          <button
            type="button"
            className="vyb-campus-compose-primary vyb-post-share-manual"
            onClick={() => onShare(normalizeUsername(query))}
            disabled={Boolean(busyUsername)}
          >
            {busyUsername === normalizeUsername(query) ? "Opening..." : `Send to @${normalizeUsername(query)}`}
          </button>
        ) : null}

        {message ? <p className="vyb-post-actions-message">{message}</p> : null}
      </div>
    </div>
  );
}
