"use client";

const SETTINGS_UPDATED_EVENT = "vyb:settings-updated";

export type CampusSettingsIdentity = {
  userId?: string | null;
  username?: string | null;
  email?: string | null;
};

export type CampusVisibilityOption = "Everyone" | "My Contacts" | "Contacts" | "Nobody";
export type CampusMessageTimerOption = "Instant" | "24h" | "7d" | "30d" | "90d";
export type CampusAutoDownloadOption = "WiFi & Cellular" | "WiFi Only" | "Never";
export type CampusUploadQualityOption = "Standard" | "High";
export type CampusVerificationStatus = "unverified" | "requested" | "verified";

export type StoredCampusSettings = {
  bio: string;
  branchDepartment: string;
  hostelRoomNo: string;
  lastSeenOnline: Extract<CampusVisibilityOption, "Everyone" | "My Contacts" | "Nobody">;
  readReceipts: boolean;
  typingIndicator: boolean;
  groupAddPermissions: Extract<CampusVisibilityOption, "Everyone" | "Contacts" | "Nobody">;
  vibeVisibility: Extract<CampusVisibilityOption, "Everyone" | "Contacts" | "Nobody">;
  globalMessageTimer: CampusMessageTimerOption;
  janitorExclusions: string[];
  highQualityUploads: boolean;
  autoplayOnWifiOnly: boolean;
  disableCommentsOnPosts: boolean;
  hideReactionCountsOnVibes: boolean;
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
  verifiedStudentStatus: CampusVerificationStatus;
  linkedAccounts: {
    google: boolean;
    phone: boolean;
    github: boolean;
  };
  coverPhotoUrl: string | null;
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
    vibeVisibility: "Contacts",
    globalMessageTimer: "30d",
    janitorExclusions: [],
    highQualityUploads: true,
    autoplayOnWifiOnly: true,
    disableCommentsOnPosts: false,
    hideReactionCountsOnVibes: false,
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
    verifiedStudentStatus: "unverified",
    linkedAccounts: {
      google: true,
      phone: true,
      github: false
    },
    coverPhotoUrl: null,
    updatedAt: new Date().toISOString()
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
      typeof parsed.socialInteractions === "boolean" &&
      Array.isArray(parsed.janitorExclusions)
  );
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
        return {
          ...fallback,
          ...parsed,
          linkedAccounts: {
            ...fallback.linkedAccounts,
            ...parsed.linkedAccounts
          },
          quietModeSchedule: {
            ...fallback.quietModeSchedule,
            ...parsed.quietModeSchedule
          },
          janitorExclusions: parsed.janitorExclusions.filter((entry) => typeof entry === "string")
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
