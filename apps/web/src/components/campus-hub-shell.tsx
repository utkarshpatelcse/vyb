"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buildPrimaryCampusNav, CampusDesktopNavigation, CampusMobileNavigation } from "./campus-navigation";
import { SignOutButton } from "./sign-out-button";
import { VybLogoLockup } from "./vyb-logo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HubTab = "games" | "events";

type Game = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  activePlayers: number;
  maxPlayers: number;
  category: string;
  href: string;
  isHot: boolean;
};

type HeroSlide = {
  id: string;
  kind: "game" | "event";
  title: string;
  subtitle: string;
  emoji: string;
  stat: string;
  statLabel: string;
  accentColor: string;
};

type LeaderEntry = {
  rank: number;
  username: string;
  displayName: string;
  score: number;
  badge: string;
};

export type CampusHubShellProps = {
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  viewerEmail: string;
};

// ---------------------------------------------------------------------------
// Mock data (replace with real API calls as backend is ready)
// ---------------------------------------------------------------------------

const HERO_SLIDES: HeroSlide[] = [
  {
    id: "slide-scribble",
    kind: "game",
    title: "Scribble Frenzy 🎨",
    subtitle: "Most played game this hour — 247 active sessions",
    emoji: "🖌️",
    stat: "247",
    statLabel: "live players",
    accentColor: "rgba(99,102,241,0.9)"
  },
  {
    id: "slide-quiz",
    kind: "game",
    title: "Rapid-Fire Quiz ⚡",
    subtitle: "Trending on campus — beat the reigning champ!",
    emoji: "🏆",
    stat: "189",
    statLabel: "live players",
    accentColor: "rgba(168,85,247,0.9)"
  },
  {
    id: "slide-chess",
    kind: "game",
    title: "Chess Arena ♟️",
    subtitle: "Campus championship bracket is open — join now",
    emoji: "♟️",
    stat: "94",
    statLabel: "live matches",
    accentColor: "rgba(59,130,246,0.9)"
  }
];

const LEADERBOARD: LeaderEntry[] = [
  { rank: 1, username: "aryan_singh", displayName: "Aryan Singh", score: 4820, badge: "👑" },
  { rank: 2, username: "priya_m", displayName: "Priya M.", score: 3910, badge: "🥈" },
  { rank: 3, username: "dev_codes", displayName: "Dev K.", score: 3540, badge: "🥉" },
  { rank: 4, username: "isha_rao", displayName: "Isha Rao", score: 3120, badge: "🔥" },
  { rank: 5, username: "rahul_v", displayName: "Rahul V.", score: 2980, badge: "⚡" }
];

const GAMES: Game[] = [
  {
    id: "scribble",
    name: "Scribble",
    description: "Draw & guess with your campus squad",
    emoji: "🎨",
    activePlayers: 247,
    maxPlayers: 8,
    category: "Multiplayer",
    href: "#scribble",
    isHot: true
  },
  {
    id: "chess",
    name: "Chess",
    description: "Classic 1v1 strategy battles",
    emoji: "♟️",
    activePlayers: 94,
    maxPlayers: 2,
    category: "Strategy",
    href: "#chess",
    isHot: false
  },
  {
    id: "quiz",
    name: "Rapid-Fire Quiz",
    description: "30-second trivia sprints — all topics",
    emoji: "⚡",
    activePlayers: 189,
    maxPlayers: 50,
    category: "Trivia",
    href: "#quiz",
    isHot: true
  }
];

// ---------------------------------------------------------------------------
// Helper utils
// ---------------------------------------------------------------------------

function formatPlayerCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatScore(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

// ---------------------------------------------------------------------------
// Icon components
// ---------------------------------------------------------------------------

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

function MessagesIcon() {
  return (
    <IconBase>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function GamepadIcon() {
  return (
    <IconBase>
      <line x1="6" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8" y1="10" x2="8" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="15" cy="11" r="0.8" fill="currentColor" />
      <circle cx="17" cy="13" r="0.8" fill="currentColor" />
      <path d="M6 8h12a2 2 0 0 1 2 2v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function CalendarFunIcon() {
  return (
    <IconBase>
      <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 16l1.5-1.5L12 16l1.5-1.5L15 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ChevronLeftIcon() {
  return (
    <IconBase>
      <path d="M15 18 9 12l6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ChevronRightIcon() {
  return (
    <IconBase>
      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function UsersIcon() {
  return (
    <IconBase>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function TrophyIcon() {
  return (
    <IconBase>
      <path d="M6 9H3a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4m12-7h3a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 2h12v11a6 6 0 0 1-12 0V2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 22h6M12 18v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

function ZapIcon() {
  return (
    <IconBase>
      <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H13L13 2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function advance(dir: 1 | -1) {
    setIndex((prev) => (prev + dir + slides.length) % slides.length);
  }

  useEffect(() => {
    timerRef.current = setInterval(() => advance(1), 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const slide = slides[index];

  return (
    <div className="hub-hero-carousel" role="region" aria-label="Trending now">
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          className="hub-hero-slide"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          style={{ "--hub-hero-accent": slide.accentColor } as React.CSSProperties}
        >
          <div className="hub-hero-glow" />

          <div className="hub-hero-badge">
            {slide.kind === "game" ? <GamepadIcon /> : <CalendarFunIcon />}
            <span>{slide.kind === "game" ? "🔥 Hottest Game" : "📅 Trending Event"}</span>
          </div>

          <div className="hub-hero-content">
            <span className="hub-hero-emoji" aria-hidden="true">{slide.emoji}</span>
            <div className="hub-hero-copy">
              <h2>{slide.title}</h2>
              <p>{slide.subtitle}</p>
            </div>
          </div>

          <div className="hub-hero-stats">
            <div className="hub-hero-stat">
              <strong>{slide.stat}</strong>
              <span>{slide.statLabel}</span>
            </div>
            <button type="button" className="hub-hero-cta">
              {slide.kind === "game" ? "Play Now" : "View Event"}
              <ChevronRightIcon />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dots + nav */}
      <div className="hub-hero-controls">
        <button
          type="button"
          className="hub-hero-nav-btn"
          onClick={() => advance(-1)}
          aria-label="Previous"
        >
          <ChevronLeftIcon />
        </button>
        <div className="hub-hero-dots" role="tablist">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`hub-hero-dot${i === index ? " is-active" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <button
          type="button"
          className="hub-hero-nav-btn"
          onClick={() => advance(1)}
          aria-label="Next"
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
}

function LeaderboardStrip({ entries }: { entries: LeaderEntry[] }) {
  const top = entries[0];
  return (
    <div className="hub-leaderboard-strip" role="region" aria-label="Campus leaderboard">
      <div className="hub-leaderboard-label">
        <TrophyIcon />
        <span>Campus Gaming King</span>
        <span className="hub-leaderboard-period">· This Week</span>
      </div>

      <div className="hub-leaderboard-king">
        <span className="hub-leaderboard-king-badge">{top.badge}</span>
        <strong>{top.displayName}</strong>
        <span>@{top.username}</span>
        <span className="hub-leaderboard-king-score">{formatScore(top.score)} pts</span>
      </div>

      <div className="hub-leaderboard-runners">
        {entries.slice(1).map((entry) => (
          <div key={entry.username} className="hub-leaderboard-runner">
            <span className="hub-leaderboard-runner-badge">{entry.badge}</span>
            <span>{entry.displayName}</span>
            <span className="hub-leaderboard-runner-score">{formatScore(entry.score)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.a
      href={game.href}
      className={`hub-game-card${game.isHot ? " is-hot" : ""}`}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      id={`hub-game-${game.id}`}
      aria-label={`${game.name} — ${formatPlayerCount(game.activePlayers)} active players`}
    >
      {game.isHot && (
        <span className="hub-game-hot-badge">
          <ZapIcon />
          HOT
        </span>
      )}

      <div className="hub-game-emoji-wrap" aria-hidden="true">
        <motion.span
          className="hub-game-emoji"
          animate={hovered ? { rotate: [0, -8, 8, -4, 0], scale: [1, 1.15, 1.1, 1.12, 1] } : { rotate: 0, scale: 1 }}
          transition={{ duration: 0.45 }}
        >
          {game.emoji}
        </motion.span>
      </div>

      <div className="hub-game-info">
        <strong className="hub-game-name">{game.name}</strong>
        <p className="hub-game-desc">{game.description}</p>
        <span className="hub-game-category">{game.category}</span>
      </div>

      <div className="hub-game-footer">
        <div className="hub-game-players">
          <UsersIcon />
          <span>
            <strong>{formatPlayerCount(game.activePlayers)}</strong> active
          </span>
        </div>
        <button type="button" className="hub-game-play-btn" aria-label={`Play ${game.name}`}>
          Play
        </button>
      </div>

      {/* Animated pulse ring */}
      <span className="hub-game-pulse" aria-hidden="true" />
    </motion.a>
  );
}

function GamesHub() {
  return (
    <motion.div
      key="games"
      className="hub-panel hub-panel-games"
      initial={{ opacity: 0, x: -28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 28 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Hero carousel */}
      <HeroCarousel slides={HERO_SLIDES} />

      {/* Leaderboard strip */}
      <LeaderboardStrip entries={LEADERBOARD} />

      {/* Game grid */}
      <section className="hub-games-section">
        <div className="hub-section-head">
          <GamepadIcon />
          <div>
            <h3>Game Lobby</h3>
            <span>Jump into a live session with your campus</span>
          </div>
        </div>

        <div className="hub-games-grid">
          {GAMES.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.28, ease: "easeOut" }}
            >
              <GameCard game={game} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Coming soon teaser */}
      <div className="hub-coming-soon">
        <span>🚀</span>
        <div>
          <strong>More games dropping soon</strong>
          <p>Carrom, Ludo, Word Blitz and more — built for your campus.</p>
        </div>
      </div>
    </motion.div>
  );
}

function EventsHub() {
  return (
    <motion.div
      key="events"
      className="hub-panel hub-panel-events"
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -28 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="hub-events-hero">
        <div className="hub-events-hero-glow" />
        <span className="hub-events-hero-emoji" aria-hidden="true">📅</span>
        <div className="hub-events-hero-copy">
          <h2>Events Hub</h2>
          <p>Discover what's happening across your campus right now.</p>
        </div>
      </div>

      <div className="hub-events-placeholder">
        <div className="hub-events-placeholder-grid">
          {["🎭 Cultural Night", "🏀 Sports Week", "💼 Placement Drive", "🎵 Battle of Bands"].map((item) => (
            <div key={item} className="hub-events-placeholder-card">
              <span>{item.split(" ")[0]}</span>
              <strong>{item.split(" ").slice(1).join(" ")}</strong>
              <p>Coming up soon — stay tuned</p>
            </div>
          ))}
        </div>
        <a href="/events" className="hub-events-goto-btn">
          Go to Events
          <ChevronRightIcon />
        </a>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main shell
// ---------------------------------------------------------------------------

export function CampusHubShell({
  viewerName,
  viewerUsername,
  collegeName,
  viewerEmail
}: CampusHubShellProps) {
  const [activeTab, setActiveTab] = useState<HubTab>("games");

  const navItems = buildPrimaryCampusNav("events", {
    profileHref: "/dashboard"
  });

  return (
    <div className="vyb-campus-home hub-shell">
      {/* Desktop sidebar */}
      <CampusDesktopNavigation
        navItems={navItems}
        viewerName={viewerName}
        viewerUsername={viewerUsername}
      />

      {/* Main area */}
      <main className="vyb-campus-main hub-main">

        {/* Mobile header */}
        <div className="vyb-campus-mobile-header hub-mobile-header">
          <VybLogoLockup className="vyb-campus-branding-mobile is-compact-on-small" />
          <div className="hub-mobile-tab-pills">
            <button
              type="button"
              id="hub-tab-games"
              className={`hub-tab-pill${activeTab === "games" ? " is-active-games" : ""}`}
              onClick={() => setActiveTab("games")}
              aria-selected={activeTab === "games"}
            >
              <GamepadIcon />
              Games
            </button>
            <button
              type="button"
              id="hub-tab-events"
              className={`hub-tab-pill${activeTab === "events" ? " is-active-events" : ""}`}
              onClick={() => setActiveTab("events")}
              aria-selected={activeTab === "events"}
            >
              <CalendarFunIcon />
              Events
            </button>
          </div>
        </div>

        {/* Desktop topbar */}
        <div className="hub-topbar">
          <div className="hub-topbar-brand">
            <span className="hub-topbar-icon" aria-hidden="true">🎮</span>
            <div>
              <strong>The Hub</strong>
              <span>{collegeName} · Gaming &amp; Social Calendar</span>
            </div>
          </div>

          {/* Desktop tab switcher */}
          <div className="hub-tabs" role="tablist" aria-label="Hub sections">
            <button
              type="button"
              role="tab"
              id="hub-desktop-tab-games"
              aria-selected={activeTab === "games"}
              className={`hub-tab${activeTab === "games" ? " is-active-games" : ""}`}
              onClick={() => setActiveTab("games")}
            >
              <GamepadIcon />
              <span>Games Hub</span>
              {activeTab === "games" && (
                <motion.span
                  className="hub-tab-indicator hub-tab-indicator-games"
                  layoutId="hub-tab-indicator"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
            <button
              type="button"
              role="tab"
              id="hub-desktop-tab-events"
              aria-selected={activeTab === "events"}
              className={`hub-tab${activeTab === "events" ? " is-active-events" : ""}`}
              onClick={() => setActiveTab("events")}
            >
              <CalendarFunIcon />
              <span>Events Hub</span>
              {activeTab === "events" && (
                <motion.span
                  className="hub-tab-indicator hub-tab-indicator-events"
                  layoutId="hub-tab-indicator"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          </div>

          <div className="hub-topbar-live">
            <span className="hub-live-dot" aria-hidden="true" />
            <span>530 online now</span>
          </div>
        </div>

        {/* Tab content */}
        <div className="hub-content">
          <AnimatePresence mode="wait">
            {activeTab === "games" ? <GamesHub /> : <EventsHub />}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <CampusMobileNavigation navItems={navItems} />
    </div>
  );
}
