"use client";

import type { FeedCard, PostLikerItem, ReactionKind, StoryCard, UserSearchItem } from "@vyb/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CampusAvatarContent, useResolvedAvatarUrl } from "./campus-avatar";
import { SocialPostActionSheet } from "./social-post-action-sheet";
import { SocialPostLightbox } from "./social-post-lightbox";
import { SocialPostLikersSheet } from "./social-post-likers-sheet";
import { SocialPostRepostSheet } from "./social-post-repost-sheet";
import { SocialPostShareSheet } from "./social-post-share-sheet";
import { SocialThreadSheet } from "./social-thread-sheet";
import { buildPrimaryCampusNav, CampusDesktopNavigation, CampusMobileNavigation } from "./campus-navigation";
import { SignOutButton } from "./sign-out-button";
import { useSocialPostEngagement } from "./use-social-post-engagement";
import { VybLogoLockup, VybLogoMark } from "./vyb-logo";
import { MediaCarousel } from "./media-carousel";
import { useSearchNavigationGuard } from "../lib/search-navigation";
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
  unreadChatCount: number;
  recentChats?: unknown[];
  viewerUserId?: string;
  initialViewerIdentity?: unknown;
  initialFocusedPostId?: string | null;
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

function renderStoryRailPreview(story: StoryCard, alt: string) {
  if (story.mediaType === "image") {
    return <img src={story.mediaUrl} alt={alt} loading="lazy" />;
  }

  return (
    <span className="vyb-campus-story-preview is-video" aria-hidden="true">
      <span className="vyb-campus-story-preview-avatar">
        <CampusAvatarContent
          userId={story.userId}
          username={story.username}
          displayName={story.displayName}
          avatarUrl={story.avatarUrl ?? null}
          decorative
        />
      </span>
      <span className="vyb-campus-story-video-badge">
        <PlayIcon />
      </span>
    </span>
  );
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" fill="none" stroke="currentColor" />
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" fill="none" stroke="currentColor" />
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

function HeartIcon() {
  return (
    <IconBase>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" fill="none" stroke="currentColor" />
    </IconBase>
  );
}

function CommentIcon() {
  return (
    <IconBase>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641-.183.711-.532 1.488-1.025 2.115a.498.498 0 00.41.791c1.512-.132 2.871-.78 3.84-1.647A8.905 8.905 0 0012 20.25z" fill="none" stroke="currentColor" />
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

function BookmarkIcon() {
  return (
    <IconBase>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" fill="none" stroke="currentColor" />
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

function BackIcon() {
  return (
    <IconBase>
      <path d="M15 18 9 12l6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function PlayIcon() {
  return (
    <IconBase>
      <path d="M9 7.2v9.6l7.4-4.8z" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

function getProfileHref(username: string, viewerUsername: string) {
  return username === viewerUsername ? "/dashboard" : `/u/${encodeURIComponent(username)}`;
}

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function getPostAuthorLabel(post: FeedCard) {
  return post.isAnonymous ? "Anonymous Vyber" : post.author.displayName || post.author.username;
}

function buildInternalShareDraft(post: FeedCard) {
  const caption = truncateText(post.body || post.title || `Post from ${getPostAuthorLabel(post)}`, 140);
  return `${caption}\n\n${window.location.origin}${window.location.pathname}#post-${post.id}`;
}

const POST_REACTION_OPTIONS: Array<{
  kind: ReactionKind;
  label: string;
  symbol: string;
  tone: string;
}> = [
  { kind: "like", label: "Like", symbol: "👍", tone: "like" },
  { kind: "fire", label: "Fire", symbol: "🔥", tone: "fire" },
  { kind: "support", label: "Support", symbol: "👏", tone: "support" },
  { kind: "love", label: "Love", symbol: "❤️", tone: "love" },
  { kind: "insight", label: "Insight", symbol: "💡", tone: "insight" },
  { kind: "funny", label: "Funny", symbol: "😂", tone: "funny" }
];

function getPostReactionMeta(reactionType: ReactionKind | null | undefined) {
  return POST_REACTION_OPTIONS.find((item) => item.kind === reactionType) ?? POST_REACTION_OPTIONS[0];
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
  suggestedUsers,
  unreadChatCount,
  viewerUserId,
  initialFocusedPostId = null
}: CampusHomeShellProps) {
  const router = useRouter();
  const { isFromSearch, goBack, clearOrigin } = useSearchNavigationGuard("/search");
  const engagement = useSocialPostEngagement(initialPosts, "feed", {
    viewerName,
    viewerUsername,
    viewerUserId: viewerUserId ?? null
  });
  const settingsIdentity = useMemo(
    () => ({
      userId: viewerUserId ?? null,
      username: viewerUsername,
      email: viewerEmail
    }),
    [viewerEmail, viewerUserId, viewerUsername]
  );
  const [recommendedUsers, setRecommendedUsers] = useState(suggestedUsers);
  const [storyFeed, setStoryFeed] = useState(stories);
  const [vibeStrip, setVibeStrip] = useState(trendingVibes);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isStoryPaused, setIsStoryPaused] = useState(false);
  const [isStoryMuted, setIsStoryMuted] = useState(false);
  const [storyMessageDraft, setStoryMessageDraft] = useState("");
  const [seenStoryIds, setSeenStoryIds] = useState<Record<string, true>>({});
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
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
  const [repostComposerPost, setRepostComposerPost] = useState<FeedCard | null>(null);
  const [sharePost, setSharePost] = useState<FeedCard | null>(null);
  const [shareBusyUsername, setShareBusyUsername] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [repostBusyPostId, setRepostBusyPostId] = useState<string | null>(null);
  const [saveBusyPostId, setSaveBusyPostId] = useState<string | null>(null);
  const [reactionTrayPostId, setReactionTrayPostId] = useState<string | null>(null);
  const [storedCampusSettings, setStoredCampusSettings] = useState(createDefaultCampusSettings);
  const [postDisplayPreferences, setPostDisplayPreferences] = useState<Record<string, PostDisplayPreference>>({});
  const storyVideoRef = useRef<HTMLVideoElement | null>(null);
  const storyHoldTimeoutRef = useRef<number | null>(null);
  const storyPointerDownAtRef = useRef<number>(0);
  const storyPointerZoneRef = useRef<"left" | "center" | "right">("center");
  const reactionHoldTimeoutRef = useRef<number | null>(null);
  const suppressReactionClickPostIdRef = useRef<string | null>(null);
  const reactionShellRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasAppliedInitialPostRef = useRef(false);

  const storyGroups = useMemo(() => buildStoryRailGroups(storyFeed, viewerUsername), [storyFeed, viewerUsername]);
  const storySequence = useMemo(() => storyGroups.flatMap((group) => group.items), [storyGroups]);
  const mirroredPostLookup = useMemo(
    () => new Map([...engagement.posts, ...vibeStrip].map((post) => [post.id, post])),
    [engagement.posts, vibeStrip]
  );
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
      clearReactionHoldTimer();
    };
  }, []);

  useEffect(() => {
    if (!isFromSearch || !initialFocusedPostId) {
      return;
    }

    const handleScroll = () => {
      if (window.scrollY > 48) {
        clearOrigin();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [clearOrigin, initialFocusedPostId, isFromSearch]);

  useEffect(() => {
    if (!reactionTrayPostId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const reactionShell = reactionShellRefs.current[reactionTrayPostId];
      if (reactionShell?.contains(event.target as Node)) {
        return;
      }

      suppressReactionClickPostIdRef.current = null;
      setReactionTrayPostId(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [reactionTrayPostId]);

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
  const navItems = useMemo(() => buildPrimaryCampusNav("home", { unreadCount: unreadChatCount }), [unreadChatCount]);
  const viewerAvatarUrl = useResolvedAvatarUrl({
    username: viewerUsername,
    email: viewerEmail
  });
  const createPostHref = "/create?kind=post&from=%2Fhome";
  const createStoryHref = "/create?kind=story&from=%2Fhome";

  useEffect(() => {
    router.prefetch(createPostHref);
    router.prefetch(createStoryHref);
  }, [createPostHref, createStoryHref, router]);

  function syncPostEverywhere(postId: string, updater: (post: FeedCard) => FeedCard) {
    engagement.setPosts((current) => current.map((post) => (post.id === postId ? updater(post) : post)));
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

  async function handlePostReaction(post: FeedCard, reactionType?: ReactionKind, triggerBurst = false) {
    const requestedReactionType = reactionType ?? post.viewerReactionType ?? "like";
    const reaction = await engagement.react(post.id, requestedReactionType);
    if (!reaction) {
      setFlashMessage("We could not update that reaction right now.");
      return;
    }

    if (reaction.active && reaction.viewerReactionType === "like" && (triggerBurst || requestedReactionType === "like")) {
      setHeartBurstPostId(post.id);
    }

    syncPostEverywhere(post.id, (current) => ({
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
        setLikesMessage(payload?.error?.message ?? "We could not load the reaction list right now.");
        return;
      }

      setLikesByPost((current) => ({
        ...current,
        [post.id]: payload?.items ?? []
      }));
    } catch {
      setLikesMessage("We could not load the reaction list right now.");
    } finally {
      setLikesLoadingPostId(null);
    }
  }

  useEffect(() => {
    const syncLatestPost = (current: FeedCard | null) => {
      if (!current) {
        return current;
      }

      return mirroredPostLookup.get(current.id) ?? null;
    };

    setLightboxPost(syncLatestPost);
    setLikesPost(syncLatestPost);
    setActionPost(syncLatestPost);
  }, [mirroredPostLookup]);

  async function handleTogglePostSave(post: FeedCard) {
    setSaveBusyPostId(post.id);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}/save`, {
        method: "PUT"
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            postId?: string;
            savedCount?: number;
            isSaved?: boolean;
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || typeof payload?.savedCount !== "number" || typeof payload?.isSaved !== "boolean") {
        const nextMessage = payload?.error?.message ?? "We could not update your saved posts right now.";
        setActionMessage(nextMessage);
        setFlashMessage(nextMessage);
        return;
      }

      syncPostEverywhere(post.id, (current) => ({
        ...current,
        savedCount: payload.savedCount ?? current.savedCount,
        isSaved: payload.isSaved ?? current.isSaved
      }));
      setFlashMessage(payload.isSaved ? "Post saved." : "Post removed from saved.");
    } catch {
      setActionMessage("We could not update your saved posts right now.");
      setFlashMessage("We could not update your saved posts right now.");
    } finally {
      setSaveBusyPostId(null);
    }
  }

  function openRepostComposer(post: FeedCard) {
    setReactionTrayPostId(null);
    setActionMessage(null);
    setActionPost(null);
    setRepostComposerPost(post);
  }

  async function handleSubmitRepost(post: FeedCard, repostPayload: { quote: string; placement: "feed" | "vibe" }) {
    setActionBusy(true);
    setActionMessage(null);
    setReactionTrayPostId(null);
    setRepostBusyPostId(post.id);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}/repost`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          placement: repostPayload.placement,
          quote: repostPayload.quote.trim() || undefined
        })
      });
      const responsePayload = (await response.json().catch(() => null)) as
        | {
            item?: FeedCard;
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !responsePayload?.item) {
        setActionMessage(responsePayload?.error?.message ?? "We could not repost this right now.");
        return;
      }

      if (responsePayload.item.placement === "feed") {
        engagement.prependPost(responsePayload.item);
      } else {
        setVibeStrip((current) => [responsePayload.item!, ...current].slice(0, 10));
      }

      setActionPost(null);
      setRepostComposerPost(null);
      setFlashMessage(repostPayload.quote.trim() ? "Your repost is now live." : "Reposted to your campus lane.");
      router.refresh();
    } catch {
      setActionMessage("We could not repost this right now.");
    } finally {
      setRepostBusyPostId(null);
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
      setFlashMessage("Share link copied.");
    } catch {
      setActionMessage("We could not copy that link right now.");
    }
  }

  useEffect(() => {
    if (!initialFocusedPostId || hasAppliedInitialPostRef.current || engagement.posts.length === 0) {
      return;
    }

    const targetPost = engagement.posts.find((post) => post.id === initialFocusedPostId);
    if (!targetPost) {
      hasAppliedInitialPostRef.current = true;
      return;
    }

    hasAppliedInitialPostRef.current = true;
    window.requestAnimationFrame(() => {
      document.getElementById(`post-${targetPost.id}`)?.scrollIntoView({
        block: "center",
        behavior: "smooth"
      });
    });
    void openPostLightbox(targetPost);
  }, [engagement.posts, initialFocusedPostId]);

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

  function handleSharePost(post: FeedCard) {
    setShareMessage(null);
    setActionPost(null);
    setSharePost(post);
  }

  async function handleShareToChat(post: FeedCard, username: string) {
    const normalizedUsername = username.trim().replace(/^@+/u, "");

    if (!normalizedUsername) {
      setShareMessage("Enter a valid username first.");
      return;
    }

    setShareBusyUsername(normalizedUsername);
    setShareMessage(null);

    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ recipientUsername: normalizedUsername })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            conversation?: {
              id?: string;
            };
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !payload?.conversation?.id) {
        setShareMessage(payload?.error?.message ?? "We could not open that chat right now.");
        return;
      }

      const shareParams = new URLSearchParams({
        draft: buildInternalShareDraft(post),
        sharedPostId: post.id,
        sharedPostAuthor: getPostAuthorLabel(post),
        sharedPostTitle: truncateText(post.title || "", 80),
        sharedPostBody: truncateText(post.body || "", 140),
        sharedPostMediaUrl: post.media?.[0]?.url ?? post.mediaUrl ?? "",
        sharedPostMediaKind: post.media?.[0]?.kind ?? (post.mediaUrl ? (post.kind === "video" ? "video" : "image") : "")
      });

      setSharePost(null);
      router.push(`/messages/${encodeURIComponent(payload.conversation.id)}?${shareParams.toString()}`);
    } catch {
      setShareMessage("Network issue while opening that chat.");
    } finally {
      setShareBusyUsername(null);
    }
  }

  function clearReactionHoldTimer() {
    if (reactionHoldTimeoutRef.current !== null) {
      window.clearTimeout(reactionHoldTimeoutRef.current);
      reactionHoldTimeoutRef.current = null;
    }
  }

  function handleReactionButtonPointerDown(postId: string) {
    clearReactionHoldTimer();
    reactionHoldTimeoutRef.current = window.setTimeout(() => {
      suppressReactionClickPostIdRef.current = postId;
      setReactionTrayPostId(postId);
      reactionHoldTimeoutRef.current = null;
    }, 320);
  }

  function handleReactionButtonPointerCancel() {
    clearReactionHoldTimer();
  }

  function handleReactionButtonClick(post: FeedCard) {
    if (suppressReactionClickPostIdRef.current === post.id) {
      suppressReactionClickPostIdRef.current = null;
      return;
    }

    setReactionTrayPostId(null);
    void handlePostReaction(post);
  }

  function handleReactionOptionSelect(post: FeedCard, reactionType: ReactionKind) {
    setReactionTrayPostId(null);
    suppressReactionClickPostIdRef.current = null;
    void handlePostReaction(post, reactionType);
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

  function closeStoryViewer() {
    setStoryProgress(0);
    setSelectedStoryIndex(null);
  }

  function clearStoryHoldTimer() {
    if (storyHoldTimeoutRef.current !== null) {
      window.clearTimeout(storyHoldTimeoutRef.current);
      storyHoldTimeoutRef.current = null;
    }
  }

  function handleStoryPointerDown(event: ReactPointerEvent<HTMLButtonElement>, zone: "left" | "center" | "right") {
    event.preventDefault();
    event.stopPropagation();
    storyPointerZoneRef.current = zone;
    storyPointerDownAtRef.current = performance.now();
    clearStoryHoldTimer();
    storyHoldTimeoutRef.current = window.setTimeout(() => {
      setIsStoryPaused(true);
    }, 180);
  }

  function handleStoryPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const wasLongPress = performance.now() - storyPointerDownAtRef.current >= 180;

    clearStoryHoldTimer();
    setIsStoryPaused(false);

    if (wasLongPress) {
      return;
    }
  }

  function handleStoryPointerCancel(event?: ReactPointerEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();
    clearStoryHoldTimer();
    setIsStoryPaused(false);
  }

  function handleStoryZoneClick(event: ReactMouseEvent<HTMLButtonElement>, zone: "left" | "center" | "right") {
    event.preventDefault();
    event.stopPropagation();

    if (performance.now() - storyPointerDownAtRef.current >= 180) {
      return;
    }

    if (zone === "left") {
      moveStory(-1);
      return;
    }

    if (zone === "right") {
      moveStory(1);
    }
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

  async function handleEditPost(post: FeedCard, payload: { title: string | null; body: string; location: string | null; allowAnonymousComments: boolean }) {
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

      syncPostEverywhere(post.id, () => data.item!);
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
      <CampusDesktopNavigation navItems={navItems} viewerName={viewerName} viewerUsername={viewerUsername} />

      <section className="vyb-campus-main">
        <header className="vyb-campus-topbar">
          <div className="vyb-campus-topbar-copy">
            <strong>Campus feed</strong>
            <span>{collegeName}</span>
          </div>

          <div className="vyb-campus-top-actions">
            {isFromSearch ? (
              <button type="button" className="vyb-campus-top-icon" aria-label="Back to search" onClick={() => goBack()}>
                <BackIcon />
              </button>
            ) : null}
            <Link href="/search" className="vyb-campus-top-icon vyb-campus-top-link" aria-label="Search campus users">
              <SearchIcon />
            </Link>
            <button type="button" className="vyb-campus-top-icon" aria-label="Notifications">
              <BellIcon />
            </button>
            <button
              type="button"
              className="vyb-campus-post-trigger"
              onPointerEnter={() => router.prefetch(createPostHref)}
              onPointerDown={() => router.prefetch(createPostHref)}
              onClick={() => router.push(createPostHref)}
            >
              <AddPostIcon />
              <span>Create post</span>
            </button>
            <Link href="/messages" className="vyb-campus-top-icon vyb-campus-top-link" aria-label="Open campus messages">
              <SendIcon />
              {unreadChatCount > 0 ? (
                <span className="vyb-campus-top-badge">{unreadChatCount > 9 ? "9+" : unreadChatCount}</span>
              ) : null}
            </Link>
          </div>
        </header>

        <header className="vyb-campus-mobile-header">
          <Link href="/home" className="vyb-campus-branding vyb-campus-branding-mobile">
            <VybLogoMark />
          </Link>
          <div className="vyb-campus-mobile-actions">
            {isFromSearch ? (
              <button type="button" className="vyb-campus-top-icon" aria-label="Back to search" onClick={() => goBack()}>
                <BackIcon />
              </button>
            ) : null}
            <Link href="/search" className="vyb-campus-top-icon vyb-campus-top-link" aria-label="Search campus users">
              <SearchIcon />
            </Link>
            <button type="button" className="vyb-campus-post-trigger vyb-campus-post-trigger-mobile" onClick={() => router.push(createPostHref)}>
              <AddPostIcon />
              <span>Post</span>
            </button>
            <Link href="/messages" className="vyb-campus-top-icon vyb-campus-top-link" aria-label="Open campus messages">
              <SendIcon />
              {unreadChatCount > 0 ? (
                <span className="vyb-campus-top-badge">{unreadChatCount > 9 ? "9+" : unreadChatCount}</span>
              ) : null}
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
                    {renderStoryRailPreview(ownStoryGroup.preview, "Your story")}
                  </span>
                  <span>Your story</span>
                </button>
                <button
                  type="button"
                  className="vyb-campus-story-plus"
                  aria-label="Add a new story"
                  onClick={() => router.push(createStoryHref)}
                >
                  <AddPostIcon />
                </button>
              </div>
            ) : (
              <button type="button" className="vyb-campus-story vyb-campus-story-add" onClick={() => router.push(createStoryHref)}>
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
                  {renderStoryRailPreview(group.preview, group.username)}
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
              const reactionMeta = getPostReactionMeta(post.viewerReactionType);
              const hasViewerReaction = Boolean(post.viewerReactionType);
              const displayControls = getPostDisplayControls(storedCampusSettings, post, postDisplayPreferences[post.id]);

              return (
              <div key={post.id} className="vyb-campus-feed-item">
                <article id={`post-${post.id}`} className={`fc-card${post.isAnonymous ? " fc-card--anonymous" : ""}`}>
                  {/* ── Header ── */}
                  <div className="fc-header">
                    {post.isAnonymous ? (
                      <span className="fc-avatar fc-avatar--anonymous" aria-label="Anonymous author">
                        <CampusAvatarContent
                          userId={post.author.userId}
                          username={post.author.username}
                          displayName={post.author.displayName}
                          avatarUrl={post.author.avatarUrl ?? null}
                          fallback={(post.author.displayName || "Anonymous").slice(0, 2).toUpperCase()}
                          decorative
                        />
                      </span>
                    ) : (
                      <Link href={getProfileHref(post.author.username, viewerUsername)} className="fc-avatar" aria-label={post.author.username}>
                        <CampusAvatarContent
                          userId={post.author.userId}
                          username={post.author.username}
                          displayName={post.author.displayName}
                          avatarUrl={post.author.avatarUrl ?? null}
                          fallback={post.author.displayName.slice(0, 1).toUpperCase()}
                          decorative
                        />
                      </Link>
                    )}
                    <div className="fc-header-info">
                      <div className="fc-header-top">
                        {post.isAnonymous ? (
                          <span className="fc-author-name fc-author-name--anonymous">{getPostAuthorLabel(post)}</span>
                        ) : (
                          <Link href={getProfileHref(post.author.username, viewerUsername)} className="fc-author-name">
                            {post.author.displayName || post.author.username}
                          </Link>
                        )}
                      </div>
                      <div className="fc-header-bottom">
                        <span className="fc-username">{post.isAnonymous ? "Hidden profile" : `@${post.author.username}`}</span>
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
                      onDoubleClick={() => void handlePostReaction(post, "like", true)}
                    >
                      <MediaCarousel
                        items={mediaItems}
                        alt={post.body || post.title || "Post media"}
                        onClick={() => void openPostLightbox(post)}
                        onDoubleTap={() => void handlePostReaction(post, "like", true)}
                        showHeartBurst={heartBurstPostId === post.id}
                        heartBurstNode={
                          <span className="vyb-heart-pulse" aria-hidden="true">
                            <HeartIcon />
                          </span>
                        }
                      />
                    </div>
                  )}

                  {/* ── Metrics Bar ── */}
                  <div className="fc-metrics-bar">
                    <div className="fc-metrics-left">
                      {displayControls.hideReactionCount ? null : <span>{formatMetric(post.reactions)} reactions</span>}
                      {displayControls.hideCommentCount ? null : <span>{formatMetric(post.comments)} comments</span>}
                    </div>
                    <div className="fc-metrics-right">
                      <span>{formatMetric(post.savedCount || 0)} shares</span>
                    </div>
                  </div>

                  {/* ── Actions ── */}
                  <div className="fc-actions">
                    <div className="fc-actions-group is-left">
                      <div
                        ref={(node) => {
                          reactionShellRefs.current[post.id] = node;
                        }}
                        className={`fc-reaction-shell${reactionTrayPostId === post.id ? " is-open" : ""}`}
                      >
                        <button
                          type="button"
                          className={`fc-action-btn is-reaction-btn${hasViewerReaction ? ` reaction-${reactionMeta.tone} is-active` : ""}`}
                          disabled={engagement.loadingPostId === post.id}
                          aria-pressed={hasViewerReaction}
                          title={hasViewerReaction ? `Remove ${reactionMeta.label}` : "Like"}
                          onPointerDown={() => handleReactionButtonPointerDown(post.id)}
                          onPointerUp={handleReactionButtonPointerCancel}
                          onPointerCancel={handleReactionButtonPointerCancel}
                          onPointerLeave={handleReactionButtonPointerCancel}
                          onContextMenu={(event) => event.preventDefault()}
                          onClick={() => handleReactionButtonClick(post)}
                        >
                          <span className="fc-action-symbol" aria-hidden="true">{reactionMeta.symbol}</span>
                        </button>

                        <div className="fc-reaction-tray" role="menu" aria-label="Choose a reaction">
                          {POST_REACTION_OPTIONS.map((option) => (
                            <button
                              key={option.kind}
                              type="button"
                              className={`fc-reaction-option reaction-${option.tone}${post.viewerReactionType === option.kind ? " is-selected" : ""}`}
                              aria-label={option.label}
                              title={option.label}
                              onClick={() => handleReactionOptionSelect(post, option.kind)}
                            >
                              <span aria-hidden="true">{option.symbol}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="fc-action-btn"
                        onClick={() => void engagement.openThread(post.id)}
                      >
                        <CommentIcon />
                      </button>

                      <button
                        type="button"
                        className="fc-action-btn"
                        onClick={() => handleSharePost(post)}
                      >
                        <ShareIcon />
                      </button>
                    </div>

                    <div className="fc-actions-group is-right">
                      <button
                        type="button"
                        className="fc-action-btn"
                        disabled={repostBusyPostId === post.id}
                        onClick={() => openRepostComposer(post)}
                        title="Repost"
                      >
                        <RepostIcon />
                      </button>
                      <button
                        type="button"
                        className={`fc-action-btn${post.isSaved ? " is-active is-save-active" : ""}`}
                        disabled={saveBusyPostId === post.id}
                        onClick={() => void handleTogglePostSave(post)}
                        title="Save"
                      >
                        <BookmarkIcon />
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
                            <strong>{getPostAuthorLabel(vibe)}</strong>
                            <span>{vibe.isAnonymous ? "Hidden profile" : `@${vibe.author.username}`}</span>
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
            <img src={viewerAvatarUrl ?? `https://i.pravatar.cc/120?u=${encodeURIComponent(viewerEmail)}`} alt={viewerName} />
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

      <CampusMobileNavigation navItems={navItems} />

      {selectedStory ? (
        <div className="vyb-story-viewer-backdrop" role="presentation" onClick={closeStoryViewer}>
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
                   <CampusAvatarContent
                     userId={selectedStory.userId}
                     username={selectedStory.username}
                     displayName={selectedStory.displayName}
                     avatarUrl={selectedStory.avatarUrl ?? null}
                     fallback={(selectedStory.displayName.trim() || selectedStory.username).slice(0, 2).toUpperCase()}
                     decorative
                   />
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
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      closeStoryViewer();
                    }}
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
                  onClick={(event) => handleStoryZoneClick(event, "left")}
                  onPointerDown={(event) => handleStoryPointerDown(event, "left")}
                  onPointerUp={handleStoryPointerUp}
                  onPointerCancel={handleStoryPointerCancel}
                  onPointerLeave={handleStoryPointerCancel}
                  onContextMenu={(event) => event.preventDefault()}
                />
                <button
                  type="button"
                  aria-label="Pause story"
                  onClick={(event) => handleStoryZoneClick(event, "center")}
                  onPointerDown={(event) => handleStoryPointerDown(event, "center")}
                  onPointerUp={handleStoryPointerUp}
                  onPointerCancel={handleStoryPointerCancel}
                  onPointerLeave={handleStoryPointerCancel}
                  onContextMenu={(event) => event.preventDefault()}
                />
                <button
                  type="button"
                  aria-label="Next story"
                  onClick={(event) => handleStoryZoneClick(event, "right")}
                  onPointerDown={(event) => handleStoryPointerDown(event, "right")}
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
        deletingCommentId={engagement.threadDeletingCommentId}
        isAnonymousComment={engagement.threadIsAnonymous}
        onClose={engagement.closeThread}
        onDraftChange={engagement.setThreadDraft}
        onMediaUrlChange={engagement.setThreadMediaUrl}
        onMediaTypeChange={engagement.setThreadMediaType}
        onAnonymousCommentChange={engagement.setThreadIsAnonymous}
        onReply={engagement.beginReply}
        onCommentLike={(commentId) => {
          void engagement.reactToComment(commentId);
        }}
        onDeleteComment={(comment) => {
          void engagement.deleteComment(comment.id);
        }}
        onEditComment={(comment, body) => engagement.editComment(comment.id, body)}
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
            void handlePostReaction(lightboxPost, undefined, true);
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
        shareTargets={recommendedUsers.map((user) => ({
          userId: user.userId,
          username: user.username,
          displayName: user.displayName,
          source: "suggested" as const
        }))}
        busyUsername={shareBusyUsername}
        message={shareMessage}
        onClose={() => {
          if (!shareBusyUsername) {
            setSharePost(null);
            setShareMessage(null);
          }
        }}
        onAddToStory={() => {}}
        onShare={(target) => {
          if (sharePost) {
            void handleShareToChat(sharePost, target.username);
          }
        }}
      />
    </main>
  );
}
