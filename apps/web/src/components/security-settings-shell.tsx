"use client";

import type {
  ChatDevicePairingSession,
  ChatIdentitySummary,
  ChatKeyBackupRecord,
  ChatServerPinAttemptState,
  ChatTrustedDevicePlatform,
  ChatTrustedDeviceRecord
} from "@vyb/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildPrimaryCampusNav, CampusDesktopNavigation } from "./campus-navigation";
import { ChatPrivacyUI } from "./chat-privacy-ui";
import {
  CHAT_IDENTITY_ALGORITHM,
  createStoredChatKeyMaterial,
  createChatDevicePairingRequestKey,
  decryptRecoveryPhraseFromBackup,
  decryptStoredChatKeyMaterialFromDevicePairing,
  decryptStoredChatKeyMaterialFromBackup,
  encryptStoredChatKeyMaterialForDevicePairing,
  encryptStoredChatKeyMaterialForBackup,
  generateRecoveryPhrase,
  isStoredChatKeyCompatible,
  isValidSecurityPin,
  loadStoredChatKeyMaterial,
  normalizeRecoveryPhrase,
  normalizeSecurityPin,
  saveStoredChatKeyMaterial,
  type StoredChatKeyMaterial
} from "../lib/chat-e2ee";

type SecuritySettingsShellProps = {
  viewerUserId: string;
  viewerKeyStorageUserIds?: string[];
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  initialViewerIdentity: ChatIdentitySummary | null;
  initialBackup: ChatKeyBackupRecord | null;
  initialTrustedDevices?: ChatTrustedDeviceRecord[];
  initialIntent?: "create-identity" | "create-backup" | "restore-device" | null;
  initialPairingId?: string | null;
  returnTo?: string | null;
  loadError?: string | null;
};

type ActiveModal = "create-backup" | "change-pin" | "verify-recovery" | null;

const RESTORE_DEVICE_PAIRING_MESSAGE =
  "Approve this browser from a trusted device. PIN or recovery phrase restore is only a fallback if another device is not available.";

function normalizeDevicePairingCode(value: string) {
  return value.replace(/\D/gu, "").slice(0, 6);
}

function formatLockoutCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) {
    return "recently";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return date.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getOrCreateChatDeviceId(viewerUserId: string) {
  const storageKey = `vyb-chat-device-id:${viewerUserId}`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const nextId = crypto.randomUUID();
  window.localStorage.setItem(storageKey, nextId);
  return nextId;
}

function getChatPairingPrivateKeyStorageKey(pairingId: string) {
  return `vyb-chat-device-pairing-private:${pairingId}`;
}

function getChatPairingIdFromLink(value: string) {
  const trimmed = value.trim();
  if (/^[0-9a-f-]{36}$/iu.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed, window.location.origin);
    const pairingId = url.searchParams.get("pair");
    return pairingId && /^[0-9a-f-]{36}$/iu.test(pairingId) ? pairingId : null;
  } catch {
    return null;
  }
}

function detectTrustedDevicePlatform(): ChatTrustedDevicePlatform {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("android")) {
    return "android";
  }
  if (userAgent.includes("iphone") || userAgent.includes("ipad") || userAgent.includes("ipod")) {
    return "ios";
  }
  return "web";
}

function buildTrustedDeviceLabel() {
  const platform = navigator.platform || "browser";
  const userAgent = navigator.userAgent;
  const browser =
    userAgent.includes("Edg/")
      ? "Edge"
      : userAgent.includes("Chrome/")
        ? "Chrome"
        : userAgent.includes("Firefox/")
          ? "Firefox"
          : userAgent.includes("Safari/")
            ? "Safari"
            : "Browser";

  return `${browser} on ${platform}`.slice(0, 80);
}

async function fetchSecurityJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message ?? "We could not complete the secure settings request.");
  }

  return data as T;
}

export function SecuritySettingsShell({
  viewerUserId,
  viewerKeyStorageUserIds = [],
  viewerName,
  viewerUsername,
  collegeName,
  initialViewerIdentity,
  initialBackup,
  initialTrustedDevices = [],
  initialIntent = null,
  initialPairingId = null,
  returnTo = null,
  loadError
}: SecuritySettingsShellProps) {
  const router = useRouter();
  const [viewerIdentity, setViewerIdentity] = useState<ChatIdentitySummary | null>(initialViewerIdentity);
  const [localChatKey, setLocalChatKey] = useState<StoredChatKeyMaterial | null>(null);
  const [remoteKeyBackup, setRemoteKeyBackup] = useState<ChatKeyBackupRecord | null>(initialBackup);
  const [trustedDevices, setTrustedDevices] = useState<ChatTrustedDeviceRecord[]>(initialTrustedDevices);
  const [devicePairing, setDevicePairing] = useState<ChatDevicePairingSession | null>(null);
  const [incomingPairing, setIncomingPairing] = useState<ChatDevicePairingSession | null>(null);
  const [attemptState, setAttemptState] = useState<ChatServerPinAttemptState | null>(null);
  const [pageError, setPageError] = useState<string | null>(loadError ?? null);
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [createPin, setCreatePin] = useState("");
  const [confirmCreatePin, setConfirmCreatePin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [viewPhrasePin, setViewPhrasePin] = useState("");
  const [restoreSecret, setRestoreSecret] = useState("");
  const [pairingCodeInput, setPairingCodeInput] = useState("");
  const [revealedRecoveryPhrase, setRevealedRecoveryPhrase] = useState<string | null>(null);
  const localKeyRef = useRef<StoredChatKeyMaterial | null>(null);
  const intentHandledRef = useRef<string | null>(null);
  const trustedDeviceSyncRef = useRef<string | null>(null);
  const chatKeyStorageUserIds = useMemo(() => {
    const ids = [viewerUserId, ...viewerKeyStorageUserIds]
      .map((id) => id.trim())
      .filter(Boolean);
    return Array.from(new Set(ids));
  }, [viewerKeyStorageUserIds, viewerUserId]);
  const primaryChatKeyStorageUserId = chatKeyStorageUserIds[0] ?? viewerUserId;

  useEffect(() => {
    localKeyRef.current = localChatKey;
  }, [localChatKey]);

  async function loadStoredChatKeyMaterialForViewer() {
    for (const storageUserId of chatKeyStorageUserIds) {
      const stored = await loadStoredChatKeyMaterial(storageUserId).catch(() => null);
      if (stored) {
        return stored;
      }
    }

    return null;
  }

  async function saveStoredChatKeyMaterialForViewer(material: StoredChatKeyMaterial) {
    const normalized =
      material.userId === primaryChatKeyStorageUserId
        ? material
        : {
            ...material,
            userId: primaryChatKeyStorageUserId
          };
    await saveStoredChatKeyMaterial(normalized);
    return (await loadStoredChatKeyMaterial(primaryChatKeyStorageUserId).catch(() => null)) ?? normalized;
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stored = await loadStoredChatKeyMaterialForViewer();
        if (cancelled) {
          return;
        }

        if (stored && viewerIdentity && isStoredChatKeyCompatible(stored, viewerIdentity)) {
          const synced = await saveStoredChatKeyMaterialForViewer({
            ...stored,
            identityId: viewerIdentity.id,
            algorithm: viewerIdentity.algorithm,
            keyVersion: viewerIdentity.keyVersion,
            updatedAt: viewerIdentity.updatedAt
          });
          if (!cancelled) {
            setLocalChatKey(synced);
          }
          return;
        }

        setLocalChatKey(viewerIdentity ? null : stored);
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : "We could not load your secure session on this device.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatKeyStorageUserIds, primaryChatKeyStorageUserId, viewerIdentity]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await fetchSecurityJson<{ attemptState: ChatServerPinAttemptState }>("/api/chats/key-backup/attempts", {
          method: "GET"
        });
        if (!cancelled) {
          setAttemptState(data.attemptState);
        }
      } catch {
        if (!cancelled) {
          setAttemptState(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasCompatibleLocalChatKey = Boolean(
    viewerIdentity && localChatKey && isStoredChatKeyCompatible(localChatKey, viewerIdentity)
  );
  const hasRemoteBackup = Boolean(remoteKeyBackup);
  const backupNeedsUpgrade = Boolean(
    remoteKeyBackup && (!remoteKeyBackup.pinWrappedRecoveryPhrase || !remoteKeyBackup.pinRecoveryPhraseIv)
  );
  const localSessionLabel = !viewerIdentity
    ? "No campus chat identity is published yet."
    : hasCompatibleLocalChatKey
      ? "This browser is holding your secure chat identity."
      : hasRemoteBackup
        ? "Pair this browser from a trusted device, or use your encrypted backup as a fallback."
        : "Pair this browser from a trusted device to restore the local chat key.";
  const cloudBackupLabel = hasRemoteBackup
    ? `Cloud backup ready, last sealed ${formatUpdatedAt(remoteKeyBackup?.updatedAt ?? null)}.`
    : "No encrypted cloud backup exists yet.";
  const secureSessionTone = hasCompatibleLocalChatKey ? "ready" : viewerIdentity ? "restore" : "setup";
  const navItems = buildPrimaryCampusNav("profile", { profileHref: "/profile/settings/chat-privacy" });
  const activeLockoutUntil =
    attemptState?.lockedUntil && new Date(attemptState.lockedUntil).getTime() > Date.now()
      ? attemptState.lockedUntil
      : null;
  const activeLockoutCountdown = activeLockoutUntil
    ? formatLockoutCountdown(new Date(activeLockoutUntil).getTime() - Date.now())
    : "";
  const devicePairingLink =
    typeof window !== "undefined" && devicePairing
      ? `${window.location.origin}/profile/settings/chat-privacy?pair=${encodeURIComponent(devicePairing.id)}`
      : null;

  useEffect(() => {
    if (!hasCompatibleLocalChatKey || !localChatKey?.publicKey) {
      trustedDeviceSyncRef.current = null;
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const deviceId = getOrCreateChatDeviceId(viewerUserId);
        const syncKey = `${deviceId}:${localChatKey.publicKey}`;
        if (trustedDeviceSyncRef.current === syncKey) {
          return;
        }

        trustedDeviceSyncRef.current = syncKey;
        const data = await fetchSecurityJson<{ items: ChatTrustedDeviceRecord[] }>("/api/chats/devices", {
          method: "PUT",
          body: JSON.stringify({
            deviceId,
            label: buildTrustedDeviceLabel(),
            platform: detectTrustedDevicePlatform(),
            publicKey: localChatKey.publicKey
          })
        });

        if (!cancelled) {
          setTrustedDevices(data.items);
        }
      } catch {
        if (!cancelled) {
          trustedDeviceSyncRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasCompatibleLocalChatKey, localChatKey?.publicKey, viewerUserId]);

  useEffect(() => {
    if (!initialIntent) {
      intentHandledRef.current = null;
      return;
    }

    const intentKey = [
      initialIntent,
      viewerIdentity ? "identity" : "no-identity",
      hasCompatibleLocalChatKey ? "local-ready" : "local-missing",
      hasRemoteBackup ? "backup-ready" : "backup-missing"
    ].join("|");

    if (intentHandledRef.current === intentKey) {
      return;
    }

    if (initialIntent === "create-identity" && !viewerIdentity && !busyAction) {
      intentHandledRef.current = intentKey;
      void handleCreateIdentity();
      return;
    }

    if (initialIntent === "create-backup" && hasCompatibleLocalChatKey && !hasRemoteBackup && !activeModal) {
      intentHandledRef.current = intentKey;
      setActiveModal("create-backup");
      return;
    }

    if (initialIntent === "restore-device" && viewerIdentity && !hasCompatibleLocalChatKey) {
      if (busyAction || devicePairing || incomingPairing) {
        return;
      }
      intentHandledRef.current = intentKey;
      setPageError(RESTORE_DEVICE_PAIRING_MESSAGE);
      void handleStartDevicePairing({ automatic: true });
    }
  }, [
    activeModal,
    busyAction,
    devicePairing,
    hasCompatibleLocalChatKey,
    hasRemoteBackup,
    incomingPairing,
    initialIntent,
    viewerIdentity
  ]);

  useEffect(() => {
    if (!initialPairingId) {
      setIncomingPairing(null);
      return;
    }

    setDevicePairing(null);

    let cancelled = false;

    void (async () => {
      try {
        const data = await fetchSecurityJson<{ pairing: ChatDevicePairingSession }>(
          `/api/chats/device-pairings/${encodeURIComponent(initialPairingId)}`,
          {
            method: "GET"
          }
        );
        if (!cancelled) {
          setIncomingPairing(data.pairing);
        }
      } catch (error) {
        if (!cancelled) {
          setIncomingPairing(null);
          setPageError(error instanceof Error ? error.message : "This device pairing link is no longer valid.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialPairingId]);

  useEffect(() => {
    if (!devicePairing || devicePairing.status !== "pending") {
      return;
    }

    let cancelled = false;
    let consecutiveFailures = 0;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const data = await fetchSecurityJson<{ pairing: ChatDevicePairingSession }>(
            `/api/chats/device-pairings/${encodeURIComponent(devicePairing.id)}`,
            {
              method: "GET"
            }
          );
          if (cancelled) {
            return;
          }

          consecutiveFailures = 0;
          setDevicePairing(data.pairing);
          if (data.pairing.status === "approved" && data.pairing.transferEnvelope) {
            window.clearInterval(timer);
            void handleClaimDevicePairing(data.pairing);
          } else if (data.pairing.status === "expired") {
            window.clearInterval(timer);
            setPageError("This pairing code expired. Start pairing again to get a fresh 6-digit code.");
          } else if (data.pairing.status === "claimed") {
            window.clearInterval(timer);
            setPageSuccess("Trusted device pairing is already complete on this browser.");
          }
        } catch {
          if (!cancelled) {
            consecutiveFailures += 1;
            if (consecutiveFailures >= 8) {
              window.clearInterval(timer);
              setPageError("We are having trouble checking approval status. Keep this page open and tap Start pairing again if the code expires.");
            }
          }
        }
      })();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [devicePairing]);

  useEffect(() => {
    if (hasCompatibleLocalChatKey) {
      setPageError((current) =>
        current === RESTORE_DEVICE_PAIRING_MESSAGE
          ? null
          : current
      );
    }
  }, [hasCompatibleLocalChatKey]);

  function resetFeedback() {
    setPageError(null);
    setPageSuccess(null);
  }

  async function refreshAttemptState() {
    const data = await fetchSecurityJson<{ attemptState: ChatServerPinAttemptState }>("/api/chats/key-backup/attempts", {
      method: "GET"
    });
    setAttemptState(data.attemptState);
    return data.attemptState;
  }

  async function recordFailedAttempt() {
    const data = await fetchSecurityJson<{ attemptState: ChatServerPinAttemptState }>("/api/chats/key-backup/attempts", {
      method: "PUT",
      body: "{}"
    });
    setAttemptState(data.attemptState);
    return data.attemptState;
  }

  async function clearAttemptState() {
    const data = await fetchSecurityJson<{ attemptState: ChatServerPinAttemptState }>("/api/chats/key-backup/attempts", {
      method: "DELETE",
      body: "{}"
    });
    setAttemptState(data.attemptState);
    return data.attemptState;
  }

  async function refreshTrustedDevices() {
    const deviceId =
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(`vyb-chat-device-id:${viewerUserId}`);
    const data = await fetchSecurityJson<{ items: ChatTrustedDeviceRecord[] }>(
      `/api/chats/devices${deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ""}`,
      {
        method: "GET"
      }
    );
    setTrustedDevices(data.items);
    return data.items;
  }

  async function handleLoadDevicePairingCode() {
    resetFeedback();
    const pairingCode = normalizeDevicePairingCode(pairingCodeInput);
    if (pairingCode.length !== 6) {
      setPageError("Enter the 6-digit code shown on the browser you want to unlock.");
      return;
    }

    setBusyAction("device-pairing-code");

    try {
      const data = await fetchSecurityJson<{ pairing: ChatDevicePairingSession }>(
        `/api/chats/device-pairings?code=${encodeURIComponent(pairingCode)}`,
        {
          method: "GET"
        }
      );
      setIncomingPairing(data.pairing);
      setDevicePairing(null);
      setPageSuccess("Pairing request found. Check the browser name, then approve it.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not find that pairing code.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLoadDevicePairingLink(value: string) {
    resetFeedback();
    const pairingId = getChatPairingIdFromLink(value);
    if (!pairingId) {
      setPageError("This QR is not a valid device pairing request.");
      return;
    }

    setBusyAction("device-pairing-scan");

    try {
      const data = await fetchSecurityJson<{ pairing: ChatDevicePairingSession }>(
        `/api/chats/device-pairings/${encodeURIComponent(pairingId)}`,
        {
          method: "GET"
        }
      );
      setIncomingPairing(data.pairing);
      setDevicePairing(null);
      setPageSuccess("Pairing request scanned. Check the device name, then approve it.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not load that pairing QR.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRevokeTrustedDevice(deviceId: string) {
    resetFeedback();
    setBusyAction(`revoke-device:${deviceId}`);

    try {
      const data = await fetchSecurityJson<{ items: ChatTrustedDeviceRecord[] }>(
        `/api/chats/devices/${encodeURIComponent(deviceId)}`,
        {
          method: "DELETE",
          body: "{}"
        }
      );
      setTrustedDevices(data.items);
      setPageSuccess("Trusted chat device removed.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not remove this trusted chat device.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleStartDevicePairing(options: { automatic?: boolean } = {}) {
    resetFeedback();
    setBusyAction("device-pairing-create");

    try {
      if (!viewerIdentity) {
        throw new Error("Set up secure chat identity before pairing devices.");
      }

      const deviceId = getOrCreateChatDeviceId(viewerUserId);
      const requestKey = await createChatDevicePairingRequestKey();
      const data = await fetchSecurityJson<{ pairing: ChatDevicePairingSession }>("/api/chats/device-pairings", {
        method: "POST",
        body: JSON.stringify({
          requesterDeviceId: deviceId,
          requesterLabel: buildTrustedDeviceLabel(),
          requesterPlatform: detectTrustedDevicePlatform(),
          requesterPublicKey: requestKey.publicKey
        })
      });
      window.sessionStorage.setItem(getChatPairingPrivateKeyStorageKey(data.pairing.id), requestKey.privateKey);
      setDevicePairing(data.pairing);
      setPageSuccess(
        options.automatic
          ? "Pairing link ready. Open or scan it on your already trusted device to approve this browser."
          : "Pairing link ready. Open it on an already trusted device to approve this browser."
      );
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not start trusted device pairing.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleApproveDevicePairing() {
    resetFeedback();
    setBusyAction("device-pairing-approve");

    try {
      if (!incomingPairing) {
        throw new Error("Open a valid device pairing link first.");
      }
      if (!localChatKey || !viewerIdentity || !isStoredChatKeyCompatible(localChatKey, viewerIdentity)) {
        throw new Error("This browser is not trusted yet. Approve from a device where secure chat already works.");
      }

      const approverDeviceId = getOrCreateChatDeviceId(viewerUserId);
      const transferEnvelope = await encryptStoredChatKeyMaterialForDevicePairing(
        localChatKey,
        incomingPairing.requesterPublicKey
      );
      const data = await fetchSecurityJson<{ pairing: ChatDevicePairingSession }>(
        `/api/chats/device-pairings/${encodeURIComponent(incomingPairing.id)}/approve`,
        {
          method: "PUT",
          body: JSON.stringify({
            approverDeviceId,
            approverLabel: buildTrustedDeviceLabel(),
            transferEnvelope
          })
        }
      );
      setIncomingPairing(data.pairing);
      setPageSuccess("New device approved. Keep the new device online for a few seconds so it can finish syncing.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not approve this device pairing.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleClaimDevicePairing(pairing: ChatDevicePairingSession) {
    resetFeedback();
    setBusyAction("device-pairing-claim");

    try {
      if (!pairing.transferEnvelope) {
        throw new Error("This pairing has not been approved yet.");
      }

      const privateKey = window.sessionStorage.getItem(getChatPairingPrivateKeyStorageKey(pairing.id));
      if (!privateKey) {
        throw new Error("This browser no longer has the one-time pairing key. Start pairing again.");
      }

      const material = await decryptStoredChatKeyMaterialFromDevicePairing(
        pairing.transferEnvelope,
        privateKey,
        {
          userId: primaryChatKeyStorageUserId,
          allowedUserIds: chatKeyStorageUserIds,
          expectedPublicKey: viewerIdentity?.publicKey ?? null
        }
      );
      const synced = viewerIdentity
        ? {
            ...material,
            identityId: viewerIdentity.id,
            algorithm: viewerIdentity.algorithm,
            keyVersion: viewerIdentity.keyVersion,
            updatedAt: viewerIdentity.updatedAt
          }
        : material;
      const saved = await saveStoredChatKeyMaterialForViewer(synced);
      setLocalChatKey(saved);
      window.sessionStorage.removeItem(getChatPairingPrivateKeyStorageKey(pairing.id));
      const claimed = await fetchSecurityJson<{ pairing: ChatDevicePairingSession }>(
        `/api/chats/device-pairings/${encodeURIComponent(pairing.id)}/claim`,
        {
          method: "PUT",
          body: "{}"
        }
      );
      setDevicePairing(claimed.pairing);
      setPageSuccess("Trusted device pairing complete. Secure chat is ready on this browser.");
      void refreshTrustedDevices();
      if (returnTo) {
        window.setTimeout(() => {
          router.replace(returnTo);
        }, 180);
      }
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not finish trusted device pairing.");
    } finally {
      setBusyAction(null);
    }
  }

  async function ensureChatIdentityReady() {
    if (viewerIdentity && localKeyRef.current && isStoredChatKeyCompatible(localKeyRef.current, viewerIdentity)) {
      return localKeyRef.current;
    }

    const stored = localKeyRef.current ?? (await loadStoredChatKeyMaterialForViewer());
    if (viewerIdentity && stored && isStoredChatKeyCompatible(stored, viewerIdentity)) {
      const synced = await saveStoredChatKeyMaterialForViewer({
        ...stored,
        identityId: viewerIdentity.id,
        algorithm: viewerIdentity.algorithm,
        keyVersion: viewerIdentity.keyVersion,
        updatedAt: viewerIdentity.updatedAt
      });
      setLocalChatKey(synced);
      return synced;
    }

    if (viewerIdentity) {
      if (remoteKeyBackup) {
        throw new Error(
          "This browser is not trusted yet. Pair it from another trusted device, or use the PIN / recovery phrase fallback below."
        );
      }

      throw new Error(
        "This browser is not trusted yet. Use device pairing from the original browser before creating a fresh secure chat identity."
      );
    }

    const material = stored ?? (await createStoredChatKeyMaterial(primaryChatKeyStorageUserId));
    const savedMaterial = await saveStoredChatKeyMaterialForViewer(material);
    setLocalChatKey(savedMaterial);

    const data = await fetchSecurityJson<{ identity: ChatIdentitySummary }>("/api/chats/keys", {
      method: "PUT",
      body: JSON.stringify({
        publicKey: savedMaterial.publicKey,
        algorithm: savedMaterial.algorithm || CHAT_IDENTITY_ALGORITHM,
        keyVersion: savedMaterial.keyVersion
      })
    });

    const synced = await saveStoredChatKeyMaterialForViewer({
      ...savedMaterial,
      identityId: data.identity.id,
      algorithm: data.identity.algorithm,
      keyVersion: data.identity.keyVersion,
      updatedAt: data.identity.updatedAt
    });
    setViewerIdentity(data.identity);
    setLocalChatKey(synced);
    return synced;
  }

  async function saveBackup(material: StoredChatKeyMaterial, pin: string, recoveryPhrase: string) {
    const encryptedBackup = await encryptStoredChatKeyMaterialForBackup(material, {
      pin,
      userSalt: viewerUserId,
      recoveryPhrase
    });
    const data = await fetchSecurityJson<{ backup: ChatKeyBackupRecord }>("/api/chats/key-backup", {
      method: "PUT",
      body: JSON.stringify(encryptedBackup)
    });
    setRemoteKeyBackup(data.backup);
    return data.backup;
  }

  async function verifyPinProtectedBackup(pin: string) {
    if (!remoteKeyBackup) {
      throw new Error("No encrypted cloud backup exists for this account yet.");
    }

    const gate = await refreshAttemptState();
    if (gate.isLocked && gate.lockedUntil) {
      throw new Error(
        `Too many wrong PIN attempts. Try again in ${formatLockoutCountdown(new Date(gate.lockedUntil).getTime() - Date.now())}.`
      );
    }

    try {
      const restored = await decryptStoredChatKeyMaterialFromBackup(remoteKeyBackup, pin);
      if (viewerIdentity && !isStoredChatKeyCompatible(restored, viewerIdentity)) {
        throw new Error("That PIN restored a different key than the one linked to this account.");
      }
      await clearAttemptState();
      return restored;
    } catch {
      const nextState = await recordFailedAttempt();
      if (nextState.isLocked && nextState.lockedUntil) {
        throw new Error(
          `Too many wrong PIN attempts. Try again in ${formatLockoutCountdown(new Date(nextState.lockedUntil).getTime() - Date.now())}.`
        );
      }

      throw new Error(
        `Wrong PIN. ${Math.max(0, nextState.remainingAttempts)} attempts left before this account locks for 1 hour.`
      );
    }
  }

  async function handleCreateIdentity() {
    resetFeedback();
    setBusyAction("identity");

    try {
      await ensureChatIdentityReady();
      if (initialIntent && !remoteKeyBackup) {
        setActiveModal("create-backup");
        setPageSuccess("Secure chat identity is ready. Create a backup fallback now.");
      } else {
        setPageSuccess("Secure chat identity is ready on this device.");
      }
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not create your secure chat identity.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateBackup() {
    resetFeedback();
    setBusyAction("create-backup");

    try {
      const normalizedPin = normalizeSecurityPin(createPin);
      const normalizedConfirmPin = normalizeSecurityPin(confirmCreatePin);
      if (!isValidSecurityPin(normalizedPin)) {
        throw new Error("Choose a 6-digit backup PIN before creating the fallback.");
      }
      if (normalizedPin !== normalizedConfirmPin) {
        throw new Error("Your new PIN confirmation does not match.");
      }

      const material = await ensureChatIdentityReady();
      const nextRecoveryPhrase = generateRecoveryPhrase();
      await saveBackup(material, normalizedPin, nextRecoveryPhrase);
      setRevealedRecoveryPhrase(nextRecoveryPhrase);
      setCreatePin("");
      setConfirmCreatePin("");
      setActiveModal(null);
      setPageSuccess("Encrypted cloud backup created. Save the 24-word recovery phrase now.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not create your encrypted backup.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleChangePin() {
    resetFeedback();
    setBusyAction("change-pin");

    try {
      const normalizedCurrentPin = normalizeSecurityPin(currentPin);
      const normalizedNewPin = normalizeSecurityPin(newPin);
      const normalizedConfirmPin = normalizeSecurityPin(confirmNewPin);
      if (!isValidSecurityPin(normalizedCurrentPin)) {
        throw new Error("Enter your current 6-digit PIN first.");
      }
      if (!isValidSecurityPin(normalizedNewPin)) {
        throw new Error("Choose a new 6-digit PIN.");
      }
      if (normalizedNewPin !== normalizedConfirmPin) {
        throw new Error("Your new PIN confirmation does not match.");
      }

      const material = await verifyPinProtectedBackup(normalizedCurrentPin);
      let nextRecoveryPhrase: string;
      let generatedFreshPhrase = false;

      try {
        nextRecoveryPhrase = await decryptRecoveryPhraseFromBackup(remoteKeyBackup as ChatKeyBackupRecord, normalizedCurrentPin);
      } catch {
        nextRecoveryPhrase = generateRecoveryPhrase();
        generatedFreshPhrase = true;
      }

      await saveBackup(material, normalizedNewPin, nextRecoveryPhrase);
      setRevealedRecoveryPhrase(nextRecoveryPhrase);
      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
      setActiveModal(null);
      setPageSuccess(
        generatedFreshPhrase
          ? "PIN updated. This backup also generated a fresh recovery phrase because the older backup could not reveal one."
          : "Backup PIN updated successfully."
      );
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not update your backup PIN.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleViewRecoveryPhrase() {
    resetFeedback();
    setBusyAction("view-phrase");

    try {
      const normalizedPin = normalizeSecurityPin(viewPhrasePin);
      if (!isValidSecurityPin(normalizedPin)) {
        throw new Error("Enter your current 6-digit PIN to reveal the recovery phrase.");
      }

      await verifyPinProtectedBackup(normalizedPin);
      const phrase = await decryptRecoveryPhraseFromBackup(remoteKeyBackup as ChatKeyBackupRecord, normalizedPin);
      setRevealedRecoveryPhrase(phrase);
      setViewPhrasePin("");
      setActiveModal(null);
      setPageSuccess("Recovery phrase unlocked on this device. Keep it offline and private.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not reveal your recovery phrase.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRestoreLocalKey() {
    resetFeedback();
    setBusyAction("restore-device");

    try {
      if (!remoteKeyBackup) {
        throw new Error("No encrypted cloud backup is available for this account.");
      }

      const secret = restoreSecret.trim();
      if (!secret) {
        throw new Error("Enter your 6-digit PIN or 24-word recovery phrase first.");
      }

      const material = isValidSecurityPin(secret)
        ? await verifyPinProtectedBackup(secret)
        : await decryptStoredChatKeyMaterialFromBackup(remoteKeyBackup, normalizeRecoveryPhrase(secret));
      const nextIdentity = viewerIdentity ?? initialViewerIdentity;
      const synced = await saveStoredChatKeyMaterialForViewer(
        nextIdentity
          ? {
            ...material,
            identityId: nextIdentity.id,
            algorithm: nextIdentity.algorithm,
            keyVersion: nextIdentity.keyVersion,
            updatedAt: nextIdentity.updatedAt
          }
          : material
      );
      setLocalChatKey(synced);
      setRestoreSecret("");
      setPageSuccess("Secure session restored on this device.");
      if (returnTo) {
        window.setTimeout(() => {
          router.replace(returnTo);
        }, 160);
      }
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not restore your local secure session.");
    } finally {
      setBusyAction(null);
    }
  }

  function handleCopyRecoveryPhrase() {
    const phrase = revealedRecoveryPhrase;
    if (!phrase) {
      return;
    }

    void navigator.clipboard?.writeText(phrase);
    setPageSuccess("Recovery phrase copied. Store it offline and remove it from shared clipboards.");
  }

  return (
    <main className="vyb-campus-home vyb-chat-privacy-page">
      <CampusDesktopNavigation navItems={navItems} viewerName={viewerName} viewerUsername={viewerUsername} />

      <section className="vyb-campus-main vyb-chat-privacy-main">
        <ChatPrivacyUI
          viewerName={viewerName}
          viewerUsername={viewerUsername}
          collegeName={collegeName}
          pageError={pageError}
          pageSuccess={pageSuccess}
          busyAction={busyAction}
          activeModal={activeModal}
          setActiveModal={setActiveModal}
          createPin={createPin}
          confirmCreatePin={confirmCreatePin}
          onCreatePinChange={(value) => setCreatePin(normalizeSecurityPin(value))}
          onConfirmCreatePinChange={(value) => setConfirmCreatePin(normalizeSecurityPin(value))}
          currentPin={currentPin}
          newPin={newPin}
          confirmNewPin={confirmNewPin}
          onCurrentPinChange={(value) => setCurrentPin(normalizeSecurityPin(value))}
          onNewPinChange={(value) => setNewPin(normalizeSecurityPin(value))}
          onConfirmNewPinChange={(value) => setConfirmNewPin(normalizeSecurityPin(value))}
          viewPhrasePin={viewPhrasePin}
          onViewPhrasePinChange={(value) => setViewPhrasePin(normalizeSecurityPin(value))}
          restoreSecret={restoreSecret}
          onRestoreSecretChange={setRestoreSecret}
          pairingCodeInput={pairingCodeInput}
          onPairingCodeInputChange={(value) => setPairingCodeInput(normalizeDevicePairingCode(value))}
          revealedRecoveryPhrase={revealedRecoveryPhrase}
          onHideRecoveryPhrase={() => setRevealedRecoveryPhrase(null)}
          onCopyRecoveryPhrase={handleCopyRecoveryPhrase}
          localSessionLabel={localSessionLabel}
          cloudBackupLabel={cloudBackupLabel}
          secureSessionTone={secureSessionTone}
          hasCompatibleLocalChatKey={hasCompatibleLocalChatKey}
          hasRemoteBackup={hasRemoteBackup}
          hasViewerIdentity={Boolean(viewerIdentity)}
          backupNeedsUpgrade={backupNeedsUpgrade}
          activeLockoutCountdown={activeLockoutCountdown}
          attemptState={attemptState}
          trustedDevices={trustedDevices}
          devicePairing={devicePairing}
          devicePairingLink={devicePairingLink}
          incomingPairing={incomingPairing}
          onCreateIdentity={() => {
            void handleCreateIdentity();
          }}
          onCreateBackup={() => {
            void handleCreateBackup();
          }}
          onChangePin={() => {
            void handleChangePin();
          }}
          onViewRecoveryPhrase={() => {
            void handleViewRecoveryPhrase();
          }}
          onRestoreLocalKey={() => {
            void handleRestoreLocalKey();
          }}
          onRefreshTrustedDevices={() => {
            void refreshTrustedDevices();
          }}
          onRevokeTrustedDevice={(deviceId) => {
            void handleRevokeTrustedDevice(deviceId);
          }}
          onStartDevicePairing={() => {
            void handleStartDevicePairing();
          }}
          onApproveDevicePairing={() => {
            void handleApproveDevicePairing();
          }}
          onLoadDevicePairingCode={() => {
            void handleLoadDevicePairingCode();
          }}
          onLoadDevicePairingLink={(value) => {
            void handleLoadDevicePairingLink(value);
          }}
          lastBackupUpdatedLabel={formatUpdatedAt(remoteKeyBackup?.updatedAt ?? null)}
          backToHref={returnTo ?? "/messages"}
          backToLabel={returnTo ? "Continue to chats" : "Back to chats"}
        />
      </section>
    </main>
  );
}
