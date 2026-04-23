"use client";

import type { ActivityItem, CourseItem, FeedCard, ProfileRecord, ResourceItem } from "@vyb/contracts";
import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { courseOptions, defaultCourse, getStreamOptions, getYearOptionsForCourse, splitDisplayName } from "../lib/college-access";
import { getFirebaseClientAuth, isFirebaseClientConfigured } from "../lib/firebase-client";
import { persistStoredAvatarUrl, readStoredAvatarUrl } from "./campus-avatar";
import { buildPrimaryCampusNav, CampusDesktopNavigation, CampusMobileNavigation } from "./campus-navigation";
import { SignOutButton } from "./sign-out-button";
import { VybLogoLockup, VybLogoMark } from "./vyb-logo";

type CampusProfileShellProps = {
  viewerName: string;
  username: string;
  collegeName: string;
  viewerEmail?: string | null;
  course?: string | null;
  stream?: string | null;
  role: string;
  stats: {
    posts: number;
    followers: number;
    following: number;
  };
  posts: FeedCard[];
  isOwnProfile: boolean;
  isFollowing: boolean;
  recentResources?: ResourceItem[];
  recentCourses?: CourseItem[];
  recentActivity?: ActivityItem[];
  initialProfile?: ProfileRecord | null;
};

type ProfileTab = "posts" | "vibes" | "saved";
type ThemeMode = "dark" | "light";
type ToastState = {
  text: string;
  tone: "success" | "error";
};
type AvatarCropDraft = {
  fileName: string;
  sourceUrl: string;
  imageWidth: number;
  imageHeight: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
};
type ProfileDraft = {
  username: string;
  firstName: string;
  lastName: string;
  course: string;
  stream: string;
  year: string;
  section: string;
  isHosteller: boolean;
  hostelName: string;
  phoneNumber: string;
};
type NotificationPrefs = {
  mentions: boolean;
  follows: boolean;
  events: boolean;
  marketplace: boolean;
};
type PrivacyPrefs = {
  discoverable: boolean;
  allowMessages: boolean;
  activityVisible: boolean;
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

function EditIcon() {
  return (
    <IconBase>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function GridIcon() {
  return (
    <IconBase>
      <path
        d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function GalleryIcon() {
  return (
    <IconBase>
      <rect x="4" y="7" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 7V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function BookmarkIcon() {
  return (
    <IconBase>
      <path
        d="M7 4.8A1.8 1.8 0 0 1 8.8 3h6.4A1.8 1.8 0 0 1 17 4.8V21l-5-3.3L7 21V4.8Z"
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
      <path d="m9 7 8 5-8 5z" fill="currentColor" />
    </IconBase>
  );
}

function HeartIcon() {
  return (
    <IconBase>
      <path
        d="M12 20s-6.8-4.4-8.5-8A5 5 0 0 1 12 6a5 5 0 0 1 8.5 6C18.8 15.6 12 20 12 20Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function SparkIcon() {
  return (
    <IconBase>
      <path
        d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function LocationIcon() {
  return (
    <IconBase>
      <path
        d="M12 20s5.5-5.6 5.5-10A5.5 5.5 0 1 0 6.5 10C6.5 14.4 12 20 12 20Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2" fill="currentColor" />
    </IconBase>
  );
}

function SettingsIcon() {
  return (
    <IconBase>
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </IconBase>
  );
}

function ShieldIcon() {
  return (
    <IconBase>
      <path
        d="M12 3.5 18 6v5.6c0 3.5-2.3 6.8-6 8.9-3.7-2.1-6-5.4-6-8.9V6l6-2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function SunIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.8v2.4M12 18.8v2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M2.8 12h2.4M18.8 12h2.4M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

function MoonIcon() {
  return (
    <IconBase>
      <path
        d="M17.4 14.7A6.8 6.8 0 0 1 9.3 6.6a7.6 7.6 0 1 0 8.1 8.1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function BellIcon() {
  return (
    <IconBase>
      <path
        d="M12 4.5a4 4 0 0 0-4 4v2.1c0 .9-.3 1.8-.9 2.5L6 14.5h12l-1.1-1.4c-.6-.7-.9-1.6-.9-2.5V8.5a4 4 0 0 0-4-4ZM10 18a2 2 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function DownloadIcon() {
  return (
    <IconBase>
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 18.5h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: value > 999 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function buildBannerStyle(seed: string): CSSProperties {
  const normalizedSeed = encodeURIComponent(seed || "vyb");
  return {
    backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.16), rgba(10, 10, 12, 0.92)), url("https://picsum.photos/seed/${normalizedSeed}-banner/1200/540")`
  };
}

function buildAvatarUrl(seed: string) {
  return `https://i.pravatar.cc/240?u=${encodeURIComponent(seed || "vyb-user")}`;
}

const AVATAR_CROP_FRAME_SIZE = 320;
const AVATAR_CROP_OUTPUT_SIZE = 512;
const AVATAR_CROP_MIN_ZOOM = 1;
const AVATAR_CROP_MAX_ZOOM = 3;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getAvatarCropMetrics(imageWidth: number, imageHeight: number, zoom: number) {
  const scale = Math.max(AVATAR_CROP_FRAME_SIZE / imageWidth, AVATAR_CROP_FRAME_SIZE / imageHeight) * zoom;
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;
  return {
    scale,
    renderedWidth,
    renderedHeight,
    minOffsetX: Math.min(0, AVATAR_CROP_FRAME_SIZE - renderedWidth),
    minOffsetY: Math.min(0, AVATAR_CROP_FRAME_SIZE - renderedHeight)
  };
}

function getCenteredAvatarOffsets(imageWidth: number, imageHeight: number, zoom: number) {
  const metrics = getAvatarCropMetrics(imageWidth, imageHeight, zoom);
  return {
    offsetX: (AVATAR_CROP_FRAME_SIZE - metrics.renderedWidth) / 2,
    offsetY: (AVATAR_CROP_FRAME_SIZE - metrics.renderedHeight) / 2
  };
}

function clampAvatarOffsets(offsetX: number, offsetY: number, imageWidth: number, imageHeight: number, zoom: number) {
  const metrics = getAvatarCropMetrics(imageWidth, imageHeight, zoom);
  return {
    offsetX: clampNumber(offsetX, metrics.minOffsetX, 0),
    offsetY: clampNumber(offsetY, metrics.minOffsetY, 0)
  };
}

function revokeObjectUrl(value: string | null | undefined) {
  if (value?.startsWith("blob:")) {
    URL.revokeObjectURL(value);
  }
}

async function readImageDimensions(sourceUrl: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = sourceUrl;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("We could not read that image."));
  });

  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height
  };
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("We could not prepare your cropped photo."));
    }, type, quality);
  });
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("We could not save your profile photo."));
    };
    reader.onerror = () => reject(new Error("We could not save your profile photo."));
    reader.readAsDataURL(blob);
  });
}

async function exportAvatarCrop(draft: AvatarCropDraft) {
  const image = new Image();
  image.decoding = "async";
  image.src = draft.sourceUrl;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("We could not load that photo for cropping."));
  });

  const metrics = getAvatarCropMetrics(draft.imageWidth, draft.imageHeight, draft.zoom);
  const sourceX = clampNumber(-draft.offsetX / metrics.scale, 0, Math.max(0, draft.imageWidth - AVATAR_CROP_FRAME_SIZE / metrics.scale));
  const sourceY = clampNumber(-draft.offsetY / metrics.scale, 0, Math.max(0, draft.imageHeight - AVATAR_CROP_FRAME_SIZE / metrics.scale));
  const sourceSize = AVATAR_CROP_FRAME_SIZE / metrics.scale;
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_CROP_OUTPUT_SIZE;
  canvas.height = AVATAR_CROP_OUTPUT_SIZE;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("We could not prepare your cropped photo.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    AVATAR_CROP_OUTPUT_SIZE,
    AVATAR_CROP_OUTPUT_SIZE
  );

  return canvasToBlob(canvas, "image/jpeg", 0.92);
}

function getPostMediaAssets(post: FeedCard) {
  if (Array.isArray(post.media) && post.media.length > 0) {
    return post.media.filter((item) => item?.url && (item.kind === "image" || item.kind === "video"));
  }

  if (post.mediaUrl) {
    return [
      {
        url: post.mediaUrl,
        kind: post.kind === "video" ? "video" : "image"
      }
    ] satisfies Array<{ url: string; kind: "image" | "video" }>;
  }

  return [] as Array<{ url: string; kind: "image" | "video" }>;
}

function getInitials(value: string) {
  const parts = value.split(/\s+/u).filter(Boolean).slice(0, 2);
  if (parts.length === 0) {
    return "V";
  }
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "V";
}

function buildEmptyMessage(tab: ProfileTab, isOwnProfile: boolean) {
  if (tab === "saved") {
    return isOwnProfile ? "Saved posts will appear here when that shelf goes live." : "Saved collections stay private.";
  }
  if (tab === "vibes") {
    return isOwnProfile ? "Drop a video post and your vibes shelf will fill up here." : "No video posts are visible on this profile yet.";
  }
  return isOwnProfile ? "Your posts will appear here as soon as you publish them." : "This profile has not posted anything yet.";
}

function formatActivityLabel(value: string) {
  return value
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatActivityTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function sanitizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/gu, "_")
    .replace(/[._]{2,}/gu, "_")
    .replace(/^[._]+/gu, "")
    .slice(0, 24)
    .replace(/[._]+$/gu, "");
}

function buildProfileDraft({
  initialProfile,
  username,
  viewerName,
  course,
  stream
}: {
  initialProfile?: ProfileRecord | null;
  username: string;
  viewerName: string;
  course?: string | null;
  stream?: string | null;
}): ProfileDraft {
  const splitName = splitDisplayName(initialProfile?.fullName ?? viewerName);
  const draftCourse = initialProfile?.course ?? course ?? defaultCourse;
  const streams = getStreamOptions(draftCourse);
  const years = getYearOptionsForCourse(draftCourse);

  return {
    username: sanitizeUsername(initialProfile?.username ?? username),
    firstName: initialProfile?.firstName ?? splitName.firstName,
    lastName: initialProfile?.lastName ?? splitName.lastName,
    course: draftCourse,
    stream: initialProfile?.stream ?? stream ?? streams[0] ?? getStreamOptions(defaultCourse)[0],
    year: String(initialProfile?.year ?? years[0] ?? 1),
    section: initialProfile?.section ?? "A",
    isHosteller: initialProfile?.isHosteller ?? false,
    hostelName: initialProfile?.hostelName ?? "",
    phoneNumber: initialProfile?.phoneNumber ?? ""
  };
}

function readStoredJson<T>(key: string, fallback: T) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function CampusProfileShell({
  viewerName,
  username,
  collegeName,
  viewerEmail,
  course,
  stream,
  role,
  stats,
  posts,
  isOwnProfile,
  isFollowing,
  recentResources = [],
  recentCourses = [],
  recentActivity = [],
  initialProfile = null
}: CampusProfileShellProps) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const avatarCropDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const initialAvatarUrl = (initialProfile as (ProfileRecord & { avatarUrl?: string | null }) | null)?.avatarUrl ?? null;
  const [message, setMessage] = useState<ToastState | null>(null);
  const [busy, setBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [profileDraft, setProfileDraft] = useState(() =>
    buildProfileDraft({ initialProfile, username, viewerName, course, stream })
  );
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    mentions: true,
    follows: true,
    events: true,
    marketplace: true
  });
  const [privacyPrefs, setPrivacyPrefs] = useState<PrivacyPrefs>({
    discoverable: true,
    allowMessages: true,
    activityVisible: true
  });
  const [blockedAccounts, setBlockedAccounts] = useState<string[]>([]);
  const [mutedAccounts, setMutedAccounts] = useState<string[]>([]);
  const [blockedDraft, setBlockedDraft] = useState("");
  const [mutedDraft, setMutedDraft] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarCropDraft, setAvatarCropDraft] = useState<AvatarCropDraft | null>(null);
  const [followingState, setFollowingState] = useState(isFollowing);
  const [followerCount, setFollowerCount] = useState(stats.followers);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");

  const streamOptions = useMemo(() => getStreamOptions(profileDraft.course), [profileDraft.course]);
  const yearOptions = useMemo(() => getYearOptionsForCourse(profileDraft.course), [profileDraft.course]);
  const vibePosts = useMemo(() => posts.filter((post) => post.kind === "video"), [posts]);
  const likesCount = useMemo(() => posts.reduce((total, post) => total + post.reactions, 0), [posts]);
  const visiblePosts = activeTab === "posts" ? posts : activeTab === "vibes" ? vibePosts : ([] as FeedCard[]);
  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;
  const profileSeed = `${username}-${viewerName}`;
  const avatarStorageIdentity = useMemo(
    () => ({
      userId: initialProfile?.userId ?? null,
      username,
      email: viewerEmail ?? null
    }),
    [initialProfile?.userId, username, viewerEmail]
  );
  const resolvedAvatarUrl = avatarUrl ?? buildAvatarUrl(profileSeed);
  const avatarCropMetrics = avatarCropDraft
    ? getAvatarCropMetrics(avatarCropDraft.imageWidth, avatarCropDraft.imageHeight, avatarCropDraft.zoom)
    : null;
  const layoutStyle = {
    "--vyb-campus-left-width": "260px",
    "--vyb-campus-right-width": "336px"
  } as CSSProperties;

  useEffect(() => {
    setProfileDraft((current) => {
      const nextStream = streamOptions.includes(current.stream) ? current.stream : streamOptions[0] ?? current.stream;
      const nextYear = yearOptions.includes(Number(current.year)) ? current.year : String(yearOptions[0] ?? 1);
      if (nextStream === current.stream && nextYear === current.year) {
        return current;
      }
      return { ...current, stream: nextStream, year: nextYear };
    });
  }, [streamOptions, yearOptions]);

  useEffect(() => {
    if (!isOwnProfile) {
      return;
    }

    const savedTheme = window.localStorage.getItem("vyb-theme");
    const nextTheme: ThemeMode = savedTheme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    setThemeMode(nextTheme);
    setNotificationPrefs(readStoredJson("vyb-profile-notifications", notificationPrefs));
    setPrivacyPrefs(readStoredJson("vyb-profile-privacy", privacyPrefs));
    setBlockedAccounts(readStoredJson("vyb-profile-blocked", []));
    setMutedAccounts(readStoredJson("vyb-profile-muted", []));
  }, [isOwnProfile]);

  useEffect(() => {
    const storedAvatar = readStoredAvatarUrl(avatarStorageIdentity);
    if (storedAvatar) {
      setAvatarUrl(storedAvatar);
    }
  }, [avatarStorageIdentity]);

  useEffect(() => {
    if (typeof window === "undefined" || !avatarUrl) {
      return;
    }

    persistStoredAvatarUrl(avatarStorageIdentity, avatarUrl);
  }, [avatarStorageIdentity, avatarUrl]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(avatarCropDraft?.sourceUrl);
    };
  }, [avatarCropDraft?.sourceUrl]);

  useEffect(() => {
    if (!isOwnProfile) {
      return;
    }
    window.localStorage.setItem("vyb-profile-notifications", JSON.stringify(notificationPrefs));
  }, [notificationPrefs, isOwnProfile]);

  useEffect(() => {
    if (!isOwnProfile) {
      return;
    }
    window.localStorage.setItem("vyb-profile-privacy", JSON.stringify(privacyPrefs));
  }, [privacyPrefs, isOwnProfile]);

  useEffect(() => {
    if (!isOwnProfile) {
      return;
    }
    window.localStorage.setItem("vyb-profile-blocked", JSON.stringify(blockedAccounts));
  }, [blockedAccounts, isOwnProfile]);

  useEffect(() => {
    if (!isOwnProfile) {
      return;
    }
    window.localStorage.setItem("vyb-profile-muted", JSON.stringify(mutedAccounts));
  }, [mutedAccounts, isOwnProfile]);

  useEffect(() => {
    if (!settingsOpen && !editProfileOpen) {
      return;
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setEditProfileOpen(false);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [settingsOpen, editProfileOpen]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  function updateDraft<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setProfileDraft((current) => ({ ...current, [key]: value }));
  }

  function showSuccess(text: string) {
    setMessage({ text, tone: "success" });
  }

  function showError(text: string) {
    setMessage({ text, tone: "error" });
  }

  function closeAvatarCropper() {
    avatarCropDragRef.current = null;
    setAvatarCropDraft((current) => {
      revokeObjectUrl(current?.sourceUrl);
      return null;
    });
  }

  function resetAvatarCrop() {
    setAvatarCropDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        zoom: AVATAR_CROP_MIN_ZOOM,
        ...getCenteredAvatarOffsets(current.imageWidth, current.imageHeight, AVATAR_CROP_MIN_ZOOM)
      };
    });
  }

  function handleAvatarCropZoomChange(event: ChangeEvent<HTMLInputElement>) {
    const nextZoom = clampNumber(Number(event.target.value), AVATAR_CROP_MIN_ZOOM, AVATAR_CROP_MAX_ZOOM);
    setAvatarCropDraft((current) => {
      if (!current) {
        return current;
      }

      const currentMetrics = getAvatarCropMetrics(current.imageWidth, current.imageHeight, current.zoom);
      const nextMetrics = getAvatarCropMetrics(current.imageWidth, current.imageHeight, nextZoom);
      const centerX = (AVATAR_CROP_FRAME_SIZE / 2 - current.offsetX) / currentMetrics.scale;
      const centerY = (AVATAR_CROP_FRAME_SIZE / 2 - current.offsetY) / currentMetrics.scale;
      const nextOffsetX = AVATAR_CROP_FRAME_SIZE / 2 - centerX * nextMetrics.scale;
      const nextOffsetY = AVATAR_CROP_FRAME_SIZE / 2 - centerY * nextMetrics.scale;

      return {
        ...current,
        zoom: nextZoom,
        ...clampAvatarOffsets(nextOffsetX, nextOffsetY, current.imageWidth, current.imageHeight, nextZoom)
      };
    });
  }

  function handleAvatarCropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!avatarCropDraft) {
      return;
    }

    avatarCropDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: avatarCropDraft.offsetX,
      originY: avatarCropDraft.offsetY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleAvatarCropPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = avatarCropDragRef.current;
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    setAvatarCropDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        ...clampAvatarOffsets(
          dragState.originX + deltaX,
          dragState.originY + deltaY,
          current.imageWidth,
          current.imageHeight,
          current.zoom
        )
      };
    });
  }

  function handleAvatarCropPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (avatarCropDragRef.current?.pointerId === event.pointerId) {
      avatarCropDragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function handleAvatarCropSave() {
    if (!avatarCropDraft) {
      return;
    }

    setAvatarBusy(true);
    setMessage(null);

    try {
      const croppedBlob = await exportAvatarCrop(avatarCropDraft);
      const nextAvatarUrl = await blobToDataUrl(croppedBlob);
      setAvatarUrl(nextAvatarUrl);
      closeAvatarCropper();
      showSuccess("Profile photo updated.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "We could not update your profile photo right now.");
    } finally {
      setAvatarBusy(false);
    }
  }

  function applyTheme(nextTheme: ThemeMode) {
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("vyb-theme", nextTheme);
    setThemeMode(nextTheme);
    showSuccess(`Theme switched to ${nextTheme}.`);
  }

  function toggleNotification(key: keyof NotificationPrefs) {
    setNotificationPrefs((current) => ({ ...current, [key]: !current[key] }));
  }

  function togglePrivacy(key: keyof PrivacyPrefs) {
    setPrivacyPrefs((current) => ({ ...current, [key]: !current[key] }));
  }

  function addModerationEntry(kind: "blocked" | "muted") {
    const rawValue = kind === "blocked" ? blockedDraft : mutedDraft;
    const value = sanitizeUsername(rawValue);
    if (!value) {
      return;
    }

    if (kind === "blocked") {
      setBlockedAccounts((current) => Array.from(new Set([...current, value])));
      setBlockedDraft("");
      showSuccess(`@${value} added to blocked accounts.`);
      return;
    }

    setMutedAccounts((current) => Array.from(new Set([...current, value])));
    setMutedDraft("");
    showSuccess(`@${value} added to muted accounts.`);
  }

  function removeModerationEntry(kind: "blocked" | "muted", value: string) {
    if (kind === "blocked") {
      setBlockedAccounts((current) => current.filter((item) => item !== value));
      return;
    }
    setMutedAccounts((current) => current.filter((item) => item !== value));
  }

  async function handleProfileSave() {
    if (!isOwnProfile) {
      return;
    }

    setProfileBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          username: sanitizeUsername(profileDraft.username),
          firstName: profileDraft.firstName.trim(),
          lastName: profileDraft.lastName.trim() || null,
          course: profileDraft.course,
          stream: profileDraft.stream,
          year: Number(profileDraft.year),
          section: profileDraft.section.trim(),
          isHosteller: profileDraft.isHosteller,
          hostelName: profileDraft.isHosteller ? profileDraft.hostelName.trim() || null : null,
          phoneNumber: profileDraft.phoneNumber.trim() || null
        })
      });

      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        showError(payload?.error?.message ?? "We could not save your profile settings.");
        return;
      }

      showSuccess("Profile settings updated.");
      router.refresh();
    } catch {
      showError("We could not save your profile settings.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showError("Choose an image file for your profile photo.");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      showError("Choose an image smaller than 12 MB.");
      return;
    }

    setAvatarBusy(true);
    setMessage(null);

    try {
      const sourceUrl = URL.createObjectURL(file);
      const { width, height } = await readImageDimensions(sourceUrl);
      const nextDraft: AvatarCropDraft = {
        fileName: file.name,
        sourceUrl,
        imageWidth: width,
        imageHeight: height,
        zoom: AVATAR_CROP_MIN_ZOOM,
        ...getCenteredAvatarOffsets(width, height, AVATAR_CROP_MIN_ZOOM)
      };

      setAvatarCropDraft((current) => {
        revokeObjectUrl(current?.sourceUrl);
        return nextDraft;
      });
    } catch (error) {
      showError(error instanceof Error ? error.message : "We could not open that photo.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handlePasswordReset() {
    if (!viewerEmail) {
      showError("No account email is available for password recovery.");
      return;
    }
    if (!isFirebaseClientConfigured()) {
      showError("Firebase auth is not configured for password reset right now.");
      return;
    }

    setPasswordBusy(true);
    setMessage(null);

    try {
      const auth = await getFirebaseClientAuth();
      await sendPasswordResetEmail(auth, viewerEmail);
      showSuccess("Password reset email sent to your college inbox.");
    } catch {
      showError("We could not send a password reset email right now.");
    } finally {
      setPasswordBusy(false);
    }
  }

  function handleExportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: initialProfile,
      stats: {
        posts: stats.posts,
        followers: followerCount,
        following: stats.following,
        likes: likesCount
      },
      activity: recentActivity,
      resources: recentResources,
      courses: recentCourses,
      posts,
      preferences: {
        themeMode,
        notificationPrefs,
        privacyPrefs,
        blockedAccounts,
        mutedAccounts
      }
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vyb-profile-${username}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showSuccess("Profile data export downloaded.");
  }

  async function handleFollowToggle() {
    if (isOwnProfile) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/follows/${encodeURIComponent(username)}`, {
        method: followingState ? "DELETE" : "PUT"
      });

      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        showError(payload?.error?.message ?? "We could not update that follow right now.");
        return;
      }

      setFollowingState((current) => !current);
      setFollowerCount((current) => Math.max(0, current + (followingState ? -1 : 1)));
      showSuccess(followingState ? `Unfollowed @${username}.` : `Following @${username}.`);
      router.refresh();
    } catch {
      showError("We could not update that follow right now.");
    } finally {
      setBusy(false);
    }
  }

  const navItems = buildPrimaryCampusNav("profile");

  const tabs = [
    { id: "posts" as const, label: "Posts", icon: <GridIcon /> },
    { id: "vibes" as const, label: "Vibes", icon: <VibesIcon /> },
    { id: "saved" as const, label: "Saved", icon: <BookmarkIcon /> }
  ];

  const utilityCards = [
    {
      key: "resources",
      title: "Campus resources",
      meta: `${recentResources.length} live`,
      empty: "Published notes and guides will start appearing here as soon as the resource vault is active.",
      content:
        recentResources.length === 0 ? null : (
          <>
            {recentResources.map((resource) => (
              <div key={resource.id} className="vyb-profile-rail-item">
                <strong>{resource.title}</strong>
                <span>{resource.type.toUpperCase()} - {resource.courseId ? "Linked course" : "General"}</span>
              </div>
            ))}
          </>
        )
    },
    {
      key: "courses",
      title: "Courses",
      meta: `${recentCourses.length} mapped`,
      empty: "Course mappings will show here once course rows are available for this tenant.",
      content:
        recentCourses.length === 0 ? null : (
          <div className="vyb-profile-chip-list">
            {recentCourses.map((courseItem) => (
              <span key={courseItem.id} className="vyb-profile-chip">
                {courseItem.code}
              </span>
            ))}
          </div>
        )
    },
    {
      key: "activity",
      title: "Recent activity",
      meta: `${recentActivity.length} events`,
      empty: "Your next posts, saves, and campus actions will start showing up here.",
      content:
        recentActivity.length === 0 ? null : (
          <>
            {recentActivity.map((activityItem) => (
              <div key={activityItem.id} className="vyb-profile-rail-item">
                <strong>{formatActivityLabel(activityItem.activityType)}</strong>
                <span>{formatActivityTime(activityItem.createdAt)}</span>
              </div>
            ))}
          </>
        )
    }
  ];

  return (
    <main className="vyb-campus-home vyb-profile-layout" style={layoutStyle}>
      <CampusDesktopNavigation navItems={navItems} viewerName={viewerName} viewerUsername={username} />

      <section className="vyb-campus-main vyb-profile-main">
        <header className="vyb-campus-topbar">
          <div className="vyb-campus-topbar-copy">
            <strong>{isOwnProfile ? "Your profile" : "Campus profile"}</strong>
            <span>{identityLine}</span>
          </div>

          <div className="vyb-campus-top-actions">
            <button type="button" className="vyb-campus-top-icon" aria-label="Notifications" onClick={() => setSettingsOpen(true)}>
              <BellIcon />
            </button>
            {isOwnProfile ? (
              <>
                <button type="button" className="vyb-campus-top-icon" aria-label="Profile settings" onClick={() => setSettingsOpen(true)}>
                  <SettingsIcon />
                </button>
                <Link href="/create?kind=post&from=%2Fdashboard" className="vyb-campus-post-trigger">
                  <SparkIcon />
                  <span>Create post</span>
                </Link>
              </>
            ) : (
              <button type="button" className="vyb-campus-post-trigger" disabled={busy} onClick={handleFollowToggle}>
                <SparkIcon />
                <span>{busy ? "Updating..." : followingState ? "Following" : "Follow"}</span>
              </button>
            )}
          </div>
        </header>

        <header className="vyb-campus-mobile-header">
          <Link href="/home" className="vyb-campus-branding vyb-campus-branding-mobile">
            <VybLogoMark />
          </Link>
          <div className="vyb-campus-mobile-actions">
            {isOwnProfile ? (
              <>
                <button type="button" className="vyb-campus-top-icon" aria-label="Profile settings" onClick={() => setSettingsOpen(true)}>
                  <SettingsIcon />
                </button>
                <Link href="/create?kind=post&from=%2Fdashboard" className="vyb-campus-post-trigger vyb-campus-post-trigger-mobile">
                  <span>Post</span>
                </Link>
              </>
            ) : (
              <button type="button" className="vyb-campus-post-trigger vyb-campus-post-trigger-mobile" disabled={busy} onClick={handleFollowToggle}>
                <span>{busy ? "..." : followingState ? "Following" : "Follow"}</span>
              </button>
            )}
          </div>
        </header>

        {message ? <div className={`vyb-profile-toast is-${message.tone}`}>{message.text}</div> : null}

        {avatarCropDraft && avatarCropMetrics ? (
          <div className="vyb-avatar-cropper" role="dialog" aria-modal="true" aria-labelledby="vyb-avatar-cropper-title">
            <div className="vyb-avatar-cropper-backdrop" onClick={avatarBusy ? undefined : closeAvatarCropper} />
            <div className="vyb-avatar-cropper-panel">
              <div className="vyb-avatar-cropper-header">
                <div>
                  <h2 id="vyb-avatar-cropper-title">Adjust profile photo</h2>
                  <p>Drag and zoom to frame your avatar before saving.</p>
                </div>
                <button
                  type="button"
                  className="vyb-avatar-cropper-close"
                  onClick={closeAvatarCropper}
                  disabled={avatarBusy}
                  aria-label="Close photo cropper"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="vyb-avatar-cropper-body">
                <div
                  className="vyb-avatar-cropper-stage"
                  onPointerDown={handleAvatarCropPointerDown}
                  onPointerMove={handleAvatarCropPointerMove}
                  onPointerUp={handleAvatarCropPointerUp}
                  onPointerCancel={handleAvatarCropPointerUp}
                >
                  <img
                    src={avatarCropDraft.sourceUrl}
                    alt={avatarCropDraft.fileName}
                    className="vyb-avatar-cropper-image"
                    draggable={false}
                    style={{
                      width: `${avatarCropMetrics.renderedWidth}px`,
                      height: `${avatarCropMetrics.renderedHeight}px`,
                      transform: `translate(${avatarCropDraft.offsetX}px, ${avatarCropDraft.offsetY}px)`
                    }}
                  />
                  <div className="vyb-avatar-cropper-mask" aria-hidden="true" />
                </div>

                <div className="vyb-avatar-cropper-preview">
                  <span>Preview</span>
                  <div className="vyb-avatar-cropper-preview-bubble">
                    <img
                      src={avatarCropDraft.sourceUrl}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      style={{
                        width: `${avatarCropMetrics.renderedWidth}px`,
                        height: `${avatarCropMetrics.renderedHeight}px`,
                        transform: `translate(${avatarCropDraft.offsetX}px, ${avatarCropDraft.offsetY}px)`
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="vyb-avatar-cropper-controls">
                <label className="vyb-avatar-cropper-zoom">
                  <span>Zoom</span>
                  <input
                    type="range"
                    min={AVATAR_CROP_MIN_ZOOM}
                    max={AVATAR_CROP_MAX_ZOOM}
                    step={0.01}
                    value={avatarCropDraft.zoom}
                    onChange={handleAvatarCropZoomChange}
                    disabled={avatarBusy}
                  />
                </label>
                <button type="button" className="vyb-insta-outline-btn" onClick={resetAvatarCrop} disabled={avatarBusy}>
                  Recenter
                </button>
              </div>

              <div className="vyb-avatar-cropper-actions">
                <button type="button" className="vyb-insta-outline-btn" onClick={closeAvatarCropper} disabled={avatarBusy}>
                  Cancel
                </button>
                <button type="button" className="vyb-insta-save-btn" onClick={handleAvatarCropSave} disabled={avatarBusy}>
                  {avatarBusy ? "Saving..." : "Save photo"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="vyb-insta-profile-shell" style={{ display: (settingsOpen || editProfileOpen) ? "none" : "block" }}>
          <section className="vyb-insta-header">
            <div className="vyb-insta-header-main">
              <div className="vyb-insta-avatar-container">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="vyb-insta-avatar-input"
                  onChange={handleAvatarFileChange}
                />
                <div className="vyb-insta-avatar">
                  <img src={resolvedAvatarUrl} alt={viewerName} />
                  <span className="vyb-insta-avatar-fallback" aria-hidden="true">
                    {getInitials(viewerName)}
                  </span>
                </div>
              </div>

              <div className="vyb-insta-header-info">
                <div className="vyb-insta-top-row">
                  <h1>{viewerName}</h1>
                  <div className="vyb-insta-actions">
                    {isOwnProfile ? (
                      <>
                        <button type="button" className="vyb-insta-action-icon" onClick={() => setEditProfileOpen(true)} title="Edit Profile">
                          <EditIcon />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="vyb-insta-stats">
                  <span><strong>{formatMetric(stats.posts)}</strong> posts</span>
                  <span><strong>{formatMetric(followerCount)}</strong> followers</span>
                  <span><strong>{formatMetric(stats.following)}</strong> following</span>
                </div>
              </div>
            </div>

            <div className="vyb-insta-bio">
              <strong>@{username}</strong>
              <p>{identityLine} • {collegeName}</p>
            </div>
          </section>

          <section className="vyb-insta-content">
            <div className="vyb-insta-tabs" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`vyb-insta-tab${activeTab === tab.id ? " active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}
                  <span>{tab.label.toUpperCase()}</span>
                </button>
              ))}
            </div>

            <div className="vyb-insta-grid">
              {visiblePosts.length === 0 ? (
                <div className="vyb-insta-empty">
                  <div className="vyb-empty-icon"><GridIcon /></div>
                  <strong>No {activeTab} yet</strong>
                </div>
              ) : null}

              {visiblePosts.map((post) => {
                const mediaAssets = getPostMediaAssets(post);
                const previewMedia = mediaAssets[0] ?? null;
                const isVideo = previewMedia?.kind === "video";
                const hasMultipleMedia = mediaAssets.length > 1;
                return (
                  <article key={post.id} className="vyb-insta-grid-item">
                    {previewMedia ? (
                      isVideo ? (
                        <video src={previewMedia.url} muted playsInline preload="metadata" />
                      ) : (
                        <img src={previewMedia.url} alt={post.title || post.body || `${viewerName} post`} />
                      )
                    ) : (
                      <div className="vyb-insta-text-tile">
                        <p>{(post.body || post.title || "Campus update").slice(0, 60)}...</p>
                      </div>
                    )}

                    {hasMultipleMedia || isVideo ? (
                      <div className="vyb-insta-grid-indicators" aria-hidden="true">
                        {hasMultipleMedia ? (
                          <span className="vyb-insta-grid-indicator">
                            <GalleryIcon />
                          </span>
                        ) : null}
                        {isVideo ? (
                          <span className="vyb-insta-grid-indicator">
                            <PlayIcon />
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="vyb-insta-grid-overlay">
                      <div className="vyb-overlay-stat">
                        <HeartIcon /> <span>{formatMetric(Math.max(post.reactions, post.comments, 0))}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      
{isOwnProfile && editProfileOpen ? (
        <div style={{ padding: "0 1rem 2rem", width: "100%", maxWidth: "600px", margin: "0 auto", boxSizing: "border-box", animation: "vyb-slide-up 0.3s ease" }}>
          <div className="vyb-insta-settings-inline">
            <div className="vyb-insta-settings-header" style={{borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "1rem", marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between"}}>
              <button type="button" className="vyb-insta-outline-btn" style={{border: "none", padding: "0.2rem 0", background: "transparent", color: "#94a3b8"}} onClick={() => setEditProfileOpen(false)}>← Back</button>
              <h2 style={{margin: 0, fontSize: "1.15rem", fontWeight: 600}}>Edit Profile</h2>
              <div style={{width: 50}}></div>
            </div>

            <div className="vyb-insta-settings-body" style={{ background: "transparent", padding: 0 }}>
              {/* EDIT PROFILE */}
              <section className="vyb-insta-settings-section borderless">
                <div className="vyb-insta-form">
                  <div className="vyb-insta-photo-field">
                    <div className="vyb-insta-photo-preview">
                      <img src={resolvedAvatarUrl} alt={viewerName} />
                    </div>
                    <div className="vyb-insta-photo-copy">
                      <strong>Profile photo</strong>
                      <span>Choose a photo, adjust it, then save your cropped avatar.</span>
                    </div>
                    <button
                      type="button"
                      className="vyb-insta-outline-btn"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarBusy}
                    >
                      {avatarBusy ? "Working..." : avatarUrl ? "Change photo" : "Add photo"}
                    </button>
                  </div>

                  <label className="vyb-insta-field">
                    <span>Username</span>
                    <input value={profileDraft.username} onChange={(event) => updateDraft("username", sanitizeUsername(event.target.value))} autoCapitalize="none" spellCheck={false} />
                  </label>
                  <div className="vyb-insta-field-row">
                    <label className="vyb-insta-field">
                      <span>First name</span>
                      <input value={profileDraft.firstName} onChange={(event) => updateDraft("firstName", event.target.value)} />
                    </label>
                    <label className="vyb-insta-field">
                      <span>Last name</span>
                      <input value={profileDraft.lastName} onChange={(event) => updateDraft("lastName", event.target.value)} />
                    </label>
                  </div>
                  <div className="vyb-insta-field-row">
                    <label className="vyb-insta-field">
                      <span>Course</span>
                      <select value={profileDraft.course} onChange={(event) => updateDraft("course", event.target.value)}>
                        {courseOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
                      </select>
                    </label>
                    <label className="vyb-insta-field">
                      <span>Stream</span>
                      <select value={profileDraft.stream} onChange={(event) => updateDraft("stream", event.target.value)}>
                        {streamOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
                      </select>
                    </label>
                  </div>
                  <div className="vyb-insta-field-row">
                    <label className="vyb-insta-field">
                      <span>Year</span>
                      <select value={profileDraft.year} onChange={(event) => updateDraft("year", event.target.value)}>
                        {yearOptions.map((option) => (<option key={option} value={String(option)}>Year {option}</option>))}
                      </select>
                    </label>
                    <label className="vyb-insta-field">
                      <span>Section</span>
                      <input value={profileDraft.section} onChange={(event) => updateDraft("section", event.target.value.toUpperCase())} />
                    </label>
                  </div>
                  <label className="vyb-insta-field">
                    <span>Phone</span>
                    <input value={profileDraft.phoneNumber} onChange={(event) => updateDraft("phoneNumber", event.target.value)} inputMode="tel" placeholder="+91" />
                  </label>
                  <label className="vyb-insta-checkbox-row">
                    <span>I stay in hostel</span>
                    <input type="checkbox" checked={profileDraft.isHosteller} onChange={(event) => updateDraft("isHosteller", event.target.checked)} />
                  </label>
                  {profileDraft.isHosteller ? (
                    <label className="vyb-insta-field">
                      <span>Hostel name</span>
                      <input value={profileDraft.hostelName} onChange={(event) => updateDraft("hostelName", event.target.value)} />
                    </label>
                  ) : null}
                  <button type="button" className="vyb-insta-save-btn" onClick={handleProfileSave} disabled={profileBusy}>
                    {profileBusy ? "Saving..." : "Save details"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {isOwnProfile && settingsOpen ? (
        <div style={{ padding: "0 1rem 2rem", width: "100%", maxWidth: "600px", margin: "0 auto", boxSizing: "border-box", animation: "vyb-slide-up 0.3s ease" }}>
          <div className="vyb-insta-settings-inline">
            <div className="vyb-insta-settings-header" style={{borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "1rem", marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between"}}>
              <button type="button" className="vyb-insta-outline-btn" style={{border: "none", padding: "0.2rem 0", background: "transparent", color: "#94a3b8"}} onClick={() => setSettingsOpen(false)}>← Back</button>
              <h2 style={{margin: 0, fontSize: "1.15rem", fontWeight: 600}}>Settings</h2>
              <div style={{width: 50}}></div>
            </div>

            <div className="vyb-insta-settings-body" style={{ background: "transparent", padding: 0 }}>
              {/* NOTIFICATIONS & PRIVACY */}
              <section className="vyb-insta-settings-section">
                <h3>Notifications</h3>
                <div className="vyb-insta-toggles">
                  {[
                    ["mentions", "Mentions and replies", notificationPrefs, toggleNotification],
                    ["follows", "Follows and profile actions", notificationPrefs, toggleNotification],
                    ["events", "Events and reminders", notificationPrefs, toggleNotification],
                    ["marketplace", "Marketplace updates", notificationPrefs, toggleNotification]
                  ].map(([key, label, prefs, toggle]) => {
                    const isChecked = (prefs as any)[key as string];
                    return (
                      <button key={key as string} type="button" className={`vyb-insta-toggle${isChecked ? " on" : ""}`} onClick={() => (toggle as Function)(key)}>
                        <span>{label as string}</span>
                        <div className="vyb-toggle-track"><div className="vyb-toggle-thumb" /></div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="vyb-insta-settings-section">
                <h3>Privacy & Visibility</h3>
                <div className="vyb-insta-toggles">
                  {[
                    ["discoverable", "Allow profile discovery", privacyPrefs, togglePrivacy],
                    ["allowMessages", "Allow direct messages", privacyPrefs, togglePrivacy],
                    ["activityVisible", "Show recent activity", privacyPrefs, togglePrivacy]
                  ].map(([key, label, prefs, toggle]) => {
                    const isChecked = (prefs as any)[key as string];
                    return (
                      <button key={key as string} type="button" className={`vyb-insta-toggle${isChecked ? " on" : ""}`} onClick={() => (toggle as Function)(key)}>
                        <span>{label as string}</span>
                        <div className="vyb-toggle-track"><div className="vyb-toggle-thumb" /></div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ACCOUNT RECOVERY & MODERATION */}
              <section className="vyb-insta-settings-section">
                <h3>Account & Moderation</h3>
                <div className="vyb-insta-account-actions">
                  <div className="vyb-insta-field">
                    <span>Account email</span>
                    <div style={{color: '#fff', fontSize: '0.9rem', marginBottom: '0.5rem'}}>{viewerEmail ?? "Unavailable"}</div>
                  </div>
                  <button type="button" className="vyb-insta-outline-btn" disabled={passwordBusy} onClick={handlePasswordReset}>
                    {passwordBusy ? "Sending..." : "Send password reset link"}
                  </button>
                  <button type="button" className="vyb-insta-outline-btn" onClick={handleExportData}>
                    Download my data
                  </button>
                </div>

                <h4 style={{marginTop: '1.5rem', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.85rem'}}>Blocked accounts</h4>
                <div className="vyb-insta-moderation">
                  <div className="vyb-insta-mod-input">
                    <input value={blockedDraft} onChange={(event) => setBlockedDraft(event.target.value)} placeholder="@username" />
                    <button type="button" onClick={() => addModerationEntry("blocked")}>Block</button>
                  </div>
                  <div className="vyb-insta-mod-list">
                    {blockedAccounts.map((item) => (
                      <div key={item} className="vyb-insta-mod-chip">
                        <span>@{item}</span>
                        <button type="button" onClick={() => removeModerationEntry("blocked", item)}><CloseIcon /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <h4 style={{marginTop: '1.5rem', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.85rem'}}>Muted accounts</h4>
                <div className="vyb-insta-moderation">
                  <div className="vyb-insta-mod-input">
                    <input value={mutedDraft} onChange={(event) => setMutedDraft(event.target.value)} placeholder="@username" />
                    <button type="button" onClick={() => addModerationEntry("muted")}>Mute</button>
                  </div>
                  <div className="vyb-insta-mod-list">
                    {mutedAccounts.map((item) => (
                      <div key={item} className="vyb-insta-mod-chip">
                        <span>@{item}</span>
                        <button type="button" onClick={() => removeModerationEntry("muted", item)}><CloseIcon /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* SUPPORT & LOGOUT */}
              <section className="vyb-insta-settings-section borderless">
                <div className="vyb-insta-support-actions">
                  <a href="mailto:support@vyb.app?subject=Vyb%20Support">Email support</a>
                  <a href="mailto:feedback@vyb.app?subject=Vyb%20Feedback">Send feedback</a>
                  <SignOutButton className="vyb-insta-logout-btn" />
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    
</section>

      <aside className="vyb-campus-right-panel vyb-campus-rail vyb-profile-right-panel">
        <div className="vyb-campus-side-card vyb-profile-side-card">
          <span className="vyb-campus-side-label">Profile control</span>
          <div className="vyb-campus-side-user">
            <img src={resolvedAvatarUrl} alt={viewerName} />
            <div>
              <strong>{viewerName}</strong>
              <span>@{username}</span>
            </div>
          </div>
          <p className="vyb-profile-side-copy">{identityLine}</p>
          {isOwnProfile ? (
            <button type="button" className="vyb-profile-side-cta" onClick={() => setSettingsOpen(true)}>
              Open settings
            </button>
          ) : (
            <button type="button" className="vyb-profile-side-cta" disabled={busy} onClick={handleFollowToggle}>
              {busy ? "Updating..." : followingState ? "Following" : "Follow"}
            </button>
          )}
        </div>

        <div className="vyb-campus-side-card vyb-profile-side-card">
          <span className="vyb-campus-side-label">Saved shortcuts</span>
          <div className="vyb-profile-shortcut-list">
            <button type="button" className="vyb-profile-shortcut-button" onClick={() => setActiveTab("saved")}>
              <strong>Saved posts</strong>
              <span>Jump to your saved shelf on profile.</span>
            </button>
            <Link href="/market" className="vyb-profile-shortcut-button">
              <strong>Saved listings</strong>
              <span>Open marketplace and continue from your saved items.</span>
            </Link>
          </div>
        </div>

        {utilityCards.map((card) => (
          <div key={card.key} className="vyb-campus-side-card vyb-profile-side-card">
            <div className="vyb-profile-side-head">
              <span className="vyb-campus-side-label">{card.title}</span>
              <strong>{card.meta}</strong>
            </div>
            {card.content ?? <p className="vyb-profile-side-copy">{card.empty}</p>}
          </div>
        ))}
      </aside>

      <CampusMobileNavigation navItems={navItems} />
    </main>
  );
}
