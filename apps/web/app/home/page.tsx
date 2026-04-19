import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getViewerMe, getViewerProfile } from "../../src/lib/backend";
import { SignOutButton } from "../../src/components/sign-out-button";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  active?: boolean;
};

type StoryItem = {
  id: string;
  handle: string;
  imageUrl: string;
};

type PostItem = {
  id: string;
  author: string;
  caption: string;
  imageUrl: string;
  likes: string;
  location: string;
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

export default async function AuthenticatedHomePage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [profile, me] = await Promise.all([getViewerProfile(viewer).catch(() => null), getViewerMe(viewer).catch(() => null)]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const navItems: NavItem[] = [
    { label: "Home", href: "/home", icon: <HomeIcon />, active: true },
    { label: "Events", href: "/home", icon: <EventsIcon /> },
    { label: "Reels", href: "/home", icon: <ReelsIcon /> },
    { label: "Buy/Sell", href: "/home", icon: <MarketIcon /> },
    { label: "Profile", href: "/dashboard", icon: <ProfileIcon /> }
  ];

  const stories: StoryItem[] = [
    { id: "1", handle: "akash_v", imageUrl: "https://i.pravatar.cc/120?img=12" },
    { id: "2", handle: "priya.dev", imageUrl: "https://i.pravatar.cc/120?img=32" },
    { id: "3", handle: "rahul.vns", imageUrl: "https://i.pravatar.cc/120?img=14" },
    { id: "4", handle: "sneha.ui", imageUrl: "https://i.pravatar.cc/120?img=25" },
    { id: "5", handle: "kiet.culture", imageUrl: "https://i.pravatar.cc/120?img=18" },
    { id: "6", handle: "ece.core", imageUrl: "https://i.pravatar.cc/120?img=44" }
  ];

  const posts: PostItem[] = [
    {
      id: "1",
      author: "utkarsh_vyb",
      caption: "Building the VYB experience for one trusted campus at a time.",
      imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
      likes: "1,284",
      location: "Innovation Lab"
    },
    {
      id: "2",
      author: "campus.frame",
      caption: "Tonight's open-mic energy was unreal. More moments from KIET soon.",
      imageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80",
      likes: "842",
      location: "Central Auditorium"
    },
    {
      id: "3",
      author: "design.circle",
      caption: "When product, community, and identity finally feel like one app.",
      imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
      likes: "967",
      location: "Studio Bay"
    }
  ];

  const viewerName = profile.profile?.fullName ?? viewer.displayName;

  return (
    <main className="vyb-campus-home">
      <aside className="vyb-campus-sidebar">
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
            <span>{profile.collegeName}</span>
          </div>
          <SignOutButton className="vyb-campus-signout" />
        </div>
      </aside>

      <section className="vyb-campus-main">
        <header className="vyb-campus-mobile-header">
          <Link href="/home" className="vyb-campus-branding vyb-campus-branding-mobile">
            VYB
          </Link>
          <div className="vyb-campus-mobile-actions">
            <BellIcon />
            <SendIcon />
          </div>
        </header>

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
          {posts.map((post) => (
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

              <img src={post.imageUrl} alt={post.caption} className="vyb-campus-post-image" />

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
      </section>

      <aside className="vyb-campus-right-panel">
        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Your vibe</span>
          <div className="vyb-campus-side-user">
            <img src={`https://i.pravatar.cc/120?u=${encodeURIComponent(viewer.email)}`} alt={viewerName} />
            <div>
              <strong>{viewerName}</strong>
              <span>
                {profile.profile?.course} · {profile.profile?.stream}
              </span>
            </div>
          </div>
        </div>

        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Suggested vibes</span>
          <div className="vyb-campus-suggestion">
            <div>
              <strong>ashwani_vyb</strong>
              <span>Same campus · same rhythm</span>
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
            <li>{profile.collegeName}</li>
            <li>{viewer.email}</li>
            <li>Role: {me?.membershipSummary.role ?? viewer.role}</li>
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
    </main>
  );
}
