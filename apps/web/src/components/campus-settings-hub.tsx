"use client";

import type {
  ActivityItem,
  CourseItem,
  FeedCard,
  ProfileRecord,
  ResourceItem
} from "@vyb/contracts";
import { sendPasswordResetEmail } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { splitDisplayName } from "../lib/college-access";
import { clearChatVault } from "../lib/chat-e2ee";
import { getFirebaseClientAuth, isFirebaseClientConfigured } from "../lib/firebase-client";
import { queueAppRouteOrigin } from "../lib/app-navigation-state";
import { persistStoredAvatarUrl } from "./campus-avatar";
import {
  CAMPUS_SOCIAL_LINK_KEYS,
  CAMPUS_SOCIAL_LINK_LABELS,
  clearStoredCampusSettings,
  createDefaultCampusSettings,
  createDefaultCampusSocialLinks,
  normalizeCampusSocialLink,
  normalizeStoredSocialLinks,
  persistStoredCampusSettings,
  readStoredCampusSettings,
  type CampusSettingsIdentity,
  type CampusSocialLinkKey,
  type CampusSocialLinks,
  type StoredCampusSettings
} from "./campus-settings-storage";

type SettingCategory = {
  id: string;
  label: string;
  icon: ReactNode;
};

type FeedbackState = {
  tone: "success" | "error" | "info";
  text: string;
};

type CampusSettingsHubProps = {
  onClose: () => void;
  viewerName: string;
  viewerUsername: string;
  viewerEmail?: string | null;
  collegeName: string;
  initialProfile?: ProfileRecord | null;
  avatarUrl: string;
  settingsIdentity: CampusSettingsIdentity;
  stats: {
    posts: number;
    followers: number;
    following: number;
  };
  posts: FeedCard[];
  recentResources?: ResourceItem[];
  recentCourses?: CourseItem[];
  recentActivity?: ActivityItem[];
};

const SETTINGS_DATA: SettingCategory[] = [
  {
    id: "account",
    label: "Account & Identity",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  },
  {
    id: "privacy",
    label: "Privacy & Chat Identity",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )
  },
  {
    id: "content",
    label: "Content & Activity",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
      </svg>
    )
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    )
  },
  {
    id: "system",
    label: "Data & Storage",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5V19A9 3 0 0 0 21 19V5" />
        <path d="M3 12A9 3 0 0 0 21 12" />
      </svg>
    )
  },
  {
    id: "danger_zone",
    label: "Safety & Termination",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" x2="12" y1="8" y2="12" />
        <line x1="12" x2="12.01" y1="16" y2="16" />
      </svg>
    )
  }
];

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}

function formatLabel(key: string) {
  const overrides: Record<string, string> = {
    display_name: "Display Name",
    branch_department: "Branch / Department",
    batch_year: "Batch Year",
    hostel_room_no: "Hostel / Room No.",
    primary_email: "Primary Email",
    phone_number: "Phone Number",
    last_seen_online: "Last Seen & Online Status",
    group_add_permissions: "Who can add me to groups?",
    story_visibility: "Who can see my story?",
    global_message_timer: "Global Message Timer",
    autoplay_on_wifi_only: "Autoplay videos on WiFi only",
    hide_reaction_counts_on_posts: "Hide reaction counts on posts",
    hide_comment_counts_on_posts: "Hide comment counts on posts",
    hide_reaction_counts_on_vibes: "Hide reaction counts on vibes",
    hide_comment_counts_on_vibes: "Hide comment counts on vibes",
    chat_messages: "Chat messages",
    marketplace_deals: "Marketplace deals",
    social_interactions: "Social interactions",
    quiet_mode: "Quiet Mode"
  };

  if (overrides[key]) {
    return overrides[key];
  }

  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isDangerAction(key: string) {
  return ["logout_all_devices", "deactivate_account", "delete_my_account_permanently", "nuclear_reset"].includes(key);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("We could not read that file."));
    };
    reader.onerror = () => reject(new Error("We could not read that file."));
    reader.readAsDataURL(file);
  });
}

function formatStorageBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function buildInitialAccountDraft({
  viewerName,
  viewerEmail,
  initialProfile,
  storedSettings
}: {
  viewerName: string;
  viewerEmail?: string | null;
  initialProfile?: ProfileRecord | null;
  storedSettings: StoredCampusSettings;
}) {
  return {
    displayName: initialProfile?.fullName ?? viewerName,
    bio: initialProfile?.bio ?? storedSettings.bio,
    branchDepartment: storedSettings.branchDepartment || initialProfile?.stream || "",
    batchYear: String(initialProfile?.year ?? 1),
    hostelRoomNo: storedSettings.hostelRoomNo,
    primaryEmail: viewerEmail ?? initialProfile?.primaryEmail ?? "",
    phoneNumber: initialProfile?.phoneNumber ?? ""
  };
}

function buildInitialSocialDraft(settings: StoredCampusSettings, initialProfile?: ProfileRecord | null): CampusSocialLinks {
  const persistedLinks = normalizeStoredSocialLinks(initialProfile?.socialLinks);
  return CAMPUS_SOCIAL_LINK_KEYS.reduce<CampusSocialLinks>((links, key) => {
    links[key] = settings.socialLinks[key].trim() || persistedLinks[key] || "";
    return links;
  }, createDefaultCampusSocialLinks());
}

function normalizeSocialDraft(draft: CampusSocialLinks): CampusSocialLinks {
  return CAMPUS_SOCIAL_LINK_KEYS.reduce<CampusSocialLinks>((links, key) => {
    links[key] = normalizeCampusSocialLink(key, draft[key]);
    return links;
  }, createDefaultCampusSocialLinks());
}

async function clearCurrentSession(redirectToLogin = false) {
  await clearChatVault();

  if (isFirebaseClientConfigured()) {
    const auth = await getFirebaseClientAuth();
    await auth.signOut().catch(() => undefined);
  }

  await fetch("/api/auth/session", {
    method: "DELETE"
  }).catch(() => undefined);

  if (redirectToLogin) {
    window.location.assign("/login");
  }
}

export function CampusSettingsHub({
  onClose,
  viewerName,
  viewerUsername,
  viewerEmail,
  collegeName,
  initialProfile = null,
  avatarUrl,
  settingsIdentity,
  stats,
  posts,
  recentResources = [],
  recentCourses = [],
  recentActivity = []
}: CampusSettingsHubProps) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>("account");
  const [settings, setSettings] = useState<StoredCampusSettings>(() => readStoredCampusSettings(settingsIdentity));
  const [accountDraft, setAccountDraft] = useState(() =>
    buildInitialAccountDraft({
      viewerName,
      viewerEmail,
      initialProfile,
      storedSettings: readStoredCampusSettings(settingsIdentity)
    })
  );
  const [socialDraft, setSocialDraft] = useState<CampusSocialLinks>(() =>
    buildInitialSocialDraft(readStoredCampusSettings(settingsIdentity), initialProfile)
  );
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const chatPrivacyLoadedRef = useRef(false);
  const lastSyncedChatPrivacyRef = useRef("");

  const storageStats = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    let localStorageBytes = 0;
    let vybKeyCount = 0;

    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key) {
          continue;
        }

        const value = window.localStorage.getItem(key) ?? "";
        localStorageBytes += key.length + value.length;

        if (key.startsWith("vyb")) {
          vybKeyCount += 1;
        }
      }
    } catch {
      return null;
    }

    return {
      localStorageBytes,
      vybKeyCount,
      avatarBytes: avatarUrl.length,
      connectedSocialLinks: CAMPUS_SOCIAL_LINK_KEYS.filter((key) => settings.socialLinks[key].trim()).length
    };
  }, [avatarUrl, settings.socialLinks]);

  useEffect(() => {
    persistStoredCampusSettings(settingsIdentity, settings);
  }, [settings, settingsIdentity]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/chats/privacy-settings", {
          cache: "no-store",
          credentials: "same-origin"
        });
        if (!response.ok || cancelled) {
          return;
        }

        const payload = (await response.json()) as {
          settings?: Partial<Pick<StoredCampusSettings, "lastSeenOnline" | "readReceipts" | "typingIndicator">>;
        };
        if (!payload.settings) {
          return;
        }

        setSettings((current) => ({
          ...current,
          lastSeenOnline:
            payload.settings?.lastSeenOnline === "Everyone" ||
            payload.settings?.lastSeenOnline === "My Contacts" ||
            payload.settings?.lastSeenOnline === "Nobody"
              ? payload.settings.lastSeenOnline
              : current.lastSeenOnline,
          readReceipts:
            typeof payload.settings?.readReceipts === "boolean"
              ? payload.settings.readReceipts
              : current.readReceipts,
          typingIndicator:
            typeof payload.settings?.typingIndicator === "boolean"
              ? payload.settings.typingIndicator
              : current.typingIndicator
        }));
      } catch {
        return;
      } finally {
        chatPrivacyLoadedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!chatPrivacyLoadedRef.current) {
      return;
    }

    const payload = {
      lastSeenOnline: settings.lastSeenOnline,
      readReceipts: settings.readReceipts,
      typingIndicator: settings.typingIndicator
    };
    const payloadKey = JSON.stringify(payload);
    if (payloadKey === lastSyncedChatPrivacyRef.current) {
      return;
    }

    lastSyncedChatPrivacyRef.current = payloadKey;

    void fetch("/api/chats/privacy-settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: payloadKey,
      cache: "no-store",
      credentials: "same-origin"
    }).catch(() => {
      lastSyncedChatPrivacyRef.current = "";
    });
  }, [settings.lastSeenOnline, settings.readReceipts, settings.typingIndicator]);

  useEffect(() => {
    setAccountDraft(buildInitialAccountDraft({ viewerName, viewerEmail, initialProfile, storedSettings: settings }));
  }, [
    initialProfile,
    settings.bio,
    settings.branchDepartment,
    settings.hostelRoomNo,
    viewerEmail,
    viewerName
  ]);

  useEffect(() => {
    setSocialDraft(buildInitialSocialDraft(settings, initialProfile));
  }, [initialProfile, settings.socialLinks]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFeedback(null);
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  function showFeedback(tone: FeedbackState["tone"], text: string) {
    setFeedback({ tone, text });
  }

  function toggleCategory(id: string) {
    setExpandedCategoryId((current) => (current === id ? null : id));
  }

  function updateSettings<K extends keyof StoredCampusSettings>(key: K, value: StoredCampusSettings[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateAccountDraft<K extends keyof typeof accountDraft>(key: K, value: (typeof accountDraft)[K]) {
    setAccountDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateSocialDraft(key: CampusSocialLinkKey, value: string) {
    setSocialDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function buildProfileSyncPayload(options?: { avatarUrl?: string | null; socialLinks?: CampusSocialLinks }) {
    const splitName = splitDisplayName(accountDraft.displayName.trim() || viewerName);
    const socialLinks = options?.socialLinks ?? settings.socialLinks;
    const hasSocialLinks = CAMPUS_SOCIAL_LINK_KEYS.some((key) => socialLinks[key].trim());

    return {
      username: initialProfile?.username ?? viewerUsername,
      firstName: splitName.firstName.trim(),
      lastName: splitName.lastName.trim() || null,
      course: initialProfile?.course ?? (accountDraft.branchDepartment.trim() || "Campus"),
      stream: initialProfile?.stream ?? (accountDraft.branchDepartment.trim() || "General"),
      year: Number(accountDraft.batchYear) || initialProfile?.year || 1,
      section: initialProfile?.section ?? "A",
      isHosteller: initialProfile?.isHosteller ?? false,
      hostelName: initialProfile?.hostelName ?? null,
      phoneNumber: accountDraft.phoneNumber.trim() || null,
      bio: accountDraft.bio.trim() || null,
      avatarUrl: options?.avatarUrl ?? (avatarUrl || null),
      ...(options?.socialLinks || hasSocialLinks ? { socialLinks } : {})
    };
  }

  async function handleProfilePhotoSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showFeedback("error", "Choose an image file for your profile photo.");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      showFeedback("error", "Choose an image smaller than 12 MB.");
      return;
    }

    try {
      const nextAvatarUrl = await readFileAsDataUrl(file);
      persistStoredAvatarUrl(settingsIdentity, nextAvatarUrl);
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(buildProfileSyncPayload({ avatarUrl: nextAvatarUrl }))
      });

      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        showFeedback("error", payload?.error?.message ?? "We could not sync your profile photo.");
        return;
      }

      showFeedback("success", "Profile photo updated.");
      router.refresh();
    } catch (error) {
      showFeedback("error", error instanceof Error ? error.message : "We could not update your profile photo.");
    }
  }

  async function handleAccountSave() {
    setProfileBusy(true);

    const nextStoredSettings: StoredCampusSettings = {
      ...settings,
      bio: accountDraft.bio.trim(),
      branchDepartment: accountDraft.branchDepartment.trim(),
      hostelRoomNo: accountDraft.hostelRoomNo.trim()
    };

    setSettings(nextStoredSettings);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(buildProfileSyncPayload({ socialLinks: nextStoredSettings.socialLinks }))
      });

      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        showFeedback("error", payload?.error?.message ?? "We could not save your account settings.");
        return;
      }

      showFeedback("success", "Account settings saved.");
      router.refresh();
    } catch {
      showFeedback("error", "We could not save your account settings.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleSocialLinksSave() {
    const nextSocialLinks = normalizeSocialDraft(socialDraft);
    const nextStoredSettings = {
      ...settings,
      socialLinks: nextSocialLinks
    };
    setProfileBusy(true);
    setSettings(nextStoredSettings);
    setSocialDraft(nextSocialLinks);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(buildProfileSyncPayload({ socialLinks: nextSocialLinks }))
      });

      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        showFeedback("error", payload?.error?.message ?? "We could not save your social links.");
        return;
      }

      showFeedback("success", "Social account links saved to your profile bio.");
      router.refresh();
    } catch {
      showFeedback("error", "We could not save your social links.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handlePasswordReset() {
    if (!viewerEmail) {
      showFeedback("error", "No account email is available for password recovery.");
      return;
    }

    if (!isFirebaseClientConfigured()) {
      showFeedback("error", "Firebase auth is not configured for password reset right now.");
      return;
    }

    setPasswordBusy(true);

    try {
      const auth = await getFirebaseClientAuth();
      await sendPasswordResetEmail(auth, viewerEmail);
      showFeedback("success", "Password reset email sent to your college inbox.");
    } catch {
      showFeedback("error", "We could not send a password reset email right now.");
    } finally {
      setPasswordBusy(false);
    }
  }

  function handleStorageStatsPanel() {
    setActivePanel((current) => (current === "storage_stats" ? null : "storage_stats"));
  }

  function handleDevicesPanel() {
    setActivePanel((current) => (current === "devices" ? null : "devices"));
  }

  function handleExportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      viewer: {
        name: viewerName,
        username: viewerUsername,
        email: viewerEmail,
        collegeName
      },
      profile: initialProfile,
      stats,
      posts,
      resources: recentResources,
      courses: recentCourses,
      activity: recentActivity,
      settings,
      accountDraft
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vyb-settings-${viewerUsername}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showFeedback("success", "Settings export downloaded.");
  }

  function clearVybLocalCaches() {
    if (typeof window === "undefined") {
      return;
    }

    const removableKeys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith("vyb")) {
        removableKeys.push(key);
      }
    }

    for (const key of removableKeys) {
      window.localStorage.removeItem(key);
    }

    clearStoredCampusSettings(settingsIdentity);
  }

  async function handleClearCache() {
    if (!window.confirm("Clear locally cached VYB media, preferences, and drafts from this device?")) {
      return;
    }

    clearVybLocalCaches();
    setSettings(createDefaultCampusSettings());
    showFeedback("success", "Local cache cleared from this device.");
    router.refresh();
  }

  async function handleSessionReset(kind: "logout" | "nuclear") {
    const message =
      kind === "logout"
        ? "Sign out this VYB web session now?"
        : "This will wipe local VYB settings, cached chat keys, and sign you out of this device. Continue?";

    if (!window.confirm(message)) {
      return;
    }

    setSessionBusy(true);

    try {
      if (kind === "nuclear") {
        clearVybLocalCaches();
      }

      await clearCurrentSession(true);
    } catch {
      showFeedback("error", "We could not complete that reset right now.");
      setSessionBusy(false);
    }
  }

  function handleSoftTermination(kind: "deactivate" | "delete") {
    const copy =
      kind === "deactivate"
        ? "Permanent account deactivation is not wired to a backend endpoint in this build yet. Support mail has been prepared for you."
        : "Permanent account deletion is not wired to a backend endpoint in this build yet. Support mail has been prepared for you.";

    window.open(
      `mailto:support@vyb.app?subject=${encodeURIComponent(kind === "deactivate" ? "Account deactivation request" : "Permanent account deletion request")}`,
      "_blank",
      "noopener,noreferrer"
    );
    showFeedback("info", copy);
  }

  function openSecuritySettings() {
    queueAppRouteOrigin("/profile/settings/chat-privacy");
    router.push("/profile/settings/chat-privacy");
  }

  const deviceLabel =
    typeof navigator === "undefined"
      ? "Current browser"
      : `${navigator.platform || "Web"} • ${Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time"}`;

  const deviceDetails = useMemo(() => {
    if (typeof navigator === "undefined") {
      return {
        deviceLabel,
        browserLabel: "Web browser",
        platformLabel: "Web",
        timezoneLabel: "Local time",
        checkedAtLabel: new Date().toLocaleString("en-IN")
      };
    }

    const userAgent = navigator.userAgent;
    const browserLabel = /Edg\//u.test(userAgent)
      ? "Microsoft Edge"
      : /Chrome\//u.test(userAgent)
        ? "Chrome"
        : /Firefox\//u.test(userAgent)
          ? "Firefox"
          : /Safari\//u.test(userAgent)
            ? "Safari"
            : "Web browser";
    const platformLabel = navigator.platform || "Web";
    const timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time";

    return {
      deviceLabel: `${browserLabel} on ${platformLabel}`,
      browserLabel,
      platformLabel,
      timezoneLabel,
      checkedAtLabel: new Date().toLocaleString("en-IN")
    };
  }, []);

  return (
    <div className="vyb-settings-list-hub">
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="vyb-settings-list-hidden-input"
        onChange={handleProfilePhotoSelection}
      />

      <div className="vyb-settings-list-header">
        <button type="button" className="vyb-settings-list-back" onClick={onClose}>
          <ChevronLeftIcon />
          <span>Back to Profile</span>
        </button>
        <h2>Settings</h2>
        {feedback ? <p className={`vyb-settings-list-feedback is-${feedback.tone}`}>{feedback.text}</p> : null}
      </div>

      <div className="vyb-settings-list-body">
        {SETTINGS_DATA.map((category) => (
          <div key={category.id} className={`vyb-settings-list-category${expandedCategoryId === category.id ? " is-expanded" : ""}`}>
            <button type="button" className="vyb-settings-list-item-main" onClick={() => toggleCategory(category.id)}>
              <div className="vyb-settings-list-item-left">
                <div className="vyb-settings-list-icon">{category.icon}</div>
                <div className="vyb-settings-list-item-copy">
                  <strong>{category.label}</strong>
                </div>
              </div>
              <div className="vyb-settings-list-item-right">
                <ChevronRightIcon />
              </div>
            </button>

            {expandedCategoryId === category.id ? (
              <div className="vyb-settings-list-expanded">
                {category.id === "account" ? (
                  <>
                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Profile Personalization</span>
                      <div className="vyb-settings-list-section-group">
                        <div className="vyb-settings-list-row is-field">
                          <div className="vyb-settings-list-row-info">
                            <strong>{formatLabel("display_name")}</strong>
                          </div>
                          <input
                            className="vyb-settings-list-input"
                            value={accountDraft.displayName}
                            onChange={(event) => updateAccountDraft("displayName", event.target.value)}
                            placeholder="Enter display name"
                          />
                        </div>
                        <div className="vyb-settings-list-row is-field is-textarea">
                          <div className="vyb-settings-list-row-info">
                            <strong>Bio</strong>
                          </div>
                          <textarea
                            className="vyb-settings-list-textarea"
                            rows={3}
                            value={accountDraft.bio}
                            onChange={(event) => updateAccountDraft("bio", event.target.value.slice(0, 180))}
                            placeholder="Tell your campus network what you are into"
                          />
                        </div>
                        <button type="button" className="vyb-settings-list-row is-action is-button-row" onClick={() => avatarInputRef.current?.click()}>
                          <div className="vyb-settings-list-row-info">
                            <strong>Profile Image</strong>
                            <span>Upload a new profile photo for this device.</span>
                          </div>
                          <span className="vyb-settings-upload-btn">
                            <UploadIcon />
                            <span>Upload</span>
                          </span>
                        </button>
                        <div className="vyb-settings-list-row-actions">
                          <button type="button" className="vyb-settings-list-save-btn" onClick={handleAccountSave} disabled={profileBusy}>
                            {profileBusy ? "Saving..." : "Save personalization"}
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Campus Badge</span>
                      <div className="vyb-settings-list-section-group">
                        <div className="vyb-settings-list-row is-field">
                          <div className="vyb-settings-list-row-info">
                            <strong>{formatLabel("branch_department")}</strong>
                          </div>
                          <input
                            className="vyb-settings-list-input"
                            value={accountDraft.branchDepartment}
                            onChange={(event) => updateAccountDraft("branchDepartment", event.target.value)}
                            placeholder="CSE / Design / MBA"
                          />
                        </div>
                        <div className="vyb-settings-list-row is-field">
                          <div className="vyb-settings-list-row-info">
                            <strong>{formatLabel("batch_year")}</strong>
                          </div>
                          <select
                            className="vyb-settings-list-select"
                            value={accountDraft.batchYear}
                            onChange={(event) => updateAccountDraft("batchYear", event.target.value)}
                          >
                            {["1", "2", "3", "4", "5", "6"].map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="vyb-settings-list-row is-field">
                          <div className="vyb-settings-list-row-info">
                            <strong>{formatLabel("hostel_room_no")}</strong>
                          </div>
                          <input
                            className="vyb-settings-list-input"
                            value={accountDraft.hostelRoomNo}
                            onChange={(event) => updateAccountDraft("hostelRoomNo", event.target.value)}
                            placeholder="Optional"
                          />
                        </div>
                        <div className="vyb-settings-list-row-actions">
                          <button type="button" className="vyb-settings-list-save-btn" onClick={handleAccountSave} disabled={profileBusy}>
                            {profileBusy ? "Saving..." : "Save badge"}
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Link Social Accounts</span>
                      <div className="vyb-settings-list-section-group">
                        <div className="vyb-settings-list-row is-social-copy">
                          <div className="vyb-settings-list-row-info">
                            <strong>Profile bio icons</strong>
                            <span>Add public links or handles. Connected links appear as brand icons at the end of your bio.</span>
                          </div>
                        </div>
                        <div className="vyb-settings-social-grid">
                          {CAMPUS_SOCIAL_LINK_KEYS.map((key) => (
                            <label key={key} className="vyb-settings-social-field">
                              <span>{CAMPUS_SOCIAL_LINK_LABELS[key]}</span>
                              <input
                                className="vyb-settings-list-input"
                                value={socialDraft[key]}
                                onChange={(event) => updateSocialDraft(key, event.target.value)}
                                placeholder={
                                  key === "email"
                                    ? "name@college.edu"
                                    : key === "linkedin"
                                      ? "linkedin.com/in/username"
                                      : key === "codeforces"
                                        ? "codeforces.com/profile/handle"
                                        : key === "leetcode"
                                          ? "leetcode.com/u/username"
                                      : `@${key}_handle or profile URL`
                                }
                              />
                            </label>
                          ))}
                        </div>
                        <div className="vyb-settings-list-row-actions">
                          <button type="button" className="vyb-settings-list-save-btn" onClick={handleSocialLinksSave}>
                            Save social links
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Account Security</span>
                      <div className="vyb-settings-list-section-group">
                        <div className="vyb-settings-list-row is-field">
                          <div className="vyb-settings-list-row-info">
                            <strong>{formatLabel("primary_email")}</strong>
                            <span>Managed by your sign-in account.</span>
                          </div>
                          <input className="vyb-settings-list-input" value={accountDraft.primaryEmail} disabled readOnly />
                        </div>
                        <div className="vyb-settings-list-row is-field">
                          <div className="vyb-settings-list-row-info">
                            <strong>{formatLabel("phone_number")}</strong>
                          </div>
                          <input
                            className="vyb-settings-list-input"
                            value={accountDraft.phoneNumber}
                            onChange={(event) => updateAccountDraft("phoneNumber", event.target.value)}
                            placeholder="+91"
                          />
                        </div>
                        <button type="button" className="vyb-settings-list-row is-action is-button-row" onClick={handlePasswordReset} disabled={passwordBusy}>
                          <div className="vyb-settings-list-row-info">
                            <strong>Password Management</strong>
                            <span>Send a password reset link to your campus inbox.</span>
                          </div>
                          <span className="vyb-settings-list-inline-pill">{passwordBusy ? "Sending..." : "Send link"}</span>
                        </button>
                        <div className="vyb-settings-list-row-actions">
                          <button type="button" className="vyb-settings-list-save-btn" onClick={handleAccountSave} disabled={profileBusy}>
                            {profileBusy ? "Saving..." : "Save security contact"}
                          </button>
                        </div>
                      </div>
                    </section>
                  </>
                ) : null}

                {category.id === "privacy" ? (
                  <>
                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Identity Vault</span>
                      <div className="vyb-settings-list-section-group">
                        <button type="button" className="vyb-settings-list-row is-action is-button-row" onClick={openSecuritySettings}>
                          <div className="vyb-settings-list-row-info">
                            <strong>Manage PIN</strong>
                            <span>Open the secure identity module to manage your PIN.</span>
                          </div>
                          <ChevronRightIcon />
                        </button>
                        <button type="button" className="vyb-settings-list-row is-action is-button-row" onClick={openSecuritySettings}>
                          <div className="vyb-settings-list-row-info">
                            <strong>Master Recovery Phrase</strong>
                            <span>Open the secure identity module to view recovery options.</span>
                          </div>
                          <ChevronRightIcon />
                        </button>
                      </div>
                    </section>

                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Chat Controls</span>
                      <div className="vyb-settings-list-section-group">
                        <div className="vyb-settings-list-row">
                          <div className="vyb-settings-list-row-info">
                            <strong>{formatLabel("last_seen_online")}</strong>
                            <span>If you choose Nobody, your last seen is hidden and other students' last seen is hidden from you too.</span>
                          </div>
                          <select
                            className="vyb-settings-list-select"
                            value={settings.lastSeenOnline}
                            onChange={(event) => updateSettings("lastSeenOnline", event.target.value as StoredCampusSettings["lastSeenOnline"])}
                          >
                            {["Everyone", "My Contacts", "Nobody"].map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="vyb-settings-list-row">
                          <div className="vyb-settings-list-row-info">
                            <strong>Read Receipts</strong>
                            <span>When off, you will not send read receipts or see read receipts from others.</span>
                          </div>
                          <label className="vyb-settings-list-toggle">
                            <input
                              type="checkbox"
                              checked={settings.readReceipts}
                              onChange={(event) => updateSettings("readReceipts", event.target.checked)}
                            />
                            <span className="vyb-settings-list-toggle-slider"></span>
                          </label>
                        </div>
                        <div className="vyb-settings-list-row">
                          <div className="vyb-settings-list-row-info">
                            <strong>Typing Indicator</strong>
                            <span>When off, you will not broadcast typing or see typing indicators from others.</span>
                          </div>
                          <label className="vyb-settings-list-toggle">
                            <input
                              type="checkbox"
                              checked={settings.typingIndicator}
                              onChange={(event) => updateSettings("typingIndicator", event.target.checked)}
                            />
                            <span className="vyb-settings-list-toggle-slider"></span>
                          </label>
                        </div>
                      </div>
                    </section>

                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Permission Management</span>
                      <div className="vyb-settings-list-section-group">
                        <div className="vyb-settings-list-row">
                          <div className="vyb-settings-list-row-info">
                            <strong>{formatLabel("group_add_permissions")}</strong>
                          </div>
                          <select
                            className="vyb-settings-list-select"
                            value={settings.groupAddPermissions}
                            onChange={(event) => updateSettings("groupAddPermissions", event.target.value as StoredCampusSettings["groupAddPermissions"])}
                          >
                            {["Everyone", "Contacts", "Nobody"].map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="vyb-settings-list-row">
                          <div className="vyb-settings-list-row-info">
                            <strong>{formatLabel("story_visibility")}</strong>
                          </div>
                          <select
                            className="vyb-settings-list-select"
                            value={settings.storyVisibility}
                            onChange={(event) => updateSettings("storyVisibility", event.target.value as StoredCampusSettings["storyVisibility"])}
                          >
                            {["Everyone", "Contacts", "Nobody"].map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </section>
                  </>
                ) : null}

                {category.id === "content" ? (
                  <>
                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Auto-Destruct (TTL) Policy</span>
                      <div className="vyb-settings-list-section-group">
                        <div className="vyb-settings-list-row">
                          <div className="vyb-settings-list-row-info">
                            <strong>{formatLabel("global_message_timer")}</strong>
                          </div>
                          <select
                            className="vyb-settings-list-select"
                            value={settings.globalMessageTimer}
                            onChange={(event) => updateSettings("globalMessageTimer", event.target.value as StoredCampusSettings["globalMessageTimer"])}
                          >
                            {["Instant", "24h", "7d", "30d", "90d"].map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </section>

                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Vibe Settings</span>
                      <div className="vyb-settings-list-section-group">
                        <div className="vyb-settings-list-row">
                          <div className="vyb-settings-list-row-info">
                            <strong>High Quality Uploads</strong>
                          </div>
                          <label className="vyb-settings-list-toggle">
                            <input
                              type="checkbox"
                              checked={settings.highQualityUploads}
                              onChange={(event) => updateSettings("highQualityUploads", event.target.checked)}
                            />
                            <span className="vyb-settings-list-toggle-slider"></span>
                          </label>
                        </div>
                        <div className="vyb-settings-list-row">
                          <div className="vyb-settings-list-row-info">
                            <strong>{formatLabel("autoplay_on_wifi_only")}</strong>
                          </div>
                          <label className="vyb-settings-list-toggle">
                            <input
                              type="checkbox"
                              checked={settings.autoplayOnWifiOnly}
                              onChange={(event) => updateSettings("autoplayOnWifiOnly", event.target.checked)}
                            />
                            <span className="vyb-settings-list-toggle-slider"></span>
                          </label>
                        </div>
                      </div>
                    </section>

                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Interaction Controls</span>
                      <div className="vyb-settings-list-section-group">
                        {(
                          [
                            ["hideReactionCountsOnPosts", "hide_reaction_counts_on_posts"],
                            ["hideCommentCountsOnPosts", "hide_comment_counts_on_posts"],
                            ["hideReactionCountsOnVibes", "hide_reaction_counts_on_vibes"],
                            ["hideCommentCountsOnVibes", "hide_comment_counts_on_vibes"]
                          ] as const
                        ).map(([key, labelKey]) => (
                          <div key={key} className="vyb-settings-list-row">
                            <div className="vyb-settings-list-row-info">
                              <strong>{formatLabel(labelKey)}</strong>
                              <span>Global default. Owners can override a single post or vibe from its three-dot menu.</span>
                            </div>
                            <label className="vyb-settings-list-toggle">
                              <input
                                type="checkbox"
                                checked={settings[key]}
                                onChange={(event) => updateSettings(key, event.target.checked)}
                              />
                              <span className="vyb-settings-list-toggle-slider"></span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                ) : null}

                {category.id === "notifications" ? (
                  <>
                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Alert Toggles</span>
                      <div className="vyb-settings-list-section-group">
                        {(
                          [
                            ["chatMessages", "Chat Messages"],
                            ["marketplaceDeals", "Marketplace Deals"],
                            ["socialInteractions", "Social Interactions"]
                          ] as const
                        ).map(([key, label]) => (
                          <div key={key} className="vyb-settings-list-row">
                            <div className="vyb-settings-list-row-info">
                              <strong>{label}</strong>
                            </div>
                            <label className="vyb-settings-list-toggle">
                              <input
                                type="checkbox"
                                checked={settings[key]}
                                onChange={(event) => updateSettings(key, event.target.checked)}
                              />
                              <span className="vyb-settings-list-toggle-slider"></span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Focus Mode</span>
                      <div className="vyb-settings-list-section-group">
                        <div className="vyb-settings-list-row">
                          <div className="vyb-settings-list-row-info">
                            <strong>{formatLabel("quiet_mode")}</strong>
                          </div>
                          <label className="vyb-settings-list-toggle">
                            <input
                              type="checkbox"
                              checked={settings.quietMode}
                              onChange={(event) => updateSettings("quietMode", event.target.checked)}
                            />
                            <span className="vyb-settings-list-toggle-slider"></span>
                          </label>
                        </div>
                        <div className="vyb-settings-list-row is-field">
                          <div className="vyb-settings-list-row-info">
                            <strong>Schedule</strong>
                          </div>
                          <div className="vyb-settings-list-time-range">
                            <input
                              type="time"
                              className="vyb-settings-list-input"
                              value={settings.quietModeSchedule.start}
                              onChange={(event) =>
                                updateSettings("quietModeSchedule", {
                                  ...settings.quietModeSchedule,
                                  start: event.target.value
                                })
                              }
                            />
                            <span>to</span>
                            <input
                              type="time"
                              className="vyb-settings-list-input"
                              value={settings.quietModeSchedule.end}
                              onChange={(event) =>
                                updateSettings("quietModeSchedule", {
                                  ...settings.quietModeSchedule,
                                  end: event.target.value
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </section>
                  </>
                ) : null}

                {category.id === "system" ? (
                  <>
                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Optimization</span>
                      <div className="vyb-settings-list-section-group">
                        <button type="button" className="vyb-settings-list-row is-action is-button-row" onClick={handleClearCache}>
                          <div className="vyb-settings-list-row-info">
                            <strong>Clear Cache</strong>
                            <span>Remove device-local media, preferences, and drafts.</span>
                          </div>
                          <ChevronRightIcon />
                        </button>
                        <button type="button" className="vyb-settings-list-row is-action is-button-row" onClick={handleStorageStatsPanel}>
                          <div className="vyb-settings-list-row-info">
                            <strong>Storage Stats</strong>
                            <span>Inspect what this browser currently stores for VYB.</span>
                          </div>
                          <ChevronRightIcon />
                        </button>
                        {activePanel === "storage_stats" && storageStats ? (
                          <div className="vyb-settings-list-panel">
                            <div className="vyb-settings-list-panel-row">
                              <strong>VYB local keys</strong>
                              <span>{storageStats.vybKeyCount}</span>
                            </div>
                            <div className="vyb-settings-list-panel-row">
                              <strong>Total local storage</strong>
                              <span>{formatStorageBytes(storageStats.localStorageBytes)}</span>
                            </div>
                            <div className="vyb-settings-list-panel-row">
                              <strong>Cached avatar data</strong>
                              <span>{formatStorageBytes(storageStats.avatarBytes)}</span>
                            </div>
                            <div className="vyb-settings-list-panel-row">
                              <strong>Connected social links</strong>
                              <span>{storageStats.connectedSocialLinks}</span>
                            </div>
                          </div>
                        ) : null}
                        <button type="button" className="vyb-settings-list-row is-action is-button-row" onClick={handleExportData}>
                          <div className="vyb-settings-list-row-info">
                            <strong>Export Data</strong>
                            <span>Download a JSON snapshot of your profile and settings.</span>
                          </div>
                          <ChevronRightIcon />
                        </button>
                      </div>
                    </section>

                    <section className="vyb-settings-list-section">
                      <span className="vyb-settings-list-section-title">Media Quality</span>
                      <div className="vyb-settings-list-section-group">
                        <div className="vyb-settings-list-row">
                          <div className="vyb-settings-list-row-info">
                            <strong>Auto Download</strong>
                          </div>
                          <select
                            className="vyb-settings-list-select"
                            value={settings.autoDownload}
                            onChange={(event) => updateSettings("autoDownload", event.target.value as StoredCampusSettings["autoDownload"])}
                          >
                            {["WiFi & Cellular", "WiFi Only", "Never"].map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="vyb-settings-list-row">
                          <div className="vyb-settings-list-row-info">
                            <strong>Upload Quality</strong>
                          </div>
                          <select
                            className="vyb-settings-list-select"
                            value={settings.uploadQuality}
                            onChange={(event) => updateSettings("uploadQuality", event.target.value as StoredCampusSettings["uploadQuality"])}
                          >
                            {["Standard", "High"].map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </section>
                  </>
                ) : null}

                {category.id === "danger_zone" ? (
                  <section className="vyb-settings-list-section">
                    <span className="vyb-settings-list-section-title">Emergency Actions</span>
                    <div className="vyb-settings-list-section-group">
                      <button type="button" className="vyb-settings-list-row is-action is-button-row" onClick={handleDevicesPanel}>
                        <div className="vyb-settings-list-row-info">
                          <strong>My Logged In Devices</strong>
                          <span>Review the active browser currently holding your VYB session.</span>
                        </div>
                        <ChevronRightIcon />
                      </button>
                      {activePanel === "devices" ? (
                        <div className="vyb-settings-list-panel">
                          <div className="vyb-settings-list-panel-row">
                            <strong>Current session</strong>
                            <span>{deviceDetails.deviceLabel}</span>
                          </div>
                          <div className="vyb-settings-list-panel-row">
                            <strong>Browser</strong>
                            <span>{deviceDetails.browserLabel}</span>
                          </div>
                          <div className="vyb-settings-list-panel-row">
                            <strong>Platform</strong>
                            <span>{deviceDetails.platformLabel}</span>
                          </div>
                          <div className="vyb-settings-list-panel-row">
                            <strong>Timezone</strong>
                            <span>{deviceDetails.timezoneLabel}</span>
                          </div>
                          <div className="vyb-settings-list-panel-row">
                            <strong>Signed in as</strong>
                            <span>{viewerEmail ?? `@${viewerUsername}`}</span>
                          </div>
                          <div className="vyb-settings-list-panel-row">
                            <strong>Last checked</strong>
                            <span>{deviceDetails.checkedAtLabel}</span>
                          </div>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="vyb-settings-list-row is-action is-button-row"
                        onClick={() => handleSessionReset("logout")}
                        disabled={sessionBusy}
                      >
                        <div className="vyb-settings-list-row-info">
                          <strong className={isDangerAction("logout_all_devices") ? "is-danger" : ""}>Logout This Device</strong>
                          <span>This build can securely sign out this current browser session.</span>
                        </div>
                        <ChevronRightIcon />
                      </button>
                      <button type="button" className="vyb-settings-list-row is-action is-button-row" onClick={() => handleSoftTermination("deactivate")}>
                        <div className="vyb-settings-list-row-info">
                          <strong className="is-danger">Deactivate Account</strong>
                          <span>Prepare a deactivation request for support.</span>
                        </div>
                        <ChevronRightIcon />
                      </button>
                      <button type="button" className="vyb-settings-list-row is-action is-button-row" onClick={() => handleSoftTermination("delete")}>
                        <div className="vyb-settings-list-row-info">
                          <strong className="is-danger">Delete My Account Permanently</strong>
                          <span>Prepare a permanent deletion request for support.</span>
                        </div>
                        <ChevronRightIcon />
                      </button>
                      <button
                        type="button"
                        className="vyb-settings-list-row is-action is-button-row"
                        onClick={() => handleSessionReset("nuclear")}
                        disabled={sessionBusy}
                      >
                        <div className="vyb-settings-list-row-info">
                          <strong className="is-danger">Nuclear Reset</strong>
                          <span>Wipe device-local VYB data and sign out immediately.</span>
                        </div>
                        <ChevronRightIcon />
                      </button>
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="vyb-settings-list-footer">
        <p>VYB v2.2.0 • MASTER SETTINGS</p>
      </div>
    </div>
  );
}
