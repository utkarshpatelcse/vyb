"use client";

import type { ChatDevicePairingSession, ChatServerPinAttemptState, ChatTrustedDeviceRecord } from "@vyb/contracts";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState, type ReactNode } from "react";

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
  pairingCodeInput: string;
  onPairingCodeInputChange: (value: string) => void;
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
  trustedDevices: ChatTrustedDeviceRecord[];
  devicePairing: ChatDevicePairingSession | null;
  devicePairingLink: string | null;
  incomingPairing: ChatDevicePairingSession | null;
  onCreateIdentity: () => void;
  onCreateBackup: () => void;
  onChangePin: () => void;
  onViewRecoveryPhrase: () => void;
  onRestoreLocalKey: () => void;
  onRefreshTrustedDevices: () => void;
  onRevokeTrustedDevice: (deviceId: string) => void;
  onStartDevicePairing: () => void;
  onApproveDevicePairing: () => void;
  onLoadDevicePairingCode: () => void;
  onLoadDevicePairingLink: (value: string) => void;
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

function formatDeviceLastSeen(value: string | null | undefined) {
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

function PairingQrCode({ value, showLinkActions = true }: { value: string; showLinkActions?: boolean }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 220,
      color: {
        dark: "#020617",
        light: "#ffffff"
      }
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="vyb-chat-privacy-pairing-qr-wrap">
      <div className="vyb-chat-privacy-pairing-qr" aria-label="Device pairing QR code">
        {qrDataUrl ? <img src={qrDataUrl} alt="Device pairing QR code" /> : <span>QR loading</span>}
      </div>
      {showLinkActions && (
        <div className="vyb-chat-privacy-pairing-actions">
          <a className="vyb-cp-btn-ghost" href={value}>
            Open link
          </a>
          <button type="button" className="vyb-cp-btn-ghost" onClick={() => void copyLink()}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}

function PairingQrScanner({ onScan }: { onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  function stopScanner() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  }

  useEffect(() => stopScanner, []);

  async function startScanner() {
    setScanError(null);
    const BarcodeDetectorCtor = (window as unknown as {
      BarcodeDetector?: new (options: { formats: string[] }) => {
        detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
      };
    }).BarcodeDetector;

    if (!BarcodeDetectorCtor) {
      setScanError("QR scanner is not supported in this browser. Enter the 6-digit code instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      streamRef.current = stream;
      setActive(true);

      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 0);

      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      timerRef.current = window.setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          return;
        }

        void detector.detect(video).then((codes) => {
          const value = codes.find((code) => code.rawValue)?.rawValue;
          if (value) {
            stopScanner();
            onScan(value);
          }
        }).catch(() => {
          setScanError("Could not read the QR. Try again or enter the 6-digit code.");
        });
      }, 550);
    } catch {
      stopScanner();
      setScanError("Camera permission is needed to scan. You can still enter the 6-digit code.");
    }
  }

  return (
    <div className="vyb-chat-privacy-scanner-panel">
      <div>
        <strong>Scan QR</strong>
        <span>Use this trusted device camera to approve the new device.</span>
      </div>
      {active ? (
        <>
          <video ref={videoRef} className="vyb-chat-privacy-scanner-video" muted playsInline />
          <button type="button" className="vyb-cp-btn-ghost" onClick={stopScanner}>
            Stop scanner
          </button>
        </>
      ) : (
        <button type="button" className="vyb-cp-btn-white" onClick={() => void startScanner()}>
          Scan QR
        </button>
      )}
      {scanError && <span className="vyb-chat-privacy-scanner-error">{scanError}</span>}
    </div>
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
      label: props.hasCompatibleLocalChatKey ? "This device is ready" : props.hasViewerIdentity ? "Restore needed" : "Setup needed",
      detail: props.hasCompatibleLocalChatKey
        ? "Your private chat key is already sealed locally on this device."
        : props.hasViewerIdentity
          ? "Your account already has chat identity data, but this device needs the local key restored."
          : "Create the secure session once on this device before backup or restore can work.",
      tone: props.hasCompatibleLocalChatKey ? "secured" : props.hasViewerIdentity ? "warning" : "risk",
      icon: "shield"
    },
    {
      title: "Backup",
      label: props.hasRemoteBackup ? "Cloud backup synced" : "Backup missing",
      detail: props.hasRemoteBackup
        ? `Encrypted backup last sealed ${props.lastBackupUpdatedLabel}.`
        : "Create a backup fallback after this device is trusted.",
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
          : "Viewing the phrase always requires PIN verification on this device.",
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
      detail: "This device does not have a usable chat identity yet. Create it once, then you can set a PIN or make a backup.",
      tone: "risk",
      primaryAction: { label: "Create secure session", kind: "create-identity" }
    };
  }

  if (!props.hasCompatibleLocalChatKey && props.hasRemoteBackup) {
    return {
      kicker: "Do this now",
      title: "Pair this device before opening chats",
      detail: "Use trusted-device pairing first. PIN or recovery phrase restore is available below only as a fallback.",
      tone: "warning",
      primaryAction: { label: "Go to restore", kind: "anchor-restore" },
      secondaryAction: { label: "Refresh secure session", kind: "create-identity" }
    };
  }

  if (!props.hasRemoteBackup) {
    return {
      kicker: "Step 2",
      title: "Create backup fallback",
      detail: "Trusted devices are the easy path. Add a backup PIN only for account recovery after every trusted device is lost.",
      tone: "warning",
      primaryAction: { label: "Create fallback", kind: "create-backup" }
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
      title: "Bring the local key back to this device",
      detail: "Your identity exists but this device still cannot decrypt. Start trusted-device pairing below.",
      tone: "warning",
      primaryAction: { label: "Go to restore", kind: "anchor-restore" }
    };
  }

  return {
    kicker: "All set",
    title: "Your secure chat setup is ready",
    detail: "This device already has a local key, a cloud backup, and a sealed recovery phrase flow. You can open chats now or manage the backup below.",
    tone: "secured",
    primaryAction: { label: "Change PIN", kind: "change-pin" },
    secondaryAction: { label: "View recovery phrase", kind: "verify-recovery" }
  };
}

export function ChatPrivacyUI(props: ChatPrivacyUIProps) {
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const lockoutActive = Boolean(props.activeLockoutCountdown);
  const attemptsLabel = props.attemptState
    ? props.attemptState.isLocked
      ? "Temporarily blocked by server"
      : `${Math.max(0, props.attemptState.remainingAttempts)} attempts remaining`
    : "Rate-limited on backend";

  const sessionStatus =
    props.secureSessionTone === "ready" ? "Active" :
    props.secureSessionTone === "restore" ? "Pair device" : "Setup";
  const sessionPulse =
    props.secureSessionTone === "ready" ? "secured" :
    props.secureSessionTone === "restore" ? "warning" : "risk";
  const isApprovingDevice = Boolean(props.incomingPairing);
  const pairingActionLabel = props.hasCompatibleLocalChatKey ? "Create pairing link" : "Start pairing";
  const activeTrustedDevices = props.trustedDevices.filter((device) => !device.revokedAt);
  const pairingCode = props.devicePairing?.pairingCode ?? null;
  const recoveryOnly = !props.hasCompatibleLocalChatKey && activeTrustedDevices.length === 0;
  const showRecoveryFallback = props.hasRemoteBackup && (fallbackOpen || recoveryOnly || props.busyAction === "restore-device");

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
            <strong>{props.hasCompatibleLocalChatKey ? "Encrypted" : recoveryOnly ? "Needs recovery" : props.hasViewerIdentity ? "Needs pairing" : "Not ready"}</strong>
          </div>
          <div className="vyb-chat-privacy-snapshot-card">
            <span>Cloud</span>
            <strong>{props.hasRemoteBackup ? "Synced" : "Missing"}</strong>
          </div>
          <div className="vyb-chat-privacy-snapshot-card">
            <span>Devices</span>
            <strong>{props.trustedDevices.length > 0 ? `${props.trustedDevices.length} trusted` : "Pending"}</strong>
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
              <span>Server-side rate limit. Clearing app data won&apos;t bypass this.</span>
            </div>
          </div>
        )}

        {/* ── MAIN SECTIONS ── */}
        <main className="vyb-chat-privacy-card-grid">

          {props.hasCompatibleLocalChatKey && (
            <>
              {/* Backup PIN */}
              <motion.section
                className="vyb-chat-privacy-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, delay: 0.08 }}
              >
                <div className="vyb-cp-row">
                  <div className="vyb-cp-row-copy">
                    <h3>Backup PIN</h3>
                    <p>Fallback for account recovery after every trusted device is lost.</p>
                  </div>
                  {!props.hasRemoteBackup ? (
                    <button
                      type="button"
                      className="vyb-cp-btn-white"
                      onClick={() => props.setActiveModal("create-backup")}
                      disabled={props.busyAction === "create-backup"}
                    >
                      {props.busyAction === "create-backup" ? "Sealing…" : "Create fallback"}
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
                  <span>Fallback brute-force shield:</span>
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
                  <p>24-word fallback for when trusted-device pairing is unavailable.</p>
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
            </>
          )}

          {/* Device recovery */}
          <motion.section
            id="chat-privacy-restore"
            className="vyb-chat-privacy-card vyb-chat-privacy-flow-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, delay: 0.14 }}
          >
            {isApprovingDevice && props.incomingPairing ? (
              <>
                <div className="vyb-chat-privacy-flow-head">
                  <span>Approve device</span>
                  <h3>{props.hasCompatibleLocalChatKey ? "Approve This Device" : "Open This Link On Old Device"}</h3>
                  <p>
                    {props.hasCompatibleLocalChatKey
                      ? "Tap approve here, then return to the new device."
                      : "This device cannot approve itself. Use a device where your chats already open."}
                  </p>
                </div>
                <div className="vyb-chat-privacy-request-panel">
                  <div>
                    <strong>{props.incomingPairing.requesterLabel}</strong>
                    <span>
                      {props.incomingPairing.requesterPlatform.toUpperCase()} · {props.incomingPairing.status}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="vyb-cp-btn-white"
                    onClick={props.onApproveDevicePairing}
                    disabled={!props.hasCompatibleLocalChatKey || props.incomingPairing.status !== "pending" || props.busyAction === "device-pairing-approve"}
                  >
                    {props.busyAction === "device-pairing-approve" ? "Approving…" : "Approve"}
                  </button>
                </div>
                {props.hasCompatibleLocalChatKey ? (
                  <div className="vyb-chat-privacy-help-panel">
                    <strong>What happens next?</strong>
                    <ol className="vyb-chat-privacy-step-list">
                      <li>Tap Approve on this trusted device.</li>
                      <li>Go back to the device you are pairing.</li>
                      <li>Your chats unlock there automatically.</li>
                    </ol>
                  </div>
                ) : (
                  <div className="vyb-chat-privacy-help-panel">
                    <strong>To unlock this device</strong>
                    <ol className="vyb-chat-privacy-step-list">
                      <li>Open this same link on your old trusted device.</li>
                      <li>Tap Approve there.</li>
                      <li>Come back here and open chats again.</li>
                    </ol>
                    <div className="vyb-chat-privacy-help-actions">
                      <Link className="vyb-cp-btn-ghost" href="/profile/settings/chat-privacy?intent=restore-device">
                        Unlock this device
                      </Link>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="vyb-chat-privacy-flow-head">
                  <span>{props.hasCompatibleLocalChatKey ? "Add device" : recoveryOnly ? "Recovery needed" : "New device"}</span>
                  <h3>{props.hasCompatibleLocalChatKey ? "Add Another Device" : recoveryOnly ? "Use Recovery Fallback" : "Pair This Device"}</h3>
                  <p>
                    {props.hasCompatibleLocalChatKey
                      ? "Create a one-time request for the device you want to add."
                      : recoveryOnly
                        ? "No trusted device is active for approval. Use the recovery you saved earlier."
                      : activeTrustedDevices.length > 0
                        ? "Use one of your trusted devices below to approve this device."
                        : "No trusted device is active yet. Use recovery fallback if you saved it."}
                  </p>
                </div>

                {!props.devicePairing ? (
                  recoveryOnly ? (
                    <div className="vyb-chat-privacy-help-panel vyb-chat-privacy-recovery-only">
                      <strong>No trusted device found</strong>
                      <ol className="vyb-chat-privacy-step-list">
                        <li>Enter the backup PIN you created earlier.</li>
                        <li>Or paste the 24-word recovery phrase you saved earlier.</li>
                        <li>If you never saved either one, old encrypted chats cannot be unlocked on this device.</li>
                      </ol>
                    </div>
                  ) : (
                    <>
                      <div className="vyb-chat-privacy-choice-grid">
                        <button
                          type="button"
                          className="vyb-chat-privacy-choice-card vyb-chat-privacy-choice-primary"
                          onClick={props.onStartDevicePairing}
                          disabled={!props.hasViewerIdentity || props.busyAction === "device-pairing-create"}
                        >
                          <strong>{props.busyAction === "device-pairing-create" ? "Preparing..." : pairingActionLabel}</strong>
                          <span>
                            {props.hasCompatibleLocalChatKey
                              ? "Use this when another device shows a code."
                              : "Shows a short code for your trusted device."}
                          </span>
                        </button>

                        {props.hasRemoteBackup ? (
                          <button
                            type="button"
                            className="vyb-chat-privacy-choice-card"
                            onClick={() => setFallbackOpen((current) => !current)}
                          >
                            <strong>No trusted device?</strong>
                            <span>Use recovery fallback only as the second option.</span>
                          </button>
                        ) : (
                          <div className="vyb-chat-privacy-choice-card vyb-chat-privacy-choice-muted">
                            <strong>No fallback yet</strong>
                            <span>After pairing, add a recovery fallback for emergencies.</span>
                          </div>
                        )}
                      </div>

                      {props.hasCompatibleLocalChatKey && (
                        <>
                          <PairingQrScanner onScan={props.onLoadDevicePairingLink} />
                          <div className="vyb-chat-privacy-code-panel">
                            <div>
                              <strong>Approve with code</strong>
                              <span>Enter the 6-digit code shown on the device you want to unlock.</span>
                            </div>
                            <label className="vyb-chat-privacy-code-input">
                              <input
                                value={props.pairingCodeInput}
                                onChange={(event) => props.onPairingCodeInputChange(event.target.value)}
                                placeholder="000000"
                                inputMode="numeric"
                                maxLength={6}
                              />
                            </label>
                            <button
                              type="button"
                              className="vyb-cp-btn-white"
                              onClick={props.onLoadDevicePairingCode}
                              disabled={props.pairingCodeInput.length !== 6 || props.busyAction === "device-pairing-code"}
                            >
                              {props.busyAction === "device-pairing-code" ? "Checking..." : "Find request"}
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )
                ) : props.devicePairingLink && !recoveryOnly ? (
                  <div className="vyb-chat-privacy-pairing-box">
                    <strong>Waiting for approval</strong>
                    <span>Open Chat Privacy on a trusted device and enter this code.</span>
                    {pairingCode ? (
                      <div className="vyb-chat-privacy-pairing-code" aria-label="Device pairing code">
                        {pairingCode}
                      </div>
                    ) : (
                      <span>Code is being prepared. Start pairing again if it does not appear.</span>
                    )}
                    <PairingQrCode value={props.devicePairingLink} showLinkActions={false} />
                    <div className="vyb-chat-privacy-help-panel">
                      <strong>Where do I approve?</strong>
                      {activeTrustedDevices.length > 0 ? (
                        <ol className="vyb-chat-privacy-step-list">
                          <li>Open Chat Privacy on: {activeTrustedDevices.map((device) => device.label).join(", ")}.</li>
                          <li>Type the 6-digit code there.</li>
                          <li>Tap Approve there. This device will unlock by itself.</li>
                        </ol>
                      ) : (
                        <ol className="vyb-chat-privacy-step-list">
                          <li>No trusted device is registered for this account.</li>
                          <li>Use recovery fallback if you saved a PIN or recovery phrase.</li>
                          <li>If you never saved recovery, old encrypted chats cannot be unlocked.</li>
                        </ol>
                      )}
                    </div>
                    {props.hasRemoteBackup && (
                      <button
                        type="button"
                        className="vyb-cp-btn-ghost"
                        onClick={() => setFallbackOpen((current) => !current)}
                      >
                        Use recovery fallback
                      </button>
                    )}
                  </div>
                ) : null}

                {showRecoveryFallback && (
                  <div className="vyb-chat-privacy-pairing-box">
                    <strong>Recovery fallback</strong>
                    <span>Use the backup PIN or 24-word recovery phrase you saved earlier.</span>
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
                      className="vyb-cp-btn-ghost"
                      onClick={props.onRestoreLocalKey}
                      disabled={props.busyAction === "restore-device"}
                    >
                      {props.busyAction === "restore-device" ? "Restoring..." : "Restore"}
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.section>

          {/* Trusted devices */}
          <motion.section
            className="vyb-chat-privacy-card vyb-chat-privacy-device-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, delay: 0.16 }}
          >
            <div className="vyb-cp-row">
              <div className="vyb-cp-row-copy">
                <h3>Trusted Devices</h3>
                <p>
                  {props.hasCompatibleLocalChatKey
                    ? "Devices allowed to hold this account's chat identity."
                    : "After this device is unlocked, it will appear here."}
                </p>
              </div>
              <button type="button" className="vyb-cp-btn-ghost" onClick={props.onRefreshTrustedDevices}>
                Refresh
              </button>
            </div>
            <div className="vyb-chat-privacy-device-list">
              {props.trustedDevices.length === 0 ? (
                <div className="vyb-chat-privacy-device-empty">
                  <span>No trusted device yet.</span>
                  <small>Unlock this device first. Then it will show here.</small>
                </div>
              ) : (
                props.trustedDevices.map((device) => (
                  <div key={device.id} className="vyb-chat-privacy-device-row">
                    <div>
                      <strong>{device.label}</strong>
                      <span>
                        {device.platform.toUpperCase()} · Last active {formatDeviceLastSeen(device.lastSeenAt)}
                      </span>
                    </div>
                    <div className="vyb-chat-privacy-device-actions">
                      {device.isCurrentDevice && <span className="vyb-chat-privacy-device-current">This device</span>}
                      <button
                        type="button"
                        className="vyb-cp-btn-ghost"
                        onClick={() => props.onRevokeTrustedDevice(device.id)}
                        disabled={device.isCurrentDevice || props.busyAction === `revoke-device:${device.id}`}
                      >
                        {device.isCurrentDevice ? "Active" : props.busyAction === `revoke-device:${device.id}` ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
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
            title="Create Backup Fallback"
            description="Use this only if every trusted device is unavailable. VYB generates your 24-word phrase after the first backup."
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
            title="Change Backup PIN"
            description="Enter the current PIN once. VYB will reseal the fallback backup with the new PIN."
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
