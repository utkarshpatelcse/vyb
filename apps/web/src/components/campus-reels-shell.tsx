"use client";

import type { ChatConversationPreview, ChatIdentitySummary, FeedCard, PostLikerItem, UserSearchItem } from "@vyb/contracts";
import { animate, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CHAT_IDENTITY_ALGORITHM,
  createStoredChatKeyMaterial,
  encryptChatText,
  isStoredChatKeyCompatible,
  loadStoredChatKeyMaterial,
  saveStoredChatKeyMaterial,
  syncStoredChatKeyIdentity,
  type StoredChatKeyMaterial
} from "../lib/chat-e2ee";
import { CampusAvatarContent } from "./campus-avatar";
import { SocialPostActionSheet } from "./social-post-action-sheet";
import { SocialPostLightbox } from "./social-post-lightbox";
import { SocialPostLikersSheet } from "./social-post-likers-sheet";
import { SocialPostRepostSheet } from "./social-post-repost-sheet";
import { SocialPostShareSheet, type SocialShareTarget } from "./social-post-share-sheet";
import { SocialThreadSheet } from "./social-thread-sheet";
import { buildPrimaryCampusNav, CampusDesktopNavigation, CampusMobileNavigation } from "./campus-navigation";
import { SignOutButton } from "./sign-out-button";
import { useSocialPostEngagement } from "./use-social-post-engagement";
import { VybLogoLockup } from "./vyb-logo";
import {
  createDefaultCampusSettings,
  getPostDisplayControls,
  persistPostDisplayPreference,
  readPostDisplayPreferences,
  readStoredCampusSettings,
  subscribeToCampusSettings,
  subscribeToPostDisplayPreferences,
  type PostDisplayPreference
} from "./campus-settings-storage";
import { useSearchNavigationGuard } from "../lib/search-navigation";

type CampusReelsShellProps = {
  viewerName: string;
  viewerUsername: string;
  viewerUserId: string;
  collegeName: string;
  viewerEmail: string;
  course?: string | null;
  stream?: string | null;
  role: string;
  initialVibes: FeedCard[];
  suggestedUsers: UserSearchItem[];
  recentChats: ChatConversationPreview[];
  initialViewerIdentity?: ChatIdentitySummary | null;
  initialFocusedPostId?: string | null;
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

function ReelsIcon() {
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" fill="none" stroke="currentColor" />
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" fill="none" stroke="currentColor" />
    </IconBase>
  );
}

function HeartBurstIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vyb-vibes-double-heart-icon">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" fill="currentColor" stroke="currentColor" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <IconBase>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641-.183.711-.532 1.488-1.025 2.115a.498.498 0 00.41.791c1.512-.132 2.871-.78 3.84-1.647A8.905 8.905 0 0012 20.25z" fill="none" stroke="currentColor" />
    </IconBase>
  );
}

function RepostIcon() {
  return (
    <IconBase>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" fill="none" stroke="currentColor" />
    </IconBase>
  );
}

function ShareIcon() {
  return (
    <IconBase>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" fill="none" stroke="currentColor" />
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
        d="M5 9.5h3.1L12.8 6v12l-4.7-3.5H5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 9.2a4 4 0 0 1 0 5.6M18.7 6.4a8 8 0 0 1 0 11.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function VolumeMutedIcon() {
  return (
    <IconBase>
      <path
        d="M5 9.5h3.1L12.8 6v12l-4.7-3.5H5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m16.2 8.5 4.3 7M20.5 8.5l-4.3 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function BackIcon() {
  return (
    <IconBase>
      <path d="M15 18 9 12l6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function buildRecentShareTarget(item: ChatConversationPreview): SocialShareTarget {
  return {
    userId: item.peer.userId,
    username: item.peer.username,
    displayName: item.peer.displayName,
    conversationId: item.id,
    peerIdentity: item.peer.publicKey ?? null,
    lastActivityAt: item.lastActivityAt,
    source: "recent"
  };
}

function buildSuggestedShareTarget(item: UserSearchItem): SocialShareTarget {
  return {
    userId: item.userId,
    username: item.username,
    displayName: item.displayName,
    source: "suggested"
  };
}

function buildShareTargets(recentChats: ChatConversationPreview[], suggestedUsers: UserSearchItem[]) {
  const targets: SocialShareTarget[] = [];
  const seen = new Set<string>();

  for (const item of [...recentChats].sort((left, right) => new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime())) {
    const key = item.peer.userId || item.peer.username.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    targets.push(buildRecentShareTarget(item));
  }

  for (const item of suggestedUsers) {
    const key = item.userId || item.username.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    targets.push(buildSuggestedShareTarget(item));
  }

  return targets;
}

function upsertShareTarget(items: SocialShareTarget[], target: SocialShareTarget): SocialShareTarget[] {
  const normalizedUsername = target.username.toLowerCase();
  const remaining = items.filter(
    (item) =>
      item.userId !== target.userId &&
      item.username.toLowerCase() !== normalizedUsername &&
      (!target.conversationId || item.conversationId !== target.conversationId)
  );

  return [{ ...target, source: "recent" as const }, ...remaining];
}

function buildSharedPostCardPayload(post: FeedCard) {
  const authorLabel = post.isAnonymous ? "Anonymous" : post.author.displayName || post.author.username;
  return JSON.stringify({
    version: 1,
    type: "vibe_card",
    postId: post.id,
    title: truncateText(post.title || "Shared vibe", 80),
    body: truncateText(post.body || "", 140),
    mediaUrl: post.media?.[0]?.url ?? post.mediaUrl ?? null,
    thumbnailUrl: post.media?.[0]?.url ?? post.mediaUrl ?? null,
    authorUsername: post.isAnonymous ? "anonymous" : post.author.username,
    authorDisplayName: authorLabel,
    caption: null
  });
}

export function CampusReelsShell({
  viewerName,
  viewerUsername,
  viewerUserId,
  collegeName,
  viewerEmail,
  course,
  stream,
  role,
  initialVibes,
  suggestedUsers,
  recentChats,
  initialViewerIdentity = null,
  initialFocusedPostId = null
}: CampusReelsShellProps) {
  const router = useRouter();
  const { isFromSearch, goBack, clearOrigin } = useSearchNavigationGuard("/search");
  const engagement = useSocialPostEngagement(initialVibes);
  const settingsIdentity = useMemo(
    () => ({
      userId: viewerUserId,
      username: viewerUsername,
      email: viewerEmail
    }),
    [viewerEmail, viewerUserId, viewerUsername]
  );
  const prefersReducedMotion = useReducedMotion();
  const feedRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const scrollRafRef = useRef<number | null>(null);
  const snapAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const tapTimeoutRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);
  const chatIdentityPromiseRef = useRef<Promise<StoredChatKeyMaterial> | null>(null);
  const snappingRef = useRef(false);
  const holdTriggeredRef = useRef(false);
  const holdPostIdRef = useRef<string | null>(null);
  const initialFocusIndexRef = useRef<number | null>(null);
  const hasAppliedInitialFocusRef = useRef(false);
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
  const [repostComposerPost, setRepostComposerPost] = useState<FeedCard | null>(null);
  const [sharePost, setSharePost] = useState<FeedCard | null>(null);
  const [shareTargets, setShareTargets] = useState(() => buildShareTargets(recentChats, suggestedUsers));
  const [shareBusyUsername, setShareBusyUsername] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [viewerChatIdentity, setViewerChatIdentity] = useState<ChatIdentitySummary | null>(initialViewerIdentity);
  const [localChatKey, setLocalChatKey] = useState<StoredChatKeyMaterial | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(false);
  const [speedBoostPostId, setSpeedBoostPostId] = useState<string | null>(null);
  const [progressByPost, setProgressByPost] = useState<Record<string, number>>({});
  const [storedCampusSettings, setStoredCampusSettings] = useState(createDefaultCampusSettings);
  const [postDisplayPreferences, setPostDisplayPreferences] = useState<Record<string, PostDisplayPreference>>({});

  const navItems = useMemo(() => buildPrimaryCampusNav("vibes"), []);

  const identityLine = [course, stream].filter(Boolean).join(" / ") || `${collegeName} • ${role}`;
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
    const syncStoredSettings = () => {
      setStoredCampusSettings(readStoredCampusSettings(settingsIdentity));
    };

    syncStoredSettings();
    return subscribeToCampusSettings(syncStoredSettings);
  }, [settingsIdentity]);

  useEffect(() => {
    const syncPostDisplayPreferences = () => {
      setPostDisplayPreferences(readPostDisplayPreferences(settingsIdentity));
    };

    syncPostDisplayPreferences();
    return subscribeToPostDisplayPreferences(syncPostDisplayPreferences);
  }, [settingsIdentity]);

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
    if (!initialFocusedPostId || hasAppliedInitialFocusRef.current || engagement.posts.length === 0) {
      return;
    }

    const nextIndex = engagement.posts.findIndex((post) => post.id === initialFocusedPostId);
    hasAppliedInitialFocusRef.current = true;

    if (nextIndex < 0) {
      return;
    }

    initialFocusIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    window.requestAnimationFrame(() => {
      const feed = feedRef.current;
      if (!feed) {
        return;
      }

      feed.scrollTo({
        top: nextIndex * feed.clientHeight
      });
    });
  }, [engagement.posts, initialFocusedPostId]);

  useEffect(() => {
    setShareTargets(buildShareTargets(recentChats, suggestedUsers));
  }, [recentChats, suggestedUsers]);

  useEffect(() => {
    setIsPlaybackPaused(false);
    setSpeedBoostPostId(null);
  }, [activePost?.id]);

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
    if (!isFromSearch) {
      initialFocusIndexRef.current = null;
      return;
    }

    if (initialFocusIndexRef.current === null) {
      return;
    }

    if (activeIndex !== initialFocusIndexRef.current) {
      initialFocusIndexRef.current = null;
      clearOrigin();
    }
  }, [activeIndex, clearOrigin, isFromSearch]);

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
      video.playbackRate = isActive && speedBoostPostId === post.id ? 2 : 1;

      if (isActive && !isPlaybackPaused) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            if (video.muted) {
              return null;
            }

            video.muted = true;
            setIsMuted(true);
            return video.play().catch(() => null);
          });
        }
      } else {
        video.pause();
      }
    }
  }, [activePost?.id, engagement.posts, isMuted, isPlaybackPaused, speedBoostPostId]);

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current !== null) {
        window.clearTimeout(tapTimeoutRef.current);
      }

      if (holdTimeoutRef.current !== null) {
        window.clearTimeout(holdTimeoutRef.current);
      }
    };
  }, []);

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
      if (tapTimeoutRef.current !== null) {
        window.clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }

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

    if (tapTimeoutRef.current !== null) {
      window.clearTimeout(tapTimeoutRef.current);
    }

    tapTimeoutRef.current = window.setTimeout(() => {
      if (activePost?.id === post.id && post.kind === "video") {
        setIsPlaybackPaused((current) => !current);
      }

      tapTimeoutRef.current = null;
    }, 260);
  }

  function clearHoldTimer() {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  }

  function releaseSpeedBoost() {
    clearHoldTimer();
    holdTriggeredRef.current = false;
    holdPostIdRef.current = null;
    setSpeedBoostPostId(null);
  }

  function handleMediaPointerDown(post: FeedCard) {
    if (post.kind !== "video" || activePost?.id !== post.id) {
      holdTriggeredRef.current = false;
      holdPostIdRef.current = null;
      clearHoldTimer();
      return;
    }

    holdTriggeredRef.current = false;
    holdPostIdRef.current = post.id;
    clearHoldTimer();
    holdTimeoutRef.current = window.setTimeout(() => {
      holdTriggeredRef.current = true;
      setSpeedBoostPostId(post.id);

      if (isPlaybackPaused) {
        setIsPlaybackPaused(false);
      }

      const video = videoRefs.current[post.id];
      if (!video) {
        return;
      }

      video.playbackRate = 2;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => null);
      }
    }, 180);
  }

  function handleMediaPointerUp(post: FeedCard) {
    const didTriggerHold = holdTriggeredRef.current && holdPostIdRef.current === post.id;
    releaseSpeedBoost();

    if (didTriggerHold) {
      lastTapRef.current = {
        postId: null,
        timestamp: 0
      };
      if (tapTimeoutRef.current !== null) {
        window.clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      return;
    }

    handleMediaTap(post);
  }

  function handleMediaPointerCancel() {
    releaseSpeedBoost();
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

  function openRepostComposer(post: FeedCard) {
    setActionMessage(null);
    setActionPost(null);
    setRepostComposerPost(post);
  }

  async function requestRepost(post: FeedCard, repostPayload: { quote?: string; placement: "feed" | "vibe" }) {
    const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}/repost`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        placement: repostPayload.placement,
        quote: repostPayload.quote?.trim() || undefined
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
      throw new Error(payload?.error?.message ?? "We could not repost this vibe right now.");
    }

    return payload.item;
  }

  async function handleSubmitRepost(post: FeedCard, repostPayload: { quote: string; placement: "feed" | "vibe" }) {
    setActionBusy(true);
    setActionMessage(null);

    try {
      const nextItem = await requestRepost(post, repostPayload);
      engagement.prependPost(nextItem);
      setActionPost(null);
      setRepostComposerPost(null);
      setFlashMessage(repostPayload.quote.trim() ? "Quote repost added to vibes." : "Vibe reposted to your lane.");
      router.refresh();
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "We could not repost this vibe right now.";
      setActionMessage(nextMessage);
      setFlashMessage(nextMessage);
    } finally {
      setActionBusy(false);
    }
  }

  function handleSharePost(post: FeedCard) {
    setShareMessage(null);
    setActionPost(null);
    setSharePost(post);
  }

  async function fetchChatEndpoint(input: string, init?: RequestInit) {
    return fetch(input, {
      cache: "no-store",
      credentials: "same-origin",
      ...(init ?? {})
    });
  }

  async function ensureChatIdentityReady() {
    if (viewerChatIdentity && localChatKey && isStoredChatKeyCompatible(localChatKey, viewerChatIdentity)) {
      return localChatKey;
    }

    const stored = localChatKey ?? (await loadStoredChatKeyMaterial(viewerUserId));
    if (viewerChatIdentity && stored && isStoredChatKeyCompatible(stored, viewerChatIdentity)) {
      const synced = (await syncStoredChatKeyIdentity(viewerUserId, viewerChatIdentity)) ?? stored;
      await saveStoredChatKeyMaterial(synced);
      setLocalChatKey(synced);
      return synced;
    }

    if (viewerChatIdentity) {
      throw new Error("Restore your secure chat key from Settings / Security before sharing from this browser.");
    }

    if (chatIdentityPromiseRef.current) {
      return chatIdentityPromiseRef.current;
    }

    const pending = (async () => {
      const material = stored ?? (await createStoredChatKeyMaterial(viewerUserId));
      await saveStoredChatKeyMaterial(material);
      setLocalChatKey(material);

      const response = await fetchChatEndpoint("/api/chats/keys", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          publicKey: material.publicKey,
          algorithm: material.algorithm || CHAT_IDENTITY_ALGORITHM,
          keyVersion: material.keyVersion
        })
      });
      const data = (await response.json().catch(() => null)) as
        | {
            identity?: ChatIdentitySummary;
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !data?.identity) {
        throw new Error(data?.error?.message ?? "We could not enable secure sharing on this browser.");
      }

      const synced = (await syncStoredChatKeyIdentity(viewerUserId, data.identity)) ?? {
        ...material,
        identityId: data.identity.id,
        algorithm: data.identity.algorithm,
        keyVersion: data.identity.keyVersion,
        updatedAt: data.identity.updatedAt
      };

      await saveStoredChatKeyMaterial(synced);
      setViewerChatIdentity(data.identity);
      setLocalChatKey(synced);
      return synced;
    })();

    chatIdentityPromiseRef.current = pending;

    try {
      return await pending;
    } finally {
      chatIdentityPromiseRef.current = null;
    }
  }

  async function resolveShareTarget(target: SocialShareTarget) {
    if (target.conversationId && target.peerIdentity) {
      return target;
    }

    const normalizedUsername = target.username.trim().replace(/^@+/u, "");
    const response = await fetchChatEndpoint("/api/chats", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(
        target.userId.startsWith("lookup:")
          ? { recipientUsername: normalizedUsername }
          : {
              recipientUserId: target.userId,
              recipientUsername: normalizedUsername
            }
      )
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          conversation?: {
            id?: string;
            peer?: {
              userId?: string;
              username?: string;
              displayName?: string;
              publicKey?: ChatIdentitySummary | null;
            };
            messages?: Array<{ createdAt?: string }>;
            lastReadAt?: string | null;
          };
          error?: {
            message?: string;
          };
        }
      | null;

    if (!response.ok || !payload?.conversation?.id || !payload.conversation.peer?.username || !payload.conversation.peer.userId) {
      throw new Error(payload?.error?.message ?? "We could not open that chat right now.");
    }

    return {
      userId: payload.conversation.peer.userId,
      username: payload.conversation.peer.username,
      displayName: payload.conversation.peer.displayName || payload.conversation.peer.username,
      conversationId: payload.conversation.id,
      peerIdentity: payload.conversation.peer.publicKey ?? null,
      lastActivityAt: payload.conversation.messages?.[payload.conversation.messages.length - 1]?.createdAt ?? payload.conversation.lastReadAt ?? null,
      source: "recent" as const
    };
  }

  async function handleShareToChat(post: FeedCard, target: SocialShareTarget) {
    const normalizedUsername = target.username.trim().replace(/^@+/u, "");

    if (!normalizedUsername) {
      setShareMessage("Enter a valid username first.");
      return;
    }

    setShareBusyUsername(normalizedUsername);
    setShareMessage(null);

    try {
      const resolvedTarget = await resolveShareTarget(target);
      if (!resolvedTarget.conversationId || !resolvedTarget.peerIdentity) {
        throw new Error("This user has not finished setting up secure chat yet.");
      }

      const keyMaterial = await ensureChatIdentityReady();
      const encryptedPayload = await encryptChatText(buildSharedPostCardPayload(post), keyMaterial, resolvedTarget.peerIdentity);
      const response = await fetchChatEndpoint(`/api/chats/${encodeURIComponent(resolvedTarget.conversationId)}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          messageKind: "vibe_card",
          ...encryptedPayload
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            conversationPreview?: ChatConversationPreview;
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "We could not share this vibe right now.");
      }

      const conversationPreview = payload?.conversationPreview;
      if (conversationPreview) {
        setShareTargets((current) => upsertShareTarget(current, buildRecentShareTarget(conversationPreview)));
      } else {
        setShareTargets((current) => upsertShareTarget(current, resolvedTarget));
      }

      setSharePost(null);
      setShareMessage(null);
      setFlashMessage(`Shared with ${resolvedTarget.displayName || resolvedTarget.username}.`);
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : "Network issue while sharing this vibe.");
    } finally {
      setShareBusyUsername(null);
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

  function updatePostDisplayPreference(post: FeedCard, key: "hideReactionCount" | "hideCommentCount") {
    const currentPreference = postDisplayPreferences[post.id] ?? {
      hideReactionCount: false,
      hideCommentCount: false,
      reactionCountMode: "default" as const,
      commentCountMode: "default" as const,
      updatedAt: new Date().toISOString()
    };
    const currentControls = getPostDisplayControls(storedCampusSettings, post, currentPreference);
    const isReactionToggle = key === "hideReactionCount";
    const nextReactionMode = isReactionToggle
      ? currentControls.hideReactionCount ? "visible" : "hidden"
      : currentPreference.reactionCountMode ?? "default";
    const nextCommentMode = !isReactionToggle
      ? currentControls.hideCommentCount ? "visible" : "hidden"
      : currentPreference.commentCountMode ?? "default";
    const nextPreference = {
      hideReactionCount: currentPreference.hideReactionCount,
      hideCommentCount: currentPreference.hideCommentCount,
      reactionCountMode: nextReactionMode,
      commentCountMode: nextCommentMode,
      [key]: isReactionToggle ? nextReactionMode === "hidden" : nextCommentMode === "hidden"
    };

    setPostDisplayPreferences((current) => ({
      ...current,
      [post.id]: {
        ...nextPreference,
        updatedAt: new Date().toISOString()
      }
    }));
    persistPostDisplayPreference(settingsIdentity, post.id, nextPreference);
    setActionMessage(key === "hideReactionCount" ? "Like count preference updated." : "Comment count preference updated.");
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
    <main className="vyb-campus-home vyb-vibes-theater-page">
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

      <CampusDesktopNavigation navItems={navItems} viewerName={viewerName} viewerUsername={viewerUsername} />

      <section className="vyb-campus-main vyb-vibes-main">
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
            {isFromSearch ? (
              <button type="button" className="vyb-vibes-topbar-icon" aria-label="Back to search" onClick={() => goBack()}>
                <BackIcon />
              </button>
            ) : null}
            <Link href="/search" className="vyb-vibes-topbar-icon" aria-label="Search campus">
              <SearchIcon />
            </Link>
            <Link href="/create?kind=vibe&from=%2Fvibes" className="vyb-vibes-topbar-icon is-primary" aria-label="Upload vibe">
              <PlusIcon />
            </Link>
            <Link href="/dashboard" className="vyb-vibes-viewer-chip">
              <span className="vyb-vibes-viewer-avatar">
                <CampusAvatarContent
                  username={viewerUsername}
                  email={viewerEmail}
                  displayName={viewerName}
                  fallback={getInitials(viewerName || viewerUsername)}
                  decorative
                />
              </span>
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
              {engagement.posts.map((item) => {
                const isActive = activePost?.id === item.id;
                const profileHref =
                  item.isAnonymous || item.author.username !== viewerUsername
                    ? `/u/${encodeURIComponent(item.author.username)}`
                    : "/dashboard";
                const progress = progressByPost[item.id] ?? 0;
                const displayControls = getPostDisplayControls(storedCampusSettings, item, postDisplayPreferences[item.id]);

                return (
                  <section key={item.id} id={`post-${item.id}`} className="vyb-vibes-slide">
                    <motion.article
                      className={`vyb-vibes-stage${isActive ? " is-active" : ""}${item.isAnonymous ? " is-anonymous" : ""}`}
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

                        <div
                          className="vyb-vibes-press-surface"
                          aria-hidden="true"
                          onPointerDown={() => handleMediaPointerDown(item)}
                          onPointerUp={() => handleMediaPointerUp(item)}
                          onPointerCancel={handleMediaPointerCancel}
                          onPointerLeave={handleMediaPointerCancel}
                          onContextMenu={(event) => event.preventDefault()}
                        />

                        {item.kind === "video" ? (
                          <button
                            type="button"
                            className="vyb-vibes-volume-toggle"
                            aria-label={isMuted ? "Unmute active vibe" : "Mute active vibe"}
                            onClick={(event) => {
                              event.stopPropagation();
                              setIsMuted((current) => !current);

                              if (isPlaybackPaused) {
                                setIsPlaybackPaused(false);
                              }
                            }}
                          >
                            {isMuted ? <VolumeMutedIcon /> : <VolumeOnIcon />}
                          </button>
                        ) : null}

                        {item.kind === "video" && speedBoostPostId === item.id ? (
                          <span className="vyb-vibes-speed-badge" aria-hidden="true">
                            2x
                          </span>
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
                            {item.isAnonymous ? (
                              <span className="vyb-vibes-author-avatar" aria-label="Anonymous author">
                                <CampusAvatarContent
                                  userId={item.author.userId}
                                  username={item.author.username}
                                  displayName={item.author.displayName}
                                  avatarUrl={item.author.avatarUrl ?? null}
                                  fallback={getInitials(item.author.displayName)}
                                  decorative
                                />
                              </span>
                            ) : (
                              <Link href={profileHref} className="vyb-vibes-author-avatar" aria-label={`Open ${item.author.displayName} profile`}>
                                <CampusAvatarContent
                                  userId={item.author.userId}
                                  username={item.author.username}
                                  displayName={item.author.displayName}
                                  avatarUrl={item.author.avatarUrl ?? null}
                                  fallback={getInitials(item.author.displayName)}
                                  decorative
                                />
                              </Link>
                            )}
                            <div className="vyb-vibes-author-copy">
                              {item.isAnonymous ? (
                                <strong>{item.author.displayName}</strong>
                              ) : (
                                <Link href={profileHref}>
                                  <strong>{item.author.displayName}</strong>
                                </Link>
                              )}
                              <span>{item.isAnonymous ? "Hidden profile" : `@${item.author.username}`}</span>
                            </div>
                          </div>
                          <p className="vyb-vibes-caption">{item.body}</p>
                          <div className="vyb-vibes-stage-meta">
                            <span>{collegeName}</span>
                            {displayControls.hideReactionCount ? null : <span>{formatMetric(item.reactions)} likes</span>}
                            {displayControls.hideReactionCount ? null : (
                              <button type="button" onClick={() => void openPostLikes(item)}>
                                See likes
                              </button>
                            )}
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
                            {displayControls.hideReactionCount ? <span>Like</span> : <span>{formatMetric(item.reactions)}</span>}
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
                            {displayControls.hideCommentCount ? <span>Comments</span> : <span>{formatMetric(item.comments)}</span>}
                          </button>
                          <button
                            type="button"
                            className="vyb-vibes-action-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openRepostComposer(item);
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
                              handleSharePost(item);
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
      </section>

      <CampusMobileNavigation navItems={navItems} />

      <SocialThreadSheet
        desktopInsetLeft="var(--vyb-campus-left-width)"
        desktopInsetRight="0px"
        post={engagement.selectedPost}
        comments={engagement.selectedComments}
        draft={engagement.threadDraft}
        mediaUrl={engagement.threadMediaUrl}
        mediaType={engagement.threadMediaType}
        replyTarget={engagement.threadReplyTarget}
        message={engagement.threadMessage}
        isLoading={engagement.threadLoading}
        isSubmitting={engagement.threadSubmitting}
        deletingCommentId={engagement.threadDeletingCommentId}
        viewerName={viewerName}
        viewerUsername={viewerUsername}
        onClose={engagement.closeThread}
        onDraftChange={engagement.setThreadDraft}
        onMediaUrlChange={engagement.setThreadMediaUrl}
        onMediaTypeChange={engagement.setThreadMediaType}
        onReply={engagement.beginReply}
        onCommentLike={(commentId) => {
          void engagement.reactToComment(commentId);
        }}
        onDeleteComment={(comment) => {
          void engagement.deleteComment(comment.id);
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
        hideReactionCount={
          lightboxPost
            ? getPostDisplayControls(storedCampusSettings, lightboxPost, postDisplayPreferences[lightboxPost.id]).hideReactionCount
            : false
        }
        hideCommentCount={
          lightboxPost
            ? getPostDisplayControls(storedCampusSettings, lightboxPost, postDisplayPreferences[lightboxPost.id]).hideCommentCount
            : false
        }
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

      <SocialPostRepostSheet
        post={repostComposerPost}
        viewerName={viewerName}
        viewerUsername={viewerUsername}
        isBusy={actionBusy}
        message={actionMessage}
        onClose={() => {
          if (!actionBusy) {
            setRepostComposerPost(null);
            setActionMessage(null);
          }
        }}
        onSubmit={(payload) => {
          if (repostComposerPost) {
            void handleSubmitRepost(repostComposerPost, payload);
          }
        }}
      />

      <SocialPostShareSheet
        post={sharePost}
        shareTargets={shareTargets}
        busyUsername={shareBusyUsername}
        message={shareMessage}
        onClose={() => {
          if (!shareBusyUsername) {
            setSharePost(null);
            setShareMessage(null);
          }
        }}
        onAddToStory={() => {
          setSharePost(null);
          setShareMessage(null);
          router.push("/create?kind=story&from=%2Fvibes");
        }}
        onShare={(target) => {
          if (sharePost) {
            void handleShareToChat(sharePost, target);
          }
        }}
      />

      <SocialPostActionSheet
        post={actionPost}
        isOwner={Boolean(actionPost?.viewerCanManage)}
        isBusy={actionBusy}
        message={actionMessage}
        hideReactionCount={
          actionPost
            ? getPostDisplayControls(storedCampusSettings, actionPost, postDisplayPreferences[actionPost.id]).hideReactionCount
            : false
        }
        hideCommentCount={
          actionPost
            ? getPostDisplayControls(storedCampusSettings, actionPost, postDisplayPreferences[actionPost.id]).hideCommentCount
            : false
        }
        onClose={() => setActionPost(null)}
        onOpenDetail={() => {
          if (actionPost) {
            setActionPost(null);
            void openPostLightbox(actionPost);
          }
        }}
        onOpenRepostComposer={() => {
          if (actionPost) {
            openRepostComposer(actionPost);
          }
        }}
        onToggleReactionCount={() => {
          if (actionPost) {
            updatePostDisplayPreference(actionPost, "hideReactionCount");
          }
        }}
        onToggleCommentCount={() => {
          if (actionPost) {
            updatePostDisplayPreference(actionPost, "hideCommentCount");
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
