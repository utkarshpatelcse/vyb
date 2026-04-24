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

type ChatPrivacyUIProps = {
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
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

function ArrowLeftIcon() {
  return (
    <IconBase>
      <path d="M19 12H5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m12 19-7-7 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
            <ArrowLeftIcon />
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
      label: props.hasCompatibleLocalChatKey ? "Local identity secured" : props.hasViewerIdentity ? "Needs restore" : "Identity not ready",
      detail: props.hasCompatibleLocalChatKey
        ? "This browser holds a non-extractable CryptoKey sealed inside IndexedDB."
        : props.hasViewerIdentity
          ? "Your campus identity exists, but this browser needs a local restore before chat can decrypt again."
          : "Create the secure session once on this device before backing anything up.",
      tone: props.hasCompatibleLocalChatKey ? "secured" : props.hasViewerIdentity ? "warning" : "risk",
      icon: "shield"
    },
    {
      title: "Backup",
      label: props.hasRemoteBackup ? "Cloud backup synced" : "Backup missing",
      detail: props.hasRemoteBackup
        ? `Encrypted backup last sealed ${props.lastBackupUpdatedLabel}.`
        : "Set a 6-digit PIN once to protect device changes, sign-out, or storage wipes.",
      tone: props.hasRemoteBackup ? "secured" : "warning",
      icon: "cloud"
    },
    {
      title: "Recovery",
      label: !props.hasRemoteBackup ? "Phrase unavailable" : props.backupNeedsUpgrade ? "Upgrade required" : "Recovery phrase sealed",
      detail: !props.hasRemoteBackup
        ? "A 24-word phrase appears only after you create the first encrypted backup."
        : props.backupNeedsUpgrade
          ? "This account uses an older backup format. Rotate your PIN once to seal the phrase envelope."
          : "Viewing the phrase requires PIN re-verification on this device every time.",
      tone: !props.hasRemoteBackup ? "risk" : props.backupNeedsUpgrade ? "warning" : "secured",
      icon: "key"
    }
  ];
}

export function ChatPrivacyUI(props: ChatPrivacyUIProps) {
  const statusCards = buildStatusCards(props);
  const lockoutActive = Boolean(props.activeLockoutCountdown);
  const attemptsLabel = props.attemptState
    ? props.attemptState.isLocked
      ? "PIN attempts are temporarily blocked on the server."
      : `${Math.max(0, props.attemptState.remainingAttempts)} server-tracked attempts left before lockout.`
    : "PIN checks are rate-limited on the backend.";

  return (
    <>
      <div className="vyb-chat-privacy-shell">
        <motion.header
          className="vyb-chat-privacy-hero"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          <div className="vyb-chat-privacy-hero-copy">
            <span className="vyb-chat-privacy-kicker">Profile settings / Chat privacy</span>
            <h1>Privacy & Chat Identity</h1>
            <p>
              High-trust E2EE controls for {props.viewerName}. Manage PIN backup, recovery phrase access, and device restore without entering any chat thread.
            </p>
          </div>
          <div className="vyb-chat-privacy-hero-status">
            <SessionToneBadge tone={props.secureSessionTone} />
            <strong>Secure Session</strong>
            <span>{props.localSessionLabel}</span>
            <small>{props.cloudBackupLabel}</small>
          </div>
        </motion.header>

        {props.pageError ? (
          <div className="vyb-chat-privacy-banner vyb-chat-privacy-banner-error" role="alert">
            <LockIcon />
            <div>
              <strong>Attention needed</strong>
              <span>{props.pageError}</span>
            </div>
          </div>
        ) : null}

        {props.pageSuccess ? (
          <div className="vyb-chat-privacy-banner vyb-chat-privacy-banner-success" role="status">
            <SparkIcon />
            <div>
              <strong>Security updated</strong>
              <span>{props.pageSuccess}</span>
            </div>
          </div>
        ) : null}

        {lockoutActive ? (
          <div className="vyb-chat-privacy-banner vyb-chat-privacy-banner-warning" role="alert">
            <LockIcon />
            <div>
              <strong>PIN locked for {props.activeLockoutCountdown}</strong>
              <span>Wrong PIN attempts are rate-limited server-side, so clearing local browser state will not bypass this window.</span>
            </div>
          </div>
        ) : null}

        {props.backupNeedsUpgrade ? (
          <motion.section
            className="vyb-chat-privacy-upgrade"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.08 }}
          >
            <div>
              <span className="vyb-chat-privacy-kicker">Upgrade required</span>
              <strong>Seal the new recovery phrase envelope</strong>
              <p>
                Your backup is from the older format. Rotate the PIN once and VYB will reseal the recovery phrase so it can be viewed safely after PIN verification.
              </p>
            </div>
            <button
              type="button"
              className="vyb-chat-privacy-primary"
              onClick={() => props.setActiveModal("change-pin")}
              disabled={props.busyAction === "change-pin"}
            >
              Upgrade backup now
            </button>
          </motion.section>
        ) : null}

        <div className="vyb-chat-privacy-layout">
          <aside className="vyb-chat-privacy-sidebar">
            <div className="vyb-chat-privacy-sidebar-card">
              <span className="vyb-chat-privacy-sidebar-label">Profile settings</span>
              <div className="vyb-chat-privacy-sidebar-items">
                <Link href="/dashboard" className="vyb-chat-privacy-sidebar-link">
                  <ArrowLeftIcon />
                  Back to profile
                </Link>
                <button type="button" className="vyb-chat-privacy-sidebar-link is-active">
                  <ShieldIcon />
                  Chat privacy
                </button>
              </div>
            </div>

            <div className="vyb-chat-privacy-sidebar-card">
              <span className="vyb-chat-privacy-sidebar-label">Session notes</span>
              <p className="vyb-chat-privacy-sidebar-copy">
                Logout uses a secure wipe flow for the local vault. Shared devices should always sign out after chat use.
              </p>
              <div className="vyb-chat-privacy-sidebar-meta">
                <strong>@{props.viewerUsername}</strong>
                <span>{props.collegeName}</span>
              </div>
            </div>

            <div className="vyb-chat-privacy-sidebar-card">
              <span className="vyb-chat-privacy-sidebar-label">PIN guardrail</span>
              <p className="vyb-chat-privacy-sidebar-copy">{attemptsLabel}</p>
            </div>
          </aside>

          <section className="vyb-chat-privacy-content">
            <div className="vyb-chat-privacy-actions">
              <Link href="/messages" className="vyb-chat-privacy-ghost">
                Back to chats
              </Link>
              <button
                type="button"
                className="vyb-chat-privacy-primary"
                onClick={props.onCreateIdentity}
                disabled={props.busyAction === "identity"}
              >
                {props.busyAction === "identity"
                  ? "Preparing secure session..."
                  : props.hasViewerIdentity
                    ? "Refresh secure session"
                    : "Create secure session"}
              </button>
            </div>

            <div className="vyb-chat-privacy-status-grid">
              {statusCards.map((card, index) => (
                <StatusCardView key={card.title} card={card} index={index} />
              ))}
            </div>

            <div className="vyb-chat-privacy-card-grid">
              <motion.section
                className="vyb-chat-privacy-card"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.08 }}
              >
                <div className="vyb-chat-privacy-card-head">
                  <div>
                    <span className="vyb-chat-privacy-card-kicker">Local identity</span>
                    <strong>Secure session health</strong>
                  </div>
                  <SessionToneBadge tone={props.secureSessionTone} />
                </div>
                <p>
                  {props.hasCompatibleLocalChatKey
                    ? "This browser can decrypt campus chats locally. The vault stays inside IndexedDB and no raw private key is shown in the UI."
                    : "This browser is missing a usable local key. Restore it from your encrypted backup before returning to secure chat."}
                </p>
                <div className="vyb-chat-privacy-note">
                  <span className="vyb-chat-privacy-pulse vyb-chat-privacy-pulse-secured" />
                  Auto-wipe on logout stays enabled for shared devices.
                </div>
              </motion.section>

              <motion.section
                className="vyb-chat-privacy-card"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.12 }}
              >
                <div className="vyb-chat-privacy-card-head">
                  <div>
                    <span className="vyb-chat-privacy-card-kicker">PIN management</span>
                    <strong>{props.hasRemoteBackup ? "Backup controls" : "Create your first backup"}</strong>
                  </div>
                  <ShieldIcon />
                </div>
                <p>
                  {props.hasRemoteBackup
                    ? "Rotate the PIN, reveal the sealed recovery phrase, or keep the cloud backup current when you switch devices."
                    : "Create a 6-digit PIN to seal your first cloud backup and generate a private 24-word recovery phrase."}
                </p>
                <div className="vyb-chat-privacy-inline-actions">
                  {!props.hasRemoteBackup ? (
                    <button type="button" className="vyb-chat-privacy-primary" onClick={() => props.setActiveModal("create-backup")}>
                      Create encrypted backup
                    </button>
                  ) : (
                    <>
                      <button type="button" className="vyb-chat-privacy-primary" onClick={() => props.setActiveModal("change-pin")}>
                        Update PIN
                      </button>
                      <button type="button" className="vyb-chat-privacy-ghost" onClick={() => props.setActiveModal("verify-recovery")}>
                        View recovery phrase
                      </button>
                    </>
                  )}
                </div>
              </motion.section>

              <motion.section
                className="vyb-chat-privacy-card"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.16 }}
              >
                <div className="vyb-chat-privacy-card-head">
                  <div>
                    <span className="vyb-chat-privacy-card-kicker">Device restore</span>
                    <strong>Recover this browser</strong>
                  </div>
                  <KeyIcon />
                </div>
                <p>
                  Use your 6-digit PIN or full 24-word phrase to restore the encrypted identity onto this browser after sign-out, browser reset, or device change.
                </p>
                <label className="vyb-chat-privacy-field">
                  <span>PIN or 24-word phrase</span>
                  <input
                    value={props.restoreSecret}
                    onChange={(event) => props.onRestoreSecretChange(event.target.value)}
                    placeholder="Enter PIN or full phrase"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </label>
                <div className="vyb-chat-privacy-inline-actions">
                  <button
                    type="button"
                    className="vyb-chat-privacy-primary"
                    onClick={props.onRestoreLocalKey}
                    disabled={!props.hasRemoteBackup || props.busyAction === "restore-device"}
                  >
                    {props.busyAction === "restore-device" ? "Restoring..." : "Restore this device"}
                  </button>
                </div>
              </motion.section>
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {props.activeModal === "create-backup" ? (
          <ModalFrame
            title="Create encrypted backup"
            description="Set a 6-digit PIN. VYB will seal your encrypted cloud backup and generate a 24-word recovery phrase."
            onClose={() => props.setActiveModal(null)}
          >
            <div className="vyb-chat-privacy-modal-body">
              <label className="vyb-chat-privacy-field">
                <span>Create security PIN</span>
                <input
                  type="password"
                  value={props.createPin}
                  onChange={(event) => props.onCreatePinChange(event.target.value)}
                  placeholder="6-digit PIN"
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
              <label className="vyb-chat-privacy-field">
                <span>Confirm security PIN</span>
                <input
                  type="password"
                  value={props.confirmCreatePin}
                  onChange={(event) => props.onConfirmCreatePinChange(event.target.value)}
                  placeholder="Confirm PIN"
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
              <div className="vyb-chat-privacy-modal-actions">
                <button type="button" className="vyb-chat-privacy-ghost" onClick={() => props.setActiveModal(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="vyb-chat-privacy-primary"
                  onClick={props.onCreateBackup}
                  disabled={props.busyAction === "create-backup"}
                >
                  {props.busyAction === "create-backup" ? "Sealing backup..." : "Create backup"}
                </button>
              </div>
            </div>
          </ModalFrame>
        ) : null}

        {props.activeModal === "change-pin" ? (
          <ModalFrame
            title="Update security PIN"
            description="Your current PIN must decrypt the backup before a new one is sealed."
            onClose={() => props.setActiveModal(null)}
          >
            <div className="vyb-chat-privacy-modal-body">
              <label className="vyb-chat-privacy-field">
                <span>Current PIN</span>
                <input
                  type="password"
                  value={props.currentPin}
                  onChange={(event) => props.onCurrentPinChange(event.target.value)}
                  placeholder="Current PIN"
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
              <label className="vyb-chat-privacy-field">
                <span>New PIN</span>
                <input
                  type="password"
                  value={props.newPin}
                  onChange={(event) => props.onNewPinChange(event.target.value)}
                  placeholder="New 6-digit PIN"
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
              <label className="vyb-chat-privacy-field">
                <span>Confirm new PIN</span>
                <input
                  type="password"
                  value={props.confirmNewPin}
                  onChange={(event) => props.onConfirmNewPinChange(event.target.value)}
                  placeholder="Confirm new PIN"
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
              <div className="vyb-chat-privacy-modal-actions">
                <button type="button" className="vyb-chat-privacy-ghost" onClick={() => props.setActiveModal(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="vyb-chat-privacy-primary"
                  onClick={props.onChangePin}
                  disabled={props.busyAction === "change-pin"}
                >
                  {props.busyAction === "change-pin" ? "Updating..." : "Update PIN"}
                </button>
              </div>
            </div>
          </ModalFrame>
        ) : null}

        {props.activeModal === "verify-recovery" ? (
          <ModalFrame
            title="Verify PIN to reveal phrase"
            description="This phrase stays hidden until you re-verify your current PIN on this device."
            onClose={() => props.setActiveModal(null)}
          >
            <div className="vyb-chat-privacy-modal-body">
              <label className="vyb-chat-privacy-field">
                <span>Current PIN</span>
                <input
                  type="password"
                  value={props.viewPhrasePin}
                  onChange={(event) => props.onViewPhrasePinChange(event.target.value)}
                  placeholder="Enter current PIN"
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
              <div className="vyb-chat-privacy-note">
                <span className="vyb-chat-privacy-pulse vyb-chat-privacy-pulse-warning" />
                {attemptsLabel}
              </div>
              <div className="vyb-chat-privacy-modal-actions">
                <button type="button" className="vyb-chat-privacy-ghost" onClick={() => props.setActiveModal(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="vyb-chat-privacy-primary"
                  onClick={props.onViewRecoveryPhrase}
                  disabled={props.busyAction === "view-phrase"}
                >
                  {props.busyAction === "view-phrase" ? "Verifying..." : "Reveal phrase"}
                </button>
              </div>
            </div>
          </ModalFrame>
        ) : null}

        {props.revealedRecoveryPhrase ? (
          <ModalFrame
            title="Recovery phrase"
            description="Store these 24 words offline. Anyone holding them can restore your encrypted chat identity."
            onClose={props.onHideRecoveryPhrase}
          >
            <div className="vyb-chat-privacy-modal-body">
              <div className="vyb-chat-privacy-phrase">{props.revealedRecoveryPhrase}</div>
              <div className="vyb-chat-privacy-modal-actions">
                <button type="button" className="vyb-chat-privacy-ghost" onClick={props.onHideRecoveryPhrase}>
                  Hide
                </button>
                <button type="button" className="vyb-chat-privacy-primary" onClick={props.onCopyRecoveryPhrase}>
                  Copy phrase
                </button>
              </div>
            </div>
          </ModalFrame>
        ) : null}
      </AnimatePresence>
    </>
  );
}
