"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";

type StoryItem = {
  id: string;
  handle: string;
  imageUrl: string;
};

type PostItem = {
  id: string;
  author: string;
  caption: string;
  imageUrl?: string | null;
  likes: string;
  location: string;
  title?: string | null;
};

type CampusHomeShellProps = {
  viewerName: string;
  collegeName: string;
  viewerEmail: string;
  course?: string | null;
  stream?: string | null;
  role: string;
  stories: StoryItem[];
  initialPosts: PostItem[];
};

type ResizeSide = "left" | "right";

const DEFAULT_LEFT_WIDTH = 260;
const DEFAULT_RIGHT_WIDTH = 320;
const MIN_LEFT_WIDTH = 220;
const MAX_LEFT_WIDTH = 360;
const MIN_RIGHT_WIDTH = 280;
const MAX_RIGHT_WIDTH = 420;
const LEFT_WIDTH_STORAGE_KEY = "vyb-campus-left-width";
const RIGHT_WIDTH_STORAGE_KEY = "vyb-campus-right-width";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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

function ShuffleIcon() {
  return (
    <IconBase>
      <path d="M16 4h4v4M4 8h3.2c1.6 0 3.1.8 4 2.1l1.6 2.2A5 5 0 0 0 16.8 15H20M4 16h3.2c1.6 0 3.1-.8 4-2.1l1-1.4M16 20h4v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function AddPostIcon() {
  return (
    <IconBase>
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

export function CampusHomeShell({
  viewerName,
  collegeName,
  viewerEmail,
  course,
  stream,
  role,
  stories,
  initialPosts
}: CampusHomeShellProps) {
  const [feedPosts, setFeedPosts] = useState(initialPosts);
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [activeResize, setActiveResize] = useState<ResizeSide | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [composerMessage, setComposerMessage] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resizeState = useRef<{ side: ResizeSide; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const storedLeftWidth = Number.parseInt(window.localStorage.getItem(LEFT_WIDTH_STORAGE_KEY) ?? "", 10);
    const storedRightWidth = Number.parseInt(window.localStorage.getItem(RIGHT_WIDTH_STORAGE_KEY) ?? "", 10);

    if (Number.isFinite(storedLeftWidth)) {
      setLeftWidth(clamp(storedLeftWidth, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH));
    }

    if (Number.isFinite(storedRightWidth)) {
      setRightWidth(clamp(storedRightWidth, MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LEFT_WIDTH_STORAGE_KEY, String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    window.localStorage.setItem(RIGHT_WIDTH_STORAGE_KEY, String(rightWidth));
  }, [rightWidth]);

  useEffect(() => {
    if (!activeResize) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const currentResize = resizeState.current;

      if (!currentResize) {
        return;
      }

      if (currentResize.side === "left") {
        const nextWidth = clamp(currentResize.startWidth + (event.clientX - currentResize.startX), MIN_LEFT_WIDTH, MAX_LEFT_WIDTH);
        setLeftWidth(nextWidth);
        return;
      }

      const nextWidth = clamp(currentResize.startWidth - (event.clientX - currentResize.startX), MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH);
      setRightWidth(nextWidth);
    }

    function handlePointerUp() {
      resizeState.current = null;
      setActiveResize(null);
    }

    document.body.classList.add("vyb-campus-is-resizing");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.classList.remove("vyb-campus-is-resizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeResize]);

  useEffect(() => {
    if (!composerOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setComposerOpen(false);
        setComposerMessage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [composerOpen]);

  useEffect(() => {
    if (!flashMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFlashMessage(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [flashMessage]);

  function openComposer() {
    setComposerMessage(null);
    setComposerOpen(true);
  }

  function closeComposer() {
    setComposerMessage(null);
    setComposerOpen(false);
  }

  function startResizeDrag(side: ResizeSide, event: PointerEvent<HTMLButtonElement>) {
    if (window.innerWidth < 900) {
      return;
    }

    event.preventDefault();
    resizeState.current = {
      side,
      startX: event.clientX,
      startWidth: side === "left" ? leftWidth : rightWidth
    };
    setActiveResize(side);
  }

  function handleComposerSubmit() {
    const title = draftTitle.trim();
    const body = draftBody.trim();

    if (!title && !body) {
      setComposerMessage("Add a title or message before publishing.");
      return;
    }

    setComposerMessage(null);
    setIsSubmitting(true);

    void (async () => {
      try {
        const response = await fetch("/api/posts", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            title,
            body,
            communityId: null
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
          setComposerMessage(payload?.error?.message ?? "We could not publish your post right now.");
          return;
        }

        setFeedPosts((currentPosts) => [
          {
            id: `new-${Date.now()}`,
            author: viewerEmail.split("@")[0] ?? viewerName,
            title: title || "Campus update",
            caption: body || title || "A new update just landed in the campus feed.",
            imageUrl: null,
            likes: "0",
            location: collegeName
          },
          ...currentPosts
        ]);
        setDraftTitle("");
        setDraftBody("");
        setFlashMessage("Post published to the campus feed.");
        setComposerOpen(false);
      } finally {
        setIsSubmitting(false);
      }
    })();
  }

  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;
  const navItems = [
    { label: "Home", href: "/home", icon: <HomeIcon />, active: true },
    { label: "Events", href: "/home", icon: <EventsIcon /> },
    { label: "Reels", href: "/home", icon: <ReelsIcon /> },
    { label: "Market", href: "/market", icon: <MarketIcon /> },
    { label: "Profile", href: "/dashboard", icon: <ProfileIcon /> }
  ];
  const layoutStyle = {
    "--vyb-campus-left-width": `${leftWidth}px`,
    "--vyb-campus-right-width": `${rightWidth}px`
  } as CSSProperties;

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
            <span>{collegeName}</span>
          </div>
          <SignOutButton className="vyb-campus-signout" />
        </div>
      </aside>

      <button
        type="button"
        className={`vyb-campus-resizer vyb-campus-resizer-left${activeResize === "left" ? " is-active" : ""}`}
        aria-label="Resize left sidebar"
        onPointerDown={(event) => startResizeDrag("left", event)}
      />

      <section className="vyb-campus-main">
        <header className="vyb-campus-topbar">
          <div className="vyb-campus-topbar-copy">
            <strong>Campus feed</strong>
            <span>{collegeName}</span>
          </div>

          <div className="vyb-campus-top-actions">
            <button type="button" className="vyb-campus-top-icon" aria-label="Notifications">
              <BellIcon />
            </button>
            <button type="button" className="vyb-campus-post-trigger" onClick={openComposer}>
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
            <button type="button" className="vyb-campus-top-icon" aria-label="Notifications">
              <BellIcon />
            </button>
            <button type="button" className="vyb-campus-post-trigger vyb-campus-post-trigger-mobile" onClick={openComposer}>
              <AddPostIcon />
              <span>Post</span>
            </button>
            <button type="button" className="vyb-campus-top-icon" aria-label="Messages">
              <SendIcon />
            </button>
          </div>
        </header>

        {flashMessage ? <div className="vyb-campus-flash-message">{flashMessage}</div> : null}

        <div className="vyb-campus-feed-stack">
          <div className="vyb-campus-stories">
            {stories.map((story) => (
              <button key={story.id} type="button" className="vyb-campus-story">
                <span className="vyb-campus-story-ring">
                  <img src={story.imageUrl} alt={story.handle} />
                </span>
                <span>{story.handle}</span>
              </button>
            ))}
          </div>

          <div className="vyb-campus-feed">
            {feedPosts.map((post) => (
              <article key={post.id} className="vyb-campus-feed-card">
                <div className="vyb-campus-card-top">
                  <div className="vyb-campus-card-author">
                    <span className="vyb-campus-card-avatar">{post.author.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <strong>{post.author}</strong>
                      <span>{post.location}</span>
                    </div>
                  </div>
                  <button type="button" className="vyb-campus-icon-button" aria-label="Post options">
                    <MenuIcon />
                  </button>
                </div>

                {post.imageUrl ? (
                  <img src={post.imageUrl} alt={post.caption} className="vyb-campus-post-image" />
                ) : (
                  <div className="vyb-campus-post-copy-panel">
                    {post.title ? <strong>{post.title}</strong> : null}
                    <p>{post.caption}</p>
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
                      <SendIcon />
                    </button>
                    <button type="button" className="vyb-campus-action-icon" aria-label="Repost post">
                      <ShuffleIcon />
                    </button>
                  </div>
                  <button type="button" className="vyb-campus-action-icon" aria-label="Save post">
                    <BookmarkIcon />
                  </button>
                </div>

                <div className="vyb-campus-card-copy">
                  <p className="vyb-campus-card-likes">{post.likes} likes</p>
                  <p>
                    <strong>{post.author}</strong> {post.caption}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <button
        type="button"
        className={`vyb-campus-resizer vyb-campus-resizer-right${activeResize === "right" ? " is-active" : ""}`}
        aria-label="Resize right sidebar"
        onPointerDown={(event) => startResizeDrag("right", event)}
      />

      <aside className="vyb-campus-right-panel vyb-campus-rail">
        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Your vibe</span>
          <div className="vyb-campus-side-user">
            <img src={`https://i.pravatar.cc/120?u=${encodeURIComponent(viewerEmail)}`} alt={viewerName} />
            <div>
              <strong>{viewerName}</strong>
              <span>{identityLine}</span>
            </div>
          </div>
        </div>

        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Suggested vibes</span>
          <div className="vyb-campus-suggestion">
            <div>
              <strong>ashwani_vyb</strong>
              <span>Same campus, same rhythm</span>
            </div>
            <button type="button">Follow</button>
          </div>
          <div className="vyb-campus-suggestion">
            <div>
              <strong>kiet.creators</strong>
              <span>Events, launches, and stories</span>
            </div>
            <button type="button">Follow</button>
          </div>
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

      {composerOpen ? (
        <div className="vyb-campus-compose-backdrop" role="presentation" onClick={closeComposer}>
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
                <span>Share an update with your verified campus feed.</span>
              </div>
              <button type="button" className="vyb-campus-compose-close" aria-label="Close composer" onClick={closeComposer}>
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

            {composerMessage ? <p className="vyb-campus-compose-message">{composerMessage}</p> : null}

            <div className="vyb-campus-compose-actions">
              <button type="button" className="vyb-campus-compose-secondary" onClick={closeComposer} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="button" className="vyb-campus-compose-primary" onClick={handleComposerSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Publishing..." : "Publish post"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
