"use client";

import type { FeedCard, PostLikerItem, StoryCard, UserSearchItem } from "@vyb/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { SocialPostActionSheet } from "./social-post-action-sheet";
import { SocialPostLightbox } from "./social-post-lightbox";
import { SocialPostLikersSheet } from "./social-post-likers-sheet";
import { SocialThreadSheet } from "./social-thread-sheet";
import { SignOutButton } from "./sign-out-button";
import { useSocialPostEngagement } from "./use-social-post-engagement";

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

function buildSeenStoryMap(items: StoryCard[]) {
  return items.reduce<Record<string, true>>((accumulator, story) => {
    if (story.viewerHasSeen) {
      accumulator[story.id] = true;
    }

    return accumulator;
  }, {});
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

  const selectedStory = selectedStoryIndex === null ? null : storyFeed[selectedStoryIndex] ?? null;

  useEffect(() => {
    setStoryFeed(stories);
    setSeenStoryIds(buildSeenStoryMap(stories));
  }, [stories]);

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

    const durationMs = selectedStory.mediaType === "video" ? 6500 : 5200;
    let frameId = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const nextProgress = Math.min(1, (now - startedAt) / durationMs);
      setStoryProgress(nextProgress);

      if (nextProgress >= 1) {
        setSelectedStoryIndex((current) => {
          if (current === null) {
            return null;
          }

          return current + 1 < storyFeed.length ? current + 1 : null;
        });
        return;
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [selectedStory, storyFeed.length]);

  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;
  const navItems = useMemo(
    () => [
      { label: "Home", href: "/home", icon: <HomeIcon />, active: true },
      { label: "Events", href: "/events", icon: <EventsIcon /> },
      { label: "Vibes", href: "/vibes", icon: <ReelsIcon /> },
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

  function openStoryAt(index: number) {
    setSelectedStoryIndex(index);
  }

  function moveStory(offset: number) {
    setSelectedStoryIndex((current) => {
      if (current === null) {
        return null;
      }

      const next = current + offset;
      return next >= 0 && next < storyFeed.length ? next : null;
    });
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
            <button type="button" className="vyb-campus-top-icon" aria-label="Messages">
              <SendIcon />
            </button>
          </div>
        </header>

        <header className="vyb-campus-mobile-header">
          <Link href="/home" className="vyb-campus-branding vyb-campus-branding-mobile">
            VYB
          </Link>
          <div className="vyb-campus-mobile-actions">
            <Link href="/search" className="vyb-campus-top-icon vyb-campus-top-link" aria-label="Search campus users">
              <SearchIcon />
            </Link>
            <button type="button" className="vyb-campus-post-trigger vyb-campus-post-trigger-mobile" onClick={() => setIsComposerOpen(true)}>
              <AddPostIcon />
              <span>Post</span>
            </button>
          </div>
        </header>

        {flashMessage ? <div className="vyb-campus-flash-message">{flashMessage}</div> : null}

        <div className="vyb-campus-feed-stack">
          <div className="vyb-campus-stories">
            <button type="button" className="vyb-campus-story vyb-campus-story-add" onClick={() => router.push("/create?kind=story&from=%2Fhome")}>
              <span className="vyb-campus-story-ring vyb-campus-story-ring-add">
                <AddPostIcon />
              </span>
              <span>Your story</span>
            </button>

            {storyFeed.map((story, index) => (
              <button
                key={story.id}
                type="button"
                className={`vyb-campus-story${seenStoryIds[story.id] ? " is-seen" : ""}`}
                onClick={() => openStoryAt(index)}
              >
                <span className={`vyb-campus-story-ring${selectedStory?.id === story.id ? " is-active" : ""}`}>
                  {story.mediaType === "video" ? (
                    <video src={story.mediaUrl} muted playsInline autoPlay loop />
                  ) : (
                    <img src={story.mediaUrl} alt={story.username} />
                  )}
                </span>
                <span>{story.username}</span>
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

            {engagement.posts.map((post, index) => (
              <div key={post.id}>
                <article id={`post-${post.id}`} className="vyb-campus-feed-card">
                  <div className="vyb-campus-card-top">
                    <div className="vyb-campus-card-author">
                      <span className="vyb-campus-card-avatar">{post.author.displayName.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <Link href={getProfileHref(post.author.username, viewerUsername)}>
                          <strong>{post.author.username}</strong>
                        </Link>
                        <span>{post.location ?? collegeName}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="vyb-campus-icon-button"
                      aria-label="Post options"
                      onClick={() => {
                        setActionMessage(null);
                        setActionPost(post);
                      }}
                    >
                      <MenuIcon />
                    </button>
                  </div>

                  <div
                    className="vyb-campus-post-media-shell"
                    role="button"
                    tabIndex={0}
                    onClick={() => void openPostLightbox(post)}
                    onDoubleClick={() => void handlePostLike(post, true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void openPostLightbox(post);
                      }
                    }}
                  >
                    {post.mediaUrl && post.kind === "video" ? (
                      <video src={post.mediaUrl} className="vyb-campus-post-image" autoPlay muted playsInline loop preload="metadata" />
                    ) : post.mediaUrl ? (
                      <img src={post.mediaUrl} alt={post.body || post.title} className="vyb-campus-post-image" />
                    ) : (
                      <div className="vyb-campus-post-copy-panel">
                        {post.title ? <strong>{post.title}</strong> : null}
                        <p>{post.body}</p>
                      </div>
                    )}

                    {heartBurstPostId === post.id ? (
                      <span className="vyb-campus-heart-burst" aria-hidden="true">
                        <HeartIcon />
                      </span>
                    ) : null}
                  </div>

                  <div className="vyb-campus-card-actions">
                    <div className="vyb-campus-card-actions-left">
                      <button
                        type="button"
                        className={`vyb-campus-action-icon${post.viewerReactionType === "like" ? " is-active" : ""}`}
                        aria-label="Like post"
                        disabled={engagement.loadingPostId === post.id}
                        onClick={() => void handlePostLike(post)}
                      >
                        <HeartIcon />
                      </button>
                      <button
                        type="button"
                        className="vyb-campus-action-icon"
                        aria-label="Comment on post"
                        onClick={() => void engagement.openThread(post.id)}
                      >
                        <CommentIcon />
                      </button>
                      <button
                        type="button"
                        className="vyb-campus-action-icon"
                        aria-label="Repost post"
                        onClick={() => {
                          setActionMessage(null);
                          setActionPost(post);
                        }}
                      >
                        <ShareIcon />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="vyb-campus-action-icon"
                      aria-label="Open full screen post"
                      onClick={() => void openPostLightbox(post)}
                    >
                      <BookmarkIcon />
                    </button>
                  </div>

                  <div className="vyb-campus-card-copy">
                    <button type="button" className="vyb-campus-card-likes vyb-campus-inline-stat" onClick={() => void openPostLikes(post)}>
                      {formatMetric(post.reactions)} likes
                    </button>
                    <button type="button" className="vyb-campus-card-meta vyb-campus-inline-stat" onClick={() => void engagement.openThread(post.id)}>
                      {formatMetric(post.comments)} comments
                    </button>
                    <p>
                      <strong>{post.author.username}</strong> {post.body}
                    </p>
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
            ))}
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
                        <ReelsIcon />
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
            <div className="vyb-story-viewer-progress">
              {storyFeed.map((story, index) => (
                <span key={story.id} className="vyb-story-viewer-progress-bar">
                  <span
                    style={{
                      transform: `scaleX(${
                        index < (selectedStoryIndex ?? 0)
                          ? 1
                          : index === selectedStoryIndex
                            ? storyProgress
                            : 0
                      })`
                    }}
                  />
                </span>
              ))}
            </div>

            <div className="vyb-story-viewer-head">
              <div>
                <strong>@{selectedStory.username}</strong>
                <span>{selectedStory.displayName}</span>
              </div>
              <button type="button" className="vyb-campus-compose-secondary" onClick={() => setSelectedStoryIndex(null)}>
                Close
              </button>
            </div>

            <div className="vyb-story-viewer-media">
              {selectedStory.mediaType === "video" ? (
                <video src={selectedStory.mediaUrl} controls autoPlay muted playsInline loop />
              ) : (
                <img src={selectedStory.mediaUrl} alt={selectedStory.username} />
              )}

              <div className="vyb-story-viewer-nav">
                <button type="button" aria-label="Previous story" onClick={() => moveStory(-1)} />
                <button type="button" aria-label="Next story" onClick={() => moveStory(1)} />
              </div>
            </div>

            {selectedStory.caption ? <p className="vyb-story-viewer-caption">{selectedStory.caption}</p> : null}

            <div className="vyb-story-viewer-actions">
              <button
                type="button"
                className={`vyb-campus-compose-primary vyb-story-like-button${selectedStory.viewerHasLiked ? " is-active" : ""}`}
                disabled={storyBusyId === selectedStory.id}
                onClick={() => void handleStoryLike(selectedStory.id)}
              >
                {storyBusyId === selectedStory.id
                  ? "Liking..."
                  : selectedStory.viewerHasLiked
                    ? `Liked • ${formatMetric(selectedStory.reactions)}`
                    : `Like story • ${formatMetric(selectedStory.reactions)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
