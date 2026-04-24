"use client";

import type {
  ChatIdentitySummary,
  ChatKeyBackupRecord,
  ChatServerPinAttemptState
} from "@vyb/contracts";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildPrimaryCampusNav, CampusDesktopNavigation } from "./campus-navigation";
import { ChatPrivacyUI } from "./chat-privacy-ui";
import {
  CHAT_IDENTITY_ALGORITHM,
  createStoredChatKeyMaterial,
  decryptRecoveryPhraseFromBackup,
  decryptStoredChatKeyMaterialFromBackup,
  encryptStoredChatKeyMaterialForBackup,
  generateRecoveryPhrase,
  isStoredChatKeyCompatible,
  isValidSecurityPin,
  loadStoredChatKeyMaterial,
  normalizeRecoveryPhrase,
  normalizeSecurityPin,
  saveStoredChatKeyMaterial,
  syncStoredChatKeyIdentity,
  type StoredChatKeyMaterial
} from "../lib/chat-e2ee";

type SecuritySettingsShellProps = {
  viewerUserId: string;
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  initialViewerIdentity: ChatIdentitySummary | null;
  initialBackup: ChatKeyBackupRecord | null;
  initialIntent?: "create-identity" | "create-backup" | "restore-device" | null;
  returnTo?: string | null;
  loadError?: string | null;
};

type ActiveModal = "create-backup" | "change-pin" | "verify-recovery" | null;

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
  viewerName,
  viewerUsername,
  collegeName,
  initialViewerIdentity,
  initialBackup,
  initialIntent = null,
  returnTo = null,
  loadError
}: SecuritySettingsShellProps) {
  const router = useRouter();
  const [viewerIdentity, setViewerIdentity] = useState<ChatIdentitySummary | null>(initialViewerIdentity);
  const [localChatKey, setLocalChatKey] = useState<StoredChatKeyMaterial | null>(null);
  const [remoteKeyBackup, setRemoteKeyBackup] = useState<ChatKeyBackupRecord | null>(initialBackup);
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
  const [revealedRecoveryPhrase, setRevealedRecoveryPhrase] = useState<string | null>(null);
  const localKeyRef = useRef<StoredChatKeyMaterial | null>(null);
  const intentHandledRef = useRef<string | null>(null);

  useEffect(() => {
    localKeyRef.current = localChatKey;
  }, [localChatKey]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stored = await loadStoredChatKeyMaterial(viewerUserId);
        if (cancelled) {
          return;
        }

        if (stored && viewerIdentity && isStoredChatKeyCompatible(stored, viewerIdentity)) {
          const synced = (await syncStoredChatKeyIdentity(viewerUserId, viewerIdentity)) ?? stored;
          if (!cancelled) {
            setLocalChatKey(synced);
          }
          return;
        }

        setLocalChatKey(stored);
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : "We could not load your secure session on this device.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [viewerIdentity, viewerUserId]);

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
        ? "Restore this browser from your encrypted backup."
        : "Create a backup after the first secure session is ready.";
  const cloudBackupLabel = hasRemoteBackup
    ? `Cloud backup ready, last sealed ${formatUpdatedAt(remoteKeyBackup?.updatedAt ?? null)}.`
    : "No encrypted cloud backup exists yet.";
  const secureSessionTone = hasCompatibleLocalChatKey ? "ready" : hasRemoteBackup ? "restore" : "setup";
  const navItems = buildPrimaryCampusNav("profile", { profileHref: "/profile/settings/chat-privacy" });
  const activeLockoutUntil =
    attemptState?.lockedUntil && new Date(attemptState.lockedUntil).getTime() > Date.now()
      ? attemptState.lockedUntil
      : null;
  const activeLockoutCountdown = activeLockoutUntil
    ? formatLockoutCountdown(new Date(activeLockoutUntil).getTime() - Date.now())
    : "";

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

    if (initialIntent === "restore-device" && hasRemoteBackup && !hasCompatibleLocalChatKey) {
      intentHandledRef.current = intentKey;
      setPageError("Restore this browser first with your 6-digit PIN or 24-word recovery phrase, then return to chats.");
    }
  }, [activeModal, busyAction, hasCompatibleLocalChatKey, hasRemoteBackup, initialIntent, viewerIdentity]);

  useEffect(() => {
    if (hasCompatibleLocalChatKey) {
      setPageError((current) =>
        current === "Restore this browser first with your 6-digit PIN or 24-word recovery phrase, then return to chats."
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

  async function ensureChatIdentityReady() {
    if (viewerIdentity && localKeyRef.current && isStoredChatKeyCompatible(localKeyRef.current, viewerIdentity)) {
      return localKeyRef.current;
    }

    const stored = localKeyRef.current ?? (await loadStoredChatKeyMaterial(viewerUserId));
    if (viewerIdentity && stored && isStoredChatKeyCompatible(stored, viewerIdentity)) {
      const synced = (await syncStoredChatKeyIdentity(viewerUserId, viewerIdentity)) ?? stored;
      await saveStoredChatKeyMaterial(synced);
      setLocalChatKey(synced);
      return synced;
    }

    if (viewerIdentity) {
      if (remoteKeyBackup) {
        throw new Error(
          "This account already has an older secure chat setup. If you know that PIN, restore this browser below. If you never created a PIN, this old setup needs to be reset before starting fresh."
        );
      }

      throw new Error(
        "This account already has an older secure chat identity but this browser does not have the matching local key. Reset the old chat setup before creating a fresh one."
      );
    }

    const material = stored ?? (await createStoredChatKeyMaterial(viewerUserId));
    await saveStoredChatKeyMaterial(material);
    setLocalChatKey(material);

    const data = await fetchSecurityJson<{ identity: ChatIdentitySummary }>("/api/chats/keys", {
      method: "PUT",
      body: JSON.stringify({
        publicKey: material.publicKey,
        algorithm: material.algorithm || CHAT_IDENTITY_ALGORITHM,
        keyVersion: material.keyVersion
      })
    });

    const synced = (await syncStoredChatKeyIdentity(viewerUserId, data.identity)) ?? {
      ...material,
      identityId: data.identity.id,
      algorithm: data.identity.algorithm,
      keyVersion: data.identity.keyVersion,
      updatedAt: data.identity.updatedAt
    };
    await saveStoredChatKeyMaterial(synced);
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
        setPageSuccess("Secure chat identity is ready. Set your first 6-digit PIN now.");
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
        throw new Error("Choose a 6-digit security PIN before creating the backup.");
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
          : "Security PIN updated successfully."
      );
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not update your security PIN.");
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
      const synced = nextIdentity
        ? (await syncStoredChatKeyIdentity(viewerUserId, nextIdentity)) ?? {
            ...material,
            identityId: nextIdentity.id,
            algorithm: nextIdentity.algorithm,
            keyVersion: nextIdentity.keyVersion,
            updatedAt: nextIdentity.updatedAt
          }
        : material;
      await saveStoredChatKeyMaterial(synced);
      const hardened = await loadStoredChatKeyMaterial(viewerUserId);
      setLocalChatKey(hardened ?? synced);
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
          lastBackupUpdatedLabel={formatUpdatedAt(remoteKeyBackup?.updatedAt ?? null)}
          backToHref={returnTo ?? "/messages"}
          backToLabel={returnTo ? "Continue to chats" : "Back to chats"}
        />
      </section>
    </main>
  );
}
