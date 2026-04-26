"use client";

import type { UserSearchItem } from "@vyb/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { CampusAvatarContent } from "./campus-avatar";

type CampusSearchShellProps = {
  initialQuery: string;
  results: UserSearchItem[];
  viewerUsername: string;
  hasSearched: boolean;
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function TrendingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

export function CampusSearchShell({
  initialQuery,
  results,
  viewerUsername,
  hasSearched
}: CampusSearchShellProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState(results);
  const [busyUsername, setBusyUsername] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setItems(results);
  }, [results]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    router.push(trimmedQuery ? `/search?q=${encodeURIComponent(trimmedQuery)}` : "/search");
  }

  async function handleFollowToggle(username: string, shouldFollow: boolean) {
    setBusyUsername(username);
    setMessage(null);

    try {
      const response = await fetch(`/api/follows/${encodeURIComponent(username)}`, {
        method: shouldFollow ? "PUT" : "DELETE"
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setMessage(payload?.error?.message ?? "We could not update that follow right now.");
        return;
      }

      setItems((current) =>
        current.map((item) =>
          item.username === username
            ? {
                ...item,
                isFollowing: shouldFollow,
                stats: {
                  ...item.stats,
                  followers: Math.max(0, item.stats.followers + (shouldFollow ? 1 : -1))
                }
              }
            : item
        )
      );
    } finally {
      setBusyUsername(null);
    }
  }

  return (
    <main className="vyb-search-page-modern">
      <div className="vyb-search-top-bar">
        <Link href="/home" className="search-back-btn">←</Link>
        <form className="modern-search-form" onSubmit={handleSearchSubmit}>
          <div className="modern-search-input-wrap">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value.toLowerCase())}
              placeholder="Search people, squads, or vibes..."
              autoFocus
            />
          </div>
        </form>
      </div>

      <div className="search-scroll-content">
        {message ? <p className="vyb-inline-message is-error">{message}</p> : null}

        {items.length > 0 ? (
          <section className="search-section">
            <div className="section-head">
              <h2>Search Results</h2>
              <span>Found {items.length} students</span>
            </div>
            <div className="search-results-list">
              {items.map((item) => (
                <article key={item.userId} className="modern-search-card">
                  <Link href={item.username === viewerUsername ? "/dashboard" : `/u/${encodeURIComponent(item.username)}`} className="search-card-avatar">
                    <CampusAvatarContent
                      userId={item.userId}
                      username={item.username}
                      displayName={item.displayName}
                      fallback={(item.displayName || item.username).slice(0, 2).toUpperCase()}
                      decorative
                    />
                  </Link>
                  <div className="search-card-info">
                    <Link href={item.username === viewerUsername ? "/dashboard" : `/u/${encodeURIComponent(item.username)}`}>
                      <strong>{item.displayName || item.username}</strong>
                      <span>@{item.username}</span>
                    </Link>
                    <p>{item.course} • {item.stream}</p>
                  </div>
                  <button
                    type="button"
                    className={`modern-follow-btn${item.isFollowing ? " is-following" : ""}`}
                    disabled={busyUsername === item.username || item.username === viewerUsername}
                    onClick={() => handleFollowToggle(item.username, !item.isFollowing)}
                  >
                    {item.username === viewerUsername ? "You" : item.isFollowing ? "Following" : "Follow"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="search-section trending-section">
              <div className="section-head">
                <div className="icon-label">
                  <TrendingIcon />
                  <h2>Trending on Campus</h2>
                </div>
              </div>
              <div className="trending-placeholder">
                <div className="trending-card-skeleton">
                  <div className="skeleton-avatar" />
                  <div className="skeleton-copy">
                    <div className="skeleton-line" />
                    <div className="skeleton-line short" />
                  </div>
                </div>
                <div className="trending-card-skeleton">
                  <div className="skeleton-avatar" />
                  <div className="skeleton-copy">
                    <div className="skeleton-line" />
                    <div className="skeleton-line short" />
                  </div>
                </div>
                <p className="trending-note">Real-time trending updates will appear here soon.</p>
              </div>
            </section>
            
            {!hasSearched && (
              <div className="search-explore-prompt">
                <strong>Explore your campus lane</strong>
                <p>Search for students by their name or roll number to connect.</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
