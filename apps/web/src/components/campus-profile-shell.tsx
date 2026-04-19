"use client";

import type { FeedCard } from "@vyb/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";

type CampusProfileShellProps = {
  viewerName: string;
  username: string;
  viewerUsername: string;
  collegeName: string;
  viewerEmail?: string | null;
  course?: string | null;
  stream?: string | null;
  role: string;
  stats: {
    posts: number;
    followers: number;
    following: number;
  };
  posts: FeedCard[];
  isOwnProfile: boolean;
  isFollowing: boolean;
};

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vyb-campus-icon">
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <IconBase>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.8a.7.7 0 0 1-.7-.7v-4.1a1.5 1.5 0 0 0-3 0v4.1a.7.7 0 0 1-.7.7H5a1 1 0 0 1-1-1z" fill="currentColor" />
    </IconBase>
  );
}

function EventsIcon() {
  return (
    <IconBase>
      <path d="M7 3v3M17 3v3M5 8h14M6 5h12a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ReelsIcon() {
  return (
    <IconBase>
      <path d="M6.5 3h11A3.5 3.5 0 0 1 21 6.5v11a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 17.5v-11A3.5 3.5 0 0 1 6.5 3Zm0 0 3 4M11.5 3l3 4M16.5 3l3 4M10 10.5l5 2.9L10 16.3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function MarketIcon() {
  return (
    <IconBase>
      <path d="M4 8.5 5.6 4h12.8L20 8.5M5 10v7.2A1.8 1.8 0 0 0 6.8 19h10.4A1.8 1.8 0 0 0 19 17.2V10M9 13h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ProfileIcon() {
  return (
    <IconBase>
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7.2C6 16.9 8.7 15 12 15s6 1.9 6 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: value > 999 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

export function CampusProfileShell({
  viewerName,
  username,
  viewerUsername,
  collegeName,
  viewerEmail,
  course,
  stream,
  role,
  stats,
  posts,
  isOwnProfile,
  isFollowing
}: CampusProfileShellProps) {
  const router = useRouter();
  const [editableUsername, setEditableUsername] = useState(username);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [followingState, setFollowingState] = useState(isFollowing);
  const [followerCount, setFollowerCount] = useState(stats.followers);

  const navItems = useMemo(
    () => [
      { label: "Home", href: "/home", icon: <HomeIcon /> },
      { label: "Events", href: "/events", icon: <EventsIcon /> },
      { label: "Vibes", href: "/vibes", icon: <ReelsIcon /> },
      { label: "Market", href: "/market", icon: <MarketIcon /> },
      { label: "Profile", href: "/dashboard", icon: <ProfileIcon />, active: true }
    ],
    []
  );

  const layoutStyle = {
    "--vyb-campus-left-width": "260px",
    "--vyb-campus-right-width": "320px"
  } as CSSProperties;

  async function handleUsernameSave() {
    const normalized = editableUsername.trim().toLowerCase();
    if (!normalized || normalized === username) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/profile/username", {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          username: normalized
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok) {
        setMessage(payload?.error?.message ?? "We could not update your user ID.");
        return;
      }

      setMessage("Your user ID is updated.");
      router.refresh();
    } catch {
      setMessage("We could not update your user ID.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFollowToggle() {
    if (isOwnProfile) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/follows/${encodeURIComponent(username)}`, {
        method: followingState ? "DELETE" : "PUT"
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

      setFollowingState((current) => !current);
      setFollowerCount((current) => Math.max(0, current + (followingState ? -1 : 1)));
      router.refresh();
    } catch {
      setMessage("We could not update that follow right now.");
    } finally {
      setBusy(false);
    }
  }

  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;

  return (
    <main className="vyb-campus-home" style={layoutStyle}>
      <aside className="vyb-campus-sidebar vyb-campus-rail">
        <Link href="/home" className="vyb-campus-branding">
          VYB
        </Link>

        <nav className="vyb-campus-nav">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className={`vyb-campus-nav-item${item.active ? " is-active" : ""}`}>
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="vyb-campus-sidebar-footer">
          <div className="vyb-campus-sidebar-user">
            <strong>{viewerName}</strong>
            <span>@{username}</span>
          </div>
          <SignOutButton className="vyb-campus-signout" />
        </div>
      </aside>

      <section className="vyb-campus-main">
        <div className="vyb-profile-surface">
          <div className="vyb-profile-hero-card">
            <div className="vyb-profile-hero-top">
              <div className="vyb-profile-hero-copy">
                <span className="vyb-page-badge">{isOwnProfile ? "Your profile" : "Campus profile"}</span>
                <h1>{viewerName}</h1>
                <p>@{username}</p>
                <span className="vyb-profile-identity-line">{identityLine}</span>
              </div>

              <div className="vyb-profile-hero-actions">
                {isOwnProfile ? (
                  <Link href="/create?kind=post&from=%2Fdashboard" className="vyb-primary-button">
                    Create post
                  </Link>
                ) : (
                  <button type="button" className="vyb-primary-button" disabled={busy} onClick={handleFollowToggle}>
                    {busy ? "Updating..." : followingState ? "Following" : "Follow"}
                  </button>
                )}
              </div>
            </div>

            <div className="vyb-profile-stats-grid">
              <div className="vyb-profile-stat-tile">
                <strong>{formatMetric(stats.posts)}</strong>
                <span>Posts</span>
              </div>
              <div className="vyb-profile-stat-tile">
                <strong>{formatMetric(followerCount)}</strong>
                <span>Followers</span>
              </div>
              <div className="vyb-profile-stat-tile">
                <strong>{formatMetric(stats.following)}</strong>
                <span>Following</span>
              </div>
            </div>

            {isOwnProfile ? (
              <div className="vyb-profile-inline-form">
                <label className="vyb-field">
                  <span>Change your user ID</span>
                  <input
                    value={editableUsername}
                    onChange={(event) => setEditableUsername(event.target.value.toLowerCase())}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </label>
                <button type="button" className="vyb-secondary-button" disabled={busy} onClick={handleUsernameSave}>
                  {busy ? "Saving..." : "Save user ID"}
                </button>
              </div>
            ) : null}

            {message ? <p className="vyb-inline-message">{message}</p> : null}
          </div>

          <div className="vyb-profile-posts-grid">
            {posts.length === 0 ? (
              <div className="vyb-campus-empty-state">
                <strong>No posts yet</strong>
                <span>{isOwnProfile ? "Your posts will appear here as soon as you publish them." : "This profile has not posted anything yet."}</span>
              </div>
            ) : null}

            {posts.map((post) => (
              <article key={post.id} className="vyb-profile-post-card">
                <div className="vyb-profile-post-media">
                  {post.mediaUrl && post.kind === "video" ? (
                    <video src={post.mediaUrl} controls playsInline muted loop />
                  ) : post.mediaUrl ? (
                    <img src={post.mediaUrl} alt={post.body || post.title} />
                  ) : (
                    <div className="vyb-campus-post-copy-panel">
                      <strong>{post.title}</strong>
                      <p>{post.body}</p>
                    </div>
                  )}
                </div>

                <div className="vyb-profile-post-copy">
                  <strong>{post.title}</strong>
                  <p>{post.body}</p>
                  <span>{formatMetric(post.reactions)} likes</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <aside className="vyb-campus-right-panel vyb-campus-rail">
        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Verified campus</span>
          <div className="vyb-campus-side-user">
            <strong>{collegeName}</strong>
            <span>{role}</span>
          </div>
        </div>

        {viewerEmail ? (
          <div className="vyb-campus-side-card">
            <span className="vyb-campus-side-label">Verified contact</span>
            <div className="vyb-campus-side-user">
              <span className="vyb-campus-side-copy">{viewerEmail}</span>
            </div>
          </div>
        ) : null}

        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Quick links</span>
          <div className="vyb-campus-side-actions">
            <Link href="/home" className="vyb-campus-profile-link">
              Back to home
            </Link>
            {username !== viewerUsername ? (
              <Link href={`/u/${encodeURIComponent(viewerUsername)}`} className="vyb-campus-profile-link">
                View your profile
              </Link>
            ) : null}
          </div>
        </div>
      </aside>

      <nav className="vyb-campus-bottom-nav">
        {navItems.map((item) => (
          <Link key={item.label} href={item.href} className={`vyb-campus-bottom-item${item.active ? " is-active" : ""}`}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
