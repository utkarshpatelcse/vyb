"use client";

import type { UserSearchItem } from "@vyb/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

export function CampusSearchShell({
  initialQuery,
  results,
  viewerUsername,
  hasSearched
}: {
  initialQuery: string;
  results: UserSearchItem[];
  viewerUsername: string;
  hasSearched: boolean;
}) {
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

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok) {
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
    <main className="vyb-auth-page">
      <div className="vyb-auth-glow" aria-hidden="true" />
      <div className="vyb-auth-shell">
        <div className="vyb-search-shell">
          <div className="vyb-search-header">
            <div>
              <span className="vyb-page-badge">Campus Search</span>
              <h1>Find people by user ID</h1>
              <p>Search verified campus profiles and follow people to unlock their stories in your feed.</p>
            </div>
            <Link href="/home" className="vyb-secondary-button">
              Back to home
            </Link>
          </div>

          <form className="vyb-search-form" onSubmit={handleSearchSubmit}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value.toLowerCase())}
              placeholder="Search by user ID or name"
              autoCapitalize="none"
            />
            <button type="submit" className="vyb-primary-button">
              Search
            </button>
          </form>

          {message ? <p className="vyb-inline-message">{message}</p> : null}

          <div className="vyb-search-results">
            {items.length === 0 ? (
              <div className="vyb-campus-empty-state">
                <strong>{hasSearched ? "No results found" : "Start with a user ID"}</strong>
                <span>
                  {hasSearched
                    ? "No campus profile matched that user ID or name."
                    : "Enter a user ID or name and then press search."}
                </span>
              </div>
            ) : null}

            {items.map((item) => (
              <article key={item.userId} className="vyb-search-card">
                <div className="vyb-search-card-copy">
                  <Link href={item.username === viewerUsername ? "/dashboard" : `/u/${encodeURIComponent(item.username)}`}>
                    <strong>@{item.username}</strong>
                  </Link>
                  <span>{item.displayName}</span>
                  <p>
                    {item.course} / {item.stream}
                  </p>
                </div>

                <div className="vyb-search-card-meta">
                  <span>{item.stats.followers} followers</span>
                  <button
                    type="button"
                    className="vyb-secondary-button"
                    disabled={busyUsername === item.username || item.username === viewerUsername}
                    onClick={() => handleFollowToggle(item.username, !item.isFollowing)}
                  >
                    {item.username === viewerUsername
                      ? "You"
                      : busyUsername === item.username
                        ? "..."
                        : item.isFollowing
                          ? "Following"
                          : "Follow"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
