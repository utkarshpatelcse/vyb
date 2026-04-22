"use client";

import type { FeedCard, PostLikerItem } from "@vyb/contracts";
import { animate, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SocialPostActionSheet } from "./social-post-action-sheet";
import { SocialPostLightbox } from "./social-post-lightbox";
import { SocialPostLikersSheet } from "./social-post-likers-sheet";
import { SocialThreadSheet } from "./social-thread-sheet";
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
      <path
        d="M7 3v3M17 3v3M5 8h14M6 5h12a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function ReelsIcon() {
  return (
    <IconBase>
      <path
        d="M6.5 3h11A3.5 3.5 0 0 1 21 6.5v11a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 17.5v-11A3.5 3.5 0 0 1 6.5 3Zm0 0 3 4M11.5 3l3 4M16.5 3l3 4M10 10.5l5 2.9L10 16.3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function MarketIcon() {
  return (
    <IconBase>
      <path
        d="M4 8.5 5.6 4h12.8L20 8.5M5 10v7.2A1.8 1.8 0 0 0 6.8 19h10.4A1.8 1.8 0 0 0 19 17.2V10M9 13h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function ProfileIcon() {
  return (
    <IconBase>
      <path
        d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7.2C6 16.9 8.7 15 12 15s6 1.9 6 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function SearchIcon() {
  return (
    <IconBase>
      <path
        d="m20 20-3.8-3.8M10.8 17a6.2 6.2 0 1 1 0-12.4 6.2 6.2 0 0 1 0 12.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function PlusIcon() {
  return (
    <IconBase>
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function HeartIcon() {
  return (
    <IconBase>
      <path
        d="M12 20.4s-6.6-4.3-8.6-8A4.8 4.8 0 0 1 11 6.9L12 8l1-1.1a4.8 4.8 0 0 1 7.6 5.5c-2 3.7-8.6 8-8.6 8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function HeartBurstIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vyb-vibes-double-heart-icon">
      <path
        d="M12 20.4s-6.6-4.3-8.6-8A4.8 4.8 0 0 1 11 6.9L12 8l1-1.1a4.8 4.8 0 0 1 7.6 5.5c-2 3.7-8.6 8-8.6 8Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <IconBase>
      <path
        d="M5.8 17.8a7.7 7.7 0 1 1 3 1.1L4 20l1.8-4.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function RepostIcon() {
  return (
    <IconBase>
      <path
        d="M7 7.5h8.8L13.6 5M17 16.5H8.2l2.2 2.5M17 7v4.2M7 12.8V17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function MenuIcon() {
  return (
    <IconBase>
      <path d="M12 6h.01M12 12h.01M12 18h.01" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function VolumeOnIcon() {
  return (
    <IconBase>
      <path
        d="M6.8 14.5H4.5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h2.3L11.5 6v12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15.5 9.5a4 4 0 0 1 0 5M18 7a7 7 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </IconBase>
  );
}

function VolumeMutedIcon() {
  return (
    <IconBase>
      <path
        d="M6.8 14.5H4.5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h2.3L11.5 6v12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m15 9 4 4M19 9l-4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </IconBase>
  );
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: value > 999 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() ?? "")
    .join("");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
  const prefersReducedMotion = useReducedMotion();
  const feedRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const scrollRafRef = useRef<number | null>(null);
  const snapAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const snappingRef = useRef(false);
  const lastTapRef = useRef<{
    postId: string | null;
    timestamp: number;
  }>({
    postId: null,
    timestamp: 0
  });

  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [heartBurstPostId, setHeartBurstPostId] = useState<string | null>(null);
  const [lightboxPost, setLightboxPost] = useState<FeedCard | null>(null);
  const [likesPost, setLikesPost] = useState<FeedCard | null>(null);
  const [likesByPost, setLikesByPost] = useState<Record<string, PostLikerItem[]>>({});
  const [likesLoadingPostId, setLikesLoadingPostId] = useState<string | null>(null);
  const [likesMessage, setLikesMessage] = useState<string | null>(null);
  const [actionPost, setActionPost] = useState<FeedCard | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progressByPost, setProgressByPost] = useState<Record<string, number>>({});

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

  const identityLine = [course, stream].filter(Boolean).join(" / ") || `${collegeName} • ${role}`;
  const campusBadge = `@${viewerEmail.split("@")[1] ?? "campus"}`;
  const activePost = engagement.posts[clamp(activeIndex, 0, Math.max(engagement.posts.length - 1, 0))] ?? null;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 960px)");
    const applyDesktopState = () => setIsDesktop(mediaQuery.matches);
    applyDesktopState();
    mediaQuery.addEventListener("change", applyDesktopState);
    return () => mediaQuery.removeEventListener("change", applyDesktopState);
  }, []);

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
    if (!heartBurstPostId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHeartBurstPostId(null);
    }, 720);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [heartBurstPostId]);

  useEffect(() => {
    if (engagement.posts.length === 0) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((current) => clamp(current, 0, engagement.posts.length - 1));
  }, [engagement.posts.length]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) {
      return;
    }

    const handleScroll = () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }

      scrollRafRef.current = window.requestAnimationFrame(() => {
        const nextIndex = clamp(Math.round(feed.scrollTop / Math.max(feed.clientHeight, 1)), 0, Math.max(engagement.posts.length - 1, 0));
        setActiveIndex(nextIndex);
      });
    };

    feed.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      feed.removeEventListener("scroll", handleScroll);
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, [engagement.posts.length]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || engagement.posts.length === 0) {
      return;
    }

    if (snapAnimationRef.current) {
      snapAnimationRef.current.stop();
    }

    const targetTop = feed.clientHeight * activeIndex;
    if (Math.abs(feed.scrollTop - targetTop) < 2) {
      return;
    }

    if (prefersReducedMotion) {
      feed.scrollTo({ top: targetTop });
      return;
    }

    snappingRef.current = true;
    snapAnimationRef.current = animate(feed, { scrollTop: targetTop }, {
      type: "spring",
      stiffness: 138,
      damping: 28,
      mass: 0.95,
      onComplete: () => {
        snappingRef.current = false;
      }
    });

    return () => {
      snapAnimationRef.current?.stop();
      snappingRef.current = false;
    };
  }, [activeIndex, engagement.posts.length, prefersReducedMotion]);

  useEffect(() => {
    const onResize = () => {
      const feed = feedRef.current;
      if (!feed) {
        return;
      }

      feed.scrollTo({
        top: activeIndex * feed.clientHeight
      });
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeIndex]);

  useEffect(() => {
    for (const post of engagement.posts) {
      const video = videoRefs.current[post.id];
      if (!video) {
        continue;
      }

      const isActive = activePost?.id === post.id;
      video.muted = isMuted || !isActive;

      if (isActive) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => null);
        }
      } else {
        video.pause();
      }
    }
  }, [activePost?.id, engagement.posts, isMuted]);

  function syncMirroredPost(postId: string, updater: (post: FeedCard) => FeedCard) {
    setLightboxPost((current) => (current?.id === postId ? updater(current) : current));
    setLikesPost((current) => (current?.id === postId ? updater(current) : current));
    setActionPost((current) => (current?.id === postId ? updater(current) : current));
  }

  function removeMirroredPost(postId: string) {
    setLightboxPost((current) => (current?.id === postId ? null : current));
    setLikesPost((current) => (current?.id === postId ? null : current));
    setActionPost((current) => (current?.id === postId ? null : current));
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!isDesktop || engagement.posts.length <= 1) {
      return;
    }

    event.preventDefault();

    if (snappingRef.current || Math.abs(event.deltaY) < 28) {
      return;
    }

    setActiveIndex((current) => clamp(current + (event.deltaY > 0 ? 1 : -1), 0, engagement.posts.length - 1));
  }

  function handleMediaTap(post: FeedCard) {
    const now = Date.now();
    if (lastTapRef.current.postId === post.id && now - lastTapRef.current.timestamp < 260) {
      void handlePostLike(post, true);
      lastTapRef.current = {
        postId: null,
        timestamp: 0
      };
      return;
    }

    lastTapRef.current = {
      postId: post.id,
      timestamp: now
    };
  }

  async function handlePostLike(post: FeedCard, triggerBurst = false) {
    if (triggerBurst) {
      setHeartBurstPostId(post.id);
    }

    const reaction = await engagement.react(post.id);
    if (!reaction) {
      setFlashMessage("We could not update that vibe right now.");
      return;
    }

    syncMirroredPost(post.id, (current) => ({
      ...current,
      reactions: reaction.aggregateCount,
      viewerReactionType: (reaction.viewerReactionType ?? null) as FeedCard["viewerReactionType"]
    }));
    setLikesByPost((current) => {
      const next = { ...current };
      delete next[post.id];
      return next;
    });
  }

  async function openPostLightbox(post: FeedCard) {
    setLightboxPost(post);
    void engagement.loadComments(post.id);
  }

  async function openPostLikes(post: FeedCard) {
    setLikesPost(post);
    setLikesMessage(null);

    if (likesByPost[post.id]) {
      return;
    }

    setLikesLoadingPostId(post.id);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}/likes`);
      const payload = (await response.json().catch(() => null)) as
        | {
            items?: PostLikerItem[];
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok) {
        setLikesMessage(payload?.error?.message ?? "We could not load the like list right now.");
        return;
      }

      setLikesByPost((current) => ({
        ...current,
        [post.id]: payload?.items ?? []
      }));
    } catch {
      setLikesMessage("We could not load the like list right now.");
    } finally {
      setLikesLoadingPostId(null);
    }
  }

  async function handleDirectRepost(post: FeedCard) {
    setActionBusy(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}/repost`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ placement: "vibe" })
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
        const nextMessage = payload?.error?.message ?? "We could not repost this vibe right now.";
        setActionMessage(nextMessage);
        setFlashMessage(nextMessage);
        return;
      }

      engagement.prependPost(payload.item);
      setActionPost(null);
      setFlashMessage("Vibe reposted to your lane.");
    } catch {
      setActionMessage("We could not repost this vibe right now.");
      setFlashMessage("We could not repost this vibe right now.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleQuoteRepost(post: FeedCard, quote: string) {
    setActionBusy(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}/repost`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          quote,
          placement: "vibe"
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
        setActionMessage(payload?.error?.message ?? "We could not quote repost this vibe right now.");
        return;
      }

      engagement.prependPost(payload.item);
      setActionPost(null);
      setFlashMessage("Quote repost added to vibes.");
    } catch {
      setActionMessage("We could not quote repost this vibe right now.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDeletePost(post: FeedCard) {
    setActionBusy(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            deleted?: boolean;
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || payload?.deleted !== true) {
        setActionMessage(payload?.error?.message ?? "We could not delete this vibe right now.");
        return;
      }

      engagement.removePost(post.id);
      removeMirroredPost(post.id);
      setActionPost(null);
      setFlashMessage("Vibe deleted.");
    } catch {
      setActionMessage("We could not delete this vibe right now.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReportPost(post: FeedCard, reason: string) {
    setActionBusy(true);
    setActionMessage(null);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          targetType: "post",
          targetId: post.id,
          reason
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
        setActionMessage(payload?.error?.message ?? "We could not submit that report right now.");
        return;
      }

      setActionPost(null);
      setFlashMessage("Report submitted for review.");
    } catch {
      setActionMessage("We could not submit that report right now.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCopyPostLink(post: FeedCard) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#post-${post.id}`);
      setActionPost(null);
      setFlashMessage("Share link copied.");
    } catch {
      setActionMessage("We could not copy that link right now.");
      setFlashMessage("We could not copy that link right now.");
    }
  }

  async function handleEditPost(post: FeedCard, payload: { title: string | null; body: string; location: string | null }) {
    setActionBusy(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = (await response.json().catch(() => null)) as
        | {
            item?: FeedCard;
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !data?.item) {
        setActionMessage(data?.error?.message ?? "We could not update this vibe right now.");
        return;
      }

      engagement.replacePost(data.item);
      syncMirroredPost(post.id, () => data.item!);
      setActionPost(null);
      setFlashMessage("Vibe updated.");
    } catch {
      setActionMessage("We could not update this vibe right now.");
    } finally {
      setActionBusy(false);
    }
  }

  function handleVideoProgress(postId: string, element: HTMLVideoElement | null) {
    if (!element) {
      return;
    }

    const nextProgress = element.duration > 0 ? element.currentTime / element.duration : 0;
    setProgressByPost((current) => {
      const previous = current[postId] ?? 0;
      if (Math.abs(previous - nextProgress) < 0.01) {
        return current;
      }

      return {
        ...current,
        [postId]: nextProgress
      };
    });
  }

  return (
    <main className="vyb-vibes-theater-page">
      <div className="vyb-vibes-theater-backdrop" aria-hidden="true">
        {isDesktop && activePost?.mediaUrl ? (
          activePost.kind === "video" ? (
            <video key={activePost.id} src={activePost.mediaUrl} autoPlay muted loop playsInline className="vyb-vibes-theater-backdrop-media" />
          ) : (
            <img key={activePost.id} src={activePost.mediaUrl} alt="" className="vyb-vibes-theater-backdrop-media" />
          )
        ) : null}
        <div className="vyb-vibes-theater-backdrop-wash" />
      </div>

      <header className="vyb-vibes-topbar">
        <div className="vyb-vibes-topbar-copy">
          <Link href="/home" className="vyb-vibes-brand">
            VYB
          </Link>
          <div>
            <strong>Campus vibes</strong>
            <span>{identityLine}</span>
          </div>
        </div>

        <div className="vyb-vibes-topbar-actions">
          <Link href="/search" className="vyb-vibes-topbar-icon" aria-label="Search campus">
            <SearchIcon />
          </Link>
          <Link href="/create?kind=vibe&from=%2Fvibes" className="vyb-vibes-topbar-icon is-primary" aria-label="Upload vibe">
            <PlusIcon />
          </Link>
          <Link href="/dashboard" className="vyb-vibes-viewer-chip">
            <span className="vyb-vibes-viewer-avatar">{getInitials(viewerName || viewerUsername)}</span>
            <span className="vyb-vibes-viewer-copy">
              <strong>{viewerName}</strong>
              <span>@{viewerUsername}</span>
            </span>
          </Link>
        </div>
      </header>

      {flashMessage ? <div className="vyb-campus-flash-message vyb-vibes-flash">{flashMessage}</div> : null}

      <section className="vyb-vibes-stage-shell">
        {engagement.posts.length === 0 ? (
          <div className="vyb-vibes-empty-state">
            <span className="vyb-vibes-empty-kicker">Vibes</span>
            <strong>No vibes live yet</strong>
            <p>Upload the first campus vibe and turn this lane into a live theater.</p>
            <Link href="/create?kind=vibe&from=%2Fvibes" className="vyb-vibes-empty-cta">
              <PlusIcon />
              <span>Upload vibe</span>
            </Link>
          </div>
        ) : (
          <div ref={feedRef} className="vyb-vibes-feed" onWheel={handleWheel}>
            {engagement.posts.map((item, index) => {
              const isActive = activePost?.id === item.id;
              const profileHref = item.author.username === viewerUsername ? "/dashboard" : `/u/${encodeURIComponent(item.author.username)}`;
              const progress = progressByPost[item.id] ?? 0;

              return (
                <section key={item.id} id={`post-${item.id}`} className="vyb-vibes-slide">
                  <motion.article
                    className={`vyb-vibes-stage${isActive ? " is-active" : ""}`}
                    initial={false}
                    animate={{
                      opacity: isActive ? 1 : isDesktop ? 0.75 : 1,
                      scale: isActive || !isDesktop ? 1 : 0.95
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 170,
                      damping: 26
                    }}
                  >
                    <div
                      className="vyb-vibes-stage-media-shell"
                      onClick={() => handleMediaTap(item)}
                      onDoubleClick={() => void handlePostLike(item, true)}
                      role="presentation"
                    >
                      {item.mediaUrl ? (
                        item.kind === "video" ? (
                          <video
                            ref={(node) => {
                              videoRefs.current[item.id] = node;
                            }}
                            src={item.mediaUrl}
                            className="vyb-vibes-stage-media"
                            playsInline
                            loop
                            muted={isMuted}
                            preload={isActive ? "auto" : "metadata"}
                            onTimeUpdate={(event) => handleVideoProgress(item.id, event.currentTarget)}
                            onLoadedMetadata={(event) => handleVideoProgress(item.id, event.currentTarget)}
                          />
                        ) : (
                          <img src={item.mediaUrl} alt={item.body || item.title} className="vyb-vibes-stage-media" />
                        )
                      ) : (
                        <div className="vyb-vibes-stage-fallback">
                          <strong>{item.title || "Campus vibe"}</strong>
                          <p>{item.body}</p>
                        </div>
                      )}

                      <div className="vyb-vibes-stage-gradient" />

                      {item.kind === "video" ? (
                        <button
                          type="button"
                          className="vyb-vibes-volume-toggle"
                          aria-label={isMuted ? "Unmute active vibe" : "Mute active vibe"}
                          onClick={(event) => {
                            event.stopPropagation();
                            setIsMuted((current) => !current);
                          }}
                        >
                          {isMuted ? <VolumeMutedIcon /> : <VolumeOnIcon />}
                        </button>
                      ) : null}

                      {heartBurstPostId === item.id ? (
                        <span className="vyb-vibes-double-heart" aria-hidden="true">
                          <HeartBurstIcon />
                        </span>
                      ) : null}

                      <motion.div
                        className="vyb-vibes-overlay-copy"
                        initial={false}
                        animate={{
                          opacity: isActive ? 1 : 0.7,
                          y: isActive ? 0 : 10
                        }}
                        transition={{ type: "spring", stiffness: 190, damping: 24 }}
                      >
                        <div className="vyb-vibes-author-row">
                          <Link href={profileHref} className="vyb-vibes-author-avatar" aria-label={`Open ${item.author.displayName} profile`}>
                            {getInitials(item.author.displayName)}
                          </Link>
                          <div className="vyb-vibes-author-copy">
                            <Link href={profileHref}>
                              <strong>{item.author.displayName}</strong>
                            </Link>
                            <span>@{item.author.username}</span>
                          </div>
                          <span className="vyb-vibes-campus-badge">{campusBadge}</span>
                        </div>
                        <p className="vyb-vibes-caption">{item.body}</p>
                        <div className="vyb-vibes-stage-meta">
                          <span>{collegeName}</span>
                          <span>{formatMetric(item.reactions)} likes</span>
                          <button type="button" onClick={() => void openPostLikes(item)}>
                            See likes
                          </button>
                        </div>
                      </motion.div>

                      <motion.div
                        className="vyb-vibes-action-rail"
                        initial={false}
                        animate={{
                          opacity: isActive ? 1 : 0.78,
                          x: isActive ? 0 : 8
                        }}
                        transition={{ type: "spring", stiffness: 190, damping: 25 }}
                      >
                        <button
                          type="button"
                          className={`vyb-vibes-action-button${item.viewerReactionType === "like" ? " is-active" : ""}`}
                          disabled={engagement.loadingPostId === item.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handlePostLike(item, true);
                          }}
                        >
                          <HeartIcon />
                          <span>{formatMetric(item.reactions)}</span>
                        </button>
                        <button
                          type="button"
                          className="vyb-vibes-action-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void engagement.openThread(item.id);
                          }}
                        >
                          <CommentIcon />
                          <span>{formatMetric(item.comments)}</span>
                        </button>
                        <button
                          type="button"
                          className="vyb-vibes-action-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDirectRepost(item);
                          }}
                        >
                          <RepostIcon />
                          <span>Repost</span>
                        </button>
                        <button
                          type="button"
                          className="vyb-vibes-action-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleCopyPostLink(item);
                          }}
                        >
                          <ShareIcon />
                          <span>Share</span>
                        </button>
                        <button
                          type="button"
                          className="vyb-vibes-action-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setActionMessage(null);
                            setActionPost(item);
                          }}
                        >
                          <MenuIcon />
                          <span>More</span>
                        </button>
                      </motion.div>

                      <span className="vyb-vibes-progress-line" aria-hidden="true">
                        <span style={{ transform: `scaleX(${item.kind === "video" ? progress : isActive ? 1 : 0})` }} />
                      </span>
                    </div>
                  </motion.article>
                </section>
              );
            })}
          </div>
        )}
      </section>

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
        mediaUrl={engagement.threadMediaUrl}
        mediaType={engagement.threadMediaType}
        replyTarget={engagement.threadReplyTarget}
        message={engagement.threadMessage}
        isLoading={engagement.threadLoading}
        isSubmitting={engagement.threadSubmitting}
        onClose={engagement.closeThread}
        onDraftChange={engagement.setThreadDraft}
        onMediaUrlChange={engagement.setThreadMediaUrl}
        onMediaTypeChange={engagement.setThreadMediaType}
        onReply={engagement.beginReply}
        onCommentLike={(commentId) => {
          void engagement.reactToComment(commentId);
        }}
        onClearReply={engagement.clearReplyTarget}
        onSubmit={() => void engagement.submitComment()}
      />

      <SocialPostLightbox
        post={lightboxPost}
        comments={lightboxPost ? engagement.commentsByPost[lightboxPost.id] ?? [] : []}
        isCommentsLoading={engagement.threadLoading}
        viewerUsername={viewerUsername}
        isLiking={lightboxPost ? engagement.loadingPostId === lightboxPost.id : false}
        showHeartBurst={lightboxPost ? heartBurstPostId === lightboxPost.id : false}
        onClose={() => setLightboxPost(null)}
        onLike={() => {
          if (lightboxPost) {
            void handlePostLike(lightboxPost, true);
          }
        }}
        onOpenComments={() => {
          if (!lightboxPost) {
            return;
          }

          setLightboxPost(null);
          void engagement.openThread(lightboxPost.id);
        }}
        onOpenLikes={() => {
          if (lightboxPost) {
            void openPostLikes(lightboxPost);
          }
        }}
        onOpenActions={() => {
          if (lightboxPost) {
            setActionPost(lightboxPost);
          }
        }}
      />

      <SocialPostLikersSheet
        post={likesPost}
        items={likesPost ? likesByPost[likesPost.id] ?? [] : []}
        isLoading={likesPost ? likesLoadingPostId === likesPost.id : false}
        message={likesMessage}
        onClose={() => setLikesPost(null)}
      />

      <SocialPostActionSheet
        post={actionPost}
        isOwner={Boolean(actionPost && actionPost.author.username === viewerUsername)}
        isBusy={actionBusy}
        message={actionMessage}
        onClose={() => setActionPost(null)}
        onOpenDetail={() => {
          if (actionPost) {
            setActionPost(null);
            void openPostLightbox(actionPost);
          }
        }}
        onDirectRepost={() => {
          if (actionPost) {
            void handleDirectRepost(actionPost);
          }
        }}
        onQuoteRepost={(quote) => {
          if (actionPost) {
            void handleQuoteRepost(actionPost, quote);
          }
        }}
        onEdit={(payload) => {
          if (actionPost) {
            void handleEditPost(actionPost, payload);
          }
        }}
        onDelete={() => {
          if (actionPost) {
            void handleDeletePost(actionPost);
          }
        }}
        onReport={(reason) => {
          if (actionPost) {
            void handleReportPost(actionPost, reason);
          }
        }}
        onCopyLink={() => {
          if (actionPost) {
            void handleCopyPostLink(actionPost);
          }
        }}
      />
    </main>
  );
}
