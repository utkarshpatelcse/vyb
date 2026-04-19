"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";

type PostItem = {
  id: string;
  imageUrl: string;
  views?: string;
  isReel?: boolean;
};

type CampusProfileShellProps = {
  viewerName: string;
  handle: string;
  collegeName: string;
  viewerEmail: string;
  course?: string | null;
  stream?: string | null;
  role: string;
  bio?: string;
  location?: string;
  stats: {
    posts: string;
    followers: string;
    following: string;
    likes: string;
  };
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

function IconBase({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`vyb-campus-icon ${className}`}>
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

function ProfileIcon() {
  return (
    <IconBase>
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7.2C6 16.9 8.7 15 12 15s6 1.9 6 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function GridIcon() {
  return (
    <IconBase>
      <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function MsgIcon() {
  return (
    <IconBase>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m22 6-10 7L2 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function LocationIcon() {
  return (
    <IconBase>
      <path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </IconBase>
  );
}

function FilmIcon() {
  return (
    <IconBase>
      <path d="M2 3h20v18H2V3zm0 4h20M2 17h20M7 3v18M17 3v18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

export function CampusProfileShell({
  viewerName,
  handle,
  collegeName,
  viewerEmail,
  course,
  stream,
  role,
  bio,
  location,
  stats
}: CampusProfileShellProps) {
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [activeResize, setActiveResize] = useState<ResizeSide | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "reels" | "saved">("posts");
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
    if (!activeResize) return;

    function handlePointerMove(event: globalThis.PointerEvent) {
      const currentResize = resizeState.current;
      if (!currentResize) return;

      if (currentResize.side === "left") {
        const nextWidth = clamp(currentResize.startWidth + (event.clientX - currentResize.startX), MIN_LEFT_WIDTH, MAX_LEFT_WIDTH);
        setLeftWidth(nextWidth);
      } else {
        const nextWidth = clamp(currentResize.startWidth - (event.clientX - currentResize.startX), MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH);
        setRightWidth(nextWidth);
      }
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

  function startResizeDrag(side: ResizeSide, event: PointerEvent<HTMLButtonElement>) {
    if (window.innerWidth < 900) return;
    event.preventDefault();
    resizeState.current = {
      side,
      startX: event.clientX,
      startWidth: side === "left" ? leftWidth : rightWidth
    };
    setActiveResize(side);
  }

  const mockPosts: PostItem[] = Array.from({ length: 9 }).map((_, i) => ({
    id: String(i + 1),
    imageUrl: `https://picsum.photos/400/540?random=${i + 10}`,
    views: `${Math.floor(Math.random() * 100) + 1}K`,
    isReel: i % 2 === 0
  }));

  const navItems = [
    { label: "Home", href: "/home", icon: <HomeIcon /> },
    { label: "Events", href: "/home", icon: <EventsIcon /> },
    { label: "Market", href: "/market", icon: <MarketIcon /> },
    { label: "Reels", href: "/home", icon: <ReelsIcon /> },
    { label: "Profile", href: "/dashboard", icon: <ProfileIcon />, active: true }
  ];

  const layoutStyle = {
    "--vyb-campus-left-width": `${leftWidth}px`,
    "--vyb-campus-right-width": `${rightWidth}px`
  } as CSSProperties;

  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;

  return (
    <main className="vyb-campus-home" style={layoutStyle}>
      <aside className="vyb-campus-sidebar vyb-campus-rail">
        <Link href="/home" className="vyb-campus-branding">VYB</Link>
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
        onPointerDown={(event) => startResizeDrag("left", event)}
      />

      <section className="vyb-campus-main">
        {/* Desktop Header Replacement */}
        <div className="vyb-profile-header">
          <div className="vyb-profile-banner" style={{backgroundImage: "url('https://images.unsplash.com/photo-1541339907198-e08756ebafe1?auto=format&fit=crop&w=1200&q=80')"}}></div>
          
          <div className="vyb-profile-top-row">
            <div className="vyb-profile-avatar-wrap">
              <img src={`https://i.pravatar.cc/150?u=${encodeURIComponent(viewerEmail)}`} alt={viewerName} />
            </div>
            <div className="vyb-profile-actions">
              <button className="vyb-profile-msg-btn" aria-label="Message"><MsgIcon /></button>
              <button className="vyb-profile-follow-btn">Edit Profile</button>
            </div>
          </div>

          <div className="vyb-profile-details">
            <h1 className="vyb-profile-name">{viewerName}</h1>
            <p className="vyb-profile-handle">@{handle}</p>
            
            <div className="vyb-profile-bio-item">
              <FilmIcon /> {bio || "Content creator & Filmmaker"}
            </div>
            <div className="vyb-profile-bio-item">
              <LocationIcon /> {location || identityLine}
            </div>
          </div>

          <div className="vyb-profile-stats">
            <div className="vyb-profile-stat-box">
              <strong>{stats.posts}</strong>
              <span>Posts</span>
            </div>
            <div className="vyb-profile-stat-box">
              <strong>{stats.followers}</strong>
              <span>Followers</span>
            </div>
            <div className="vyb-profile-stat-box">
              <strong>{stats.following}</strong>
              <span>Following</span>
            </div>
            <div className="vyb-profile-stat-box">
              <strong>{stats.likes}</strong>
              <span>Likes</span>
            </div>
          </div>

          <div className="vyb-profile-tabs">
            <div 
              className={`vyb-profile-tab${activeTab === "posts" ? " is-active" : ""}`}
              onClick={() => setActiveTab("posts")}
            >
              <GridIcon />
            </div>
            <div 
              className={`vyb-profile-tab${activeTab === "reels" ? " is-active" : ""}`}
              onClick={() => setActiveTab("reels")}
            >
              <FilmIcon />
            </div>
            <div 
              className={`vyb-profile-tab${activeTab === "saved" ? " is-active" : ""}`}
              onClick={() => setActiveTab("saved")}
            >
              <BookmarkIcon />
            </div>
          </div>

          <div className="vyb-profile-grid">
            {mockPosts.map((post) => (
              <div key={post.id} className="vyb-profile-post-item">
                <img src={post.imageUrl} alt="Profile post" />
                {post.isReel && (
                  <div className="vyb-profile-view-count">
                    <ReelsIcon /> {post.views}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <button
        type="button"
        className={`vyb-campus-resizer vyb-campus-resizer-right${activeResize === "right" ? " is-active" : ""}`}
        onPointerDown={(event) => startResizeDrag("right", event)}
      />

      <aside className="vyb-campus-right-panel vyb-campus-rail">
        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Campus Access</span>
          <div className="vyb-campus-side-user">
             <strong>{collegeName}</strong>
             <span>{role}</span>
          </div>
        </div>
        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Verified Contact</span>
          <div className="vyb-campus-side-user">
            <span style={{fontSize: '0.85rem', color: 'var(--vyb-campus-dim)'}}>{viewerEmail}</span>
          </div>
        </div>
        <SignOutButton className="vyb-campus-signout vyb-campus-signout-wide" />
      </aside>

      {/* Mobile Bottom Nav */}
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
