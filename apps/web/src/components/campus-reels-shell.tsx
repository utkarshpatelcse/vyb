"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { consumeCampusUploads } from "../lib/campus-upload-store";
import { SignOutButton } from "./sign-out-button";

type ReelCategory = "All" | "Trending" | "Tech" | "Campus life" | "Sports" | "Creators";

type ReelItem = {
  id: string;
  title: string;
  creator: string;
  caption: string;
  posterUrl: string;
  videoUrl: string;
  likes: number;
  comments: number;
  shares: number;
  duration: string;
  category: Exclude<ReelCategory, "All">;
  soundtrack: string;
  location: string;
};

type ReelFeedItem = ReelItem & {
  feedId: string;
};

type CampusReelsShellProps = {
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

const REELS: ReelItem[] = [
  {
    id: "1",
    title: "Open mic in 18 seconds",
    creator: "campus.frame",
    caption: "The crowd switch-up right before the chorus hit was unreal.",
    posterUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=900&q=80&auto=format&fit=crop",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    likes: 128000,
    comments: 2300,
    shares: 810,
    duration: "0:18",
    category: "Trending",
    soundtrack: "Midnight crowd remix",
    location: "Central auditorium"
  },
  {
    id: "2",
    title: "Lab to launch day",
    creator: "build.with.us",
    caption: "Prototype reveal clips stitched from the product sprint room.",
    posterUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=900&q=80&auto=format&fit=crop",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    likes: 64000,
    comments: 1800,
    shares: 620,
    duration: "0:27",
    category: "Tech",
    soundtrack: "Static pulse",
    location: "Innovation lab"
  },
  {
    id: "3",
    title: "Hostel room glow-up",
    creator: "room.vibes",
    caption: "A full before and after built with cheap lights, notes, and clean desk energy.",
    posterUrl: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900&q=80&auto=format&fit=crop",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    likes: 43000,
    comments: 920,
    shares: 310,
    duration: "0:22",
    category: "Campus life",
    soundtrack: "Soft synth loop",
    location: "Block C hostel"
  },
  {
    id: "4",
    title: "Game day tunnel walk",
    creator: "sports.board",
    caption: "Quick cuts from warmups, team huddle, and the final crowd roar.",
    posterUrl: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=900&q=80&auto=format&fit=crop",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    likes: 89000,
    comments: 2100,
    shares: 970,
    duration: "0:16",
    category: "Sports",
    soundtrack: "Arena bassline",
    location: "Main stadium"
  },
  {
    id: "5",
    title: "Design critique snippets",
    creator: "design.circle",
    caption: "Tight cuts from portfolio reviews and one sharp feedback line after another.",
    posterUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&q=80&auto=format&fit=crop",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    likes: 52000,
    comments: 1300,
    shares: 440,
    duration: "0:24",
    category: "Creators",
    soundtrack: "Low tempo clicks",
    location: "Studio bay"
  },
  {
    id: "6",
    title: "Sunrise run diary",
    creator: "fit.on.campus",
    caption: "Golden-hour campus laps, shoe sounds, and zero narration.",
    posterUrl: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=900&q=80&auto=format&fit=crop",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    likes: 31000,
    comments: 670,
    shares: 210,
    duration: "0:14",
    category: "Campus life",
    soundtrack: "Run club ambient",
    location: "Sports complex"
  }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatMetric(value: number) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}K`;
  }

  return String(value);
}

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function buildFeedBatch(source: ReelItem[], batchIndex: number, size: number) {
  if (source.length === 0) {
    return [] as ReelFeedItem[];
  }

  return Array.from({ length: size }, (_, index) => {
    const reel = source[(batchIndex * size + index) % source.length];

    return {
      ...reel,
      feedId: `${reel.id}-${batchIndex}-${index}`
    };
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

function SendIcon() {
  return (
    <IconBase>
      <path d="M21 4 10 15M21 4l-7 17-4-6-6-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function RepostIcon() {
  return (
    <IconBase>
      <path d="M7 6.5h6.1A3.9 3.9 0 0 1 17 10.4v5.3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m14.5 13.2 2.5 2.5 2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 17.5h-6.1A3.9 3.9 0 0 1 7 13.6V8.3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9.5 10.8-2.5-2.5-2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function MoreIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="5.2" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="18.8" r="1.5" fill="currentColor" />
    </IconBase>
  );
}

function ReportIcon() {
  return (
    <IconBase>
      <path d="M6 20V5.2A1.2 1.2 0 0 1 7.2 4h8.9l-1.5 3.1 1.9 3.5H8.2A1.2 1.2 0 0 0 7 11.8V20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function DislikeIcon() {
  return (
    <IconBase>
      <path d="M9.5 14.5v4.1a1.7 1.7 0 0 0 3.1.9l2.4-4.1h2.5a1.7 1.7 0 0 0 1.7-1.4l1-6.1A1.7 1.7 0 0 0 18.5 6H10a2 2 0 0 0-1.8 1.1L6.5 10v4.5zM4 10.2v5.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function HideIcon() {
  return (
    <IconBase>
      <path d="M3.5 12S7 6.5 12 6.5 20.5 12 20.5 12 17 17.5 12 17.5 3.5 12 3.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4 4 16 16M14.3 14.4A3 3 0 0 1 9.6 9.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function VolumeIcon() {
  return (
    <IconBase>
      <path d="M5 14H2v-4h3l4-3v10zm10.5-6.5a5 5 0 0 1 0 9m2.5-12a8.5 8.5 0 0 1 0 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function MuteIcon() {
  return (
    <IconBase>
      <path d="M5 14H2v-4h3l4-3v10zm8-3 6 6M19 11l-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function PlayIcon() {
  return (
    <IconBase>
      <path d="M8 6.8v10.4a1 1 0 0 0 1.5.9l8.3-5.2a1 1 0 0 0 0-1.7L9.5 5.9a1 1 0 0 0-1.5.9Z" fill="currentColor" />
    </IconBase>
  );
}

function MusicIcon() {
  return (
    <IconBase>
      <path d="M14 5v10.5a2.5 2.5 0 1 1-2-2.4V7.2l7-1.7v8a2.5 2.5 0 1 1-2-2.4V4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function SparkIcon() {
  return (
    <IconBase>
      <path d="M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2L10 9l2-5.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

export function CampusReelsShell({
  viewerName,
  collegeName,
  viewerEmail,
  course,
  stream,
  role
}: CampusReelsShellProps) {
  const router = useRouter();
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [activeResize, setActiveResize] = useState<ResizeSide | null>(null);
  const [activeCategory, setActiveCategory] = useState<ReelCategory>("All");
  const [feedReels, setFeedReels] = useState<ReelFeedItem[]>([]);
  const [activeFeedId, setActiveFeedId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [repostedIds, setRepostedIds] = useState<string[]>([]);
  const [dislikedIds, setDislikedIds] = useState<string[]>([]);
  const [reportedIds, setReportedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [followedCreators, setFollowedCreators] = useState<string[]>(["campus.frame"]);
  const [pausedFeedId, setPausedFeedId] = useState<string | null>(null);
  const [expandedCaptionIds, setExpandedCaptionIds] = useState<string[]>([]);
  const [uploadedReels, setUploadedReels] = useState<ReelItem[]>([]);
  const [uploadMessage, setUploadMessage] = useState("Upload 9:16 portrait clips to make the Vibes feed feel native.");
  const [isUploading, setIsUploading] = useState(false);
  const [burstFeedId, setBurstFeedId] = useState<string | null>(null);
  const [openMenuFeedId, setOpenMenuFeedId] = useState<string | null>(null);
  const resizeState = useRef<{ side: ResizeSide; startX: number; startWidth: number } | null>(null);
  const feedContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const batchRef = useRef(1);
  const slideRefs = useRef<Record<string, HTMLElement | null>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const actionMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tapTimerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const likeBurstTimerRef = useRef<number | null>(null);
  const holdPausedFeedRef = useRef<string | null>(null);
  const suppressTapRef = useRef(false);

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
    const uploads = consumeCampusUploads(["vibe"]);

    if (uploads.length === 0) {
      return;
    }

    const nextUploads = uploads
      .filter((item) => item.mediaKind === "video" && item.mediaUrl)
      .map((item) => ({
        id: item.id,
        title: item.title || "New campus vibe",
        creator: item.author,
        caption: item.caption,
        posterUrl: "",
        videoUrl: item.mediaUrl!,
        likes: 0,
        comments: 0,
        shares: 0,
        duration: formatDuration(item.durationSeconds ?? 0),
        category: "Creators" as const,
        soundtrack: "Original audio",
        location: item.location
      }));

    if (nextUploads.length > 0) {
      setUploadedReels((current) => [...nextUploads, ...current]);
      setUploadMessage(`${nextUploads.length} vibe${nextUploads.length === 1 ? "" : "s"} added from the shared uploader.`);
    }
  }, []);

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

  function toggleLike(id: string) {
    setLikedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleFollow(creator: string) {
    setFollowedCreators((current) => (current.includes(creator) ? current.filter((item) => item !== creator) : [...current, creator]));
  }

  function toggleCaption(feedId: string) {
    setExpandedCaptionIds((current) => (current.includes(feedId) ? current.filter((item) => item !== feedId) : [...current, feedId]));
  }

  function toggleRepost(id: string) {
    setRepostedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleDislike(id: string) {
    setDislikedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleReport(id: string) {
    setReportedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function hideReel(id: string) {
    setHiddenIds((current) => (current.includes(id) ? current : [...current, id]));
    setOpenMenuFeedId(null);
  }

  function isDesktopViewport() {
    return typeof window !== "undefined" && window.innerWidth >= 900;
  }

  function clearTapTimer() {
    if (tapTimerRef.current !== null) {
      window.clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
  }

  function clearHoldTimer() {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function clearLikeBurstTimer() {
    if (likeBurstTimerRef.current !== null) {
      window.clearTimeout(likeBurstTimerRef.current);
      likeBurstTimerRef.current = null;
    }
  }

  function isInteractiveTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("button, a, input, label"));
  }

  function triggerLike(reelId: string, feedId: string) {
    setLikedIds((current) => (current.includes(reelId) ? current : [...current, reelId]));
    setBurstFeedId(feedId);
    clearLikeBurstTimer();
    likeBurstTimerRef.current = window.setTimeout(() => {
      setBurstFeedId(null);
      likeBurstTimerRef.current = null;
    }, 720);
  }

  function togglePlayback(feedId: string) {
    const video = videoRefs.current[feedId];

    if (!video) {
      return;
    }

    if (video.paused) {
      setPausedFeedId((current) => (current === feedId ? null : current));
      video.play().catch(() => undefined);
      return;
    }

    setPausedFeedId(feedId);
    video.pause();
  }

  function handleStageTap(feedId: string, reelId: string, target: EventTarget | null) {
    if (isInteractiveTarget(target)) {
      return;
    }

    if (suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }

    if (tapTimerRef.current !== null) {
      clearTapTimer();
      triggerLike(reelId, feedId);
      return;
    }

    tapTimerRef.current = window.setTimeout(() => {
      tapTimerRef.current = null;

      if (isDesktopViewport()) {
        togglePlayback(feedId);
        return;
      }

      setIsMuted((current) => !current);
    }, 220);
  }

  function handleStagePointerDown(feedId: string, event: PointerEvent<HTMLDivElement>) {
    if (isDesktopViewport() || isInteractiveTarget(event.target)) {
      return;
    }

    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      const video = videoRefs.current[feedId];

      if (video) {
        video.pause();
        holdPausedFeedRef.current = feedId;
        suppressTapRef.current = true;
      }

      holdTimerRef.current = null;
    }, 260);
  }

  function handleStagePointerUp(feedId: string) {
    clearHoldTimer();

    if (holdPausedFeedRef.current !== feedId) {
      return;
    }

    if (feedId === activeFeedId) {
      videoRefs.current[feedId]?.play().catch(() => undefined);
    }

    holdPausedFeedRef.current = null;
    window.setTimeout(() => {
      suppressTapRef.current = false;
    }, 0);
  }

  const navItems = [
    { label: "Home", href: "/home", icon: <HomeIcon /> },
    { label: "Events", href: "/events", icon: <EventsIcon /> },
    { label: "Vibes", href: "/vibes", icon: <ReelsIcon />, active: true },
    { label: "Market", href: "/market", icon: <MarketIcon /> },
    { label: "Profile", href: "/dashboard", icon: <ProfileIcon /> }
  ];

  const categories: ReelCategory[] = ["All", "Trending", "Tech", "Campus life", "Sports", "Creators"];
  const catalog = [...uploadedReels, ...REELS].filter((reel) => !hiddenIds.includes(reel.id));
  const sourceReels = activeCategory === "All" ? catalog : catalog.filter((reel) => reel.category === activeCategory);

  useEffect(() => {
    const batchSize = Math.max(4, sourceReels.length || 1);
    const initialFeed = buildFeedBatch(sourceReels, 0, batchSize);

    batchRef.current = 1;
    setFeedReels(initialFeed);
    setActiveFeedId(initialFeed[0]?.feedId ?? null);

    if (feedContainerRef.current) {
      feedContainerRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [activeCategory, uploadedReels.length, hiddenIds.length]);

  useEffect(() => {
    const root = feedContainerRef.current;
    const target = loadMoreRef.current;

    if (!root || !target || sourceReels.length === 0) {
      return;
    }

    const batchSize = Math.max(4, sourceReels.length);
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting) {
          return;
        }

        setFeedReels((current) => {
          const nextBatch = buildFeedBatch(sourceReels, batchRef.current, batchSize);
          batchRef.current += 1;
          return [...current, ...nextBatch];
        });
      },
      {
        root,
        threshold: 0.15
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [activeCategory, sourceReels.length, uploadedReels.length, hiddenIds.length]);

  useEffect(() => {
    const root = feedContainerRef.current;
    const elements = Object.values(slideRefs.current).filter(Boolean) as HTMLElement[];

    if (!root || elements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (!visible) {
          return;
        }

        const nextId = visible.target.getAttribute("data-feed-id");

        if (nextId) {
          setActiveFeedId(nextId);
        }
      },
      {
        root,
        threshold: [0.45, 0.7, 0.9]
      }
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [feedReels.length, activeCategory]);

  useEffect(() => {
    for (const [feedId, video] of Object.entries(videoRefs.current)) {
      if (!video) {
        continue;
      }

      if (feedId === activeFeedId && pausedFeedId !== feedId) {
        video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    }
  }, [activeFeedId, feedReels.length, isMuted, pausedFeedId]);

  useEffect(() => {
    if (pausedFeedId && activeFeedId && pausedFeedId !== activeFeedId) {
      setPausedFeedId(null);
    }
  }, [activeFeedId, pausedFeedId]);

  useEffect(() => {
    if (!openMenuFeedId) {
      return;
    }

    const currentMenuFeedId = openMenuFeedId;

    function handlePointerDown(event: globalThis.PointerEvent) {
      const menuRoot = actionMenuRefs.current[currentMenuFeedId];

      if (menuRoot && event.target instanceof Node && !menuRoot.contains(event.target)) {
        setOpenMenuFeedId(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuFeedId(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuFeedId]);

  useEffect(() => {
    setOpenMenuFeedId(null);
  }, [activeFeedId]);

  useEffect(() => {
    return () => {
      clearTapTimer();
      clearHoldTimer();
      clearLikeBurstTimer();
    };
  }, []);

  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;

  const layoutStyle = {
    "--vyb-campus-left-width": `${leftWidth}px`,
    "--vyb-campus-right-width": `${rightWidth}px`
  } as CSSProperties;

  return (
    <main className="vyb-campus-home" style={layoutStyle}>
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

      <section className="vyb-campus-main vyb-reels-main">
        <div className="vyb-reels-screen">
          <div className="vyb-reels-feed" ref={feedContainerRef}>
            {feedReels.map((reel) => {
              const liked = likedIds.includes(reel.id);
              const reposted = repostedIds.includes(reel.id);
              const disliked = dislikedIds.includes(reel.id);
              const reported = reportedIds.includes(reel.id);
              const followed = followedCreators.includes(reel.creator);
              const isCaptionExpanded = expandedCaptionIds.includes(reel.feedId);
              const shouldShowCaptionToggle = reel.caption.length > 58;
              const isMenuOpen = openMenuFeedId === reel.feedId;

              return (
                <article
                  key={reel.feedId}
                  data-feed-id={reel.feedId}
                  className={`vyb-reel-slide${activeFeedId === reel.feedId ? " is-active" : ""}`}
                  ref={(node) => {
                    slideRefs.current[reel.feedId] = node;
                  }}
                >
                  <div
                    className="vyb-reel-stage"
                    onClick={(event) => handleStageTap(reel.feedId, reel.id, event.target)}
                    onPointerDown={(event) => handleStagePointerDown(reel.feedId, event)}
                    onPointerUp={() => handleStagePointerUp(reel.feedId)}
                    onPointerCancel={() => handleStagePointerUp(reel.feedId)}
                    onPointerLeave={() => handleStagePointerUp(reel.feedId)}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <video
                      ref={(node) => {
                        videoRefs.current[reel.feedId] = node;
                      }}
                      className="vyb-reel-video"
                      src={reel.videoUrl}
                      poster={reel.posterUrl || undefined}
                      muted={isMuted}
                      loop
                      playsInline
                      preload={activeFeedId === reel.feedId ? "auto" : "metadata"}
                    />

                    <div className="vyb-reel-overlay">
                      <div className="vyb-reel-topline">
                        <div className="vyb-reel-badge-row">
                          <span className="vyb-reel-badge">Vibes</span>
                          <span className="vyb-reel-badge">{reel.category}</span>
                          <span className="vyb-reel-badge">{reel.duration}</span>
                        </div>
                        <button type="button" className="vyb-reel-audio-toggle" aria-label={isMuted ? "Unmute video" : "Mute video"} onClick={() => setIsMuted((current) => !current)}>
                          {isMuted ? <MuteIcon /> : <VolumeIcon />}
                        </button>
                      </div>

                      {burstFeedId === reel.feedId ? (
                        <div className="vyb-reel-like-burst" aria-hidden="true">
                          <HeartIcon />
                        </div>
                      ) : null}

                      <div className="vyb-reel-bottom">
                        <div className="vyb-reel-copy">
                          <div className="vyb-reel-creator-row">
                            <strong>@{reel.creator}</strong>
                            <button type="button" className={`vyb-reel-follow-button${followed ? " is-active" : ""}`} onClick={() => toggleFollow(reel.creator)}>
                              {followed ? "Following" : "Follow"}
                            </button>
                          </div>

                          <div className={`vyb-reel-caption-block${isCaptionExpanded ? " is-expanded" : ""}`}>
                            <p className="vyb-reel-caption">{reel.caption}</p>
                          </div>

                          {shouldShowCaptionToggle ? (
                            <button type="button" className="vyb-reel-caption-toggle" onClick={() => toggleCaption(reel.feedId)}>
                              {isCaptionExpanded ? "See less" : "See more"}
                            </button>
                          ) : null}

                          <div className="vyb-reel-meta">
                            <span>
                              <MusicIcon />
                              {reel.soundtrack}
                            </span>
                            <span>
                              <LocationIcon />
                              {reel.location}
                            </span>
                          </div>
                        </div>

                        <div className="vyb-reel-actions">
                          <button type="button" className={`vyb-reel-action-button${liked ? " is-active" : ""}`} aria-label="Like vibe" onClick={() => toggleLike(reel.id)}>
                            <HeartIcon />
                            <span>{formatMetric(reel.likes + (liked ? 1 : 0))}</span>
                          </button>
                          <button type="button" className="vyb-reel-action-button" aria-label="Open comments">
                            <CommentIcon />
                            <span>{formatMetric(reel.comments)}</span>
                          </button>
                          <button type="button" className="vyb-reel-action-button" aria-label="Share vibe">
                            <ShareIcon />
                            <span>{formatMetric(reel.shares)}</span>
                          </button>
                          <button type="button" className={`vyb-reel-action-button${reposted ? " is-active" : ""}`} aria-label="Repost vibe" onClick={() => toggleRepost(reel.id)}>
                            <RepostIcon />
                            <span>Repost</span>
                          </button>
                          <div
                            className={`vyb-reel-more-wrap${isMenuOpen ? " is-open" : ""}`}
                            ref={(node) => {
                              actionMenuRefs.current[reel.feedId] = node;
                            }}
                          >
                            <button
                              type="button"
                              className={`vyb-reel-action-button vyb-reel-more-button${isMenuOpen ? " is-active" : ""}`}
                              aria-label="More actions"
                              onClick={() => setOpenMenuFeedId((current) => (current === reel.feedId ? null : reel.feedId))}
                            >
                              <MoreIcon />
                              <span>More</span>
                            </button>

                            {isMenuOpen ? (
                              <div className="vyb-reel-more-menu" role="menu" aria-label="More vibe actions">
                                <button
                                  type="button"
                                  className={`vyb-reel-menu-item${reported ? " is-active" : ""}`}
                                  role="menuitem"
                                  onClick={() => {
                                    toggleReport(reel.id);
                                    setOpenMenuFeedId(null);
                                  }}
                                >
                                  <ReportIcon />
                                  <span>{reported ? "Reported" : "Report"}</span>
                                </button>
                                <button
                                  type="button"
                                  className={`vyb-reel-menu-item${disliked ? " is-active" : ""}`}
                                  role="menuitem"
                                  onClick={() => {
                                    toggleDislike(reel.id);
                                    setOpenMenuFeedId(null);
                                  }}
                                >
                                  <DislikeIcon />
                                  <span>{disliked ? "Disliked" : "Dislike"}</span>
                                </button>
                                <button type="button" className="vyb-reel-menu-item" role="menuitem" onClick={() => hideReel(reel.id)}>
                                  <HideIcon />
                                  <span>Hide</span>
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            <div ref={loadMoreRef} className="vyb-reel-load-sentinel" aria-hidden="true" />
          </div>
        </div>
      </section>

      <button
        type="button"
        className={`vyb-campus-resizer vyb-campus-resizer-right${activeResize === "right" ? " is-active" : ""}`}
        aria-label="Resize right sidebar"
        onPointerDown={(event) => startResizeDrag("right", event)}
      />

      <aside className="vyb-campus-right-panel vyb-campus-rail">
        <div className="vyb-campus-side-card vyb-reels-side-card">
          <span className="vyb-campus-side-label">Creator lane</span>
          <div className="vyb-reels-side-user">
            <img src={`https://i.pravatar.cc/120?u=${encodeURIComponent(viewerEmail)}`} alt={viewerName} />
            <div>
              <strong>{viewerName}</strong>
              <span>{identityLine}</span>
            </div>
          </div>

          <div className="vyb-reels-side-pill">
            <SparkIcon />
            <span>{role} creators are discovering the fastest reach through short campus edits.</span>
          </div>

          <button type="button" className="vyb-reels-side-upload" onClick={() => router.push(`/create?kind=vibe&from=${encodeURIComponent("/vibes")}`)} disabled={isUploading}>
            <PlayIcon />
            <span>{isUploading ? "Adding..." : "Upload vibe"}</span>
          </button>
          <p className="vyb-reels-side-note">{uploadMessage}</p>
        </div>

        <div className="vyb-campus-side-card vyb-reels-side-card">
          <span className="vyb-campus-side-label">Trending right now</span>
          <div className="vyb-reels-side-list">
            <div className="vyb-reels-side-list-item">
              <strong>@campus.frame</strong>
              <span>Crowd shots and event cutdowns are pulling the strongest replay rate today.</span>
            </div>
            <div className="vyb-reels-side-list-item">
              <strong>@build.with.us</strong>
              <span>Builder diaries and launch-room clips are outperforming longer narrated posts.</span>
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
