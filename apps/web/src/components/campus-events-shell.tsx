"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";
import { VybLogoLockup } from "./vyb-logo";

type EventScope = "for-you" | "week" | "saved";
type EventItem = {
  id: string;
  title: string;
  club: string;
  host: string;
  description: string;
  location: string;
  time: string;
  dateLabel: string;
  imageUrl: string;
  category: string;
  attendance: string;
  passLabel: string;
  comments: string;
};

type CampusEventsShellProps = {
  viewerName: string;
  collegeName: string;
  viewerEmail: string;
  course?: string | null;
  stream?: string | null;
  role: string;
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

const EVENTS: EventItem[] = [
  {
    id: "1",
    title: "Neon Night Showcase",
    club: "Cultural Council",
    host: "culture.live",
    description: "Student performances, live visuals, crowd moments, and late-evening campus energy in one outdoor setup.",
    location: "Central lawn",
    time: "Fri, 7:30 PM",
    dateLabel: "25 Apr",
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80&auto=format&fit=crop",
    category: "Cultural",
    attendance: "1.2K interested",
    passLabel: "Free entry",
    comments: "84 comments"
  },
  {
    id: "2",
    title: "Hack Sprint Zero",
    club: "CodeCell",
    host: "codecell.live",
    description: "A quick pre-hackathon mixer with demo tables, team matching, and a fast mentor round.",
    location: "Innovation lab",
    time: "Sat, 10:00 AM",
    dateLabel: "26 Apr",
    imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80&auto=format&fit=crop",
    category: "Tech",
    attendance: "480 builders",
    passLabel: "RSVP needed",
    comments: "39 comments"
  },
  {
    id: "3",
    title: "Startup Jam",
    club: "E-Cell",
    host: "ecell.live",
    description: "Pitch warmups, sharp founder feedback, and fast room energy for teams building in public.",
    location: "Seminar block",
    time: "Sat, 4:00 PM",
    dateLabel: "26 Apr",
    imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80&auto=format&fit=crop",
    category: "Workshop",
    attendance: "210 founders",
    passLabel: "Seats limited",
    comments: "26 comments"
  },
  {
    id: "4",
    title: "Sunrise Run Club",
    club: "Sports Board",
    host: "fit.on.campus",
    description: "Campus laps, stretch stops, and a recovery corner for early-morning runners.",
    location: "Sports complex",
    time: "Sun, 6:15 AM",
    dateLabel: "27 Apr",
    imageUrl: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80&auto=format&fit=crop",
    category: "Sports",
    attendance: "140 runners",
    passLabel: "Open drop-in",
    comments: "18 comments"
  },
  {
    id: "5",
    title: "Portfolio Review Room",
    club: "Design Circle",
    host: "design.circle",
    description: "Bring product, UI, motion, or brand work for crisp feedback and peer reviews.",
    location: "Studio bay",
    time: "Mon, 3:30 PM",
    dateLabel: "28 Apr",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80&auto=format&fit=crop",
    category: "Workshop",
    attendance: "96 designers",
    passLabel: "Bring laptop",
    comments: "13 comments"
  },
  {
    id: "6",
    title: "Indie Film Circle",
    club: "Frame House",
    host: "frame.house",
    description: "A screening room vibe with a short discussion on storytelling, cuts, and visual language.",
    location: "Mini auditorium",
    time: "Mon, 7:00 PM",
    dateLabel: "28 Apr",
    imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&q=80&auto=format&fit=crop",
    category: "Cultural",
    attendance: "320 attendees",
    passLabel: "Free + popcorn",
    comments: "44 comments"
  }
];

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

function SearchIcon() {
  return (
    <IconBase>
      <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m21 21-4.3-4.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

function CalendarIcon() {
  return (
    <IconBase>
      <path d="M7 3v3M17 3v3M5 8h14M6 5h12a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function TicketIcon() {
  return (
    <IconBase>
      <path d="M4 9a2.5 2.5 0 1 0 0 5v1.5A1.5 1.5 0 0 0 5.5 17h13a1.5 1.5 0 0 0 1.5-1.5V14a2.5 2.5 0 1 0 0-5V7.5A1.5 1.5 0 0 0 18.5 6h-13A1.5 1.5 0 0 0 4 7.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 6v11M15 6v11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2.4 2.4" />
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

function BookmarkIcon() {
  return (
    <IconBase>
      <path d="M7 4.5h10a1 1 0 0 1 1 1v14l-6-3-6 3v-14a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function SendIcon() {
  return (
    <IconBase>
      <path d="M21 4 10 15M21 4l-7 17-4-6-6-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function SparkIcon() {
  return (
    <IconBase>
      <path d="M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2L10 9l2-5.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

export function CampusEventsShell({
  viewerName,
  collegeName,
  viewerEmail,
  course,
  stream,
  role
}: CampusEventsShellProps) {
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [activeResize, setActiveResize] = useState<ResizeSide | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeScope, setActiveScope] = useState<EventScope>("for-you");
  const [savedIds, setSavedIds] = useState<string[]>(["2", "6"]);
  const [interestedIds, setInterestedIds] = useState<string[]>(["1", "3"]);
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

  function toggleSaved(id: string) {
    setSavedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleInterested(id: string) {
    setInterestedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const navItems = [
    { label: "Home", href: "/home", icon: <HomeIcon /> },
    { label: "Events", href: "/events", icon: <EventsIcon />, active: true },
    { label: "Vibes", href: "/vibes", icon: <VibesIcon /> },
    { label: "Market", href: "/market", icon: <MarketIcon /> },
    { label: "Profile", href: "/dashboard", icon: <ProfileIcon /> }
  ];

  const categories = ["All", ...new Set(EVENTS.map((event) => event.category))];
  const normalizedQuery = searchValue.trim().toLowerCase();

  const filteredEvents = EVENTS.filter((event, index) => {
    const matchesCategory = activeCategory === "All" || event.category === activeCategory;
    const haystack = `${event.title} ${event.club} ${event.host} ${event.description} ${event.location} ${event.category}`.toLowerCase();
    const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery);

    if (activeScope === "saved" && !savedIds.includes(event.id)) {
      return false;
    }

    if (activeScope === "week" && index > 3) {
      return false;
    }

    return matchesCategory && matchesSearch;
  });

  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;

  const layoutStyle = {
    "--vyb-campus-left-width": `${leftWidth}px`,
    "--vyb-campus-right-width": `${rightWidth}px`
  } as CSSProperties;

  const scopeOptions: Array<{ id: EventScope; label: string; count: number }> = [
    { id: "for-you", label: "For you", count: EVENTS.length },
    { id: "week", label: "This week", count: 4 },
    { id: "saved", label: "Saved", count: savedIds.length }
  ];

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

      <section className="vyb-campus-main vyb-events-main">
        <header className="vyb-events-header">
          <div className="vyb-events-brand-block">
            <span className="vyb-events-kicker">Campus calendar</span>
            <strong>Events</strong>
          </div>

          <label className="vyb-events-search">
            <SearchIcon />
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search clubs, nights, workshops, or venues"
              aria-label="Search campus events"
            />
          </label>

          <div className="vyb-events-header-actions">
            <button type="button" className="vyb-events-icon-button" aria-label="Notifications">
              <BellIcon />
            </button>
            <button type="button" className="vyb-events-host-button">
              <TicketIcon />
              <span>Host event</span>
            </button>
          </div>
        </header>

        <div className="vyb-events-shell vyb-events-shell-compact">
          <section className="vyb-events-toolbar vyb-events-toolbar-compact">
            <div className="vyb-events-toolbar-copy">
              <div>
                <span className="vyb-events-section-label">Live campus feed</span>
                <h2>{filteredEvents.length} event{filteredEvents.length === 1 ? "" : "s"} in your active lane</h2>
              </div>
              <p>Skip the landing-page feel and jump straight into real event discovery, saves, and RSVP intent.</p>
            </div>

            <div className="vyb-events-scope-row">
              {scopeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`vyb-events-scope-pill${activeScope === option.id ? " is-active" : ""}`}
                  onClick={() => setActiveScope(option.id)}
                >
                  <span>{option.label}</span>
                  <strong>{option.count}</strong>
                </button>
              ))}
            </div>

            <div className="vyb-events-chip-row">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`vyb-events-chip${activeCategory === category ? " is-active" : ""}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </section>

          {filteredEvents.length > 0 ? (
            <div className="vyb-events-feed">
              {filteredEvents.map((event) => {
                const isSaved = savedIds.includes(event.id);
                const isInterested = interestedIds.includes(event.id);

                return (
                  <article key={event.id} className="vyb-events-feed-card">
                    <div className="vyb-events-feed-date">
                      <span>{event.dateLabel}</span>
                      <small>{event.time}</small>
                    </div>

                    <div className="vyb-events-feed-media">
                      <img src={event.imageUrl} alt={event.title} className="vyb-events-feed-image" />
                    </div>

                    <div className="vyb-events-feed-content">
                      <div className="vyb-events-feed-topline">
                        <div className="vyb-events-feed-badges">
                          <span className="vyb-events-club-tag">{event.club}</span>
                          <span className="vyb-events-pass-badge">{event.passLabel}</span>
                        </div>

                        <button
                          type="button"
                          className={`vyb-events-save-button${isSaved ? " is-active" : ""}`}
                          aria-label={isSaved ? `Unsave ${event.title}` : `Save ${event.title}`}
                          onClick={() => toggleSaved(event.id)}
                        >
                          <BookmarkIcon />
                        </button>
                      </div>

                      <div className="vyb-events-feed-copy">
                        <div>
                          <h3>{event.title}</h3>
                          <p>@{event.host}</p>
                        </div>
                        <span className="vyb-events-attendance">{event.attendance}</span>
                      </div>

                      <p className="vyb-events-feed-description">{event.description}</p>

                      <div className="vyb-events-meta-list">
                        <span>
                          <CalendarIcon />
                          {event.time}
                        </span>
                        <span>
                          <LocationIcon />
                          {event.location}
                        </span>
                      </div>

                      <div className="vyb-events-feed-social">
                        <span>
                          <HeartIcon />
                          {isInterested ? "You are going" : event.attendance}
                        </span>
                        <span>
                          <CommentIcon />
                          {event.comments}
                        </span>
                      </div>

                      <div className="vyb-events-feed-actions">
                        <button
                          type="button"
                          className={`vyb-events-primary-button${isInterested ? " is-active" : ""}`}
                          onClick={() => toggleInterested(event.id)}
                        >
                          <TicketIcon />
                          <span>{isInterested ? "Going" : "Interested"}</span>
                        </button>
                        <button type="button" className="vyb-events-secondary-button">
                          <SendIcon />
                          <span>Share</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="vyb-events-empty-state">
              <strong>No events match that lane right now.</strong>
              <p>Try another category, switch scopes, or clear the search to see more campus activity.</p>
            </div>
          )}
        </div>
      </section>

      <button
        type="button"
        className={`vyb-campus-resizer vyb-campus-resizer-right${activeResize === "right" ? " is-active" : ""}`}
        aria-label="Resize right sidebar"
        onPointerDown={(event) => startResizeDrag("right", event)}
      />

      <aside className="vyb-campus-right-panel vyb-campus-rail">
        <div className="vyb-campus-side-card vyb-events-side-card">
          <span className="vyb-campus-side-label">Your event lane</span>
          <div className="vyb-events-side-user">
            <img src={`https://i.pravatar.cc/120?u=${encodeURIComponent(viewerEmail)}`} alt={viewerName} />
            <div>
              <strong>{viewerName}</strong>
              <span>{identityLine}</span>
            </div>
          </div>

          <div className="vyb-events-side-pill">
            <SparkIcon />
            <span>{role} access active for {collegeName}</span>
          </div>
        </div>

        <div className="vyb-campus-side-card vyb-events-side-card">
          <span className="vyb-campus-side-label">Your signals</span>
          <div className="vyb-events-side-stats">
            <div>
              <span>Saved</span>
              <strong>{savedIds.length}</strong>
            </div>
            <div>
              <span>Going</span>
              <strong>{interestedIds.length}</strong>
            </div>
          </div>
        </div>

        <div className="vyb-campus-side-card vyb-events-side-card">
          <span className="vyb-campus-side-label">Hot clubs</span>
          <div className="vyb-events-side-list">
            <div className="vyb-events-side-list-item">
              <strong>culture.live</strong>
              <span>Carrying the biggest social turnout this week across music and performance nights.</span>
            </div>
            <div className="vyb-events-side-list-item">
              <strong>codecell.live</strong>
              <span>Driving the strongest builder attendance with sprint rooms and fast RSVP conversion.</span>
            </div>
          </div>
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
    </main>
  );
}
