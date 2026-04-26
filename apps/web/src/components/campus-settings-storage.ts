"use client";

import type { FeedCard } from "@vyb/contracts";

const SETTINGS_UPDATED_EVENT = "vyb:settings-updated";
const POST_DISPLAY_PREFS_UPDATED_EVENT = "vyb:post-display-preferences-updated";

export type CampusSettingsIdentity = {
  userId?: string | null;
  username?: string | null;
  email?: string | null;
};

export type CampusVisibilityOption = "Everyone" | "My Contacts" | "Contacts" | "Nobody";
export type CampusMessageTimerOption = "Instant" | "24h" | "7d" | "30d" | "90d";
export type CampusAutoDownloadOption = "WiFi & Cellular" | "WiFi Only" | "Never";
export type CampusUploadQualityOption = "Standard" | "High";
export type CampusSocialLinkKey = "linkedin" | "github" | "instagram" | "email" | "twitter";
export type CampusSocialLinks = Record<CampusSocialLinkKey, string>;
export type PostDisplayPreference = {
  hideReactionCount: boolean;
  hideCommentCount: boolean;
  reactionCountMode?: "default" | "hidden" | "visible";
  commentCountMode?: "default" | "hidden" | "visible";
  updatedAt: string;
};

export const CAMPUS_SOCIAL_LINK_KEYS: CampusSocialLinkKey[] = ["linkedin", "github", "instagram", "email", "twitter"];
export const CAMPUS_SOCIAL_LINK_LABELS: Record<CampusSocialLinkKey, string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  instagram: "Instagram",
  email: "Email",
  twitter: "Twitter"
};

export type StoredCampusSettings = {
  bio: string;
  branchDepartment: string;
  hostelRoomNo: string;
  lastSeenOnline: Extract<CampusVisibilityOption, "Everyone" | "My Contacts" | "Nobody">;
  readReceipts: boolean;
  typingIndicator: boolean;
  groupAddPermissions: Extract<CampusVisibilityOption, "Everyone" | "Contacts" | "Nobody">;
  storyVisibility: Extract<CampusVisibilityOption, "Everyone" | "Contacts" | "Nobody">;
  globalMessageTimer: CampusMessageTimerOption;
  highQualityUploads: boolean;
  autoplayOnWifiOnly: boolean;
  hideReactionCountsOnPosts: boolean;
  hideCommentCountsOnPosts: boolean;
  hideReactionCountsOnVibes: boolean;
  hideCommentCountsOnVibes: boolean;
  chatMessages: boolean;
  marketplaceDeals: boolean;
  socialInteractions: boolean;
  quietMode: boolean;
  quietModeSchedule: {
    start: string;
    end: string;
  };
  autoDownload: CampusAutoDownloadOption;
  uploadQuality: CampusUploadQualityOption;
  socialLinks: CampusSocialLinks;
  updatedAt: string;
};

export function createDefaultCampusSettings(): StoredCampusSettings {
  return {
    bio: "",
    branchDepartment: "",
    hostelRoomNo: "",
    lastSeenOnline: "My Contacts",
    readReceipts: true,
    typingIndicator: true,
    groupAddPermissions: "Contacts",
    storyVisibility: "Contacts",
    globalMessageTimer: "30d",
    highQualityUploads: true,
    autoplayOnWifiOnly: true,
    hideReactionCountsOnPosts: false,
    hideCommentCountsOnPosts: false,
    hideReactionCountsOnVibes: false,
    hideCommentCountsOnVibes: false,
    chatMessages: true,
    marketplaceDeals: true,
    socialInteractions: true,
    quietMode: false,
    quietModeSchedule: {
      start: "22:00",
      end: "07:00"
    },
    autoDownload: "WiFi Only",
    uploadQuality: "High",
    socialLinks: createDefaultCampusSocialLinks(),
    updatedAt: new Date().toISOString()
  };
}

export function createDefaultCampusSocialLinks(): CampusSocialLinks {
  return {
    linkedin: "",
    github: "",
    instagram: "",
    email: "",
    twitter: ""
  };
}

function normalizeIdentifier(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized.toLowerCase() : null;
}

export function buildCampusSettingsStorageKeys(identity: CampusSettingsIdentity) {
  const keys: string[] = [];

  if (identity.userId?.trim()) {
    keys.push(`vyb-settings:user:${identity.userId.trim()}`);
  }

  const username = normalizeIdentifier(identity.username);
  if (username) {
    keys.push(`vyb-settings:username:${username}`);
  }

  const email = normalizeIdentifier(identity.email);
  if (email) {
    keys.push(`vyb-settings:email:${email}`);
  }

  return Array.from(new Set(keys));
}

function isStoredCampusSettings(value: unknown): value is StoredCampusSettings {
  const parsed = value as Partial<StoredCampusSettings> | null | undefined;
  return Boolean(
    parsed &&
      typeof parsed === "object" &&
      typeof parsed.lastSeenOnline === "string" &&
      typeof parsed.readReceipts === "boolean" &&
      typeof parsed.typingIndicator === "boolean" &&
      typeof parsed.globalMessageTimer === "string" &&
      typeof parsed.chatMessages === "boolean" &&
      typeof parsed.marketplaceDeals === "boolean" &&
      typeof parsed.socialInteractions === "boolean"
  );
}

function isVisibilityOption(value: unknown): value is Extract<CampusVisibilityOption, "Everyone" | "Contacts" | "Nobody"> {
  return value === "Everyone" || value === "Contacts" || value === "Nobody";
}

function normalizeStoredSocialLinks(value: unknown): CampusSocialLinks {
  const fallback = createDefaultCampusSocialLinks();
  const parsed = value as Partial<Record<CampusSocialLinkKey, unknown>> | null | undefined;
  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }

  return CAMPUS_SOCIAL_LINK_KEYS.reduce<CampusSocialLinks>((links, key) => {
    const rawValue = parsed[key];
    links[key] = typeof rawValue === "string" ? rawValue.trim().slice(0, 220) : "";
    return links;
  }, fallback);
}

export function normalizeCampusSocialLink(key: CampusSocialLinkKey, value: string) {
  const rawValue = value.trim();
  if (!rawValue) {
    return "";
  }

  if (key === "email") {
    const withoutMailto = rawValue.replace(/^mailto:/iu, "").trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(withoutMailto)) {
      return `mailto:${withoutMailto}`;
    }
  }

  if (/^(https?:|mailto:)/iu.test(rawValue)) {
    return rawValue;
  }

  if (/^(www\.|linkedin\.com\/|github\.com\/|instagram\.com\/|twitter\.com\/|x\.com\/)/iu.test(rawValue)) {
    return `https://${rawValue}`;
  }

  const handle = rawValue.replace(/^@/u, "").replace(/^\/+/u, "");
  const platformRoots: Record<Exclude<CampusSocialLinkKey, "email">, string> = {
    linkedin: "https://www.linkedin.com/in/",
    github: "https://github.com/",
    instagram: "https://www.instagram.com/",
    twitter: "https://twitter.com/"
  };

  if (key === "email") {
    return rawValue.includes("@") ? `mailto:${rawValue}` : rawValue;
  }

  return `${platformRoots[key]}${handle}`;
}

export function getCampusSocialLinkHref(key: CampusSocialLinkKey, value: string) {
  const normalized = normalizeCampusSocialLink(key, value);
  if (!normalized) {
    return "";
  }

  if (/^mailto:/iu.test(normalized) || /^https?:\/\//iu.test(normalized)) {
    return normalized;
  }

  return "";
}

export function readStoredCampusSettings(identity: CampusSettingsIdentity) {
  const fallback = createDefaultCampusSettings();

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    for (const key of buildCampusSettingsStorageKeys(identity)) {
      const value = window.localStorage.getItem(key);
      if (!value) {
        continue;
      }

      const parsed = JSON.parse(value) as unknown;
      if (isStoredCampusSettings(parsed)) {
        const legacySettings = parsed as Partial<StoredCampusSettings> & {
          disableCommentsOnPosts?: boolean;
          vibeVisibility?: unknown;
        };
        const storyVisibility = isVisibilityOption(legacySettings.storyVisibility)
          ? legacySettings.storyVisibility
          : isVisibilityOption(legacySettings.vibeVisibility)
            ? legacySettings.vibeVisibility
            : fallback.storyVisibility;
        return {
          ...fallback,
          ...parsed,
          storyVisibility,
          socialLinks: normalizeStoredSocialLinks(legacySettings.socialLinks),
          hideReactionCountsOnPosts:
            typeof legacySettings.hideReactionCountsOnPosts === "boolean"
              ? legacySettings.hideReactionCountsOnPosts
              : fallback.hideReactionCountsOnPosts,
          hideCommentCountsOnPosts:
            typeof legacySettings.hideCommentCountsOnPosts === "boolean"
              ? legacySettings.hideCommentCountsOnPosts
              : Boolean(legacySettings.disableCommentsOnPosts),
          hideReactionCountsOnVibes:
            typeof legacySettings.hideReactionCountsOnVibes === "boolean"
              ? legacySettings.hideReactionCountsOnVibes
              : fallback.hideReactionCountsOnVibes,
          hideCommentCountsOnVibes:
            typeof legacySettings.hideCommentCountsOnVibes === "boolean"
              ? legacySettings.hideCommentCountsOnVibes
              : fallback.hideCommentCountsOnVibes,
          quietModeSchedule: {
            ...fallback.quietModeSchedule,
            ...parsed.quietModeSchedule
          }
        };
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function persistStoredCampusSettings(identity: CampusSettingsIdentity, settings: StoredCampusSettings) {
  if (typeof window === "undefined") {
    return;
  }

  const keys = buildCampusSettingsStorageKeys(identity);
  if (keys.length === 0) {
    return;
  }

  const payload = JSON.stringify({
    ...settings,
    updatedAt: new Date().toISOString()
  });

  try {
    for (const key of keys) {
      window.localStorage.setItem(key, payload);
    }
    window.localStorage.setItem("vyb-settings:last-active", payload);

    window.dispatchEvent(
      new CustomEvent(SETTINGS_UPDATED_EVENT, {
        detail: {
          keys
        }
      })
    );
  } catch {
    // Ignore storage failures and keep the current in-memory state alive.
  }
}

export function clearStoredCampusSettings(identity: CampusSettingsIdentity) {
  if (typeof window === "undefined") {
    return;
  }

  const keys = buildCampusSettingsStorageKeys(identity);

  try {
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
    window.localStorage.removeItem("vyb-settings:last-active");

    window.dispatchEvent(
      new CustomEvent(SETTINGS_UPDATED_EVENT, {
        detail: {
          keys
        }
      })
    );
  } catch {
    // Ignore storage failures.
  }
}

export function subscribeToCampusSettings(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith("vyb-settings:")) {
      listener();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(SETTINGS_UPDATED_EVENT, listener);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(SETTINGS_UPDATED_EVENT, listener);
  };
}

function buildPostDisplayPreferenceKeys(identity: CampusSettingsIdentity) {
  const keys: string[] = [];

  if (identity.userId?.trim()) {
    keys.push(`vyb-post-display:user:${identity.userId.trim()}`);
  }

  const username = normalizeIdentifier(identity.username);
  if (username) {
    keys.push(`vyb-post-display:username:${username}`);
  }

  const email = normalizeIdentifier(identity.email);
  if (email) {
    keys.push(`vyb-post-display:email:${email}`);
  }

  return Array.from(new Set(keys));
}

function isPostDisplayPreference(value: unknown): value is PostDisplayPreference {
  const parsed = value as Partial<PostDisplayPreference> | null | undefined;
  return Boolean(
    parsed &&
      typeof parsed === "object" &&
      typeof parsed.hideReactionCount === "boolean" &&
      typeof parsed.hideCommentCount === "boolean"
  );
}

function normalizePostDisplayMode(value: unknown): "default" | "hidden" | "visible" {
  return value === "hidden" || value === "visible" ? value : "default";
}

export function readPostDisplayPreferences(identity: CampusSettingsIdentity) {
  if (typeof window === "undefined") {
    return {} as Record<string, PostDisplayPreference>;
  }

  try {
    for (const key of buildPostDisplayPreferenceKeys(identity)) {
      const rawValue = window.localStorage.getItem(key);
      if (!rawValue) {
        continue;
      }

      const parsed = JSON.parse(rawValue) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object") {
        continue;
      }

      return Object.entries(parsed).reduce<Record<string, PostDisplayPreference>>((preferences, [postId, value]) => {
        if (typeof postId === "string" && postId.trim() && isPostDisplayPreference(value)) {
          preferences[postId] = {
            hideReactionCount: value.hideReactionCount,
            hideCommentCount: value.hideCommentCount,
            reactionCountMode: normalizePostDisplayMode(value.reactionCountMode),
            commentCountMode: normalizePostDisplayMode(value.commentCountMode),
            updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString()
          };
        }

        return preferences;
      }, {});
    }
  } catch {
    return {};
  }

  return {};
}

export function persistPostDisplayPreference(
  identity: CampusSettingsIdentity,
  postId: string,
  preference: Pick<PostDisplayPreference, "hideReactionCount" | "hideCommentCount"> &
    Partial<Pick<PostDisplayPreference, "reactionCountMode" | "commentCountMode">>
) {
  if (typeof window === "undefined" || !postId.trim()) {
    return;
  }

  const keys = buildPostDisplayPreferenceKeys(identity);
  if (keys.length === 0) {
    return;
  }

  const current = readPostDisplayPreferences(identity);
  const payload = {
    ...current,
    [postId]: {
      hideReactionCount: preference.hideReactionCount,
      hideCommentCount: preference.hideCommentCount,
      reactionCountMode: normalizePostDisplayMode(preference.reactionCountMode),
      commentCountMode: normalizePostDisplayMode(preference.commentCountMode),
      updatedAt: new Date().toISOString()
    }
  };

  try {
    const serialized = JSON.stringify(payload);
    for (const key of keys) {
      window.localStorage.setItem(key, serialized);
    }

    window.dispatchEvent(
      new CustomEvent(POST_DISPLAY_PREFS_UPDATED_EVENT, {
        detail: {
          keys,
          postId
        }
      })
    );
  } catch {
    // Ignore local preference storage failures.
  }
}

export function subscribeToPostDisplayPreferences(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith("vyb-post-display:")) {
      listener();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(POST_DISPLAY_PREFS_UPDATED_EVENT, listener);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(POST_DISPLAY_PREFS_UPDATED_EVENT, listener);
  };
}

export function getPostDisplayControls(
  settings: StoredCampusSettings,
  post: Pick<FeedCard, "placement" | "kind">,
  preference?: Partial<PostDisplayPreference> | null
) {
  const isVibe = post.placement === "vibe" || post.kind === "video";
  const globalHideReactionCount = isVibe ? settings.hideReactionCountsOnVibes : settings.hideReactionCountsOnPosts;
  const globalHideCommentCount = isVibe ? settings.hideCommentCountsOnVibes : settings.hideCommentCountsOnPosts;
  const reactionMode = normalizePostDisplayMode(preference?.reactionCountMode);
  const commentMode = normalizePostDisplayMode(preference?.commentCountMode);

  return {
    hideReactionCount: reactionMode === "visible" ? false : reactionMode === "hidden" ? true : Boolean(preference?.hideReactionCount || globalHideReactionCount),
    hideCommentCount: commentMode === "visible" ? false : commentMode === "hidden" ? true : Boolean(preference?.hideCommentCount || globalHideCommentCount)
  };
}
