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

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function buildDefaultAvatarUrl({
  seed,
  displayName,
  username,
  size = 240
}: {
  seed?: string | null;
  displayName?: string | null;
  username?: string | null;
  size?: number;
}) {
  const source = seed?.trim() || displayName?.trim() || username?.trim() || "vyb-user";
  const palette = [
    ["#f8fafc", "#d1d5db", "#263443"],
    ["#f4f4f5", "#cbd5e1", "#27313d"],
    ["#f1f5f9", "#d4d4d8", "#243241"],
    ["#f5f5f4", "#d6d3d1", "#2a3440"]
  ];
  const [highlight, background, ink] = palette[hashString(source) % palette.length] ?? palette[0];
  const center = Math.round(size / 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><radialGradient id="bg" cx="34%" cy="22%" r="82%"><stop offset="0" stop-color="${highlight}"/><stop offset="0.56" stop-color="${background}"/><stop offset="1" stop-color="#b7bec8"/></radialGradient></defs><rect width="${size}" height="${size}" rx="${center}" fill="url(#bg)"/><circle cx="${center}" cy="${Math.round(size * 0.36)}" r="${Math.round(size * 0.16)}" fill="${ink}"/><path d="M${Math.round(size * 0.2)} ${Math.round(size * 0.86)}c${Math.round(size * 0.08)}-${Math.round(size * 0.26)} ${Math.round(size * 0.26)}-${Math.round(size * 0.39)} ${Math.round(size * 0.3)}-${Math.round(size * 0.39)}h${Math.round(size * 0.02)}c${Math.round(size * 0.04)} 0 ${Math.round(size * 0.22)} ${Math.round(size * 0.13)} ${Math.round(size * 0.3)} ${Math.round(size * 0.39)}z" fill="${ink}"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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

export function clearStoredAvatarUrl(identity: AvatarIdentity) {
  if (typeof window === "undefined") {
    return;
  }

  const keys = buildAvatarStorageKeys(identity);

  if (keys.length === 0) {
    return;
  }

  try {
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }

    window.dispatchEvent(
      new CustomEvent(AVATAR_UPDATED_EVENT, {
        detail: {
          keys,
          avatarUrl: null
        }
      })
    );
  } catch {
    // Ignore storage failures and let the server value decide after refresh.
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
      setStoredAvatarUrl(identity.avatarUrl ?? readAvatarFromKeys(storageKeys));
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

  return identity.avatarUrl ?? storedAvatarUrl ?? null;
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
  const defaultAvatarUrl = buildDefaultAvatarUrl({ seed: userId ?? username ?? email, displayName, username });
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedAvatarUrl, defaultAvatarUrl]);

  if (resolvedAvatarUrl && !imageFailed) {
    return (
      <img
        src={resolvedAvatarUrl}
        alt={decorative ? "" : alt ?? displayName ?? username ?? "Profile photo"}
        aria-hidden={decorative || undefined}
        onError={() => setImageFailed(true)}
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

  return (
    <img
      src={defaultAvatarUrl}
      alt={decorative ? "" : alt ?? displayName ?? username ?? "Profile avatar"}
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
