"use client";

import type { ActivityItem, CourseItem, FeedCard, ProfileRecord, ResourceItem } from "@vyb/contracts";
import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { courseOptions, defaultCourse, getStreamOptions, getYearOptionsForCourse, splitDisplayName } from "../lib/college-access";
import { getFirebaseClientAuth, isFirebaseClientConfigured } from "../lib/firebase-client";
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
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
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

  function updateDraft<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setProfileDraft((current) => ({ ...current, [key]: value }));
  }

  function applyTheme(nextTheme: ThemeMode) {
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("vyb-theme", nextTheme);
    setThemeMode(nextTheme);
    setMessage(`Theme switched to ${nextTheme}.`);
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
      setMessage(`@${value} added to blocked accounts.`);
      return;
    }

    setMutedAccounts((current) => Array.from(new Set([...current, value])));
    setMutedDraft("");
    setMessage(`@${value} added to muted accounts.`);
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
        setMessage(payload?.error?.message ?? "We could not save your profile settings.");
        return;
      }

      setMessage("Profile settings updated.");
      router.refresh();
    } catch {
      setMessage("We could not save your profile settings.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handlePasswordReset() {
    if (!viewerEmail) {
      setMessage("No account email is available for password recovery.");
      return;
    }
    if (!isFirebaseClientConfigured()) {
      setMessage("Firebase auth is not configured for password reset on this device.");
      return;
    }

    setPasswordBusy(true);
    setMessage(null);

    try {
      const auth = await getFirebaseClientAuth();
      await sendPasswordResetEmail(auth, viewerEmail);
      setMessage("Password reset email sent to your college inbox.");
    } catch {
      setMessage("We could not send a password reset email right now.");
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
    setMessage("Profile data export downloaded.");
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
        setMessage(payload?.error?.message ?? "We could not update that follow right now.");
        return;
      }

      setFollowingState((current) => !current);
      setFollowerCount((current) => Math.max(0, current + (followingState ? -1 : 1)));
      router.refresh();
    } catch {
      setMessage("We could not update that follow right now.");
    } finally {
      setBusy(false);
    }
  }

  const navItems = [
    { label: "Home", href: "/home", icon: <HomeIcon /> },
    { label: "Events", href: "/events", icon: <EventsIcon /> },
    { label: "Vibes", href: "/vibes", icon: <VibesIcon /> },
    { label: "Market", href: "/market", icon: <MarketIcon /> },
    { label: "Profile", href: "/dashboard", icon: <ProfileIcon />, active: true }
  ];

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
            <span>@{username}</span>
          </div>
          <SignOutButton className="vyb-campus-signout" />
        </div>
      </aside>

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

        {message ? <div className="vyb-campus-flash-message">{message}</div> : null}

        <div className="vyb-insta-profile-shell" style={{ display: (settingsOpen || editProfileOpen) ? "none" : "block" }}>
          <section className="vyb-insta-header">
            <div className="vyb-insta-avatar-container">
              <div className="vyb-insta-avatar">
                <img src={buildAvatarUrl(profileSeed)} alt={viewerName} />
                <span className="vyb-insta-avatar-fallback" aria-hidden="true">
                  {getInitials(viewerName)}
                </span>
              </div>
            </div>

            <div className="vyb-insta-header-info">
              <div className="vyb-insta-top-row">
                <h1>{username}</h1>
                <div className="vyb-insta-actions">
                  {isOwnProfile ? (
                    <>
                      <button type="button" className="vyb-insta-action-icon" onClick={() => setEditProfileOpen(true)} title="Edit Profile">
                        <ProfileIcon />
                      </button>
                      <button type="button" className="vyb-insta-action-icon" onClick={() => setSettingsOpen(true)} title="Settings">
                        <SettingsIcon />
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

              <div className="vyb-insta-bio">
                <strong>{viewerName}</strong>
                <p>{identityLine} • {collegeName}</p>
              </div>
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
                const isVideo = post.kind === "video";
                return (
                  <article key={post.id} className="vyb-insta-grid-item">
                    {post.mediaUrl ? (
                      isVideo ? (
                        <video src={post.mediaUrl} muted playsInline autoPlay loop />
                      ) : (
                        <img src={post.mediaUrl} alt={post.title} />
                      )
                    ) : (
                      <div className="vyb-insta-text-tile">
                        <p>{(post.body || post.title || "Campus update").slice(0, 60)}...</p>
                      </div>
                    )}
                    
                    <div className="vyb-insta-grid-overlay">
                      <div className="vyb-overlay-stat">
                        <HeartIcon /> <span>{formatMetric(Math.max(post.reactions, post.comments, 0))}</span>
                      </div>
                      {isVideo && <div className="vyb-overlay-stat"><PlayIcon /></div>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      
{isOwnProfile && editProfileOpen ? (
        <div className="vyb-insta-profile-shell" style={{ padding: "0 1.5rem 2rem" }}>
          <div className="vyb-insta-settings-inline">
            <div className="vyb-insta-settings-header" style={{borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "1rem", marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between"}}>
              <button type="button" className="vyb-insta-outline-btn" style={{border: "none", padding: "0.2rem 0", background: "transparent", color: "#94a3b8"}} onClick={() => setEditProfileOpen(false)}>← Back</button>
              <h2 style={{margin: 0, fontSize: "1.15rem", fontWeight: 600}}>Edit Profile</h2>
              <div style={{width: 50}}></div>
            </div>

            {message ? <p className="vyb-insta-settings-message">{message}</p> : null}

            <div className="vyb-insta-settings-body">
              {/* EDIT PROFILE */}
              <section className="vyb-insta-settings-section borderless">
                <div className="vyb-insta-form">
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
        <div className="vyb-insta-profile-shell" style={{ padding: "0 1.5rem 2rem" }}>
          <div className="vyb-insta-settings-inline">
            <div className="vyb-insta-settings-header" style={{borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "1rem", marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between"}}>
              <button type="button" className="vyb-insta-outline-btn" style={{border: "none", padding: "0.2rem 0", background: "transparent", color: "#94a3b8"}} onClick={() => setSettingsOpen(false)}>← Back</button>
              <h2 style={{margin: 0, fontSize: "1.15rem", fontWeight: 600}}>Settings</h2>
              <div style={{width: 50}}></div>
            </div>

            {message ? <p className="vyb-insta-settings-message">{message}</p> : null}

            <div className="vyb-insta-settings-body">
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
            <img src={buildAvatarUrl(profileSeed)} alt={viewerName} />
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
