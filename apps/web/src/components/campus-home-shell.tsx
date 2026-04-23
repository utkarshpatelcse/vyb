"use client";

import type { FeedCard, PostLikerItem, StoryCard, UserSearchItem } from "@vyb/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SocialPostActionSheet } from "./social-post-action-sheet";
import { SocialPostLightbox } from "./social-post-lightbox";
import { SocialPostLikersSheet } from "./social-post-likers-sheet";
import { SocialThreadSheet } from "./social-thread-sheet";
import { SignOutButton } from "./sign-out-button";
import { useSocialPostEngagement } from "./use-social-post-engagement";
import { VybLogoLockup, VybLogoMark } from "./vyb-logo";
import { MediaCarousel } from "./media-carousel";

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 52) return `${diffInWeeks}w ago`;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

function FeedCaption({ title, body }: { title?: string | null; body: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const MAX_LENGTH = 150;
  // Deduplicate title and body if they are identical
  const displayTitle = title && title.trim() !== body.trim() ? title : null;
  const shouldTruncate = body.length > MAX_LENGTH;
  const displayBody = shouldTruncate && !isExpanded ? body.slice(0, MAX_LENGTH) + "..." : body;

  return (
    <div className="fc-caption">
      {displayTitle ? <strong>{displayTitle}</strong> : null}
      <p>
        {displayBody}
        {shouldTruncate && (
          <button type="button" className="fc-read-more" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? " Show less" : " See more"}
          </button>
        )}
      </p>
    </div>
  );
}

type CampusHomeShellProps = {
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  viewerEmail: string;
  course?: string | null;
  stream?: string | null;
  role: string;
  stories: StoryCard[];
  initialPosts: FeedCard[];
  trendingVibes: FeedCard[];
  suggestedUsers: UserSearchItem[];
};

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: value > 999 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function layoutStyle() {
  return {
    "--vyb-campus-left-width": "260px",
    "--vyb-campus-right-width": "320px"
  } as CSSProperties;
}

const STORY_IMAGE_DURATION_MS = 15_000;
const STORY_VIDEO_MAX_DURATION_MS = 60_000;

function buildSeenStoryMap(items: StoryCard[]) {
  return items.reduce<Record<string, true>>((accumulator, story) => {
    if (story.viewerHasSeen) {
      accumulator[story.id] = true;
    }

    return accumulator;
  }, {});
}

type StoryRailGroup = {
  userId: string;
  username: string;
  displayName: string;
  isOwn: boolean;
  preview: StoryCard;
  items: StoryCard[];
  allSeen: boolean;
};

function buildStoryRailGroups(items: StoryCard[], viewerUsername: string) {
  const groups = new Map<string, StoryRailGroup>();

  for (const story of items) {
    const isOwnStory = story.isOwn || story.username === viewerUsername;
    const existing = groups.get(story.userId);

    if (!existing) {
      groups.set(story.userId, {
        userId: story.userId,
        username: story.username,
        displayName: story.displayName,
        isOwn: isOwnStory,
        preview: story,
        items: [story],
        allSeen: Boolean(story.viewerHasSeen)
      });
      continue;
    }

    existing.items.push(story);
    existing.isOwn = existing.isOwn || isOwnStory;

    if (new Date(story.createdAt).getTime() > new Date(existing.preview.createdAt).getTime()) {
      existing.preview = story;
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      ),
      allSeen: group.items.every((story) => story.viewerHasSeen)
    }))
    .sort((left, right) => {
      if (left.isOwn !== right.isOwn) {
        return left.isOwn ? -1 : 1;
      }

      return new Date(right.preview.createdAt).getTime() - new Date(left.preview.createdAt).getTime();
    });
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
      <path d="m20 20-3.8-3.8M10.8 17a6.2 6.2 0 1 1 0-12.4 6.2 6.2 0 0 1 0 12.4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function AddPostIcon() {
  return (
    <IconBase>
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function MediaIcon() {
  return (
    <IconBase>
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zm0 9 4.5-4.5 3 3 4.5-5.5 4 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="1.6" fill="currentColor" />
    </IconBase>
  );
}

function StoryIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </IconBase>
  );
}

function GlobeIcon() {
  return (
    <IconBase>
      <path
        d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-6.5 8h13M12 4a12.5 12.5 0 0 1 0 16M12 4a12.5 12.5 0 0 0 0 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function CloseIcon() {
  return (
    <IconBase>
      <path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function VolumeOffIcon() {
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
        d="m16.2 8.5 4.3 7M20.5 8.5l-4.3 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function getProfileHref(username: string, viewerUsername: string) {
  return username === viewerUsername ? "/dashboard" : `/u/${encodeURIComponent(username)}`;
}

export function CampusHomeShell({
  viewerName,
  viewerUsername,
  collegeName,
  viewerEmail,
  course,
  stream,
  role,
  stories,
  initialPosts,
  trendingVibes,
  suggestedUsers
}: CampusHomeShellProps) {
  const router = useRouter();
  const engagement = useSocialPostEngagement(initialPosts);
  const [recommendedUsers, setRecommendedUsers] = useState(suggestedUsers);
  const [storyFeed, setStoryFeed] = useState(stories);
  const [vibeStrip, setVibeStrip] = useState(trendingVibes);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isStoryPaused, setIsStoryPaused] = useState(false);
  const [isStoryMuted, setIsStoryMuted] = useState(false);
  const [storyMessageDraft, setStoryMessageDraft] = useState("");
  const [seenStoryIds, setSeenStoryIds] = useState<Record<string, true>>({});
  const [draftBody, setDraftBody] = useState("");
  const [composerMessage, setComposerMessage] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [followBusyUsername, setFollowBusyUsername] = useState<string | null>(null);
  const [storyBusyId, setStoryBusyId] = useState<string | null>(null);
  const [heartBurstPostId, setHeartBurstPostId] = useState<string | null>(null);
  const [lightboxPost, setLightboxPost] = useState<FeedCard | null>(null);
  const [likesPost, setLikesPost] = useState<FeedCard | null>(null);
  const [likesByPost, setLikesByPost] = useState<Record<string, PostLikerItem[]>>({});
  const [likesLoadingPostId, setLikesLoadingPostId] = useState<string | null>(null);
  const [likesMessage, setLikesMessage] = useState<string | null>(null);
  const [actionPost, setActionPost] = useState<FeedCard | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const storyVideoRef = useRef<HTMLVideoElement | null>(null);
  const storyHoldTimeoutRef = useRef<number | null>(null);
  const storyPointerDownAtRef = useRef<number>(0);
  const storyPointerZoneRef = useRef<"left" | "center" | "right">("center");

  const storyGroups = useMemo(() => buildStoryRailGroups(storyFeed, viewerUsername), [storyFeed, viewerUsername]);
  const storySequence = useMemo(() => storyGroups.flatMap((group) => group.items), [storyGroups]);
  const ownStoryGroup = storyGroups.find((group) => group.isOwn) ?? null;
  const otherStoryGroups = storyGroups.filter((group) => !group.isOwn);
  const selectedStory = selectedStoryIndex === null ? null : storySequence[selectedStoryIndex] ?? null;
  const selectedStoryGroup = selectedStory
    ? storyGroups.find((group) => group.userId === selectedStory.userId) ?? null
    : null;
  const selectedStoryGroupStartIndex =
    selectedStoryGroup?.items[0]
      ? storySequence.findIndex((story) => story.id === selectedStoryGroup.items[0]?.id)
      : -1;
  const selectedStoryGroupIndex =
    selectedStoryGroupStartIndex >= 0 && selectedStoryIndex !== null
      ? selectedStoryIndex - selectedStoryGroupStartIndex
      : 0;

  useEffect(() => {
    setStoryFeed(stories);
    setSeenStoryIds(buildSeenStoryMap(stories));
  }, [stories]);

  useEffect(() => {
    setStoryMessageDraft("");
    setIsStoryPaused(false);
    setIsStoryMuted(false);
    setStoryProgress(0);
  }, [selectedStory?.id]);

  useEffect(() => {
    setVibeStrip(trendingVibes);
  }, [trendingVibes]);

  useEffect(() => {
    setRecommendedUsers(suggestedUsers);
  }, [suggestedUsers]);

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
    return () => {
      clearStoryHoldTimer();
    };
  }, []);

  useEffect(() => {
    if (!selectedStory) {
      setStoryProgress(0);
      return;
    }

    if (!selectedStory.viewerHasSeen) {
      setSeenStoryIds((current) => ({
        ...current,
        [selectedStory.id]: true
      }));
      setStoryFeed((current) =>
        current.map((story) =>
          story.id === selectedStory.id
            ? {
                ...story,
                viewerHasSeen: true
              }
            : story
        )
      );

      void fetch(`/api/stories/${encodeURIComponent(selectedStory.id)}/seen`, {
        method: "PUT"
      }).catch(() => null);
    }

    if (isStoryPaused) {
      return;
    }

    const durationMs = selectedStory.mediaType === "video" ? STORY_VIDEO_MAX_DURATION_MS : STORY_IMAGE_DURATION_MS;
    let frameId = 0;
    const initialProgress = storyProgress;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const nextProgress = Math.min(1, initialProgress + (now - startedAt) / durationMs);
      setStoryProgress(nextProgress);

      if (nextProgress >= 1) {
        setStoryProgress(0);
        setSelectedStoryIndex((current) => {
          if (current === null) {
            return null;
          }

          return current + 1 < storySequence.length ? current + 1 : null;
        });
        return;
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [selectedStory, storySequence.length, isStoryPaused]);

  useEffect(() => {
    if (!selectedStory || selectedStory.mediaType !== "video" || !storyVideoRef.current) {
      return;
    }

    const storyVideo = storyVideoRef.current;
    storyVideo.muted = isStoryMuted;

    if (isStoryPaused) {
      storyVideo.pause();
      return;
    }

    const playStoryVideo = async () => {
      try {
        await storyVideo.play();
      } catch {
        if (!storyVideo.muted) {
          storyVideo.muted = true;
          setIsStoryMuted(true);
          await storyVideo.play().catch(() => null);
        }
      }
    };

    void playStoryVideo();
  }, [selectedStory, isStoryPaused, isStoryMuted]);

  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;
  const navItems = useMemo(
    () => [
      { label: "Home", href: "/home", icon: <HomeIcon />, active: true },
      { label: "Events", href: "/events", icon: <EventsIcon /> },
      { label: "Vibes", href: "/vibes", icon: <VibesIcon /> },
      { label: "Market", href: "/market", icon: <MarketIcon /> },
      { label: "Profile", href: "/dashboard", icon: <ProfileIcon /> }
    ],
    []
  );

  function syncMirroredPost(postId: string, updater: (post: FeedCard) => FeedCard) {
    setVibeStrip((current) => current.map((post) => (post.id === postId ? updater(post) : post)));
    setLightboxPost((current) => (current?.id === postId ? updater(current) : current));
    setLikesPost((current) => (current?.id === postId ? updater(current) : current));
    setActionPost((current) => (current?.id === postId ? updater(current) : current));
  }

  function removeMirroredPost(postId: string) {
    setVibeStrip((current) => current.filter((post) => post.id !== postId));
    setLightboxPost((current) => (current?.id === postId ? null : current));
    setLikesPost((current) => (current?.id === postId ? null : current));
    setActionPost((current) => (current?.id === postId ? null : current));
  }

  async function handlePostLike(post: FeedCard, triggerBurst = false) {
    if (triggerBurst) {
      setHeartBurstPostId(post.id);
    }

    const reaction = await engagement.react(post.id);
    if (!reaction) {
      setFlashMessage("We could not update that like right now.");
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

  async function handleDirectRepost(post: FeedCard, placement: "feed" | "vibe" = "feed") {
    setActionBusy(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}/repost`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ placement })
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
        setActionMessage(payload?.error?.message ?? "We could not repost this right now.");
        return;
      }

      if (payload.item.placement === "feed") {
        engagement.prependPost(payload.item);
      } else {
        setVibeStrip((current) => [payload.item!, ...current].slice(0, 10));
      }

      setActionPost(null);
      setFlashMessage("Reposted to your campus lane.");
      router.refresh();
    } catch {
      setActionMessage("We could not repost this right now.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleQuoteRepost(post: FeedCard, quote: string, placement: "feed" | "vibe" = "feed") {
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
          placement
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
        setActionMessage(payload?.error?.message ?? "We could not quote repost this right now.");
        return;
      }

      if (payload.item.placement === "feed") {
        engagement.prependPost(payload.item);
      } else {
        setVibeStrip((current) => [payload.item!, ...current].slice(0, 10));
      }

      setActionPost(null);
      setFlashMessage("Your quote repost is now live.");
      router.refresh();
    } catch {
      setActionMessage("We could not quote repost this right now.");
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
        setActionMessage(payload?.error?.message ?? "We could not delete this post right now.");
        return;
      }

      engagement.removePost(post.id);
      removeMirroredPost(post.id);
      setActionPost(null);
      setFlashMessage(post.placement === "vibe" ? "Vibe deleted." : "Post deleted.");
      router.refresh();
    } catch {
      setActionMessage("We could not delete this post right now.");
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
      setFlashMessage("Page link copied.");
    } catch {
      setActionMessage("We could not copy that link right now.");
    }
  }

  function openStoryGroup(group: StoryRailGroup) {
    const firstUnseenStory = group.items.find((story) => !story.viewerHasSeen);
    const targetStoryId = firstUnseenStory?.id ?? group.items[0]?.id ?? null;

    if (!targetStoryId) {
      return;
    }

    const nextIndex = storySequence.findIndex((story) => story.id === targetStoryId);
    setStoryProgress(0);
    setSelectedStoryIndex(nextIndex >= 0 ? nextIndex : null);
  }

  function moveStory(offset: number) {
    setStoryProgress(0);
    setSelectedStoryIndex((current) => {
      if (current === null) {
        return null;
      }

      const next = current + offset;
      return next >= 0 && next < storySequence.length ? next : null;
    });
  }

  function clearStoryHoldTimer() {
    if (storyHoldTimeoutRef.current !== null) {
      window.clearTimeout(storyHoldTimeoutRef.current);
      storyHoldTimeoutRef.current = null;
    }
  }

  function handleStoryPointerDown(zone: "left" | "center" | "right") {
    storyPointerZoneRef.current = zone;
    storyPointerDownAtRef.current = performance.now();
    clearStoryHoldTimer();
    storyHoldTimeoutRef.current = window.setTimeout(() => {
      setIsStoryPaused(true);
    }, 180);
  }

  function handleStoryPointerUp() {
    const pressDuration = performance.now() - storyPointerDownAtRef.current;
    const activeZone = storyPointerZoneRef.current;
    const wasLongPress = pressDuration >= 180;

    clearStoryHoldTimer();
    setIsStoryPaused(false);

    if (wasLongPress) {
      return;
    }

    if (activeZone === "left") {
      moveStory(-1);
      return;
    }

    if (activeZone === "right") {
      moveStory(1);
    }
  }

  function handleStoryPointerCancel() {
    clearStoryHoldTimer();
    setIsStoryPaused(false);
  }

  function handleStorySoundToggle() {
    const nextMuted = !isStoryMuted;
    setIsStoryMuted(nextMuted);

    if (!storyVideoRef.current) {
      return;
    }

    storyVideoRef.current.muted = nextMuted;

    if (!nextMuted) {
      void storyVideoRef.current.play().catch(() => null);
    }
  }

  async function handleQuickPostPublish() {
    const body = draftBody.trim();

    if (!body) {
      setComposerMessage("Write a caption before publishing.");
      return;
    }

    setComposerMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title: body.slice(0, 72),
          body,
          kind: "text",
          placement: "feed",
          location: collegeName
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
        setComposerMessage(payload?.error?.message ?? "We could not publish your post right now.");
        return;
      }

      engagement.prependPost(payload.item);
      setDraftBody("");
      setIsComposerOpen(false);
      setFlashMessage("Your post is now live across campus.");
      router.refresh();
    } catch {
      setComposerMessage("We could not publish your post right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFollowToggle(username: string, shouldFollow: boolean) {
    setFollowBusyUsername(username);

    try {
      const response = await fetch(`/api/follows/${encodeURIComponent(username)}`, {
        method: shouldFollow ? "PUT" : "DELETE"
      });

      if (!response.ok) {
        setFlashMessage("We could not update that follow right now.");
        return;
      }

      setRecommendedUsers((current) =>
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
      setFlashMessage(shouldFollow ? `You are now following @${username}.` : `You unfollowed @${username}.`);
      router.refresh();
    } finally {
      setFollowBusyUsername(null);
    }
  }

  async function handleStoryLike(storyId: string) {
    setStoryBusyId(storyId);

    try {
      const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}/reactions`, {
        method: "PUT"
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            aggregateCount?: number;
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || typeof payload?.aggregateCount !== "number") {
        setFlashMessage(payload?.error?.message ?? "We could not like that story right now.");
        return;
      }

      setStoryFeed((current) =>
        current.map((story) =>
          story.id === storyId
            ? {
                ...story,
                reactions: payload.aggregateCount!,
                viewerHasLiked: true
              }
            : story
        )
      );
      setFlashMessage("Story reaction updated.");
    } catch {
      setFlashMessage("We could not like that story right now.");
    } finally {
      setStoryBusyId(null);
    }
  }

  function handleStoryMessageSubmit() {
    if (!storyMessageDraft.trim()) {
      return;
    }

    setFlashMessage("Story replies are coming soon.");
    setStoryMessageDraft("");
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
        setActionMessage(data?.error?.message ?? "We could not update this post right now.");
        return;
      }

      engagement.replacePost(data.item);
      syncMirroredPost(post.id, () => data.item!);
      setActionPost(null);
      setFlashMessage(post.placement === "vibe" ? "Vibe updated." : "Post updated.");
      router.refresh();
    } catch {
      setActionMessage("We could not update this post right now.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <main className="vyb-campus-home" style={layoutStyle()}>
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
        <header className="vyb-campus-topbar">
          <div className="vyb-campus-topbar-copy">
            <strong>Campus feed</strong>
            <span>{collegeName}</span>
          </div>

          <div className="vyb-campus-top-actions">
            <Link href="/search" className="vyb-campus-top-icon vyb-campus-top-link" aria-label="Search campus users">
              <SearchIcon />
            </Link>
            <button type="button" className="vyb-campus-top-icon" aria-label="Notifications">
              <BellIcon />
            </button>
            <button type="button" className="vyb-campus-post-trigger" onClick={() => setIsComposerOpen(true)}>
              <AddPostIcon />
              <span>Create post</span>
            </button>
            <Link href="/messages" className="vyb-campus-top-icon vyb-campus-top-link" aria-label="Open campus messages">
              <SendIcon />
            </Link>
          </div>
        </header>

        <header className="vyb-campus-mobile-header">
          <Link href="/home" className="vyb-campus-branding vyb-campus-branding-mobile">
            <VybLogoMark />
          </Link>
          <div className="vyb-campus-mobile-actions">
            <Link href="/search" className="vyb-campus-top-icon vyb-campus-top-link" aria-label="Search campus users">
              <SearchIcon />
            </Link>
            <button type="button" className="vyb-campus-post-trigger vyb-campus-post-trigger-mobile" onClick={() => setIsComposerOpen(true)}>
              <AddPostIcon />
              <span>Post</span>
            </button>
            <Link href="/messages" className="vyb-campus-top-icon vyb-campus-top-link" aria-label="Open campus messages">
              <SendIcon />
            </Link>
          </div>
        </header>

        {flashMessage ? <div className="vyb-campus-flash-message">{flashMessage}</div> : null}

        <div className="vyb-campus-feed-stack">
          <div className="vyb-campus-stories">
            {ownStoryGroup ? (
              <div className="vyb-campus-story-wrap">
                <button
                  type="button"
                  className={`vyb-campus-story vyb-campus-story-own${ownStoryGroup.allSeen ? " is-seen" : ""}`}
                  onClick={() => openStoryGroup(ownStoryGroup)}
                >
                  <span
                    className={`vyb-campus-story-ring${selectedStoryGroup?.userId === ownStoryGroup.userId ? " is-active" : ""}`}
                  >
                    {ownStoryGroup.preview.mediaType === "video" ? (
                      <video src={ownStoryGroup.preview.mediaUrl} muted playsInline autoPlay loop />
                    ) : (
                      <img src={ownStoryGroup.preview.mediaUrl} alt="Your story" />
                    )}
                  </span>
                  <span>Your story</span>
                </button>
                <button
                  type="button"
                  className="vyb-campus-story-plus"
                  aria-label="Add a new story"
                  onClick={() => router.push("/create?kind=story&from=%2Fhome")}
                >
                  <AddPostIcon />
                </button>
              </div>
            ) : (
              <button type="button" className="vyb-campus-story vyb-campus-story-add" onClick={() => router.push("/create?kind=story&from=%2Fhome")}>
                <span className="vyb-campus-story-ring vyb-campus-story-ring-add">
                  <AddPostIcon />
                </span>
                <span>Your story</span>
              </button>
            )}

            {otherStoryGroups.map((group) => (
              <button
                key={group.userId}
                type="button"
                className={`vyb-campus-story${group.allSeen ? " is-seen" : ""}`}
                onClick={() => openStoryGroup(group)}
              >
                <span className={`vyb-campus-story-ring${selectedStoryGroup?.userId === group.userId ? " is-active" : ""}`}>
                  {group.preview.mediaType === "video" ? (
                    <video src={group.preview.mediaUrl} muted playsInline autoPlay loop />
                  ) : (
                    <img src={group.preview.mediaUrl} alt={group.username} />
                  )}
                </span>
                <span>{group.username}</span>
              </button>
            ))}
          </div>

          <div className="vyb-campus-feed">
            {engagement.posts.length === 0 ? (
              <div className="vyb-campus-empty-state">
                <strong>No campus posts yet</strong>
                <span>Be the first one to publish something everyone on your campus can see.</span>
              </div>
            ) : null}

            {engagement.posts.map((post, index) => {
              // Use the new native multi-media array if it has items, else fallback to backward-compatible mediaUrl
              const mediaItems = post.media && post.media.length > 0
                ? post.media
                : post.mediaUrl
                ? [{ url: post.mediaUrl, kind: post.kind === "video" ? "video" as const : "image" as const }]
                : [];

              return (
              <div key={post.id}>
                <article id={`post-${post.id}`} className="fc-card">
                  {/* ── Header ── */}
                  <div className="fc-header">
                    <Link href={getProfileHref(post.author.username, viewerUsername)} className="fc-avatar" aria-label={post.author.username}>
                      {post.author.displayName.slice(0, 1).toUpperCase()}
                    </Link>
                    <div className="fc-header-info">
                      <div className="fc-header-top">
                        <Link href={getProfileHref(post.author.username, viewerUsername)} className="fc-author-name">
                          {post.author.displayName || post.author.username}
                        </Link>
                      </div>
                      <div className="fc-header-bottom">
                        <span className="fc-username">@{post.author.username}</span>
                        <span className="fc-sep" aria-hidden="true">·</span>
                        <time className="fc-timestamp" dateTime={post.createdAt} suppressHydrationWarning>{timeAgo(post.createdAt)}</time>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="vyb-campus-icon-button fc-options-btn"
                      aria-label="Post options"
                      onClick={() => { setActionMessage(null); setActionPost(post); }}
                    >
                      <MenuIcon />
                    </button>
                  </div>

                  {/* ── Caption ── */}
                  {(post.title || post.body) && (
                    <FeedCaption title={post.title} body={post.body} />
                  )}

                  {/* ── Media ── */}
                  {mediaItems.length > 0 && (
                    <div
                      className="fc-media"
                      onDoubleClick={() => void handlePostLike(post, true)}
                    >
                      <MediaCarousel
                        items={mediaItems}
                        alt={post.body || post.title || "Post media"}
                        onClick={() => void openPostLightbox(post)}
                        onDoubleTap={() => void handlePostLike(post, true)}
                        showHeartBurst={heartBurstPostId === post.id}
                        heartBurstNode={
                          <span className="vyb-heart-pulse" aria-hidden="true">
                            <HeartIcon />
                          </span>
                        }
                      />
                    </div>
                  )}

                  {/* ── Actions ── */}
                  <div className="fc-actions">
                    <div className="fc-actions-left">
                      <button
                        type="button"
                        className={`fc-action-btn ${post.viewerReactionType === "like" ? "is-active" : ""}`}
                        disabled={engagement.loadingPostId === post.id}
                        onClick={() => void handlePostLike(post)}
                      >
                        <HeartIcon />
                        <span>{formatMetric(post.reactions)}</span>
                      </button>
                      <button
                        type="button"
                        className="fc-action-btn"
                        onClick={() => void engagement.openThread(post.id)}
                      >
                        <CommentIcon />
                        <span>{formatMetric(post.comments)}</span>
                      </button>
                      <button
                        type="button"
                        className="fc-action-btn"
                        onClick={() => { setActionMessage(null); setActionPost(post); }}
                      >
                        <ShareIcon />
                      </button>
                    </div>
                  </div>

                </article>

                {(index + 1) % 4 === 0 && vibeStrip.length > 0 ? (
                  <section className="vyb-home-vibes-teaser">
                    <div className="vyb-home-vibes-teaser-head">
                      <div>
                        <strong>Trending vibes</strong>
                        <span>Campus reels right inside the home feed.</span>
                      </div>
                      <Link href="/vibes">Open vibe lane</Link>
                    </div>

                    <div className="vyb-home-vibes-teaser-list">
                      {vibeStrip.slice(0, 6).map((vibe) => (
                        <button key={vibe.id} type="button" className="vyb-home-vibes-teaser-card" onClick={() => void openPostLightbox(vibe)}>
                          <div className="vyb-home-vibes-teaser-media">
                            {vibe.mediaUrl ? (
                              vibe.kind === "video" ? (
                                <video src={vibe.mediaUrl} autoPlay muted playsInline loop preload="metadata" />
                              ) : (
                                <img src={vibe.mediaUrl} alt={vibe.body || vibe.title} />
                              )
                            ) : (
                              <div className="vyb-home-vibes-teaser-copy">
                                <strong>{vibe.title}</strong>
                                <p>{vibe.body}</p>
                              </div>
                            )}
                          </div>
                          <div className="vyb-home-vibes-teaser-meta">
                            <strong>{vibe.author.displayName}</strong>
                            <span>@{vibe.author.username}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="vyb-campus-right-panel vyb-campus-rail">
        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Your vibe</span>
          <div className="vyb-campus-side-user">
            <img src={`https://i.pravatar.cc/120?u=${encodeURIComponent(viewerEmail)}`} alt={viewerName} />
            <div>
              <strong>{viewerName}</strong>
              <span>@{viewerUsername}</span>
            </div>
          </div>
          <p className="vyb-campus-side-copy">{identityLine}</p>
        </div>

        <div className="vyb-campus-side-card">
          <div className="vyb-campus-side-header">
            <span className="vyb-campus-side-label">Suggested vibes</span>
            <Link href="/search" className="vyb-campus-inline-link">
              Search
            </Link>
          </div>

          {recommendedUsers.length === 0 ? (
            <p className="vyb-campus-side-copy">Campus suggestions will appear here as more profiles go live.</p>
          ) : null}

          {recommendedUsers.map((user) => (
            <div key={user.userId} className="vyb-campus-suggestion">
              <div>
                <Link href={`/u/${encodeURIComponent(user.username)}`}>
                  <strong>{user.username}</strong>
                </Link>
                <span>{user.displayName}</span>
              </div>
              <button
                type="button"
                disabled={followBusyUsername === user.username}
                onClick={() => handleFollowToggle(user.username, !user.isFollowing)}
              >
                {followBusyUsername === user.username
                  ? "..."
                  : user.isFollowing
                    ? "Following"
                    : "Follow"}
              </button>
            </div>
          ))}
        </div>

        <div className="vyb-campus-side-card">
          <span className="vyb-campus-side-label">Campus access</span>
          <ul className="vyb-campus-side-list">
            <li>{collegeName}</li>
            <li>{viewerEmail}</li>
            <li>Role: {role}</li>
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

      {isComposerOpen ? (
        <div className="vyb-campus-compose-backdrop" role="presentation" onClick={() => setIsComposerOpen(false)}>
          <div
            className="vyb-campus-compose-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Create a post"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="vyb-campus-compose-handle" aria-hidden="true" />

            <div className="vyb-campus-compose-head">
              <div className="vyb-campus-compose-head-copy">
                <span className="vyb-campus-compose-kicker">Live feed</span>
                <strong>Create post</strong>
                <span>Publish instantly to the live campus feed.</span>
              </div>
              <button type="button" className="vyb-campus-compose-close" aria-label="Close composer" onClick={() => setIsComposerOpen(false)}>
                <CloseIcon />
              </button>
            </div>

            <div className="vyb-campus-compose-grid">
              <div className="vyb-campus-compose-main">
                <div className="vyb-campus-compose-user">
                  <div className="vyb-campus-compose-avatar" aria-hidden="true">
                    {(viewerName.trim() || viewerUsername).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="vyb-campus-compose-user-copy">
                    <strong>{viewerName}</strong>
                    <span>@{viewerUsername}</span>
                  </div>
                  <span className="vyb-campus-compose-user-pill">Public post</span>
                </div>

                <label className="vyb-campus-compose-field">
                  <span>Caption</span>
                  <textarea
                    value={draftBody}
                    onChange={(event) => setDraftBody(event.target.value)}
                    placeholder="What's on your mind?"
                    rows={5}
                    disabled={isSubmitting}
                  />
                </label>

                {composerMessage ? <p className="vyb-campus-compose-message">{composerMessage}</p> : null}
              </div>

              <aside className="vyb-campus-compose-side">
                <div className="vyb-campus-compose-side-copy">
                  <strong>Tools</strong>
                </div>

                <div className="vyb-campus-compose-option-list">
                  <Link href="/create?kind=post&from=%2Fhome" className="vyb-campus-compose-option">
                    <div className="vyb-campus-compose-option-copy">
                      <span className="vyb-campus-compose-option-icon ic-media">
                        <MediaIcon />
                      </span>
                      <strong>Media</strong>
                    </div>
                  </Link>

                  <Link href="/create?kind=story&from=%2Fhome" className="vyb-campus-compose-option">
                    <div className="vyb-campus-compose-option-copy">
                      <span className="vyb-campus-compose-option-icon ic-story">
                        <StoryIcon />
                      </span>
                      <strong>Story</strong>
                    </div>
                  </Link>

                  <Link href="/create?kind=vibe&from=%2Fhome" className="vyb-campus-compose-option">
                    <div className="vyb-campus-compose-option-copy">
                      <span className="vyb-campus-compose-option-icon ic-vibe">
                        <VibesIcon />
                      </span>
                      <strong>Vibe</strong>
                    </div>
                  </Link>

                  <div className="vyb-campus-compose-option is-static">
                    <div className="vyb-campus-compose-option-copy">
                      <span className="vyb-campus-compose-option-icon ic-globe">
                        <GlobeIcon />
                      </span>
                      <strong>Campus</strong>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className="vyb-campus-compose-link-row">
              <span>Need image or video?</span>
              <Link href="/create?kind=post&from=%2Fhome" className="vyb-campus-inline-link">
                Open full uploader
              </Link>
            </div>

            <div className="vyb-campus-compose-actions">
              <button type="button" className="vyb-campus-compose-secondary" onClick={() => setIsComposerOpen(false)} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="button" className="vyb-campus-compose-primary" onClick={handleQuickPostPublish} disabled={isSubmitting}>
                {isSubmitting ? "Publishing..." : "Publish post"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedStory ? (
        <div className="vyb-story-viewer-backdrop" role="presentation" onClick={() => setSelectedStoryIndex(null)}>
          <div className="vyb-story-viewer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            {selectedStory.mediaType === "image" ? (
              <div
                className="vyb-story-viewer-blur"
                style={{ backgroundImage: `url(${selectedStory.mediaUrl})` }}
                aria-hidden="true"
              />
            ) : null}
            <div className="vyb-story-viewer-scrim vyb-story-viewer-scrim-top" aria-hidden="true" />
            <div className="vyb-story-viewer-scrim vyb-story-viewer-scrim-bottom" aria-hidden="true" />

            <div className="vyb-story-viewer-progress">
              {(selectedStoryGroup?.items ?? []).map((story, index) => (
                <span key={story.id} className="vyb-story-viewer-progress-bar">
                  <span
                    style={{
                      transform: `scaleX(${
                        index < selectedStoryGroupIndex
                          ? 1
                          : index === selectedStoryGroupIndex
                            ? storyProgress
                            : 0
                      })`
                    }}
                  />
                </span>
              ))}
            </div>

            <div className="vyb-story-viewer-head">
              <div className="vyb-story-viewer-user">
                <span className="vyb-story-viewer-avatar" aria-hidden="true">
                  {(selectedStory.displayName.trim() || selectedStory.username).slice(0, 2).toUpperCase()}
                </span>
                <div className="vyb-story-viewer-user-copy">
                  <strong>{selectedStory.isOwn ? "Your story" : selectedStory.displayName}</strong>
                  <span>
                    @{selectedStory.username} • {timeAgo(selectedStory.createdAt)}
                  </span>
                </div>
              </div>
              <div className="vyb-story-viewer-head-actions">
                {selectedStory.mediaType === "video" ? (
                  <button
                    type="button"
                    className={`vyb-story-viewer-sound${isStoryMuted ? "" : " is-active"}`}
                    aria-label={isStoryMuted ? "Unmute story audio" : "Mute story audio"}
                    onClick={handleStorySoundToggle}
                  >
                    {isStoryMuted ? <VolumeOffIcon /> : <VolumeOnIcon />}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="vyb-story-viewer-close"
                  aria-label="Close story viewer"
                  onClick={() => setSelectedStoryIndex(null)}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="vyb-story-viewer-media-wrap">
              <div className="vyb-story-viewer-media">
                {selectedStory.mediaType === "video" ? (
                  <video
                    className="vyb-story-viewer-video"
                    ref={storyVideoRef}
                    src={selectedStory.mediaUrl}
                    autoPlay
                    muted={isStoryMuted}
                    playsInline
                    loop={false}
                    preload="metadata"
                  />
                ) : (
                  <img className="vyb-story-viewer-image" src={selectedStory.mediaUrl} alt={selectedStory.username} />
                )}
              </div>

              <div className="vyb-story-viewer-nav" aria-hidden="true">
                <button
                  type="button"
                  aria-label="Previous story"
                  onPointerDown={() => handleStoryPointerDown("left")}
                  onPointerUp={handleStoryPointerUp}
                  onPointerCancel={handleStoryPointerCancel}
                  onPointerLeave={handleStoryPointerCancel}
                  onContextMenu={(event) => event.preventDefault()}
                />
                <button
                  type="button"
                  aria-label="Pause story"
                  onPointerDown={() => handleStoryPointerDown("center")}
                  onPointerUp={handleStoryPointerUp}
                  onPointerCancel={handleStoryPointerCancel}
                  onPointerLeave={handleStoryPointerCancel}
                  onContextMenu={(event) => event.preventDefault()}
                />
                <button
                  type="button"
                  aria-label="Next story"
                  onPointerDown={() => handleStoryPointerDown("right")}
                  onPointerUp={handleStoryPointerUp}
                  onPointerCancel={handleStoryPointerCancel}
                  onPointerLeave={handleStoryPointerCancel}
                  onContextMenu={(event) => event.preventDefault()}
                />
              </div>
            </div>

            {selectedStory.caption ? <p className="vyb-story-viewer-caption">{selectedStory.caption}</p> : null}

            <div className="vyb-story-viewer-actions">
              <label className="vyb-story-viewer-message">
                <input
                  type="text"
                  value={storyMessageDraft}
                  onChange={(event) => setStoryMessageDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleStoryMessageSubmit();
                    }
                  }}
                  placeholder="Send message"
                />
              </label>
              <button
                type="button"
                className={`vyb-story-viewer-heart${selectedStory.viewerHasLiked ? " is-active" : ""}`}
                disabled={storyBusyId === selectedStory.id}
                aria-label={selectedStory.viewerHasLiked ? "Liked story" : "Like story"}
                onClick={() => void handleStoryLike(selectedStory.id)}
              >
                <HeartIcon />
                <span>{formatMetric(selectedStory.reactions)}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SocialThreadSheet
        viewerName={viewerName}
        viewerUsername={viewerUsername}
        desktopInsetLeft="var(--vyb-campus-left-width)"
        desktopInsetRight="var(--vyb-campus-right-width)"
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
            void handleDirectRepost(actionPost, "feed");
          }
        }}
        onQuoteRepost={(quote) => {
          if (actionPost) {
            void handleQuoteRepost(actionPost, quote, "feed");
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
