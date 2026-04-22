"use client";

import type { CampusEvent, CampusEventScope, CampusEventsDashboardResponse } from "@vyb/contracts";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";
import { VybLogoLockup } from "./vyb-logo";

type CampusEventsShellProps = {
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  viewerEmail: string;
  course?: string | null;
  stream?: string | null;
  role: string;
  initialDashboard?: CampusEventsDashboardResponse | null;
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

function buildEmptyDashboard(viewerUsername: string): CampusEventsDashboardResponse {
  return {
    tenantId: "tenant-demo",
    viewer: {
      userId: "viewer",
      username: viewerUsername,
      savedCount: 0,
      interestedCount: 0,
      hostedCount: 0
    },
    events: [],
    hostedEvents: [],
    categories: []
  };
}

function formatEventDayLabel(value: string) {
  const timestamp = new Date(value);

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short"
  }).format(timestamp);
}

function formatEventTimeRange(event: CampusEvent) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const startLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(start);

  if (!end) {
    return startLabel;
  }

  const sameDay = start.toDateString() === end.toDateString();
  const endLabel = new Intl.DateTimeFormat("en-IN", {
    ...(sameDay ? {} : { weekday: "short" }),
    hour: "numeric",
    minute: "2-digit"
  }).format(end);

  return `${startLabel} - ${endLabel}`;
}

function formatEventInterestLabel(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K interested`;
  }

  if (value <= 0) {
    return "Be the first to respond";
  }

  return `${value} interested`;
}

function isWithinNextWeek(event: CampusEvent) {
  const now = Date.now();
  const startsAt = new Date(event.startsAt).getTime();

  return startsAt >= now && startsAt <= now + 7 * 24 * 60 * 60_000;
}

function getPrimaryMedia(event: CampusEvent) {
  return event.media[0] ?? null;
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

function CloseIcon() {
  return (
    <IconBase>
      <path d="M7 7 17 17M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

export function CampusEventsShell({
  viewerName,
  viewerUsername,
  collegeName,
  viewerEmail,
  course,
  stream,
  role,
  initialDashboard
}: CampusEventsShellProps) {
  const [dashboard, setDashboard] = useState(initialDashboard ?? buildEmptyDashboard(viewerUsername));
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [activeResize, setActiveResize] = useState<ResizeSide | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeScope, setActiveScope] = useState<CampusEventScope>("for-you");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const resizeState = useRef<{ side: ResizeSide; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    setDashboard(initialDashboard ?? buildEmptyDashboard(viewerUsername));
  }, [initialDashboard, viewerUsername]);

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

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    if (!dashboard.events.some((event) => event.id === selectedEventId) && !dashboard.hostedEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [dashboard, selectedEventId]);

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

  async function handleDashboardAction(
    actionKey: string,
    requestFactory: () => Promise<Response>,
    successMessage: string,
    errorMessage: string
  ) {
    setBusyAction(actionKey);

    try {
      const response = await requestFactory();
      const payload = (await response.json().catch(() => null)) as { dashboard?: CampusEventsDashboardResponse; error?: { message?: string } } | null;

      if (!response.ok || !payload?.dashboard) {
        throw new Error(payload?.error?.message || errorMessage);
      }

      setDashboard(payload.dashboard);
      setFlashMessage(successMessage);
    } catch (error) {
      setFlashMessage(error instanceof Error ? error.message : errorMessage);
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleSaved(eventId: string) {
    await handleDashboardAction(
      `save:${eventId}`,
      () => fetch(`/api/events/${eventId}/save`, { method: "POST" }),
      "Saved events updated.",
      "We could not update your saved events."
    );
  }

  async function toggleInterested(eventId: string) {
    await handleDashboardAction(
      `interest:${eventId}`,
      () => fetch(`/api/events/${eventId}/interest`, { method: "POST" }),
      "Your RSVP was updated.",
      "We could not update your RSVP."
    );
  }

  async function cancelHostedEvent(eventId: string) {
    await handleDashboardAction(
      `cancel:${eventId}`,
      () => fetch(`/api/events/${eventId}/cancel`, { method: "POST" }),
      "Event cancelled.",
      "We could not cancel this event."
    );
  }

  async function deleteHostedEvent(eventId: string) {
    await handleDashboardAction(
      `delete:${eventId}`,
      () => fetch(`/api/events/${eventId}`, { method: "DELETE" }),
      "Event deleted.",
      "We could not delete this event."
    );
  }

  async function shareEvent(event: CampusEvent) {
    const sharePayload = {
      title: event.title,
      text: `${event.title} by ${event.club} at ${collegeName} • ${formatEventTimeRange(event)}`,
      url: `${window.location.origin}/events`
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
      } else {
        await navigator.clipboard.writeText(`${sharePayload.text}\n${sharePayload.url}`);
      }

      setFlashMessage("Event link ready to share.");
    } catch {
      setFlashMessage("Share was cancelled.");
    }
  }

  const navItems = [
    { label: "Home", href: "/home", icon: <HomeIcon /> },
    { label: "Events", href: "/events", icon: <EventsIcon />, active: true },
    { label: "Vibes", href: "/vibes", icon: <VibesIcon /> },
    { label: "Market", href: "/market", icon: <MarketIcon /> },
    { label: "Profile", href: "/dashboard", icon: <ProfileIcon /> }
  ];

  const normalizedQuery = searchValue.trim().toLowerCase();
  const categories = useMemo(() => ["All", ...dashboard.categories], [dashboard.categories]);
  const scopedCounts = useMemo(
    () => ({
      "for-you": dashboard.events.filter((event) => event.status === "published").length,
      week: dashboard.events.filter((event) => event.status === "published" && isWithinNextWeek(event)).length,
      saved: dashboard.events.filter((event) => event.isSaved).length,
      ended: dashboard.events.filter((event) => event.status === "ended").length
    }),
    [dashboard.events]
  );

  const filteredEvents = useMemo(() => {
    const nextEvents = dashboard.events.filter((event) => {
      if (activeScope === "saved" && !event.isSaved) {
        return false;
      }

      if (activeScope === "week" && !isWithinNextWeek(event)) {
        return false;
      }

      if (activeScope === "ended") {
        if (event.status !== "ended") {
          return false;
        }
      } else if (event.status !== "published") {
        return false;
      }

      if (activeCategory !== "All" && event.category !== activeCategory) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = `${event.title} ${event.club} ${event.host.username} ${event.description} ${event.location} ${event.category}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    return nextEvents.sort((left, right) => {
      const leftTime = new Date(left.startsAt).getTime();
      const rightTime = new Date(right.startsAt).getTime();

      if (activeScope === "ended") {
        return rightTime - leftTime;
      }

      return leftTime - rightTime;
    });
  }, [activeCategory, activeScope, dashboard.events, normalizedQuery]);

  const notificationEvents = useMemo(
    () =>
      dashboard.events
        .filter((event) => event.status === "published" && (event.isSaved || event.isInterested))
        .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
        .slice(0, 6),
    [dashboard.events]
  );

  const selectedEvent =
    dashboard.events.find((event) => event.id === selectedEventId) ??
    dashboard.hostedEvents.find((event) => event.id === selectedEventId) ??
    null;

  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;
  const layoutStyle = {
    "--vyb-campus-left-width": `${leftWidth}px`,
    "--vyb-campus-right-width": `${rightWidth}px`
  } as CSSProperties;

  const scopeOptions: Array<{ id: CampusEventScope; label: string; count: number }> = [
    { id: "for-you", label: "For you", count: scopedCounts["for-you"] },
    { id: "week", label: "This week", count: scopedCounts.week },
    { id: "saved", label: "Saved", count: scopedCounts.saved },
    { id: "ended", label: "Ended", count: scopedCounts.ended }
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

          <button
            type="button"
            className={`vyb-events-icon-button${notificationsOpen ? " is-active" : ""}`}
            aria-label="Open event notifications"
            onClick={() => setNotificationsOpen((current) => !current)}
          >
            <BellIcon />
          </button>
          <Link href="/events/host" className="vyb-events-host-button">
            <TicketIcon />
            <span>Host event</span>
          </Link>
        </header>

        {flashMessage ? <div className="vyb-campus-flash-message">{flashMessage}</div> : null}

        {notificationsOpen ? (
          <section className="vyb-events-notifications-panel">
            <div className="vyb-events-notifications-head">
              <strong>Your upcoming reminders</strong>
              <button type="button" className="vyb-events-close-button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications">
                <CloseIcon />
              </button>
            </div>
            {notificationEvents.length === 0 ? (
              <p className="vyb-events-notifications-empty">Saved and RSVP'd events will start showing up here.</p>
            ) : (
              <div className="vyb-events-notifications-list">
                {notificationEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="vyb-events-notification-item"
                    onClick={() => {
                      setSelectedEventId(event.id);
                      setNotificationsOpen(false);
                    }}
                  >
                    <strong>{event.title}</strong>
                    <span>{formatEventTimeRange(event)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <div className="vyb-events-shell vyb-events-shell-compact">
          <section className="vyb-events-toolbar vyb-events-toolbar-compact">
            <div className="vyb-events-scope-row vyb-events-scope-row-scroll" role="tablist" aria-label="Event lanes">
              {scopeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={activeScope === option.id}
                  className={`vyb-events-scope-pill${activeScope === option.id ? " is-active" : ""}`}
                  onClick={() => setActiveScope(option.id)}
                >
                  <span>{option.label}</span>
                  <strong>{option.count}</strong>
                </button>
              ))}
            </div>

            <div className="vyb-events-chip-row vyb-events-chip-row-scroll">
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
                const primaryMedia = getPrimaryMedia(event);
                const isSaved = event.isSaved;
                const isInterested = event.isInterested;
                const isOwnEvent = event.isHostedByViewer;
                const busySave = busyAction === `save:${event.id}`;
                const busyInterest = busyAction === `interest:${event.id}`;

                return (
                  <article key={event.id} className="vyb-events-feed-card" role="button" tabIndex={0} onClick={() => setSelectedEventId(event.id)}>
                    <div className="vyb-events-feed-date">
                      <span>{formatEventDayLabel(event.startsAt)}</span>
                      <small>{formatEventTimeRange(event)}</small>
                    </div>

                    <div className="vyb-events-feed-media">
                      {primaryMedia ? (
                        primaryMedia.kind === "video" ? (
                          <video src={primaryMedia.url} className="vyb-events-feed-image" muted playsInline preload="metadata" />
                        ) : (
                          <img src={primaryMedia.url} alt={event.title} className="vyb-events-feed-image" />
                        )
                      ) : (
                        <div className="vyb-events-feed-fallback">
                          <SparkIcon />
                          <span>{event.category}</span>
                        </div>
                      )}
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
                          disabled={busySave}
                          onClick={(actionEvent) => {
                            actionEvent.stopPropagation();
                            void toggleSaved(event.id);
                          }}
                        >
                          <BookmarkIcon />
                        </button>
                      </div>

                      <div className="vyb-events-feed-copy">
                        <div>
                          <h3>{event.title}</h3>
                          <p>@{event.host.username}</p>
                        </div>
                        <span className="vyb-events-attendance">{formatEventInterestLabel(event.interestCount)}</span>
                      </div>

                      <p className="vyb-events-feed-description">{event.description}</p>

                      <div className="vyb-events-meta-list">
                        <span>
                          <CalendarIcon />
                          {formatEventTimeRange(event)}
                        </span>
                        <span>
                          <LocationIcon />
                          {event.location}
                        </span>
                      </div>

                      <div className="vyb-events-feed-social">
                        <span>
                          <HeartIcon />
                          {isInterested ? "You are going" : formatEventInterestLabel(event.interestCount)}
                        </span>
                        <span>
                          <CommentIcon />
                          {event.commentCount} comments
                        </span>
                      </div>

                      <div className="vyb-events-feed-actions">
                        <button
                          type="button"
                          className={`vyb-events-primary-button${isInterested ? " is-active" : ""}`}
                          disabled={busyInterest || event.status !== "published"}
                          onClick={(actionEvent) => {
                            actionEvent.stopPropagation();
                            void toggleInterested(event.id);
                          }}
                        >
                          <TicketIcon />
                          <span>{isInterested ? "Going" : event.status === "ended" ? "Ended" : "Interested"}</span>
                        </button>
                        {isOwnEvent ? (
                          <Link
                            href={`/events/host?edit=${encodeURIComponent(event.id)}`}
                            className="vyb-events-secondary-button"
                            onClick={(actionEvent) => actionEvent.stopPropagation()}
                          >
                            <span>Edit</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="vyb-events-secondary-button"
                            onClick={(actionEvent) => {
                              actionEvent.stopPropagation();
                              void shareEvent(event);
                            }}
                          >
                            <SendIcon />
                            <span>Share</span>
                          </button>
                        )}
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
              <strong>{dashboard.viewer.savedCount}</strong>
            </div>
            <div>
              <span>Going</span>
              <strong>{dashboard.viewer.interestedCount}</strong>
            </div>
            <div>
              <span>Hosted</span>
              <strong>{dashboard.viewer.hostedCount}</strong>
            </div>
          </div>
        </div>

        <div className="vyb-campus-side-card vyb-events-side-card">
          <div className="vyb-events-side-list-head">
            <span className="vyb-campus-side-label">Hosted by you</span>
            <Link href="/events/host" className="vyb-events-inline-link">
              New
            </Link>
          </div>
          <div className="vyb-events-side-list">
            {dashboard.hostedEvents.length === 0 ? (
              <div className="vyb-events-side-list-item">
                <strong>No hosted events yet</strong>
                <span>Open the host page and publish your first campus event.</span>
              </div>
            ) : (
              dashboard.hostedEvents.slice(0, 4).map((event) => (
                <button key={event.id} type="button" className="vyb-events-side-list-item vyb-events-side-list-button" onClick={() => setSelectedEventId(event.id)}>
                  <strong>{event.title}</strong>
                  <span>{formatEventTimeRange(event)}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="vyb-campus-side-card vyb-events-side-card">
          <span className="vyb-campus-side-label">Hot categories</span>
          <div className="vyb-events-chip-row">
            {dashboard.categories.slice(0, 6).map((category) => (
              <button key={category} type="button" className="vyb-events-chip" onClick={() => setActiveCategory(category)}>
                {category}
              </button>
            ))}
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

      {selectedEvent ? (
        <div className="vyb-events-detail-backdrop" role="presentation" onClick={() => setSelectedEventId(null)}>
          <aside className="vyb-events-detail-sheet" role="dialog" aria-modal="true" aria-label={selectedEvent.title} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="vyb-events-detail-close" aria-label="Close event details" onClick={() => setSelectedEventId(null)}>
              <CloseIcon />
            </button>

            <div className="vyb-events-detail-media">
              {getPrimaryMedia(selectedEvent) ? (
                getPrimaryMedia(selectedEvent)?.kind === "video" ? (
                  <video src={getPrimaryMedia(selectedEvent)?.url} controls playsInline className="vyb-events-detail-image" />
                ) : (
                  <img src={getPrimaryMedia(selectedEvent)?.url} alt={selectedEvent.title} className="vyb-events-detail-image" />
                )
              ) : (
                <div className="vyb-events-detail-fallback">
                  <SparkIcon />
                  <span>{selectedEvent.category}</span>
                </div>
              )}
            </div>

            <div className="vyb-events-detail-copy">
              <div className="vyb-events-detail-badges">
                <span className="vyb-events-club-tag">{selectedEvent.club}</span>
                <span className="vyb-events-pass-badge">{selectedEvent.passLabel}</span>
                <span className={`vyb-events-status-pill is-${selectedEvent.status}`}>{selectedEvent.status}</span>
              </div>

              <div className="vyb-events-detail-head">
                <div>
                  <h2>{selectedEvent.title}</h2>
                  <p>@{selectedEvent.host.username}</p>
                </div>
                <strong>{formatEventInterestLabel(selectedEvent.interestCount)}</strong>
              </div>

              <p className="vyb-events-detail-description">{selectedEvent.description}</p>

              <div className="vyb-events-detail-meta">
                <span>
                  <CalendarIcon />
                  {formatEventTimeRange(selectedEvent)}
                </span>
                <span>
                  <LocationIcon />
                  {selectedEvent.location}
                </span>
                {selectedEvent.capacity ? (
                  <span>
                    <TicketIcon />
                    Capacity {selectedEvent.capacity}
                  </span>
                ) : null}
              </div>

              <div className="vyb-events-detail-actions">
                {!selectedEvent.isHostedByViewer ? (
                  <>
                    <button
                      type="button"
                      className={`vyb-events-primary-button${selectedEvent.isInterested ? " is-active" : ""}`}
                      disabled={busyAction === `interest:${selectedEvent.id}` || selectedEvent.status !== "published"}
                      onClick={() => toggleInterested(selectedEvent.id)}
                    >
                      <TicketIcon />
                      <span>{selectedEvent.isInterested ? "Going" : selectedEvent.status === "ended" ? "Ended" : "Interested"}</span>
                    </button>
                    <button
                      type="button"
                      className={`vyb-events-secondary-button${selectedEvent.isSaved ? " is-active" : ""}`}
                      disabled={busyAction === `save:${selectedEvent.id}`}
                      onClick={() => toggleSaved(selectedEvent.id)}
                    >
                      <BookmarkIcon />
                      <span>{selectedEvent.isSaved ? "Saved" : "Save"}</span>
                    </button>
                    <button type="button" className="vyb-events-secondary-button" onClick={() => shareEvent(selectedEvent)}>
                      <SendIcon />
                      <span>Share</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link href={`/events/host?edit=${encodeURIComponent(selectedEvent.id)}`} className="vyb-events-primary-button">
                      <span>Edit event</span>
                    </Link>
                    {selectedEvent.status === "published" ? (
                      <button
                        type="button"
                        className="vyb-events-secondary-button"
                        disabled={busyAction === `cancel:${selectedEvent.id}`}
                        onClick={() => cancelHostedEvent(selectedEvent.id)}
                      >
                        <span>Cancel event</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="vyb-events-secondary-button"
                      disabled={busyAction === `delete:${selectedEvent.id}`}
                      onClick={() => deleteHostedEvent(selectedEvent.id)}
                    >
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
