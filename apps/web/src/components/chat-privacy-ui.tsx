"use client";

import type { ChatServerPinAttemptState } from "@vyb/contracts";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";

type ChatPrivacyModal = "create-backup" | "change-pin" | "verify-recovery" | null;
type StatusTone = "secured" | "warning" | "risk";
type StatusCard = {
  title: string;
  label: string;
  detail: string;
  tone: StatusTone;
  icon: "shield" | "cloud" | "key";
};
type GuidanceActionKind = "create-identity" | "create-backup" | "change-pin" | "verify-recovery" | "anchor-restore";
type GuidanceAction = {
  label: string;
  kind: GuidanceActionKind;
};
type GuidanceCard = {
  kicker: string;
  title: string;
  detail: string;
  tone: StatusTone;
  primaryAction: GuidanceAction;
  secondaryAction?: GuidanceAction;
};

type ChatPrivacyUIProps = {
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  backToHref: string;
  backToLabel: string;
  pageError: string | null;
  pageSuccess: string | null;
  busyAction: string | null;
  activeModal: ChatPrivacyModal;
  setActiveModal: (value: ChatPrivacyModal) => void;
  createPin: string;
  confirmCreatePin: string;
  onCreatePinChange: (value: string) => void;
  onConfirmCreatePinChange: (value: string) => void;
  currentPin: string;
  newPin: string;
  confirmNewPin: string;
  onCurrentPinChange: (value: string) => void;
  onNewPinChange: (value: string) => void;
  onConfirmNewPinChange: (value: string) => void;
  viewPhrasePin: string;
  onViewPhrasePinChange: (value: string) => void;
  restoreSecret: string;
  onRestoreSecretChange: (value: string) => void;
  revealedRecoveryPhrase: string | null;
  onHideRecoveryPhrase: () => void;
  onCopyRecoveryPhrase: () => void;
  localSessionLabel: string;
  cloudBackupLabel: string;
  secureSessionTone: "ready" | "restore" | "setup";
  hasCompatibleLocalChatKey: boolean;
  hasRemoteBackup: boolean;
  hasViewerIdentity: boolean;
  backupNeedsUpgrade: boolean;
  activeLockoutCountdown: string;
  attemptState: ChatServerPinAttemptState | null;
  onCreateIdentity: () => void;
  onCreateBackup: () => void;
  onChangePin: () => void;
  onViewRecoveryPhrase: () => void;
  onRestoreLocalKey: () => void;
  lastBackupUpdatedLabel: string;
};

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vyb-chat-privacy-icon">
      {children}
    </svg>
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

function CloudIcon() {
  return (
    <IconBase>
      <path
        d="M7.5 18.5h8.8a4.2 4.2 0 0 0 .3-8.4 5.5 5.5 0 0 0-10.8-1.3A4.4 4.4 0 0 0 7.5 18.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function KeyIcon() {
  return (
    <IconBase>
      <path
        d="M14.5 7.5a4 4 0 1 0-2.6 3.8L14 13.4V16h2.6v2H19v-2.6h2V13h-3.2l-2.1-2.1a4 4 0 0 0-1.2-3.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10.2" cy="7.8" r="1" fill="currentColor" />
    </IconBase>
  );
}

function CloseIcon() {
  return (
    <IconBase>
      <path d="M6 6 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

function LockIcon() {
  return (
    <IconBase>
      <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

function SessionToneBadge({ tone }: { tone: ChatPrivacyUIProps["secureSessionTone"] }) {
  const label = tone === "ready" ? "Secured" : tone === "restore" ? "Restore needed" : "Setup needed";
  return (
    <span className={`vyb-chat-privacy-pill vyb-chat-privacy-pill-${tone}`}>
      <span className={`vyb-chat-privacy-pulse vyb-chat-privacy-pulse-${tone === "ready" ? "secured" : tone === "restore" ? "warning" : "risk"}`} />
      {label}
    </span>
  );
}

function StatusIcon({ icon }: { icon: StatusCard["icon"] }) {
  if (icon === "cloud") {
    return <CloudIcon />;
  }
  if (icon === "key") {
    return <KeyIcon />;
  }
  return <ShieldIcon />;
}

function StatusCardView({ card, index }: { card: StatusCard; index: number }) {
  return (
    <motion.article
      className="vyb-chat-privacy-status-card"
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.06 }}
    >
      <div className="vyb-chat-privacy-status-head">
        <span className={`vyb-chat-privacy-status-icon vyb-chat-privacy-status-icon-${card.tone}`}>
          <StatusIcon icon={card.icon} />
        </span>
        <span className={`vyb-chat-privacy-pulse vyb-chat-privacy-pulse-${card.tone}`} />
      </div>
      <span className="vyb-chat-privacy-status-title">{card.title}</span>
      <strong>{card.label}</strong>
      <p>{card.detail}</p>
    </motion.article>
  );
}

function ModalFrame({
  title,
  description,
  children,
  onClose
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="vyb-chat-privacy-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="vyb-chat-privacy-modal"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.22 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vyb-chat-privacy-modal-head">
          <div>
            <strong>{title}</strong>
            <p>{description}</p>
          </div>
          <button type="button" className="vyb-chat-privacy-modal-close" onClick={onClose} aria-label="Close modal">
            <CloseIcon />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function buildStatusCards(props: ChatPrivacyUIProps): StatusCard[] {
  return [
    {
      title: "Vault",
      label: props.hasCompatibleLocalChatKey ? "This browser is ready" : props.hasViewerIdentity ? "Restore needed" : "Setup needed",
      detail: props.hasCompatibleLocalChatKey
        ? "Your private chat key is already sealed locally inside this browser."
        : props.hasViewerIdentity
          ? "Your account already has chat identity data, but this browser needs the local key restored."
          : "Create the secure session once on this browser before backup or restore can work.",
      tone: props.hasCompatibleLocalChatKey ? "secured" : props.hasViewerIdentity ? "warning" : "risk",
      icon: "shield"
    },
    {
      title: "Backup",
      label: props.hasRemoteBackup ? "Cloud backup synced" : "Backup missing",
      detail: props.hasRemoteBackup
        ? `Encrypted backup last sealed ${props.lastBackupUpdatedLabel}.`
        : "Set one 6-digit PIN to create the first encrypted backup for restore later.",
      tone: props.hasRemoteBackup ? "secured" : "warning",
      icon: "cloud"
    },
    {
      title: "Recovery",
      label: !props.hasRemoteBackup ? "Phrase unavailable" : props.backupNeedsUpgrade ? "Upgrade required" : "Recovery phrase sealed",
      detail: !props.hasRemoteBackup
        ? "Your 24-word recovery phrase appears only after the first backup is created."
        : props.backupNeedsUpgrade
          ? "This backup uses the older format. Change the PIN once to reseal the phrase envelope."
          : "Viewing the phrase always requires PIN verification on this browser.",
      tone: !props.hasRemoteBackup ? "risk" : props.backupNeedsUpgrade ? "warning" : "secured",
      icon: "key"
    }
  ];
}

function buildGuidanceCard(props: ChatPrivacyUIProps): GuidanceCard {
  if (!props.hasViewerIdentity) {
    return {
      kicker: "Step 1",
      title: "Create your secure session first",
      detail: "This browser does not have a usable chat identity yet. Create it once, then you can set a PIN or make a backup.",
      tone: "risk",
      primaryAction: { label: "Create secure session", kind: "create-identity" }
    };
  }

  if (!props.hasCompatibleLocalChatKey && props.hasRemoteBackup) {
    return {
      kicker: "Do this now",
      title: "Restore this browser before opening chats",
      detail: "Your account already has an encrypted backup. Enter your 6-digit PIN or full 24-word phrase below, then tap Restore this browser.",
      tone: "warning",
      primaryAction: { label: "Go to restore", kind: "anchor-restore" },
      secondaryAction: { label: "Refresh secure session", kind: "create-identity" }
    };
  }

  if (!props.hasRemoteBackup) {
    return {
      kicker: "Step 2",
      title: "Set your first 6-digit PIN",
      detail: "PIN is only for backup and restore. Create the first encrypted backup now so this account can be recovered after sign-out, browser reset, or device change.",
      tone: "warning",
      primaryAction: { label: "Set first PIN", kind: "create-backup" }
    };
  }

  if (props.backupNeedsUpgrade) {
    return {
      kicker: "One quick fix",
      title: "Upgrade the backup envelope",
      detail: "Your cloud backup exists, but the recovery phrase is still in the older format. Change the PIN once to upgrade it safely.",
      tone: "warning",
      primaryAction: { label: "Upgrade backup now", kind: "change-pin" }
    };
  }

  if (!props.hasCompatibleLocalChatKey) {
    return {
      kicker: "Recovery needed",
      title: "Bring the local key back to this browser",
      detail: "Your identity exists but this browser still cannot decrypt. Use your PIN or recovery phrase in the restore box below.",
      tone: "warning",
      primaryAction: { label: "Go to restore", kind: "anchor-restore" }
    };
  }

  return {
    kicker: "All set",
    title: "Your secure chat setup is ready",
    detail: "This browser already has a local key, a cloud backup, and a sealed recovery phrase flow. You can open chats now or manage the backup below.",
    tone: "secured",
    primaryAction: { label: "Change PIN", kind: "change-pin" },
    secondaryAction: { label: "View recovery phrase", kind: "verify-recovery" }
  };
}

export function ChatPrivacyUI(props: ChatPrivacyUIProps) {
  const lockoutActive = Boolean(props.activeLockoutCountdown);
  const attemptsLabel = props.attemptState
    ? props.attemptState.isLocked
      ? "Temporarily blocked by server"
      : `${Math.max(0, props.attemptState.remainingAttempts)} attempts remaining`
    : "Rate-limited on backend";

  const sessionStatus =
    props.secureSessionTone === "ready" ? "Active" :
    props.secureSessionTone === "restore" ? "Restore" : "Setup";
  const sessionPulse =
    props.secureSessionTone === "ready" ? "secured" :
    props.secureSessionTone === "restore" ? "warning" : "risk";

  return (
    <>
      <div className="vyb-chat-privacy-shell">

        {/* ── HEADER ── */}
        <motion.header
          className="vyb-chat-privacy-hero"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26 }}
        >
          <div className="vyb-chat-privacy-hero-copy">
            <nav className="vyb-chat-privacy-kicker">Chat Privacy</nav>
            <h1>Identity Vault</h1>
          </div>
          <div className="vyb-chat-privacy-hero-status">
            <span className={`vyb-chat-privacy-pulse vyb-chat-privacy-pulse-${sessionPulse}`} />
            <strong>{sessionStatus}</strong>
          </div>
        </motion.header>

        {/* ── 3 MINI STAT CARDS ── */}
        <motion.div
          className="vyb-chat-privacy-snapshot"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.05 }}
        >
          <div className="vyb-chat-privacy-snapshot-card">
            <span>Local</span>
            <strong>{props.hasCompatibleLocalChatKey ? "Encrypted" : "Not ready"}</strong>
          </div>
          <div className="vyb-chat-privacy-snapshot-card">
            <span>Cloud</span>
            <strong>{props.hasRemoteBackup ? "Synced" : "Missing"}</strong>
          </div>
          <div className="vyb-chat-privacy-snapshot-card">
            <span>E2EE</span>
            <strong>v2.1</strong>
          </div>
        </motion.div>

        {/* ── ALERTS ── */}
        {props.pageError && (
          <div className="vyb-chat-privacy-banner vyb-chat-privacy-banner-error" role="alert">
            <LockIcon />
            <div>
              <strong>Attention</strong>
              <span>{props.pageError}</span>
            </div>
          </div>
        )}
        {props.pageSuccess && (
          <div className="vyb-chat-privacy-banner vyb-chat-privacy-banner-success" role="status">
            <SparkIcon />
            <div>
              <strong>Updated</strong>
              <span>{props.pageSuccess}</span>
            </div>
          </div>
        )}
        {lockoutActive && (
          <div className="vyb-chat-privacy-banner vyb-chat-privacy-banner-warning" role="alert">
            <LockIcon />
            <div>
              <strong>PIN locked for {props.activeLockoutCountdown}</strong>
              <span>Server-side rate limit — clearing browser data won&apos;t bypass this.</span>
            </div>
          </div>
        )}

        {/* ── MAIN SECTIONS ── */}
        <main className="vyb-chat-privacy-card-grid">

          {/* Security PIN */}
          <motion.section
            className="vyb-chat-privacy-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, delay: 0.08 }}
          >
            <div className="vyb-cp-row">
              <div className="vyb-cp-row-copy">
                <h3>Security PIN</h3>
                <p>Critical for device recovery. Losing this PIN will result in permanent chat loss.</p>
              </div>
              {!props.hasRemoteBackup ? (
                <button
                  type="button"
                  className="vyb-cp-btn-white"
                  onClick={() => props.setActiveModal("create-backup")}
                  disabled={props.busyAction === "create-backup"}
                >
                  {props.busyAction === "create-backup" ? "Sealing…" : "Set PIN"}
                </button>
              ) : (
                <button
                  type="button"
                  className="vyb-cp-btn-white"
                  onClick={() => props.setActiveModal("change-pin")}
                  disabled={props.busyAction === "change-pin"}
                >
                  {props.busyAction === "change-pin" ? "Saving…" : "Update"}
                </button>
              )}
            </div>
            <div className="vyb-cp-shield-bar">
              <span>Identity Brute-force Shield:</span>
              <span className="vyb-cp-shield-value">{attemptsLabel}</span>
            </div>
          </motion.section>

          {/* Recovery Phrase */}
          <motion.section
            className="vyb-chat-privacy-card vyb-cp-inline"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, delay: 0.11 }}
          >
            <div className="vyb-cp-row-copy">
              <h3>Recovery Phrase</h3>
              <p>24-word master cryptographic fallback.</p>
            </div>
            {props.backupNeedsUpgrade ? (
              <button
                type="button"
                className="vyb-cp-btn-ghost"
                onClick={() => props.setActiveModal("change-pin")}
              >
                Upgrade
              </button>
            ) : (
              <button
                type="button"
                className="vyb-cp-btn-ghost"
                onClick={() => props.setActiveModal("verify-recovery")}
                disabled={!props.hasRemoteBackup}
              >
                Reveal
              </button>
            )}
          </motion.section>

          {/* Sync / Restore */}
          <motion.section
            id="chat-privacy-restore"
            className="vyb-chat-privacy-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, delay: 0.14 }}
          >
            <div className="vyb-cp-row-copy">
              <h3>Sync New Device</h3>
              <p>Securely restore your session on this browser.</p>
            </div>
            <label className="vyb-chat-privacy-field">
              <input
                value={props.restoreSecret}
                onChange={(e) => props.onRestoreSecretChange(e.target.value)}
                placeholder="PIN or 24-word phrase"
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className="vyb-cp-btn-indigo"
              onClick={props.onRestoreLocalKey}
              disabled={!props.hasRemoteBackup || props.busyAction === "restore-device"}
            >
              {props.busyAction === "restore-device" ? "Restoring…" : "Request Identity Restore"}
            </button>
          </motion.section>

          {/* Session / identity refresh */}
          {(!props.hasViewerIdentity || props.hasCompatibleLocalChatKey) && (
            <motion.section
              className="vyb-chat-privacy-card vyb-cp-inline"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, delay: 0.17 }}
            >
              <div className="vyb-cp-row-copy">
                <h3>Secure Session</h3>
                <p>{props.localSessionLabel}</p>
              </div>
              <button
                type="button"
                className="vyb-cp-btn-ghost"
                onClick={props.onCreateIdentity}
                disabled={props.busyAction === "identity"}
              >
                {props.busyAction === "identity" ? "Preparing…" :
                  props.hasViewerIdentity ? "Refresh" : "Create"}
              </button>
            </motion.section>
          )}

        </main>

        {/* ── FOOTER ── */}
        <footer className="vyb-cp-footer">
          <div className="vyb-cp-footer-meta">
            <p>Zero-Knowledge Protection</p>
            <p>Verified for {props.viewerName}</p>
          </div>
          <div className="vyb-cp-footer-links">
            <Link href={props.backToHref} className="vyb-cp-footer-link">
              {props.backToLabel}
            </Link>
            <Link href="/dashboard" className="vyb-cp-footer-link">
              Profile
            </Link>
          </div>
        </footer>

      </div>

      {/* ── MODALS ── */}
      <AnimatePresence>

        {props.activeModal === "create-backup" && (
          <ModalFrame
            title="Set Security PIN"
            description="PIN protects backup and restore only. VYB generates your 24-word phrase after the first backup."
            onClose={() => props.setActiveModal(null)}
          >
            <div className="vyb-chat-privacy-modal-body">
              <label className="vyb-chat-privacy-field">
                <span>Create 6-digit PIN</span>
                <input type="password" value={props.createPin} onChange={(e) => props.onCreatePinChange(e.target.value)} placeholder="6-digit PIN" inputMode="numeric" maxLength={6} />
              </label>
              <label className="vyb-chat-privacy-field">
                <span>Confirm PIN</span>
                <input type="password" value={props.confirmCreatePin} onChange={(e) => props.onConfirmCreatePinChange(e.target.value)} placeholder="Confirm PIN" inputMode="numeric" maxLength={6} />
              </label>
              <div className="vyb-chat-privacy-modal-actions">
                <button type="button" className="vyb-chat-privacy-ghost" onClick={() => props.setActiveModal(null)}>Cancel</button>
                <button type="button" className="vyb-chat-privacy-primary" onClick={props.onCreateBackup} disabled={props.busyAction === "create-backup"}>
                  {props.busyAction === "create-backup" ? "Sealing…" : "Create backup"}
                </button>
              </div>
            </div>
          </ModalFrame>
        )}

        {props.activeModal === "change-pin" && (
          <ModalFrame
            title="Change Security PIN"
            description="Enter the current PIN once. VYB will reseal the backup with the new PIN."
            onClose={() => props.setActiveModal(null)}
          >
            <div className="vyb-chat-privacy-modal-body">
              <label className="vyb-chat-privacy-field">
                <span>Current PIN</span>
                <input type="password" value={props.currentPin} onChange={(e) => props.onCurrentPinChange(e.target.value)} placeholder="Current PIN" inputMode="numeric" maxLength={6} />
              </label>
              <label className="vyb-chat-privacy-field">
                <span>New PIN</span>
                <input type="password" value={props.newPin} onChange={(e) => props.onNewPinChange(e.target.value)} placeholder="New 6-digit PIN" inputMode="numeric" maxLength={6} />
              </label>
              <label className="vyb-chat-privacy-field">
                <span>Confirm new PIN</span>
                <input type="password" value={props.confirmNewPin} onChange={(e) => props.onConfirmNewPinChange(e.target.value)} placeholder="Confirm new PIN" inputMode="numeric" maxLength={6} />
              </label>
              <div className="vyb-chat-privacy-modal-actions">
                <button type="button" className="vyb-chat-privacy-ghost" onClick={() => props.setActiveModal(null)}>Cancel</button>
                <button type="button" className="vyb-chat-privacy-primary" onClick={props.onChangePin} disabled={props.busyAction === "change-pin"}>
                  {props.busyAction === "change-pin" ? "Updating…" : "Update PIN"}
                </button>
              </div>
            </div>
          </ModalFrame>
        )}

        {props.activeModal === "verify-recovery" && (
          <ModalFrame
            title="Verify PIN"
            description="Enter your 6-digit PIN to decrypt the master recovery phrase."
            onClose={() => props.setActiveModal(null)}
          >
            <div className="vyb-chat-privacy-modal-body">
              <label className="vyb-chat-privacy-field">
                <span>Current PIN</span>
                <input type="password" value={props.viewPhrasePin} onChange={(e) => props.onViewPhrasePinChange(e.target.value)} placeholder="Enter PIN" inputMode="numeric" maxLength={6} className="vyb-cp-pin-input" />
              </label>
              <div className="vyb-chat-privacy-note">
                <span className="vyb-chat-privacy-pulse vyb-chat-privacy-pulse-warning" />
                {attemptsLabel}
              </div>
              <div className="vyb-chat-privacy-modal-actions">
                <button type="button" className="vyb-chat-privacy-ghost" onClick={() => props.setActiveModal(null)}>Cancel</button>
                <button type="button" className="vyb-chat-privacy-primary" onClick={props.onViewRecoveryPhrase} disabled={props.busyAction === "view-phrase"}>
                  {props.busyAction === "view-phrase" ? "Verifying…" : "Verify"}
                </button>
              </div>
            </div>
          </ModalFrame>
        )}

        {props.revealedRecoveryPhrase && (
          <ModalFrame
            title="Recovery Phrase"
            description="Store these 24 words offline. Anyone with them can restore your identity."
            onClose={props.onHideRecoveryPhrase}
          >
            <div className="vyb-chat-privacy-modal-body">
              <div className="vyb-chat-privacy-phrase">{props.revealedRecoveryPhrase}</div>
              <div className="vyb-chat-privacy-modal-actions">
                <button type="button" className="vyb-chat-privacy-ghost" onClick={props.onHideRecoveryPhrase}>Hide</button>
                <button type="button" className="vyb-chat-privacy-primary" onClick={props.onCopyRecoveryPhrase}>Copy phrase</button>
              </div>
            </div>
          </ModalFrame>
        )}

      </AnimatePresence>
    </>
  );
}