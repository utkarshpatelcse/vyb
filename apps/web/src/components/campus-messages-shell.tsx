"use client";

import type { ChatConversationPreview } from "@vyb/contracts";
import Link from "next/link";
import { useMemo, useState } from "react";

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function getConversationPreviewLabel(item: ChatConversationPreview) {
  if (!item.lastMessage) {
    return "Secure chat is ready for your first message.";
  }

  switch (item.lastMessage.messageKind) {
    case "image":
      return "Encrypted photo shared";
    case "vibe_card":
      return "Encrypted vibe card shared";
    case "deal_card":
      return "Encrypted market deal shared";
    case "system":
      return "System update";
    default:
      return "Encrypted message";
  }
}

export function CampusMessagesShell({
  viewerName,
  viewerUsername,
  collegeName,
  initialItems,
  loadError
}: {
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  initialItems: ChatConversationPreview[];
  loadError?: string | null;
}) {
  const [query, setQuery] = useState("");

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return initialItems;
    }

    return initialItems.filter((item) => {
      const haystack = [
        item.peer.displayName,
        item.peer.username,
        item.peer.course ?? "",
        item.peer.stream ?? ""
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [initialItems, query]);

  return (
    <main className="vyb-auth-page">
      <div className="vyb-auth-glow" aria-hidden="true" />
      <div className="vyb-auth-shell">
        <section className="vyb-search-shell vyb-messages-shell">
          <div className="vyb-search-header vyb-messages-header">
            <div>
              <span className="vyb-page-badge">Encrypted Inbox</span>
              <h1>Campus messages</h1>
              <p>
                {collegeName} ke verified students ke direct chats yahan milenge. Search karo aur active chats par seedha jump
                karo.
              </p>
            </div>
            <div className="vyb-messages-header-actions">
              <div className="vyb-messages-viewer-chip">
                <strong>{viewerName}</strong>
                <span>@{viewerUsername}</span>
              </div>
              <Link href="/home" className="vyb-secondary-button">
                Back to home
              </Link>
            </div>
          </div>

          <label className="vyb-search-form vyb-messages-search" aria-label="Search campus chats">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chats by name or user ID"
              autoCapitalize="none"
            />
          </label>

          {loadError ? <p className="vyb-inline-message">{loadError}</p> : null}

          <div className="vyb-messages-summary">
            <span>{visibleItems.length} active chats</span>
            <span>{initialItems.filter((item) => item.unreadCount > 0).length} unread threads</span>
          </div>

          <div className="vyb-search-results vyb-messages-results">
            {visibleItems.length === 0 ? (
              <div className="vyb-campus-empty-state">
                <strong>{query.trim() ? "No chats matched that search" : "No active chats yet"}</strong>
                <span>
                  {query.trim()
                    ? "Try another name or user ID."
                    : "Jab kisi verified student ke saath encrypted chat open hogi, woh yahin dikh jayegi."}
                </span>
              </div>
            ) : null}

            {visibleItems.map((item) => (
              <article key={item.id} className={`vyb-search-card vyb-messages-card${item.unreadCount > 0 ? " is-unread" : ""}`}>
                <div className="vyb-messages-card-main">
                  <div className="vyb-messages-avatar" aria-hidden="true">
                    {item.peer.displayName.slice(0, 1).toUpperCase()}
                  </div>

                  <div className="vyb-search-card-copy vyb-messages-card-copy">
                    <div className="vyb-messages-card-topline">
                      <strong>{item.peer.displayName}</strong>
                      <span>{timeAgo(item.lastActivityAt)}</span>
                    </div>
                    <span>@{item.peer.username}</span>
                    <p>{getConversationPreviewLabel(item)}</p>
                    <small>
                      {[item.peer.course, item.peer.stream].filter(Boolean).join(" / ") || "Verified campus user"}
                    </small>
                  </div>
                </div>

                <div className="vyb-search-card-meta vyb-messages-card-meta">
                  <span className="vyb-messages-security-pill">
                    {item.peer.publicKey ? "E2EE ready" : "Key pending"}
                  </span>
                  {item.unreadCount > 0 ? <strong className="vyb-messages-unread-pill">{item.unreadCount} new</strong> : <span>Seen</span>}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
