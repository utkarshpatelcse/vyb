"use client";

import type { FeedCard } from "@vyb/contracts";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { SocialThreadSheet } from "./social-thread-sheet";
import { SignOutButton } from "./sign-out-button";
import { useSocialPostEngagement } from "./use-social-post-engagement";
import { VybLogoLockup } from "./vyb-logo";

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
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 22V12h6v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function EventsIcon() {
  return (
    <IconBase>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function VibesIcon() {
  return (
    <IconBase>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function MarketIcon() {
  return (
    <IconBase>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6h18M16 10a4 4 0 0 1-8 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ProfileIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
      { label: "Vibes", href: "/vibes", icon: <VibesIcon />, active: true },
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
          <VybLogoLockup priority />
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
