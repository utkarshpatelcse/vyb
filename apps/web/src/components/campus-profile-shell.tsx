"use client";

import type { ActivityItem, CourseItem, FeedCard, ResourceItem } from "@vyb/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";

type CampusProfileShellProps = {
  viewerName: string;
  username: string;
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
  recentResources?: ResourceItem[];
  recentCourses?: CourseItem[];
  recentActivity?: ActivityItem[];
};

type ProfileTab = "posts" | "reels" | "saved";

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
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.8a.7.7 0 0 1-.7-.7v-4.1a1.5 1.5 0 0 0-3 0v4.1a.7.7 0 0 1-.7.7H5a1 1 0 0 1-1-1z"
        fill="currentColor"
      />
    </IconBase>
  );
}

function EventsIcon() {
  return (
    <IconBase>
      <path
        d="M7 3v3M17 3v3M5 8h14M6 5h12a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function ReelsIcon() {
  return (
    <IconBase>
      <path
        d="M6.5 3h11A3.5 3.5 0 0 1 21 6.5v11a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 17.5v-11A3.5 3.5 0 0 1 6.5 3Zm0 0 3 4M11.5 3l3 4M16.5 3l3 4M10 10.5l5 2.9L10 16.3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function MarketIcon() {
  return (
    <IconBase>
      <path
        d="M4 8.5 5.6 4h12.8L20 8.5M5 10v7.2A1.8 1.8 0 0 0 6.8 19h10.4A1.8 1.8 0 0 0 19 17.2V10M9 13h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function ProfileIcon() {
  return (
    <IconBase>
      <path
        d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7.2C6 16.9 8.7 15 12 15s6 1.9 6 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function MessageIcon() {
  return (
    <IconBase>
      <path
        d="M4.8 7.2A2.2 2.2 0 0 1 7 5h10a2.2 2.2 0 0 1 2.2 2.2v9.6A2.2 2.2 0 0 1 17 19H8.6l-3.8 2.6V7.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m7.2 8 4.8 4 4.8-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

function GridIcon() {
  return (
    <IconBase>
      <path
        d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function BookmarkIcon() {
  return (
    <IconBase>
      <path
        d="M7 4.8A1.8 1.8 0 0 1 8.8 3h6.4A1.8 1.8 0 0 1 17 4.8V21l-5-3.3L7 21V4.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function PlayIcon() {
  return (
    <IconBase>
      <path d="m9 7 8 5-8 5z" fill="currentColor" />
    </IconBase>
  );
}

function HeartIcon() {
  return (
    <IconBase>
      <path
        d="M12 20s-6.8-4.4-8.5-8A5 5 0 0 1 12 6a5 5 0 0 1 8.5 6C18.8 15.6 12 20 12 20Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function SparkIcon() {
  return (
    <IconBase>
      <path
        d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function LocationIcon() {
  return (
    <IconBase>
      <path
        d="M12 20s5.5-5.6 5.5-10A5.5 5.5 0 1 0 6.5 10C6.5 14.4 12 20 12 20Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2" fill="currentColor" />
    </IconBase>
  );
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: value > 999 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function buildBannerStyle(seed: string): CSSProperties {
  const normalizedSeed = encodeURIComponent(seed || "vyb");
  return {
    backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.12), rgba(10, 10, 12, 0.94)), url("https://picsum.photos/seed/${normalizedSeed}-banner/900/540")`
  };
}

function buildAvatarUrl(seed: string) {
  return `https://i.pravatar.cc/240?u=${encodeURIComponent(seed || "vyb-user")}`;
}

function getInitials(value: string) {
  const parts = value
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "V";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "V";
}

function buildEmptyMessage(tab: ProfileTab, isOwnProfile: boolean) {
  if (tab === "saved") {
    return isOwnProfile ? "Saved posts will appear here when that shelf goes live." : "Saved collections stay private.";
  }

  if (tab === "reels") {
    return isOwnProfile ? "Drop a video post and your reels shelf will fill up here." : "No video posts are visible on this profile yet.";
  }

  return isOwnProfile
    ? "Your posts will appear here as soon as you publish them."
    : "This profile has not posted anything yet.";
}

function formatActivityLabel(value: string) {
  return value
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function CampusProfileShell({
  viewerName,
  username,
  collegeName,
  viewerEmail,
  course,
  stream,
  role,
  stats,
  posts,
  isOwnProfile,
  isFollowing,
  recentResources = [],
  recentCourses = [],
  recentActivity = []
}: CampusProfileShellProps) {
  const router = useRouter();
  const [editableUsername, setEditableUsername] = useState(username);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [followingState, setFollowingState] = useState(isFollowing);
  const [followerCount, setFollowerCount] = useState(stats.followers);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");

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

  const navItems = [
    { label: "Home", href: "/home", icon: <HomeIcon /> },
    { label: "Events", href: "/events", icon: <EventsIcon /> },
    { label: "Vibes", href: "/vibes", icon: <ReelsIcon /> },
    { label: "Market", href: "/market", icon: <MarketIcon /> },
    { label: "Profile", href: "/dashboard", icon: <ProfileIcon />, active: true }
  ];
  const tabs = [
    { id: "posts" as const, label: "Posts", icon: <GridIcon /> },
    { id: "reels" as const, label: "Reels", icon: <ReelsIcon /> },
    { id: "saved" as const, label: "Saved", icon: <BookmarkIcon /> }
  ];
  const feedPosts = posts.filter((post) => post.placement !== "vibe");
  const reelPosts = posts.filter((post) => post.placement === "vibe" || post.kind === "video");
  const visiblePosts =
    activeTab === "posts" ? feedPosts : activeTab === "reels" ? reelPosts : ([] as FeedCard[]);
  const likesCount = posts.reduce((total, post) => total + post.reactions, 0);
  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;
  const secondaryLine = collegeName;
  const profileSeed = `${username}-${viewerName}`;
  const heroTitle = isOwnProfile ? "Your vibe" : "Campus profile";
  const utilityHref = isOwnProfile ? "/home" : "/dashboard";
  const utilityLabel = isOwnProfile ? "Back to home" : "Open your profile";

  return (
    <main className="vyb-campus-home vyb-profile-phone-page">
      <section className="vyb-profile-phone-shell" aria-label="Campus profile">
        <div className="vyb-profile-phone-scroll">
          <div className="vyb-profile-phone-banner" style={buildBannerStyle(profileSeed)} />

          <div className="vyb-profile-phone-top-row">
            <div className="vyb-profile-phone-avatar">
              <img src={buildAvatarUrl(profileSeed)} alt={viewerName} />
              <span className="vyb-profile-phone-avatar-fallback" aria-hidden="true">
                {getInitials(viewerName)}
              </span>
            </div>

            <div className="vyb-profile-phone-actions">
              <Link href={utilityHref} className="vyb-profile-phone-icon-button" aria-label={utilityLabel}>
                <MessageIcon />
              </Link>

              {isOwnProfile ? (
                <Link href="/create?kind=post&from=%2Fdashboard" className="vyb-profile-phone-primary-action">
                  Create post
                </Link>
              ) : (
                <button
                  type="button"
                  className="vyb-profile-phone-primary-action"
                  disabled={busy}
                  onClick={handleFollowToggle}
                >
                  {busy ? "Updating..." : followingState ? "Following" : "Follow"}
                </button>
              )}
            </div>
          </div>

          <div className="vyb-profile-phone-details">
            <div className="vyb-profile-phone-copy">
              <span className="vyb-page-badge">{heroTitle}</span>
              <h1 className="vyb-profile-phone-name">{viewerName}</h1>
              <p className="vyb-profile-phone-handle">@{username}</p>
            </div>

            <div className="vyb-profile-phone-bio">
              <div className="vyb-profile-phone-bio-row">
                <SparkIcon />
                <span>{identityLine}</span>
              </div>
              <div className="vyb-profile-phone-bio-row">
                <LocationIcon />
                <span>{secondaryLine}</span>
              </div>
              {isOwnProfile ? (
                <div className="vyb-profile-phone-bio-row">
                  <ProfileIcon />
                  <span>Verified {role} profile</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="vyb-profile-phone-stats">
            <div className="vyb-profile-phone-stat">
              <strong>{formatMetric(stats.posts)}</strong>
              <span>Posts</span>
            </div>
            <div className="vyb-profile-phone-stat">
              <strong>{formatMetric(followerCount)}</strong>
              <span>Followers</span>
            </div>
            <div className="vyb-profile-phone-stat">
              <strong>{formatMetric(stats.following)}</strong>
              <span>Following</span>
            </div>
            <div className="vyb-profile-phone-stat">
              <strong>{formatMetric(likesCount)}</strong>
              <span>Likes</span>
            </div>
          </div>

          {isOwnProfile ? (
            <section className="vyb-profile-phone-tools">
              <div className="vyb-profile-phone-tools-copy">
                <strong>Profile tools</strong>
                <span>Tune your handle, publish quickly, or sign out from this device.</span>
              </div>

              <label className="vyb-field">
                <span>Handle</span>
                <input
                  value={editableUsername}
                  onChange={(event) => setEditableUsername(event.target.value.toLowerCase())}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </label>

              <div className="vyb-profile-phone-tool-actions">
                <button type="button" className="vyb-secondary-button" disabled={busy} onClick={handleUsernameSave}>
                  {busy ? "Saving..." : "Save user ID"}
                </button>
                <Link href="/create?kind=post&from=%2Fdashboard" className="vyb-profile-phone-tool-link">
                  Create post
                </Link>
                <SignOutButton className="vyb-profile-phone-tool-button" />
              </div>
            </section>
          ) : (
            <section className="vyb-profile-phone-tools">
              <div className="vyb-profile-phone-tools-copy">
                <strong>Campus access</strong>
                <span>{collegeName}</span>
              </div>

              <div className="vyb-profile-phone-tool-actions">
                <Link href="/home" className="vyb-profile-phone-tool-link">
                  Back to home
                </Link>
                <Link href="/dashboard" className="vyb-profile-phone-tool-button is-link">
                  Your profile
                </Link>
              </div>
            </section>
          )}

          {message ? <p className="vyb-profile-phone-inline-message">{message}</p> : null}

          <section className="vyb-profile-phone-utility-grid">
            <article className="vyb-profile-phone-utility-card">
              <div className="vyb-profile-phone-utility-head">
                <strong>Campus resources</strong>
                <span>{recentResources.length} live</span>
              </div>
              {recentResources.length === 0 ? (
                <p className="vyb-profile-phone-utility-empty">Resource vault will appear here as soon as published notes and guides go live.</p>
              ) : (
                recentResources.map((resource) => (
                  <div key={resource.id} className="vyb-profile-phone-utility-item">
                    <strong>{resource.title}</strong>
                    <span>{resource.type.toUpperCase()} {resource.courseId ? "• Linked course" : "• General"}</span>
                  </div>
                ))
              )}
            </article>

            <article className="vyb-profile-phone-utility-card">
              <div className="vyb-profile-phone-utility-head">
                <strong>Courses</strong>
                <span>{recentCourses.length} mapped</span>
              </div>
              {recentCourses.length === 0 ? (
                <p className="vyb-profile-phone-utility-empty">Course mappings are ready for this tenant and will show here once course rows are available.</p>
              ) : (
                <div className="vyb-profile-phone-chip-list">
                  {recentCourses.map((courseItem) => (
                    <span key={courseItem.id} className="vyb-profile-phone-chip">
                      {courseItem.code}
                    </span>
                  ))}
                </div>
              )}
            </article>

            <article className="vyb-profile-phone-utility-card">
              <div className="vyb-profile-phone-utility-head">
                <strong>Recent activity</strong>
                <span>{recentActivity.length} events</span>
              </div>
              {recentActivity.length === 0 ? (
                <p className="vyb-profile-phone-utility-empty">Your social, resource, and moderation-safe actions will start showing up here.</p>
              ) : (
                recentActivity.map((activityItem) => (
                  <div key={activityItem.id} className="vyb-profile-phone-utility-item">
                    <strong>{formatActivityLabel(activityItem.activityType)}</strong>
                    <span>{new Date(activityItem.createdAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                ))
              )}
            </article>
          </section>

          <div className="vyb-profile-phone-tabs" role="tablist" aria-label="Profile content tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`vyb-profile-phone-tab${activeTab === tab.id ? " is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="vyb-profile-phone-grid">
            {visiblePosts.length === 0 ? (
              <div className="vyb-profile-phone-empty-state">
                <strong>{activeTab === "saved" ? "Nothing saved yet" : activeTab === "reels" ? "No reels yet" : "No posts yet"}</strong>
                <span>{buildEmptyMessage(activeTab, isOwnProfile)}</span>
              </div>
            ) : null}

            {visiblePosts.map((post) => {
              const overlayMetric = formatMetric(Math.max(post.reactions, post.comments, 0));
              const overlayIcon = post.kind === "video" ? <PlayIcon /> : <HeartIcon />;
              const textSummary = post.body.trim() || post.title.trim() || "Campus update";

              return (
                <article
                  key={post.id}
                  className={`vyb-profile-phone-tile${post.mediaUrl ? "" : " is-text"}`}
                  aria-label={post.title || post.body || "Campus post"}
                >
                  {post.mediaUrl ? (
                    post.kind === "video" ? (
                      <video src={post.mediaUrl} muted playsInline loop preload="metadata" />
                    ) : (
                      <img src={post.mediaUrl} alt={post.body || post.title} />
                    )
                  ) : (
                    <div className="vyb-profile-phone-text-tile">
                      <strong>{post.title || "Campus update"}</strong>
                      <p>{textSummary}</p>
                    </div>
                  )}

                  <div className="vyb-profile-phone-tile-overlay">
                    {overlayIcon}
                    <span>{overlayMetric}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <nav className="vyb-profile-phone-bottom-nav" aria-label="Profile navigation">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`vyb-profile-phone-nav-link${item.active ? " is-active" : ""}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}
