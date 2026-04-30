"use client";

import type { FeedCard, MarketListing, MarketRequest, UserSearchItem } from "@vyb/contracts";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CampusAvatarContent } from "./campus-avatar";
import {
  captureSearchScrollPosition,
  queueSearchNavigationOrigin,
  restoreSearchScrollPosition
} from "../lib/search-navigation";
import { queueAppRouteOrigin } from "../lib/app-navigation-state";

type CampusSearchShellProps = {
  initialQuery: string;
  results: UserSearchItem[];
  viewerUsername: string;
  hasSearched: boolean;
  initialFeedItems: FeedCard[];
  initialVibeItems: FeedCard[];
  suggestedUsers: UserSearchItem[];
  marketListings: MarketListing[];
  marketRequests: MarketRequest[];
};

type RankedDiscoveryItem = {
  type: "post" | "vibe";
  id: string;
  item: FeedCard;
  href: string;
  trendScore: number;
  ageInHours: number;
  trendingRank: number;
  isFresh: boolean;
};

type TrendingProfile = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  score: number;
  rank: number;
  recentVibeAt: string | null;
  isGlowing: boolean;
};

type DiscoveryPromo =
  | {
      type: "squad";
      id: string;
      title: string;
      description: string;
      people: UserSearchItem[];
    }
  | {
      type: "deal";
      id: string;
      title: string;
      description: string;
      listing: MarketListing | null;
      request: MarketRequest | null;
    };

type DiscoveryGridItem =
  | {
      type: "content";
      id: string;
      entry: RankedDiscoveryItem;
    }
  | {
      type: "promo";
      id: string;
      entry: DiscoveryPromo;
    };

type DiscoveryViewModel = {
  trendingProfiles: TrendingProfile[];
  gridItems: DiscoveryGridItem[];
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <circle cx="11" cy="11" r="7.5" />
      <line x1="20" y1="20" x2="16.4" y2="16.4" />
    </svg>
  );
}

function TrendingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <polyline points="22 7 13.8 15.2 9.5 10.9 2 18.4" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <path d="m12 2 2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2Z" />
    </svg>
  );
}

function DealIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
      <path d="M8 12h8M8 9h3M13 15h3" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="vyb-campus-icon">
      <path d="M15 18 9 12l6-6" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="vyb-campus-icon" aria-hidden="true">
      <path d="m9 7 8 5-8 5z" />
    </svg>
  );
}

function formatMetric(value: number) {
  if (value <= 0) {
    return "0";
  }

  return new Intl.NumberFormat("en-IN", {
    notation: value > 999 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function formatAge(createdAt: string) {
  const diffHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3_600_000);
  if (diffHours < 1) {
    return `${Math.max(1, Math.round(diffHours * 60))}m ago`;
  }

  if (diffHours < 24) {
    return `${Math.round(diffHours)}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${Math.max(1, diffDays)}d ago`;
}

function getInitials(value: string) {
  return value
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "V";
}

function getProfileHref(username: string, viewerUsername: string) {
  return username === viewerUsername ? "/dashboard" : `/u/${encodeURIComponent(username)}`;
}

function getDiscoveryTarget(entry: FeedCard) {
  const isVibe = entry.placement === "vibe" || entry.kind === "video";
  return {
    type: isVibe ? ("vibe" as const) : ("post" as const),
    href: `${isVibe ? "/vibes" : "/home"}?post=${encodeURIComponent(entry.id)}`
  };
}

function computeAgeInHours(createdAt: string) {
  return Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3_600_000);
}

function computeTrendingMomentum(item: FeedCard) {
  const ageInHours = computeAgeInHours(item.createdAt);
  const baseScore = (item.reactions * 0.4 + item.comments * 0.6) / Math.pow(ageInHours + 1, 1.2);
  return {
    ageInHours,
    score: ageInHours <= 6 ? baseScore * 1.35 : baseScore
  };
}

function buildDiscoveryViewModel(
  feedItems: FeedCard[],
  vibeItems: FeedCard[],
  suggestedUsers: UserSearchItem[],
  marketListings: MarketListing[],
  marketRequests: MarketRequest[]
) {
  const uniqueContent = new Map<string, FeedCard>();
  for (const item of [...vibeItems, ...feedItems]) {
    uniqueContent.set(item.id, item);
  }

  const rankedItems = Array.from(uniqueContent.values())
    .map((item) => {
      const target = getDiscoveryTarget(item);
      const momentum = computeTrendingMomentum(item);
      return {
        type: target.type,
        id: item.id,
        item,
        href: target.href,
        trendScore: momentum.score,
        ageInHours: momentum.ageInHours,
        trendingRank: 0,
        isFresh: momentum.ageInHours <= 6
      } satisfies RankedDiscoveryItem;
    })
    .sort((left, right) => {
      if (left.isFresh !== right.isFresh) {
        return left.isFresh ? -1 : 1;
      }

      if (Math.abs(right.trendScore - left.trendScore) > 0.001) {
        return right.trendScore - left.trendScore;
      }

      return new Date(right.item.createdAt).getTime() - new Date(left.item.createdAt).getTime();
    })
    .map((entry, index) => ({
      ...entry,
      trendingRank: index + 1
    }));

  const trendingProfiles = Array.from(
    vibeItems.reduce<Map<string, TrendingProfile>>((accumulator, vibe) => {
      if (vibe.isAnonymous || !vibe.author.userId) {
        return accumulator;
      }

      const current = accumulator.get(vibe.author.userId);
      const vibeScore =
        rankedItems.find((entry) => entry.id === vibe.id)?.trendScore ??
        computeTrendingMomentum(vibe).score;
      const isGlowing = computeAgeInHours(vibe.createdAt) <= 2;

      if (!current) {
        accumulator.set(vibe.author.userId, {
          userId: vibe.author.userId,
          username: vibe.author.username,
          displayName: vibe.author.displayName,
          score: vibeScore,
          rank: 0,
          recentVibeAt: vibe.createdAt,
          isGlowing
        });
        return accumulator;
      }

      current.score = Math.max(current.score, vibeScore);
      current.recentVibeAt =
        !current.recentVibeAt || new Date(vibe.createdAt).getTime() > new Date(current.recentVibeAt).getTime()
          ? vibe.createdAt
          : current.recentVibeAt;
      current.isGlowing = current.isGlowing || isGlowing;
      return accumulator;
    }, new Map()).values()
  )
    .sort((left, right) => {
      if (left.isGlowing !== right.isGlowing) {
        return left.isGlowing ? -1 : 1;
      }

      return right.score - left.score;
    })
    .slice(0, 5)
    .map((profile, index) => ({
      ...profile,
      rank: index + 1
    }));

  const squadPromos: DiscoveryPromo[] = [];
  for (let index = 0; index < suggestedUsers.length; index += 3) {
    const people = suggestedUsers.slice(index, index + 3);
    if (people.length === 0) {
      continue;
    }

    squadPromos.push({
      type: "squad",
      id: `squad-${people.map((person) => person.userId).join("-")}`,
      title: "Squad recommendation",
      description: "People with overlapping campus energy and likely mutual circles.",
      people
    });
  }

  const marketPromos: DiscoveryPromo[] = [...marketListings]
    .sort((left, right) => {
      const rightWeight = right.savedCount * 1.2 + right.inquiryCount * 1.6;
      const leftWeight = left.savedCount * 1.2 + left.inquiryCount * 1.6;
      if (Math.abs(rightWeight - leftWeight) > 0.001) {
        return rightWeight - leftWeight;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
    .slice(0, 3)
    .map((listing) => ({
      type: "deal" as const,
      id: `deal-${listing.id}`,
      title: "Marketplace deal",
      description: `${listing.title} is moving fast on campus.`,
      listing,
      request: null
    }));

  if (marketPromos.length === 0) {
    const fallbackRequest = [...marketRequests]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];

    if (fallbackRequest) {
      marketPromos.push({
        type: "deal",
        id: `deal-${fallbackRequest.id}`,
        title: "Marketplace signal",
        description: `${fallbackRequest.title} is getting attention right now.`,
        listing: null,
        request: fallbackRequest
      });
    }
  }

  const promoPool = marketPromos
    .flatMap((promo, index) => (squadPromos[index] ? [promo, squadPromos[index]] : [promo]))
    .concat(squadPromos.slice(marketPromos.length));

  const gridItems: DiscoveryGridItem[] = [];
  let contentIndex = 0;
  let promoIndex = 0;

  while (contentIndex < rankedItems.length && gridItems.length < 18) {
    const nextPosition = gridItems.length + 1;
    if (nextPosition % 5 === 0 && promoPool[promoIndex]) {
      const promo = promoPool[promoIndex];
      gridItems.push({
        type: "promo",
        id: promo.id,
        entry: promo
      });
      promoIndex += 1;
      continue;
    }

    const rankedItem = rankedItems[contentIndex];
    gridItems.push({
      type: "content",
      id: rankedItem.id,
      entry: rankedItem
    });
    contentIndex += 1;
  }

  while (promoIndex < promoPool.length && gridItems.length > 0 && gridItems.length < 20) {
    const nextPosition = gridItems.length + 1;
    if (nextPosition % 5 !== 0) {
      break;
    }

    const promo = promoPool[promoIndex];
    gridItems.push({
      type: "promo",
      id: promo.id,
      entry: promo
    });
    promoIndex += 1;
  }

  return {
    trendingProfiles,
    gridItems
  } satisfies DiscoveryViewModel;
}

function DiscoverySkeleton() {
  return (
    <>
      <div className="vyb-search-trending-strip">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`avatar-skeleton-${index}`} className="vyb-search-avatar-skeleton-card">
            <div className="vyb-search-avatar-skeleton" />
            <div className="vyb-search-avatar-skeleton-line" />
          </div>
        ))}
      </div>

      <div className="vyb-search-discovery-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`grid-skeleton-${index}`}
            className={`vyb-search-grid-skeleton${index % 3 === 1 ? " is-tall" : ""}${index === 4 ? " is-wide" : ""}`}
          />
        ))}
      </div>
    </>
  );
}

export function CampusSearchShell({
  initialQuery,
  results,
  viewerUsername,
  hasSearched,
  initialFeedItems,
  initialVibeItems,
  suggestedUsers,
  marketListings,
  marketRequests
}: CampusSearchShellProps) {
  const router = useRouter();
  const scrollContentRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState(results);
  const [busyUsername, setBusyUsername] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [loadedMediaIds, setLoadedMediaIds] = useState<Record<string, true>>({});
  const [discoveryModel, setDiscoveryModel] = useState<DiscoveryViewModel | null>(null);

  const hasActiveQuery = query.trim().length > 0;
  const baseDiscoveryInputs = useMemo(
    () => ({
      initialFeedItems,
      initialVibeItems,
      suggestedUsers,
      marketListings,
      marketRequests
    }),
    [initialFeedItems, initialVibeItems, marketListings, marketRequests, suggestedUsers]
  );

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setItems(results);
  }, [results]);

  useEffect(() => {
    setDiscoveryModel(null);
    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        setDiscoveryModel(
          buildDiscoveryViewModel(
            baseDiscoveryInputs.initialFeedItems,
            baseDiscoveryInputs.initialVibeItems,
            baseDiscoveryInputs.suggestedUsers,
            baseDiscoveryInputs.marketListings,
            baseDiscoveryInputs.marketRequests
          )
        );
      });
    }, 140);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [baseDiscoveryInputs]);

  useEffect(() => {
    restoreSearchScrollPosition(scrollContentRef.current);
  }, []);

  useEffect(() => {
    const container = scrollContentRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      captureSearchScrollPosition(container.scrollTop);
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const nextUrl = new URL(window.location.href);
    if (trimmedQuery) {
      nextUrl.searchParams.set("q", trimmedQuery);
    } else {
      nextUrl.searchParams.delete("q");
    }

    window.history.replaceState(window.history.state, "", nextUrl.toString());

    if (!trimmedQuery) {
      setItems([]);
      setMessage(null);
      setIsSearching(false);
      return;
    }

    if (trimmedQuery === initialQuery.trim() && hasSearched) {
      setItems(results);
      setMessage(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setMessage(null);

      try {
        const response = await fetch(`/api/search-users?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              items?: UserSearchItem[];
              error?: {
                message?: string;
              };
            }
          | null;

        if (!response.ok) {
          setItems([]);
          setMessage(payload?.error?.message ?? "We could not search campus profiles right now.");
          return;
        }

        setItems(payload?.items ?? []);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setItems([]);
        setMessage(error instanceof Error ? error.message : "We could not search campus profiles right now.");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [hasSearched, initialQuery, query, results]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function handleSearchDestination(href: string, targetType: "profile" | "post" | "vibe", targetId?: string) {
    captureSearchScrollPosition(scrollContentRef.current?.scrollTop ?? 0);
    queueAppRouteOrigin(href);
    queueSearchNavigationOrigin(href, {
      targetType,
      targetId
    });
    router.push(href);
  }

  function handleProfileOpen(username: string) {
    const href = getProfileHref(username, viewerUsername);
    handleSearchDestination(href, "profile");
  }

  async function handleFollowToggle(username: string, shouldFollow: boolean) {
    setBusyUsername(username);
    setMessage(null);

    try {
      const response = await fetch(`/api/follows/${encodeURIComponent(username)}`, {
        method: shouldFollow ? "PUT" : "DELETE"
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setMessage(payload?.error?.message ?? "We could not update that follow right now.");
        return;
      }

      setItems((current) =>
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
    } finally {
      setBusyUsername(null);
    }
  }

  function markMediaLoaded(id: string) {
    setLoadedMediaIds((current) => {
      if (current[id]) {
        return current;
      }

      return {
        ...current,
        [id]: true
      };
    });
  }

  return (
    <main className="vyb-search-page-modern">
      <div className="vyb-search-top-bar">
        <Link href="/home" className="search-back-btn" aria-label="Back to campus feed">
          <BackIcon />
        </Link>

        <form className="modern-search-form" onSubmit={handleSearchSubmit}>
          <div className="modern-search-input-wrap">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search student names or roll numbers..."
              autoFocus
              spellCheck={false}
            />
          </div>
        </form>
      </div>

      <div ref={scrollContentRef} className="search-scroll-content">
        {message ? <p className="vyb-inline-message is-error">{message}</p> : null}

        <AnimatePresence mode="wait" initial={false}>
          {hasActiveQuery ? (
            <motion.section
              key="search-results"
              className="search-section"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <div className="section-head">
                <div>
                  <h2>Campus matches</h2>
                  <span>Live results for names and campus IDs</span>
                </div>
                <span>{isSearching ? "Refreshing..." : `${items.length} students`}</span>
              </div>

              <div className="search-results-list">
                {items.map((item, index) => {
                  const profileHref = getProfileHref(item.username, viewerUsername);

                  return (
                    <motion.article
                      key={item.userId}
                      className="modern-search-card"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(index * 0.04, 0.2), duration: 0.2 }}
                    >
                      <button type="button" className="search-card-avatar" onClick={() => handleSearchDestination(profileHref, "profile")}>
                        <CampusAvatarContent
                          userId={item.userId}
                          username={item.username}
                          displayName={item.displayName}
                          avatarUrl={item.avatarUrl ?? null}
                          fallback={getInitials(item.displayName || item.username)}
                          decorative
                        />
                      </button>

                      <div className="search-card-info">
                        <button type="button" className="search-card-link" onClick={() => handleSearchDestination(profileHref, "profile")}>
                          <strong>{item.displayName || item.username}</strong>
                          <span>@{item.username}</span>
                        </button>
                        <p>{item.course} • {item.stream}</p>
                        <small>Campus ID / roll lookup: @{item.username}</small>
                      </div>

                      <button
                        type="button"
                        className={`modern-follow-btn${item.isFollowing ? " is-following" : ""}`}
                        disabled={busyUsername === item.username || item.username === viewerUsername}
                        onClick={() => handleFollowToggle(item.username, !item.isFollowing)}
                      >
                        {item.username === viewerUsername ? "You" : item.isFollowing ? "Following" : "Follow"}
                      </button>
                    </motion.article>
                  );
                })}
              </div>

              {!isSearching && items.length === 0 ? (
                <div className="search-explore-prompt is-compact">
                  <strong>No exact lane match yet</strong>
                  <p>Try a fuller name, username, or the campus ID your classmates already use.</p>
                </div>
              ) : null}
            </motion.section>
          ) : (
            <motion.div
              key="discovery"
              className="vyb-search-discovery-stack"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <section className="search-section trending-section">
                <div className="section-head">
                  <div className="icon-label">
                    <TrendingIcon />
                    <div>
                      <h2>Trending profiles</h2>
                      <span>Fresh momentum from the last campus wave</span>
                    </div>
                  </div>
                </div>

                {!discoveryModel ? (
                  <DiscoverySkeleton />
                ) : (
                  <div className="vyb-search-trending-strip" role="list" aria-label="Trending campus profiles">
                    {discoveryModel.trendingProfiles.map((profile, index) => (
                      <motion.button
                        key={profile.userId}
                        type="button"
                        className="vyb-search-trending-avatar-card"
                        onClick={() => handleProfileOpen(profile.username)}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.05, 0.18), duration: 0.22 }}
                      >
                        <span className={`vyb-search-trending-avatar-shell${profile.isGlowing ? " is-glowing" : ""}`}>
                          <span className="vyb-search-trending-badge">🔥 #{profile.rank}</span>
                          <span className="vyb-search-trending-avatar">
                            <CampusAvatarContent
                              userId={profile.userId}
                              username={profile.username}
                              displayName={profile.displayName}
                              avatarUrl={profile.avatarUrl ?? null}
                              fallback={getInitials(profile.displayName)}
                              decorative
                            />
                          </span>
                        </span>
                        <strong>{profile.displayName}</strong>
                        <span>@{profile.username}</span>
                      </motion.button>
                    ))}
                  </div>
                )}
              </section>

              <section className="search-section">
                <div className="section-head">
                  <div className="icon-label">
                    <SparkIcon />
                    <div>
                      <h2>Campus discovery hub</h2>
                      <span>Momentum-ranked posts, vibes, deals, and squad prompts</span>
                    </div>
                  </div>
                  <span>Freshest six-hour velocity first</span>
                </div>

                {!discoveryModel ? (
                  <DiscoverySkeleton />
                ) : discoveryModel.gridItems.length === 0 ? (
                  <div className="search-explore-prompt">
                    <strong>Campus discovery is warming up</strong>
                    <p>Once posts, vibes, and market activity start moving, this hub will rank them here automatically.</p>
                  </div>
                ) : (
                  <div className="vyb-search-discovery-grid">
                    {discoveryModel.gridItems.map((gridItem, index) => {
                      if (gridItem.type === "promo") {
                        const promo = gridItem.entry;

                        if (promo.type === "squad") {
                          return (
                            <motion.article
                              key={gridItem.id}
                              className="vyb-search-discovery-card is-promo is-squad"
                              initial={{ opacity: 0, y: 18 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.min(index * 0.03, 0.24), duration: 0.22 }}
                            >
                              <div className="vyb-search-promo-head">
                                <span className="vyb-search-promo-chip">
                                  <SparkIcon />
                                  {promo.title}
                                </span>
                              </div>
                              <strong>{promo.description}</strong>
                              <div className="vyb-search-squad-stack">
                                {promo.people.map((person) => (
                                  <button
                                    key={person.userId}
                                    type="button"
                                    className="vyb-search-squad-person"
                                    onClick={() => handleProfileOpen(person.username)}
                                  >
                                    <span className="vyb-search-squad-avatar">
                                      <CampusAvatarContent
                                        userId={person.userId}
                                        username={person.username}
                                        displayName={person.displayName}
                                        avatarUrl={person.avatarUrl ?? null}
                                        fallback={getInitials(person.displayName)}
                                        decorative
                                      />
                                    </span>
                                    <span>
                                      <strong>{person.displayName}</strong>
                                      <small>{person.course} • {person.stream}</small>
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </motion.article>
                          );
                        }

                        const marketLabel = promo.listing
                          ? `${promo.listing.category} • ${formatMetric(promo.listing.savedCount + promo.listing.inquiryCount)} signals`
                          : `${promo.request?.category ?? "Campus request"} • ${formatMetric(promo.request?.responseCount ?? 0)} responses`;
                        const marketTitle = promo.listing?.title ?? promo.request?.title ?? "Campus signal";
                        const marketAmount = promo.listing
                          ? `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(promo.listing.priceAmount)}`
                          : promo.request?.budgetLabel ?? "Flexible";

                        return (
                          <motion.button
                            key={gridItem.id}
                            type="button"
                            className="vyb-search-discovery-card is-promo is-deal"
                            onClick={() => {
                              queueAppRouteOrigin("/market");
                              router.push("/market");
                            }}
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(index * 0.03, 0.24), duration: 0.22 }}
                          >
                            <div className="vyb-search-promo-head">
                              <span className="vyb-search-promo-chip">
                                <DealIcon />
                                Marketplace deal
                              </span>
                              <span className="vyb-search-promo-meta">{marketAmount}</span>
                            </div>
                            <strong>{marketTitle}</strong>
                            <p>{promo.description}</p>
                            <small>{marketLabel}</small>
                          </motion.button>
                        );
                      }

                      const entry = gridItem.entry;
                      const media = entry.item.media?.[0]?.url ?? entry.item.mediaUrl;
                      const isTall = entry.type === "vibe";
                      const isLoaded = !media || Boolean(loadedMediaIds[entry.id]);

                      return (
                        <motion.button
                          key={gridItem.id}
                          type="button"
                          className={`vyb-search-discovery-card${isTall ? " is-tall" : " is-square"}`}
                          onClick={() => handleSearchDestination(entry.href, entry.type, entry.id)}
                          initial={{ opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(index * 0.025, 0.26), duration: 0.22 }}
                        >
                          <div className={`vyb-search-discovery-media${isLoaded ? " is-loaded" : ""}`}>
                            {!isLoaded ? <span className="vyb-search-media-skeleton" aria-hidden="true" /> : null}

                            {media ? (
                              entry.item.kind === "video" ? (
                                <video
                                  src={media}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  onLoadedData={() => markMediaLoaded(entry.id)}
                                />
                              ) : (
                                <img src={media} alt={entry.item.title || entry.item.body || entry.item.author.displayName} loading="lazy" onLoad={() => markMediaLoaded(entry.id)} />
                              )
                            ) : (
                              <div className="vyb-search-discovery-fallback">
                                <strong>{entry.item.title || "Campus drop"}</strong>
                                <p>{entry.item.body}</p>
                              </div>
                            )}

                            {entry.type === "vibe" ? (
                              <span className="vyb-search-vibe-pill">
                                <PlayIcon />
                                Vibe
                              </span>
                            ) : null}
                          </div>

                          <div className="vyb-search-discovery-overlay">
                            <div className="vyb-search-discovery-author">
                              <span className="vyb-search-discovery-author-avatar">
                                <CampusAvatarContent
                                  userId={entry.item.author.userId}
                                  username={entry.item.author.username}
                                  displayName={entry.item.author.displayName}
                                  avatarUrl={entry.item.author.avatarUrl ?? null}
                                  fallback={getInitials(entry.item.author.displayName)}
                                  decorative
                                />
                              </span>
                              <span>
                                <strong>{entry.item.author.displayName}</strong>
                                <small>@{entry.item.author.username}</small>
                              </span>
                            </div>

                            <div className="vyb-search-discovery-copy">
                              <strong>{entry.item.title || entry.item.body || "Campus moment"}</strong>
                              <p>{entry.item.body}</p>
                            </div>

                            <div className="vyb-search-discovery-meta">
                              <span>🔥 #{entry.trendingRank}</span>
                              <span>{formatMetric(entry.item.reactions)} likes</span>
                              <span>{formatMetric(entry.item.comments)} comments</span>
                              <span>{formatAge(entry.item.createdAt)}</span>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </section>

              <div className="search-explore-prompt">
                <strong>Explore your campus lane</strong>
                <p>Jump from student names to fresh vibes, squad suggestions, and live market momentum in one scroll.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
