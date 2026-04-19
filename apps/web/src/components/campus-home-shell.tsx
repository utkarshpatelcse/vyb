"use client";

import type { FeedCard, StoryCard, UserSearchItem } from "@vyb/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";

type CampusHomeShellProps = {
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  viewerEmail: string;
  course?: string | null;
  stream?: string | null;
  role: string;
  stories: StoryCard[];
  initialPosts: FeedCard[];
  suggestedUsers: UserSearchItem[];
};

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: value > 999 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function layoutStyle() {
  return {
    "--vyb-campus-left-width": "260px",
    "--vyb-campus-right-width": "320px"
  } as CSSProperties;
}

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

function SearchIcon() {
  return (
    <IconBase>
      <path d="m20 20-3.8-3.8M10.8 17a6.2 6.2 0 1 1 0-12.4 6.2 6.2 0 0 1 0 12.4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function BellIcon() {
  return (
    <IconBase>
      <path d="M12 4.5a4 4 0 0 1 4 4V11c0 .9.3 1.8.9 2.5l.7.8c.6.7.1 1.7-.8 1.7H7.2c-.9 0-1.4-1-.8-1.7l.7-.8A3.9 3.9 0 0 0 8 11V8.5a4 4 0 0 1 4-4Zm-1.7 13h3.4a1.7 1.7 0 0 1-3.4 0Z" fill="currentColor" />
    </IconBase>
  );
}

function SendIcon() {
  return (
    <IconBase>
      <path d="M21 4 10 15M21 4l-7 17-4-6-6-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function AddPostIcon() {
  return (
    <IconBase>
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function HeartIcon() {
  return (
    <IconBase>
      <path d="M12 20.4s-6.6-4.3-8.6-8A4.8 4.8 0 0 1 11 6.9L12 8l1-1.1a4.8 4.8 0 0 1 7.6 5.5c-2 3.7-8.6 8-8.6 8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function CommentIcon() {
  return (
    <IconBase>
      <path d="M5.8 17.8a7.7 7.7 0 1 1 3 1.1L4 20l1.8-4.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ShareIcon() {
  return (
    <IconBase>
      <path d="M9.1 10.5 14.7 7.2M9.1 13.5l5.6 3.3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.5" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17.6" cy="5.8" r="3" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17.6" cy="18.2" r="3" fill="none" stroke="currentColor" strokeWidth="1.9" />
    </IconBase>
  );
}

function BookmarkIcon() {
  return (
    <IconBase>
      <path d="M7 4.5h10a1 1 0 0 1 1 1v14l-6-3-6 3v-14a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function MenuIcon() {
  return (
    <IconBase>
      <path d="M12 6h.01M12 12h.01M12 18h.01" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function CloseIcon() {
  return (
    <IconBase>
      <path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function getProfileHref(username: string, viewerUsername: string) {
  return username === viewerUsername ? "/dashboard" : `/u/${encodeURIComponent(username)}`;
}

export function CampusHomeShell({
  viewerName,
  viewerUsername,
  collegeName,
  viewerEmail,
  course,
  stream,
  role,
  stories,
  initialPosts,
  suggestedUsers
}: CampusHomeShellProps) {
  const router = useRouter();
  const [feedPosts, setFeedPosts] = useState(initialPosts);
  const [recommendedUsers, setRecommendedUsers] = useState(suggestedUsers);
  const [selectedStory, setSelectedStory] = useState<StoryCard | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [composerMessage, setComposerMessage] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [followBusyUsername, setFollowBusyUsername] = useState<string | null>(null);

  useEffect(() => {
    setFeedPosts(initialPosts);
  }, [initialPosts]);

  useEffect(() => {
    setRecommendedUsers(suggestedUsers);
  }, [suggestedUsers]);

  useEffect(() => {
    if (!flashMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFlashMessage(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [flashMessage]);

  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;
  const navItems = useMemo(
    () => [
      { label: "Home", href: "/home", icon: <HomeIcon />, active: true },
      { label: "Events", href: "/events", icon: <EventsIcon /> },
      { label: "Vibes", href: "/vibes", icon: <ReelsIcon /> },
      { label: "Market", href: "/market", icon: <MarketIcon /> },
      { label: "Profile", href: "/dashboard", icon: <ProfileIcon /> }
    ],
    []
  );

  async function handleQuickPostPublish() {
    const title = draftTitle.trim();
    const body = draftBody.trim();

    if (!title && !body) {
      setComposerMessage("Add a title or message before publishing.");
      return;
    }

    setComposerMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title,
          body,
          kind: "text",
          placement: "feed",
          location: collegeName
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            item?: FeedCard;
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !payload?.item) {
        setComposerMessage(payload?.error?.message ?? "We could not publish your post right now.");
        return;
      }

      setFeedPosts((current) => [payload.item!, ...current]);
      setDraftTitle("");
      setDraftBody("");
      setIsComposerOpen(false);
      setFlashMessage("Your post is now live across campus.");
      router.refresh();
    } catch {
      setComposerMessage("We could not publish your post right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFollowToggle(username: string, shouldFollow: boolean) {
    setFollowBusyUsername(username);

    try {
      const response = await fetch(`/api/follows/${encodeURIComponent(username)}`, {
        method: shouldFollow ? "PUT" : "DELETE"
      });

      if (!response.ok) {
        setFlashMessage("We could not update that follow right now.");
        return;
      }

      setRecommendedUsers((current) =>
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
      setFlashMessage(shouldFollow ? `You are now following @${username}.` : `You unfollowed @${username}.`);
      router.refresh();
    } finally {
      setFollowBusyUsername(null);
    }
  }

  return (
    <main className="vyb-campus-home" style={layoutStyle()}>
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
            <span>@{viewerUsername}</span>
          </div>
          <SignOutButton className="vyb-campus-signout" />
        </div>
      </aside>

      <section className="vyb-campus-main">
        <header className="vyb-campus-topbar">
          <div className="vyb-campus-topbar-copy">
            <strong>Campus feed</strong>
            <span>{collegeName}</span>
          </div>

          <div className="vyb-campus-top-actions">
            <Link href="/search" className="vyb-campus-top-icon vyb-campus-top-link" aria-label="Search campus users">
              <SearchIcon />
            </Link>
            <button type="button" className="vyb-campus-top-icon" aria-label="Notifications">
              <BellIcon />
            </button>
            <button type="button" className="vyb-campus-post-trigger" onClick={() => setIsComposerOpen(true)}>
              <AddPostIcon />
              <span>Create post</span>
            </button>
            <button type="button" className="vyb-campus-top-icon" aria-label="Messages">
              <SendIcon />
            </button>
          </div>
        </header>

        <header className="vyb-campus-mobile-header">
          <Link href="/home" className="vyb-campus-branding vyb-campus-branding-mobile">
            VYB
          </Link>
          <div className="vyb-campus-mobile-actions">
            <Link href="/search" className="vyb-campus-top-icon vyb-campus-top-link" aria-label="Search campus users">
              <SearchIcon />
            </Link>
            <button type="button" className="vyb-campus-post-trigger vyb-campus-post-trigger-mobile" onClick={() => setIsComposerOpen(true)}>
              <AddPostIcon />
              <span>Post</span>
            </button>
          </div>
        </header>

        {flashMessage ? <div className="vyb-campus-flash-message">{flashMessage}</div> : null}

        <div className="vyb-campus-feed-stack">
          <div className="vyb-campus-stories">
            <button type="button" className="vyb-campus-story vyb-campus-story-add" onClick={() => router.push("/create?kind=story&from=%2Fhome")}>
              <span className="vyb-campus-story-ring vyb-campus-story-ring-add">
                <AddPostIcon />
              </span>
              <span>Your story</span>
            </button>

            {stories.map((story) => (
              <button key={story.id} type="button" className="vyb-campus-story" onClick={() => setSelectedStory(story)}>
                <span className="vyb-campus-story-ring">
                  {story.mediaType === "video" ? (
                    <video src={story.mediaUrl} muted playsInline autoPlay loop />
                  ) : (
                    <img src={story.mediaUrl} alt={story.username} />
                  )}
                </span>
                <span>{story.username}</span>
              </button>
            ))}
          </div>

          <div className="vyb-campus-feed">
            {feedPosts.length === 0 ? (
              <div className="vyb-campus-empty-state">
                <strong>No campus posts yet</strong>
                <span>Be the first one to publish something everyone at KIET can see.</span>
              </div>
            ) : null}

            {feedPosts.map((post) => (
              <article key={post.id} className="vyb-campus-feed-card">
                <div className="vyb-campus-card-top">
                  <div className="vyb-campus-card-author">
                    <span className="vyb-campus-card-avatar">{post.author.displayName.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <Link href={getProfileHref(post.author.username, viewerUsername)}>
                        <strong>{post.author.username}</strong>
                      </Link>
                      <span>{post.location ?? collegeName}</span>
                    </div>
                  </div>
                  <button type="button" className="vyb-campus-icon-button" aria-label="Post options">
                    <MenuIcon />
                  </button>
                </div>

                {post.mediaUrl && post.kind === "video" ? (
                  <video src={post.mediaUrl} className="vyb-campus-post-image" controls playsInline muted loop />
                ) : post.mediaUrl ? (
                  <img src={post.mediaUrl} alt={post.body || post.title} className="vyb-campus-post-image" />
                ) : (
                  <div className="vyb-campus-post-copy-panel">
                    {post.title ? <strong>{post.title}</strong> : null}
                    <p>{post.body}</p>
                  </div>
                )}

                <div className="vyb-campus-card-actions">
                  <div className="vyb-campus-card-actions-left">
                    <button type="button" className="vyb-campus-action-icon" aria-label="Like post">
                      <HeartIcon />
                    </button>
                    <button type="button" className="vyb-campus-action-icon" aria-label="Comment on post">
                      <CommentIcon />
                    </button>
                    <button type="button" className="vyb-campus-action-icon" aria-label="Share post">
                      <ShareIcon />
                    </button>
                  </div>
                  <button type="button" className="vyb-campus-action-icon" aria-label="Save post">
                    <BookmarkIcon />
                  </button>
                </div>

                <div className="vyb-campus-card-copy">
                  <p className="vyb-campus-card-likes">{formatMetric(post.reactions)} likes</p>
                  <p>
                    <strong>{post.author.username}</strong> {post.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <aside className="vyb-campus-right-panel vyb-campus-rail">
        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Your vibe</span>
          <div className="vyb-campus-side-user">
            <img src={`https://i.pravatar.cc/120?u=${encodeURIComponent(viewerEmail)}`} alt={viewerName} />
            <div>
              <strong>{viewerName}</strong>
              <span>@{viewerUsername}</span>
            </div>
          </div>
          <p className="vyb-campus-side-copy">{identityLine}</p>
        </div>

        <div className="vyb-campus-side-card">
          <div className="vyb-campus-side-header">
            <span className="vyb-campus-side-label">Suggested vibes</span>
            <Link href="/search" className="vyb-campus-inline-link">
              Search
            </Link>
          </div>

          {recommendedUsers.length === 0 ? (
            <p className="vyb-campus-side-copy">Campus suggestions will appear here as more profiles go live.</p>
          ) : null}

          {recommendedUsers.map((user) => (
            <div key={user.userId} className="vyb-campus-suggestion">
              <div>
                <Link href={`/u/${encodeURIComponent(user.username)}`}>
                  <strong>{user.username}</strong>
                </Link>
                <span>{user.displayName}</span>
              </div>
              <button
                type="button"
                disabled={followBusyUsername === user.username}
                onClick={() => handleFollowToggle(user.username, !user.isFollowing)}
              >
                {followBusyUsername === user.username
                  ? "..."
                  : user.isFollowing
                    ? "Following"
                    : "Follow"}
              </button>
            </div>
          ))}
        </div>

        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Campus access</span>
          <ul className="vyb-campus-side-list">
            <li>{collegeName}</li>
            <li>{viewerEmail}</li>
            <li>Role: {role}</li>
          </ul>
          <div className="vyb-campus-side-actions">
            <Link href="/dashboard" className="vyb-campus-profile-link">
              Open profile
            </Link>
            <SignOutButton className="vyb-campus-signout vyb-campus-signout-wide" />
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

      {isComposerOpen ? (
        <div className="vyb-campus-compose-backdrop" role="presentation" onClick={() => setIsComposerOpen(false)}>
          <div
            className="vyb-campus-compose-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Create a post"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="vyb-campus-compose-head">
              <div>
                <strong>Create post</strong>
                <span>Publish instantly to the live campus feed.</span>
              </div>
              <button type="button" className="vyb-campus-compose-close" aria-label="Close composer" onClick={() => setIsComposerOpen(false)}>
                <CloseIcon />
              </button>
            </div>

            <label className="vyb-campus-compose-field">
              <span>Title</span>
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="Prototype Night"
                disabled={isSubmitting}
              />
            </label>

            <label className="vyb-campus-compose-field">
              <span>Message</span>
              <textarea
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
                placeholder="What is happening on campus today?"
                rows={5}
                disabled={isSubmitting}
              />
            </label>

            <div className="vyb-campus-compose-link-row">
              <span>Need image or video?</span>
              <Link href="/create?kind=post&from=%2Fhome" className="vyb-campus-inline-link">
                Open full uploader
              </Link>
            </div>

            {composerMessage ? <p className="vyb-campus-compose-message">{composerMessage}</p> : null}

            <div className="vyb-campus-compose-actions">
              <button type="button" className="vyb-campus-compose-secondary" onClick={() => setIsComposerOpen(false)} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="button" className="vyb-campus-compose-primary" onClick={handleQuickPostPublish} disabled={isSubmitting}>
                {isSubmitting ? "Publishing..." : "Publish post"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedStory ? (
        <div className="vyb-story-viewer-backdrop" role="presentation" onClick={() => setSelectedStory(null)}>
          <div className="vyb-story-viewer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="vyb-story-viewer-head">
              <div>
                <strong>@{selectedStory.username}</strong>
                <span>{selectedStory.displayName}</span>
              </div>
              <button type="button" className="vyb-campus-compose-secondary" onClick={() => setSelectedStory(null)}>
                Close
              </button>
            </div>

            <div className="vyb-story-viewer-media">
              {selectedStory.mediaType === "video" ? (
                <video src={selectedStory.mediaUrl} controls autoPlay muted playsInline loop />
              ) : (
                <img src={selectedStory.mediaUrl} alt={selectedStory.username} />
              )}
            </div>

            {selectedStory.caption ? <p className="vyb-story-viewer-caption">{selectedStory.caption}</p> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
