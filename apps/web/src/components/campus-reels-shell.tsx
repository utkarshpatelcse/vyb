"use client";

import type { FeedCard } from "@vyb/contracts";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { SocialThreadSheet } from "./social-thread-sheet";
import { SignOutButton } from "./sign-out-button";
import { useSocialPostEngagement } from "./use-social-post-engagement";

type CampusReelsShellProps = {
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  viewerEmail: string;
  course?: string | null;
  stream?: string | null;
  role: string;
  initialVibes: FeedCard[];
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

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: value > 999 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

export function CampusReelsShell({
  viewerName,
  viewerUsername,
  collegeName,
  viewerEmail,
  course,
  stream,
  role,
  initialVibes
}: CampusReelsShellProps) {
  const engagement = useSocialPostEngagement(initialVibes);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const navItems = useMemo(
    () => [
      { label: "Home", href: "/home", icon: <HomeIcon /> },
      { label: "Events", href: "/events", icon: <EventsIcon /> },
      { label: "Vibes", href: "/vibes", icon: <ReelsIcon />, active: true },
      { label: "Market", href: "/market", icon: <MarketIcon /> },
      { label: "Profile", href: "/dashboard", icon: <ProfileIcon /> }
    ],
    []
  );

  const layoutStyle = {
    "--vyb-campus-left-width": "260px",
    "--vyb-campus-right-width": "320px"
  } as CSSProperties;

  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;

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
            <span>@{viewerUsername}</span>
          </div>
          <SignOutButton className="vyb-campus-signout" />
        </div>
      </aside>

      <section className="vyb-campus-main">
        <div className="vyb-reels-header-card">
          <div>
            <span className="vyb-page-badge">Vibes</span>
            <h1>Short-form campus moments</h1>
            <p>Upload portrait clips from events, creators, classrooms, and everyday campus life.</p>
          </div>
          <Link href="/create?kind=vibe&from=%2Fvibes" className="vyb-primary-button">
            Upload vibe
          </Link>
        </div>

        {flashMessage ? <div className="vyb-campus-flash-message">{flashMessage}</div> : null}

        <div className="vyb-reels-live-grid">
          {engagement.posts.length === 0 ? (
            <div className="vyb-campus-empty-state">
              <strong>No vibes yet</strong>
              <span>Upload the first campus reel and make this lane feel alive.</span>
            </div>
          ) : null}

          {engagement.posts.map((item) => (
            <article key={item.id} className="vyb-reels-live-card">
              <div className="vyb-reels-live-media">
                {item.mediaUrl ? (
                  <video src={item.mediaUrl} controls playsInline muted loop />
                ) : (
                  <div className="vyb-campus-post-copy-panel">
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </div>
                )}
              </div>

              <div className="vyb-reels-live-copy">
                <div className="vyb-reels-live-head">
                  <Link href={item.author.username === viewerUsername ? "/dashboard" : `/u/${encodeURIComponent(item.author.username)}`}>
                    <strong>@{item.author.username}</strong>
                  </Link>
                  <span>{item.location ?? collegeName}</span>
                </div>
                <p>{item.body}</p>
                <div className="vyb-reels-live-meta">
                  <span>{formatMetric(item.reactions)} likes</span>
                  <span>{formatMetric(item.comments)} comments</span>
                </div>
                <div className="vyb-reels-live-actions">
                  <button
                    type="button"
                    className={`vyb-campus-action-icon${item.viewerReactionType === "like" ? " is-active" : ""}`}
                    disabled={engagement.loadingPostId === item.id}
                    onClick={async () => {
                      const updated = await engagement.react(item.id);
                      if (updated) {
                        setFlashMessage("Vibe reaction updated.");
                      }
                    }}
                  >
                    <HeartIcon />
                    <span>{item.viewerReactionType === "like" ? "Liked" : "Like"}</span>
                  </button>
                  <button
                    type="button"
                    className="vyb-campus-action-icon"
                    onClick={async () => {
                      await engagement.openThread(item.id);
                    }}
                  >
                    <CommentIcon />
                    <span>Comments</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="vyb-campus-right-panel vyb-campus-rail">
        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Creator lane</span>
          <div className="vyb-campus-side-user">
            <img src={`https://i.pravatar.cc/120?u=${encodeURIComponent(viewerEmail)}`} alt={viewerName} />
            <div>
              <strong>{viewerName}</strong>
              <span>{identityLine}</span>
            </div>
          </div>
        </div>

        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Publishing tips</span>
          <ul className="vyb-campus-side-list">
            <li>Portrait video works best here.</li>
            <li>Keep clips short and campus-relevant.</li>
            <li>Everyone inside your verified campus can discover them.</li>
            <li>Role: {role}</li>
          </ul>
        </div>

        <SignOutButton className="vyb-campus-signout vyb-campus-signout-wide" />
      </aside>

      <nav className="vyb-campus-bottom-nav">
        {navItems.map((item) => (
          <Link key={item.label} href={item.href} className={`vyb-campus-bottom-item${item.active ? " is-active" : ""}`}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <SocialThreadSheet
        post={engagement.selectedPost}
        comments={engagement.selectedComments}
        draft={engagement.threadDraft}
        message={engagement.threadMessage}
        isLoading={engagement.threadLoading}
        isSubmitting={engagement.threadSubmitting}
        onClose={engagement.closeThread}
        onDraftChange={engagement.setThreadDraft}
        onSubmit={() => void engagement.submitComment()}
      />
    </main>
  );
}
