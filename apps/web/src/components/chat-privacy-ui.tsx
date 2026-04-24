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
  const statusCards = buildStatusCards(props);
  const guidance = buildGuidanceCard(props);
  const lockoutActive = Boolean(props.activeLockoutCountdown);
  const showRefreshAction = !props.hasViewerIdentity || props.hasCompatibleLocalChatKey;
  const showRestoreAction = props.hasViewerIdentity && !props.hasCompatibleLocalChatKey && props.hasRemoteBackup;
  const attemptsLabel = props.attemptState
    ? props.attemptState.isLocked
      ? "PIN attempts are temporarily blocked on the server."
      : `${Math.max(0, props.attemptState.remainingAttempts)} server-tracked attempts left before lockout.`
    : "PIN checks are rate-limited on the backend.";
  const renderGuidanceAction = (action: GuidanceAction, variant: "primary" | "ghost" = "primary") => {
    const className = variant === "primary" ? "vyb-chat-privacy-primary" : "vyb-chat-privacy-ghost";

    if (action.kind === "anchor-restore") {
      return (
        <a href="#chat-privacy-restore" className={className}>
          {action.label}
        </a>
      );
    }

    const disabled =
      (action.kind === "create-identity" && props.busyAction === "identity") ||
      (action.kind === "create-backup" && props.busyAction === "create-backup") ||
      (action.kind === "change-pin" && props.busyAction === "change-pin") ||
      (action.kind === "verify-recovery" && props.busyAction === "view-phrase");

    const onClick =
      action.kind === "create-identity"
        ? props.onCreateIdentity
        : action.kind === "create-backup"
          ? () => props.setActiveModal("create-backup")
          : action.kind === "change-pin"
            ? () => props.setActiveModal("change-pin")
            : () => props.setActiveModal("verify-recovery");

    return (
      <button type="button" className={className} onClick={onClick} disabled={disabled}>
        {action.label}
      </button>
    );
  };

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

        <div className="vyb-chat-privacy-actions">
          <Link href={props.backToHref} className="vyb-chat-privacy-ghost">
            {props.backToLabel}
          </Link>
          <Link href="/dashboard" className="vyb-chat-privacy-ghost">
            Back to profile
          </Link>
          {showRefreshAction ? (
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
          ) : null}
          {showRestoreAction ? (
            <a href="#chat-privacy-restore" className="vyb-chat-privacy-primary">
              Restore this browser
            </a>
          ) : null}
        </div>

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

        <motion.section
          className={`vyb-chat-privacy-next-step vyb-chat-privacy-next-step-${guidance.tone}`}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.08 }}
        >
          <div className="vyb-chat-privacy-next-step-copy">
            <span className="vyb-chat-privacy-kicker">{guidance.kicker}</span>
            <strong>{guidance.title}</strong>
            <p>{guidance.detail}</p>
          </div>
          <div className="vyb-chat-privacy-inline-actions">
            {renderGuidanceAction(guidance.primaryAction)}
            {guidance.secondaryAction ? renderGuidanceAction(guidance.secondaryAction, "ghost") : null}
          </div>
        </motion.section>

        <section className="vyb-chat-privacy-content vyb-chat-privacy-content-full">
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
                  <span className="vyb-chat-privacy-card-kicker">Security PIN</span>
                  <strong>{props.hasRemoteBackup ? "PIN protects restore" : "Set your first PIN"}</strong>
                </div>
                <ShieldIcon />
              </div>
              <p>
                Your PIN is not used to start every chat. It is only used to seal backup, restore on another browser, and reveal the recovery phrase.
              </p>
              <div className="vyb-chat-privacy-note">
                <span className="vyb-chat-privacy-pulse vyb-chat-privacy-pulse-secured" />
                {props.hasRemoteBackup
                  ? "Current backup already exists. You can rotate the PIN any time."
                  : "The 24-word recovery phrase appears right after the first backup is created."}
              </div>
              <div className="vyb-chat-privacy-inline-actions">
                {!props.hasRemoteBackup ? (
                  <button type="button" className="vyb-chat-privacy-primary" onClick={() => props.setActiveModal("create-backup")}>
                    Set first PIN
                  </button>
                ) : (
                  <>
                    <button type="button" className="vyb-chat-privacy-primary" onClick={() => props.setActiveModal("change-pin")}>
                      Change PIN
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
              transition={{ duration: 0.28, delay: 0.12 }}
            >
              <div className="vyb-chat-privacy-card-head">
                <div>
                  <span className="vyb-chat-privacy-card-kicker">Recovery phrase</span>
                  <strong>{props.hasRemoteBackup ? (props.backupNeedsUpgrade ? "Upgrade before reveal" : "Your 24-word fallback") : "Available after first backup"}</strong>
                </div>
                <KeyIcon />
              </div>
              <p>
                {props.hasRemoteBackup
                  ? props.backupNeedsUpgrade
                    ? "This account uses the older backup envelope. Change the PIN once, then the phrase can be revealed safely again."
                    : "This is your master recovery phrase. Keep it offline. Anyone with these 24 words can restore your encrypted identity."
                  : "Create your first encrypted backup and VYB will generate the private 24-word recovery phrase for you."}
              </p>
              <div className="vyb-chat-privacy-note">
                <span className={`vyb-chat-privacy-pulse vyb-chat-privacy-pulse-${props.backupNeedsUpgrade ? "warning" : props.hasRemoteBackup ? "secured" : "risk"}`} />
                {props.hasRemoteBackup ? attemptsLabel : "No phrase is shown until the first backup exists."}
              </div>
              <div className="vyb-chat-privacy-inline-actions">
                {props.backupNeedsUpgrade ? (
                  <button type="button" className="vyb-chat-privacy-primary" onClick={() => props.setActiveModal("change-pin")}>
                    Upgrade backup now
                  </button>
                ) : (
                  <button
                    type="button"
                    className="vyb-chat-privacy-ghost"
                    onClick={() => props.setActiveModal("verify-recovery")}
                    disabled={!props.hasRemoteBackup}
                  >
                    View recovery phrase
                  </button>
                )}
              </div>
            </motion.section>

            <motion.section
              id="chat-privacy-restore"
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
                <CloudIcon />
              </div>
              <p>
                If chat was working earlier on this account but this browser lost the local key, restore it here using the same 6-digit PIN or the full 24-word phrase.
              </p>
              <label className="vyb-chat-privacy-field">
                <span>PIN or 24-word phrase</span>
                <input
                  value={props.restoreSecret}
                  onChange={(event) => props.onRestoreSecretChange(event.target.value)}
                  placeholder="Enter 6-digit PIN or paste the 24-word phrase"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </label>
              <div className="vyb-chat-privacy-note">
                <span className={`vyb-chat-privacy-pulse vyb-chat-privacy-pulse-${props.hasCompatibleLocalChatKey ? "secured" : "warning"}`} />
                {props.hasCompatibleLocalChatKey
                  ? "This browser already has a usable local key, but you can still restore if needed."
                  : "Without restore, this browser cannot decrypt secure chats yet."}
              </div>
              <div className="vyb-chat-privacy-inline-actions">
                <button
                  type="button"
                  className="vyb-chat-privacy-primary"
                  onClick={props.onRestoreLocalKey}
                  disabled={!props.hasRemoteBackup || props.busyAction === "restore-device"}
                >
                  {props.busyAction === "restore-device" ? "Restoring..." : "Restore this browser"}
                </button>
              </div>
            </motion.section>

            <motion.section
              className="vyb-chat-privacy-card"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.2 }}
            >
              <div className="vyb-chat-privacy-card-head">
                <div>
                  <span className="vyb-chat-privacy-card-kicker">Session notes</span>
                  <strong>How this works on your account</strong>
                </div>
                <SessionToneBadge tone={props.secureSessionTone} />
              </div>
              <p>
                Account: @{props.viewerUsername} at {props.collegeName}. Logout still uses secure wipe for the local vault, so shared devices should always sign out after chat use.
              </p>
              <div className="vyb-chat-privacy-note">
                <span className={`vyb-chat-privacy-pulse vyb-chat-privacy-pulse-${lockoutActive ? "warning" : "secured"}`} />
                {lockoutActive ? `PIN locked for ${props.activeLockoutCountdown}.` : attemptsLabel}
              </div>
            </motion.section>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {props.activeModal === "create-backup" ? (
          <ModalFrame
            title="Set your first security PIN"
            description="This PIN protects backup and restore only. VYB will seal the cloud backup and generate your 24-word recovery phrase."
            onClose={() => props.setActiveModal(null)}
          >
            <div className="vyb-chat-privacy-modal-body">
              <label className="vyb-chat-privacy-field">
                <span>Create 6-digit PIN</span>
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
            title="Change security PIN"
            description="Enter the current PIN once. VYB will decrypt the backup locally and reseal it with the new PIN."
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
            description="The recovery phrase stays hidden until you verify the current PIN on this browser."
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
