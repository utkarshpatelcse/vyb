"use client";

import type { ChatIdentitySummary, FeedCard } from "@vyb/contracts";
import { useEffect, useMemo, useState } from "react";
import { CampusAvatarContent } from "./campus-avatar";

export type SocialShareTarget = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  conversationId?: string | null;
  peerIdentity?: ChatIdentitySummary | null;
  lastActivityAt?: string | null;
  source: "recent" | "suggested" | "lookup";
};

type SocialPostShareSheetProps = {
  post: FeedCard | null;
  shareTargets: SocialShareTarget[];
  busyUsername: string | null;
  message: string | null;
  onClose: () => void;
  onAddToStory: () => void;
  onShare: (target: SocialShareTarget) => void;
};

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/u, "");
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

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <path d="M4.7 19.3 6 15.9a8 8 0 1 1 2.1 2.1l-3.4 1.3Z" />
      <path d="M9.1 8.9c.3-.4.6-.4.9-.2l.8 1.3c.2.3.2.6 0 .9l-.3.4c.5.9 1.2 1.6 2.2 2.1l.4-.3c.3-.2.6-.2.9 0l1.2.8c.3.2.3.6.1.9-.3.5-.9.8-1.5.7-2.8-.5-4.9-2.5-5.4-5.3-.1-.5.1-1 .7-1.3Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function getPostShareUrl(post: FeedCard) {
  const path = post.kind === "video" || post.placement === "vibe" ? "/vibes" : "/home";
  const url = new URL(path, window.location.origin);
  url.searchParams.set("post", post.id);
  return url.toString();
}

function getPostShareText(post: FeedCard, url: string) {
  const authorLabel = post.isAnonymous ? "Anonymous Vyber" : post.author.displayName || post.author.username;
  const title = post.title?.trim() || post.body?.trim() || `Vyb by ${authorLabel}`;
  return `${title}\n${url}`;
}

export function SocialPostShareSheet({
  post,
  shareTargets = [],
  busyUsername,
  message,
  onClose,
  onAddToStory,
  onShare
}: SocialPostShareSheetProps) {
  const [query, setQuery] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const isSheetBusy = Boolean(busyUsername);

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
  const recentCount = useMemo(() => shareTargets.filter((item) => item.source === "recent").length, [shareTargets]);
  
  const filteredUsers = useMemo(() => {
    return shareTargets.filter((item) => {
      if (!normalizedQuery) return true;
      return (
        item.username.toLowerCase().includes(normalizedQuery) ||
        item.displayName.toLowerCase().includes(normalizedQuery)
      );
    }).slice(0, 8);
  }, [normalizedQuery, shareTargets]);

  async function handleCopyLink() {
    if (!post) return;
    try {
      await navigator.clipboard.writeText(getPostShareUrl(post));
      setCopyStatus("Link copied");
      setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus("Failed to copy");
    }
  }

  async function handleSystemShare() {
    if (!post || !navigator.share) {
      await handleCopyLink();
      return;
    }
    const url = getPostShareUrl(post);
    try {
      await navigator.share({
        title: post.title || "Vyb",
        text: post.body?.trim() || "Check this out on Vyb",
        url
      });
    } catch (err) {
      console.error('Share failed:', err);
    }
  }

  function handleWhatsAppShare() {
    if (!post) return;
    const url = getPostShareUrl(post);
    window.open(`https://wa.me/?text=${encodeURIComponent(getPostShareText(post, url))}`, "_blank", "noopener,noreferrer");
  }

  if (!post) return null;

  return (
    <div className="vyb-post-actions-backdrop" role="presentation" onClick={isSheetBusy ? undefined : onClose}>
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
            <span>Quick share or send to a friend.</span>
          </div>
          <button type="button" className="vyb-post-share-close" onClick={onClose} aria-label="Close" disabled={isSheetBusy}>
            ✕
          </button>
        </div>

        <div className="vyb-post-share-icon-row">
          <button type="button" className="vyb-post-share-icon-btn" onClick={onAddToStory} disabled={isSheetBusy}>
            <div className="vyb-post-share-icon-wrap"><PlusIcon /></div>
            <span className="vyb-post-share-icon-label">Story</span>
          </button>
          <button type="button" className="vyb-post-share-icon-btn" onClick={handleCopyLink} disabled={isSheetBusy}>
            <div className="vyb-post-share-icon-wrap"><LinkIcon /></div>
            <span className="vyb-post-share-icon-label">Copy</span>
            {copyStatus && <span className="vyb-post-share-copy-toast">{copyStatus}</span>}
          </button>
          <button type="button" className="vyb-post-share-icon-btn" onClick={handleWhatsAppShare} disabled={isSheetBusy}>
            <div className="vyb-post-share-icon-wrap"><WhatsAppIcon /></div>
            <span className="vyb-post-share-icon-label">WhatsApp</span>
          </button>
          <button type="button" className="vyb-post-share-icon-btn" onClick={handleSystemShare} disabled={isSheetBusy}>
            <div className="vyb-post-share-icon-wrap"><ExternalShareIcon /></div>
            <span className="vyb-post-share-icon-label">More apps</span>
          </button>
        </div>

        <div className="vyb-post-share-divider">
          <span>Or send to a friend</span>
        </div>

        <label className="vyb-post-actions-field vyb-post-share-search-field">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or username..."
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={isSheetBusy}
            aria-label="Search friend by name or username"
          />
        </label>

        <div className="vyb-post-share-section-label">
          <span>{recentCount > 0 ? "Recent chats" : "People"}</span>
        </div>

        <div className="vyb-post-share-users">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => {
              const isSending = busyUsername === user.username;

              return (
                <button
                  key={user.conversationId || user.userId}
                  type="button"
                  className="vyb-post-share-user"
                  onClick={() => onShare(user)}
                  disabled={isSheetBusy}
                >
                  <div className="vyb-post-share-user-avatar" aria-hidden="true">
                    <CampusAvatarContent
                      userId={user.userId}
                      username={user.username}
                      displayName={user.displayName}
                      avatarUrl={user.avatarUrl ?? null}
                      fallback={(user.displayName || user.username).slice(0, 2).toUpperCase()}
                      decorative
                    />
                  </div>
                  <div className="vyb-post-share-user-copy">
                    <strong>{user.displayName || user.username}</strong>
                    <span>@{user.username}</span>
                  </div>
                  <span className="vyb-post-share-user-action">{isSending ? "Sending..." : "Send"}</span>
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
            onClick={() =>
              onShare({
                userId: `lookup:${normalizeUsername(query).toLowerCase()}`,
                username: normalizeUsername(query),
                displayName: normalizeUsername(query),
                source: "lookup"
              })
            }
            disabled={isSheetBusy}
          >
            {busyUsername === normalizeUsername(query) ? "Sending..." : `Send to @${normalizeUsername(query)}`}
          </button>
        ) : null}

        {message ? <p className="vyb-post-actions-message">{message}</p> : null}
      </div>
    </div>
  );
}
