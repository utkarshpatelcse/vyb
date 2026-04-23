"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

const AVATAR_UPDATED_EVENT = "vyb:avatar-updated";

type AvatarIdentity = {
  userId?: string | null;
  username?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

type CampusAvatarContentProps = AvatarIdentity & {
  displayName?: string | null;
  fallback?: ReactNode;
  alt?: string;
  decorative?: boolean;
};

function normalizeIdentifier(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized.toLowerCase() : null;
}

function buildDefaultInitials(displayName?: string | null, username?: string | null) {
  const source = (displayName?.trim() || username?.trim() || "V").trim();
  const parts = source.split(/\s+/u).filter(Boolean).slice(0, 2);

  if (parts.length > 1) {
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  }

  return source.slice(0, 2).toUpperCase();
}

export function buildAvatarStorageKeys({ userId, username, email }: AvatarIdentity) {
  const keys: string[] = [];

  if (userId?.trim()) {
    keys.push(`vyb-avatar:user:${userId.trim()}`);
  }

  const normalizedUsername = normalizeIdentifier(username);
  if (normalizedUsername) {
    keys.push(`vyb-avatar:username:${normalizedUsername}`);
  }

  const normalizedEmail = normalizeIdentifier(email);
  if (normalizedEmail) {
    keys.push(`vyb-avatar:email:${normalizedEmail}`);
  }

  return Array.from(new Set(keys));
}

function readAvatarFromKeys(keys: string[]) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    for (const key of keys) {
      const value = window.localStorage.getItem(key);
      if (value && value.trim().length > 0) {
        return value;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function readStoredAvatarUrl(identity: AvatarIdentity) {
  return readAvatarFromKeys(buildAvatarStorageKeys(identity));
}

export function persistStoredAvatarUrl(identity: AvatarIdentity, avatarUrl: string) {
  if (typeof window === "undefined" || !avatarUrl) {
    return;
  }

  const keys = buildAvatarStorageKeys(identity);

  if (keys.length === 0) {
    return;
  }

  try {
    for (const key of keys) {
      window.localStorage.setItem(key, avatarUrl);
    }

    window.dispatchEvent(
      new CustomEvent(AVATAR_UPDATED_EVENT, {
        detail: {
          keys,
          avatarUrl
        }
      })
    );
  } catch {
    // Ignore storage quota / privacy mode failures and fall back to in-memory UI state.
  }
}

export function useResolvedAvatarUrl(identity: AvatarIdentity) {
  const storageKeys = useMemo(
    () =>
      buildAvatarStorageKeys({
        userId: identity.userId,
        username: identity.username,
        email: identity.email
      }),
    [identity.email, identity.userId, identity.username]
  );
  const storageKeySignature = storageKeys.join("|");
  const [storedAvatarUrl, setStoredAvatarUrl] = useState<string | null>(identity.avatarUrl ?? null);

  useEffect(() => {
    const syncAvatar = () => {
      setStoredAvatarUrl(readAvatarFromKeys(storageKeys) ?? identity.avatarUrl ?? null);
    };

    syncAvatar();

    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || storageKeys.includes(event.key)) {
        syncAvatar();
      }
    };
    const handleAvatarUpdate = () => {
      syncAvatar();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdate);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdate);
    };
  }, [identity.avatarUrl, storageKeySignature, storageKeys]);

  return storedAvatarUrl ?? identity.avatarUrl ?? null;
}

export function CampusAvatarContent({
  userId,
  username,
  email,
  avatarUrl,
  displayName,
  fallback,
  alt,
  decorative = false
}: CampusAvatarContentProps) {
  const resolvedAvatarUrl = useResolvedAvatarUrl({
    userId,
    username,
    email,
    avatarUrl
  });

  if (resolvedAvatarUrl) {
    return (
      <img
        src={resolvedAvatarUrl}
        alt={decorative ? "" : alt ?? displayName ?? username ?? "Profile photo"}
        aria-hidden={decorative || undefined}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: "inherit",
          display: "block"
        }}
      />
    );
  }

  return <>{fallback ?? buildDefaultInitials(displayName, username)}</>;
}
