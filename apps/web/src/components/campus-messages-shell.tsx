"use client";

import type {
  ChatConversationPreview,
  ChatConversationResponse,
  ChatIdentitySummary,
  ChatKeyBackupRecord,
  ChatMessageRecord,
  DeleteChatMessageScope,
  UserSearchItem
} from "@vyb/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CHAT_IDENTITY_ALGORITHM,
  createStoredChatKeyMaterial,
  decryptStoredChatKeyMaterialFromBackup,
  decryptChatText,
  encryptChatText,
  encryptStoredChatKeyMaterialForBackup,
  formatRecoveryCode,
  generateRecoveryCode,
  hasChatCipherEnvelope,
  isE2eeCipherAlgorithm,
  isStoredChatKeyCompatible,
  loadStoredChatKeyMaterial,
  loadStoredRecoveryCode,
  saveStoredChatKeyMaterial,
  saveStoredRecoveryCode,
  syncStoredChatKeyIdentity,
  type StoredChatKeyMaterial
} from "../lib/chat-e2ee";
import { buildPrimaryCampusNav, CampusDesktopNavigation, CampusMobileNavigation } from "./campus-navigation";

type ActiveConversation = ChatConversationResponse["conversation"];
type RealtimeState = "idle" | "offline" | "connecting" | "reconnecting" | "live";
type MessageActionAnchor = {
  top: number;
  left: number;
  width: number;
};
const DISMISSED_DECRYPTION_WARNING_STORAGE_PREFIX = "vyb-chat-dismissed-decryption-warning";
const CHAT_REACTION_OPTIONS = [
  "\u2764\uFE0F",
  "\uD83D\uDD25",
  "\uD83D\uDE02",
  "\uD83D\uDE0D",
  "\uD83D\uDC4D",
  "\uD83D\uDE2E",
  "\uD83D\uDE22",
  "\uD83D\uDC4F",
  "\uD83D\uDE2D",
  "\uD83D\uDE21",
  "\uD83C\uDF89",
  "\uD83D\uDE0E"
] as const;
const DELETE_FOR_EVERYONE_WINDOW_MS = 30 * 60 * 1000;
const CHAT_DELETED_MESSAGE_ALGORITHM = "deleted";

function getDismissedDecryptionWarningStorageKey(userId: string) {
  return `${DISMISSED_DECRYPTION_WARNING_STORAGE_PREFIX}:${userId}`;
}

function getMessageFallbackLabel(message: ChatMessageRecord) {
  if (message.cipherAlgorithm === CHAT_DELETED_MESSAGE_ALGORITHM) {
    return "This message has been deleted.";
  }

  switch (message.messageKind) {
    case "image":
      return "Shared a photo";
    case "vibe_card":
      return "Shared a vibe";
    case "deal_card":
      return "Shared a market deal";
    case "system":
      return "System update";
    default:
      return isE2eeCipherAlgorithm(message.cipherAlgorithm) ? "Encrypted message" : "Message";
  }
}

function isDeletedChatMessage(message: ChatMessageRecord) {
  return message.cipherAlgorithm === CHAT_DELETED_MESSAGE_ALGORITHM;
}

function getDeletedMessageLabel(isOwnMessage: boolean) {
  return isOwnMessage ? "Your message has been deleted." : "This message has been deleted.";
}

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d`;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function formatMessageDay(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { year: "numeric", month: "short", day: "numeric" };
  return date.toLocaleDateString("en-IN", options);
}

function formatMessageTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function getConversationPreviewLabel(
  item: ChatConversationPreview,
  plaintextByMessageId: Record<string, string>
): { text: string; isMarket: boolean } {
  if (!item.lastMessage) {
    return { text: "E2EE chat is ready", isMarket: false };
  }

  const lastMessage = item.lastMessage;
  const text = getMessageBody(lastMessage, plaintextByMessageId[lastMessage.id]);

  switch (item.lastMessage.messageKind) {
    case "image":
      return { text: text || "Photo", isMarket: false };
    case "vibe_card":
      return { text: text || "Shared a vibe", isMarket: false };
    case "deal_card":
      return { text: text || "Market deal", isMarket: true };
    case "system":
      return { text: text || "System update", isMarket: false };
    default:
      return { text, isMarket: false };
  }
}

function getMessageBody(
  message: ChatMessageRecord,
  plaintextOverride?: string | null,
  options?: { isOwnMessage?: boolean }
) {
  if (isDeletedChatMessage(message)) {
    return getDeletedMessageLabel(Boolean(options?.isOwnMessage));
  }

  if (plaintextOverride?.trim()) {
    return plaintextOverride;
  }

  if (!isE2eeCipherAlgorithm(message.cipherAlgorithm) && message.cipherText.trim()) {
    return message.cipherText;
  }

  return getMessageFallbackLabel(message);
}

function getReplyPreview(
  message: ChatMessageRecord | null | undefined,
  plaintextByMessageId: Record<string, string>
) {
  if (!message) return "Original message";
  const text = getMessageBody(message, plaintextByMessageId[message.id]).replace(/\s+/g, " ").trim();
  if (!text) return "Original message";
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

function getStatusRing(userId: string): "online" | "vibing" | "away" {
  const code = userId.charCodeAt(userId.length - 1);
  if (code % 3 === 0) return "online";
  if (code % 3 === 1) return "vibing";
  return "away";
}

function isOwnChatMessage(message: ChatMessageRecord, viewerUserId: string, viewerMembershipId: string) {
  return message.senderMembershipId === viewerMembershipId || message.senderUserId === viewerUserId;
}

function canDeleteChatMessageForEveryone(message: ChatMessageRecord, viewerMembershipId: string, nowTimestamp: number) {
  if (message.senderMembershipId !== viewerMembershipId || isDeletedChatMessage(message)) {
    return false;
  }

  return nowTimestamp - new Date(message.createdAt).getTime() <= DELETE_FOR_EVERYONE_WINDOW_MS;
}

function buildConversationPreview(conversation: ActiveConversation): ChatConversationPreview {
  const lastMessage = conversation.messages[conversation.messages.length - 1] ?? null;

  return {
    id: conversation.id,
    tenantId: conversation.tenantId,
    kind: conversation.kind,
    peer: conversation.peer,
    lastMessage,
    lastActivityAt: lastMessage?.createdAt ?? conversation.lastReadAt ?? new Date().toISOString(),
    unreadCount: 0
  };
}

function upsertConversationItem(
  items: ChatConversationPreview[],
  preview: ChatConversationPreview
) {
  const remaining = items.filter((item) => item.id !== preview.id);
  return [preview, ...remaining];
}

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconMessages() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconVibes() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function IconMarket() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconDoubleCheck() {
  return (
    <svg width="14" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 13 8 17 13 12" />
      <polyline points="11 13 15 17 22 9" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4Z" />
    </svg>
  );
}

function IconReply() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 17-5-5 5-5" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function useUserSearch(query: string) {
  const [results, setResults] = useState<UserSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search-users?q=${encodeURIComponent(trimmed)}`, {
          signal: abortController.signal
        });
        const data = await response.json().catch(() => ({ items: [] }));
        if (!cancelled) {
          setResults(data?.items ?? []);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 320);

    return () => {
      cancelled = true;
      abortController.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return { results, loading };
}

export function CampusMessagesShell({
  viewerUserId,
  viewerMembershipId,
  viewerName,
  viewerUsername,
  collegeName,
  initialItems,
  loadError,
  initialConversationId = null,
  initialConversation = null,
  activeConversationError = null,
  initialViewerIdentity = null
}: {
  viewerUserId: string;
  viewerMembershipId: string;
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  initialItems: ChatConversationPreview[];
  loadError?: string | null;
  initialConversationId?: string | null;
  initialConversation?: ActiveConversation | null;
  activeConversationError?: string | null;
  initialViewerIdentity?: ChatIdentitySummary | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversationPreview[]>(() =>
    initialConversation ? upsertConversationItem(initialItems, buildConversationPreview(initialConversation)) : initialItems
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId);
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(initialConversation);
  const [conversationLoading, setConversationLoading] = useState(Boolean(initialConversationId && !initialConversation && !activeConversationError));
  const [conversationError, setConversationError] = useState<string | null>(activeConversationError);
  const [draftMessage, setDraftMessage] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>(initialConversationId ? "connecting" : "idle");
  const [viewerIdentity, setViewerIdentity] = useState<ChatIdentitySummary | null>(initialViewerIdentity);
  const [localChatKey, setLocalChatKey] = useState<StoredChatKeyMaterial | null>(null);
  const [remoteKeyBackup, setRemoteKeyBackup] = useState<ChatKeyBackupRecord | null>(null);
  const [remoteKeyBackupLoaded, setRemoteKeyBackupLoaded] = useState(false);
  const [syncingKeyBackup, setSyncingKeyBackup] = useState(false);
  const [restoringKeyBackup, setRestoringKeyBackup] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [restoreRecoveryCode, setRestoreRecoveryCode] = useState("");
  const [recoveryCodeVisible, setRecoveryCodeVisible] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [keySetupError, setKeySetupError] = useState<string | null>(null);
  const [decryptionWarning, setDecryptionWarning] = useState<string | null>(null);
  const [messagePlaintextById, setMessagePlaintextById] = useState<Record<string, string>>({});
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
  const [selectedMessageActionId, setSelectedMessageActionId] = useState<string | null>(null);
  const [selectedMessageDeleteForEveryoneAllowed, setSelectedMessageDeleteForEveryoneAllowed] = useState(false);
  const [selectedMessageActionAnchor, setSelectedMessageActionAnchor] = useState<MessageActionAnchor | null>(null);
  const [messageActionBusy, setMessageActionBusy] = useState(false);
  const [messageActionError, setMessageActionError] = useState<string | null>(null);
  const [dismissedDecryptionWarningIds, setDismissedDecryptionWarningIds] = useState<Record<string, true>>({});
  const [creatingChatIdentity, setCreatingChatIdentity] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef(0);
  const isMountedRef = useRef(false);
  const composerFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ messageId: string; timestamp: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  const swipeGestureRef = useRef<{
    messageId: string;
    startX: number;
    startY: number;
    isOwnMessage: boolean;
  } | null>(null);
  const chatIdentityPromiseRef = useRef<Promise<boolean> | null>(null);
  const sessionProbePromiseRef = useRef<Promise<boolean | null> | null>(null);
  const keyBackupSyncIdentityRef = useRef<string | null>(null);
  const migratingMessageIdsRef = useRef<Set<string>>(new Set());
  const messageIdsRef = useRef<Set<string>>(new Set(initialConversation?.messages.map((message) => message.id) ?? []));
  const activeConversationRef = useRef<ActiveConversation | null>(initialConversation);
  const hasChatIdentity = Boolean(viewerIdentity);
  const [swipeReplyPreview, setSwipeReplyPreview] = useState<{ messageId: string; offsetX: number } | null>(null);

  const isSearching = query.trim().length > 0;
  const { results: searchResults, loading: searchLoading } = useUserSearch(query);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (composerFocusTimeoutRef.current) {
        clearTimeout(composerFocusTimeoutRef.current);
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      swipeGestureRef.current = null;
    };
  }, []);

  useEffect(() => {
    setConversations(
      initialConversation ? upsertConversationItem(initialItems, buildConversationPreview(initialConversation)) : initialItems
    );
  }, [initialConversation, initialItems]);

  useEffect(() => {
    setViewerIdentity(initialViewerIdentity);
  }, [initialViewerIdentity]);

  async function probeBrowserSession() {
    if (sessionProbePromiseRef.current) {
      return sessionProbePromiseRef.current;
    }

    const pending = (async () => {
      try {
        const response = await fetch("/api/dev-session", {
          cache: "no-store",
          credentials: "same-origin"
        });

        if (response.status === 401) {
          return false;
        }

        if (!response.ok) {
          return null;
        }

        const data = await response.json().catch(() => null);
        return data?.session?.userId === viewerUserId;
      } catch {
        return null;
      } finally {
        sessionProbePromiseRef.current = null;
      }
    })();

    sessionProbePromiseRef.current = pending;
    return pending;
  }

  async function syncSessionWarning(status: number) {
    if (!isMountedRef.current) {
      return;
    }

    if (status !== 401) {
      setSessionExpired(false);
      return;
    }

    const confirmedExpired = await probeBrowserSession();
    if (!isMountedRef.current || confirmedExpired === null) {
      return;
    }

    setSessionExpired(!confirmedExpired);
  }

  async function fetchChatEndpoint(input: string, init?: RequestInit) {
    const response = await fetch(input, {
      cache: "no-store",
      credentials: "same-origin",
      ...(init ?? {})
    });

    void syncSessionWarning(response.status);

    return response;
  }

  useEffect(() => {
    setRecoveryCode(loadStoredRecoveryCode(viewerUserId));
  }, [viewerUserId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(getDismissedDecryptionWarningStorageKey(viewerUserId));
      if (!raw) {
        setDismissedDecryptionWarningIds({});
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, true>;
      setDismissedDecryptionWarningIds(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setDismissedDecryptionWarningIds({});
    }
  }, [viewerUserId]);

  useEffect(() => {
    let cancelled = false;

    if (!viewerIdentity) {
      setRemoteKeyBackup(null);
      setRemoteKeyBackupLoaded(true);
      return;
    }

    setRemoteKeyBackupLoaded(false);

    void (async () => {
      try {
        const response = await fetchChatEndpoint("/api/chats/key-backup", { cache: "no-store" });
        const data = await response.json().catch(() => null);

        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          setRemoteKeyBackup(null);
          return;
        }

        setRemoteKeyBackup((data?.backup as ChatKeyBackupRecord | null | undefined) ?? null);
      } catch {
        if (!cancelled) {
          setRemoteKeyBackup(null);
        }
      } finally {
        if (!cancelled) {
          setRemoteKeyBackupLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [viewerIdentity]);

  useEffect(() => {
    const stored = loadStoredChatKeyMaterial(viewerUserId);
    if (!viewerIdentity) {
      setLocalChatKey(stored);
      setKeySetupError(null);
      return;
    }

    if (stored && isStoredChatKeyCompatible(stored, viewerIdentity)) {
      const synced = syncStoredChatKeyIdentity(viewerUserId, viewerIdentity) ?? stored;
      setLocalChatKey(synced);
      setKeySetupError(null);
      return;
    }

    setLocalChatKey(stored);
    if (!remoteKeyBackupLoaded) {
      setKeySetupError("Checking your encrypted key backup...");
      return;
    }

    if (remoteKeyBackup) {
      setKeySetupError("Enter your recovery code on this device to restore your E2EE key.");
      return;
    }

    setKeySetupError(
      "This account has E2EE chats, but no encrypted key backup is saved yet. Open the original device once to create the backup."
    );
  }, [remoteKeyBackup, remoteKeyBackupLoaded, viewerIdentity, viewerUserId]);

  async function loadConversationDetail(
    conversationId: string,
    options?: {
      silent?: boolean;
      preserveActiveConversation?: boolean;
    }
  ) {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const silent = options?.silent ?? false;
    const preserveActiveConversation = options?.preserveActiveConversation ?? silent;

    if (!silent) {
      setConversationLoading(true);
      setConversationError(null);
    }

    try {
      const response = await fetchChatEndpoint(`/api/chats/${encodeURIComponent(conversationId)}`);
      const data = await response.json().catch(() => null);

      if (requestRef.current !== requestId) {
        return;
      }

      if (!response.ok) {
        if (response.status === 401) {
          setConversationError("Your session expired on this browser. Sign in again to reopen this chat.");
          return;
        }

        if (!preserveActiveConversation || !activeConversationRef.current || activeConversationRef.current.id !== conversationId) {
          setActiveConversation(null);
          setConversationError(data?.error?.message ?? "We could not load that chat right now.");
        }
        return;
      }

      const conversation = data?.conversation as ActiveConversation | undefined;
      const responseViewerUserId =
        typeof data?.viewer?.userId === "string" ? (data.viewer.userId as string) : null;
      if (responseViewerUserId && responseViewerUserId !== viewerUserId) {
        setSessionExpired(true);
        setConversationError("This browser is now signed into another account. Open each account in a separate browser or private window.");
        return;
      }

      if (!conversation) {
        if (!preserveActiveConversation || !activeConversationRef.current || activeConversationRef.current.id !== conversationId) {
          setActiveConversation(null);
          setConversationError("This chat is not available right now.");
        }
        return;
      }

      setSessionExpired(false);
      setViewerIdentity((data?.viewer?.activeIdentity as ChatIdentitySummary | null | undefined) ?? null);
      setActiveConversation(conversation);
      setConversations((current) => upsertConversationItem(current, buildConversationPreview(conversation)));
    } catch {
      if (requestRef.current === requestId) {
        if (!preserveActiveConversation || !activeConversationRef.current || activeConversationRef.current.id !== conversationId) {
          setActiveConversation(null);
          setConversationError("Network issue while opening the chat.");
        }
      }
    } finally {
      if (!silent && requestRef.current === requestId) {
        setConversationLoading(false);
      }
    }
  }

  useEffect(() => {
    setActiveConversationId(initialConversationId);
    setDraftMessage("");
    setSendError(null);
    setRealtimeState(initialConversationId ? "connecting" : "idle");

    if (!initialConversationId) {
      setActiveConversation(null);
      setConversationLoading(false);
      setConversationError(null);
      return;
    }

    if (initialConversation) {
      setActiveConversation(initialConversation);
      setConversationLoading(false);
      setConversationError(activeConversationError);
      return;
    }

    if (activeConversationError) {
      setActiveConversation(null);
      setConversationLoading(false);
      setConversationError(activeConversationError);
      return;
    }

    void loadConversationDetail(initialConversationId, {
      silent: false,
      preserveActiveConversation: false
    });
  }, [activeConversationError, initialConversation, initialConversationId]);

  async function ensureChatIdentity() {
    if (viewerIdentity && localChatKey && isStoredChatKeyCompatible(localChatKey, viewerIdentity)) {
      setKeySetupError(null);
      return true;
    }

    if (viewerIdentity) {
      const stored = loadStoredChatKeyMaterial(viewerUserId);
      if (stored && isStoredChatKeyCompatible(stored, viewerIdentity)) {
        const synced = syncStoredChatKeyIdentity(viewerUserId, viewerIdentity) ?? stored;
        setLocalChatKey(synced);
        setKeySetupError(null);
        return true;
      }

      const message = remoteKeyBackup
        ? "Restore your E2EE key with the recovery code to continue on this device."
        : "This account has E2EE chats, but no encrypted key backup exists yet. Open the original device once to create the backup.";
      setLocalChatKey(stored);
      setKeySetupError(message);
      setSendError(message);
      return false;
    }

    if (chatIdentityPromiseRef.current) {
      return chatIdentityPromiseRef.current;
    }

    const pending = (async () => {
      setCreatingChatIdentity(true);
      setSendError(null);
      setKeySetupError(null);

      try {
        const stored =
          localChatKey ??
          loadStoredChatKeyMaterial(viewerUserId) ??
          (await createStoredChatKeyMaterial(viewerUserId));
        saveStoredChatKeyMaterial(stored);
        setLocalChatKey(stored);

        const response = await fetchChatEndpoint("/api/chats/keys", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            publicKey: stored.publicKey,
            algorithm: stored.algorithm || CHAT_IDENTITY_ALGORITHM,
            keyVersion: stored.keyVersion
          })
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          if (response.status === 401) {
            setSendError("This browser was signed out or switched to another account. Sign in again to continue secure chat.");
            return false;
          }

          setSendError(data?.error?.message ?? "We could not enable end-to-end encrypted chat.");
          return false;
        }

        const nextIdentity = (data?.identity as ChatIdentitySummary | undefined) ?? null;
        if (!nextIdentity) {
          setSendError("We could not finish setting up your E2EE identity.");
          return false;
        }

        const synced = syncStoredChatKeyIdentity(viewerUserId, nextIdentity) ?? {
          ...stored,
          identityId: nextIdentity.id,
          algorithm: nextIdentity.algorithm,
          keyVersion: nextIdentity.keyVersion,
          updatedAt: nextIdentity.updatedAt
        };
        saveStoredChatKeyMaterial(synced);
        setLocalChatKey(synced);
        setViewerIdentity(nextIdentity);
        return true;
      } catch (error) {
        setSendError(error instanceof Error ? error.message : "We could not enable end-to-end encrypted chat.");
        return false;
      } finally {
        setCreatingChatIdentity(false);
        chatIdentityPromiseRef.current = null;
      }
    })();

    chatIdentityPromiseRef.current = pending;
    return pending;
  }

  async function syncEncryptedKeyBackup(material: StoredChatKeyMaterial, nextRecoveryCode?: string | null) {
    const effectiveRecoveryCode = formatRecoveryCode(nextRecoveryCode ?? recoveryCode ?? "");
    if (!effectiveRecoveryCode || !viewerIdentity || !isStoredChatKeyCompatible(material, viewerIdentity)) {
      return;
    }

    keyBackupSyncIdentityRef.current = viewerIdentity.publicKey;
    setSyncingKeyBackup(true);

    try {
      const encryptedBackup = await encryptStoredChatKeyMaterialForBackup(material, effectiveRecoveryCode);
      const response = await fetchChatEndpoint("/api/chats/key-backup", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(encryptedBackup)
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("This browser was signed out or switched to another account. Sign in again before saving the encrypted key backup.");
        }

        throw new Error(data?.error?.message ?? "We could not save your encrypted key backup.");
      }

      setRemoteKeyBackup((data?.backup as ChatKeyBackupRecord | null | undefined) ?? encryptedBackup);
      setRemoteKeyBackupLoaded(true);
      setRecoveryCode(effectiveRecoveryCode);
      saveStoredRecoveryCode(viewerUserId, effectiveRecoveryCode);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "We could not save your encrypted key backup.");
    } finally {
      setSyncingKeyBackup(false);
    }
  }

  async function handleRestoreEncryptedKeyBackup() {
    if (!remoteKeyBackup) {
      setSendError("No encrypted key backup is available for this account yet.");
      return;
    }

    if (!viewerIdentity) {
      setSendError("Open your chat identity first before restoring the E2EE key.");
      return;
    }

    setRestoringKeyBackup(true);
    setSendError(null);

    try {
      const restored = await decryptStoredChatKeyMaterialFromBackup(remoteKeyBackup, restoreRecoveryCode);
      if (!isStoredChatKeyCompatible(restored, viewerIdentity)) {
        throw new Error("This recovery code restored a different key than the one linked to this account.");
      }

      const synced = syncStoredChatKeyIdentity(viewerUserId, viewerIdentity) ?? {
        ...restored,
        identityId: viewerIdentity.id,
        algorithm: viewerIdentity.algorithm,
        keyVersion: viewerIdentity.keyVersion,
        updatedAt: viewerIdentity.updatedAt
      };
      saveStoredChatKeyMaterial(synced);
      saveStoredRecoveryCode(viewerUserId, restoreRecoveryCode);
      setLocalChatKey(synced);
      setRecoveryCode(formatRecoveryCode(restoreRecoveryCode));
      setRestoreRecoveryCode("");
      setRecoveryCodeVisible(false);
      setKeySetupError(null);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "We could not restore your encrypted key backup.");
    } finally {
      setRestoringKeyBackup(false);
    }
  }

  const visibleConversations = useMemo(() => {
    if (isSearching) return [];
    return conversations;
  }, [conversations, isSearching]);

  const unreadCount = conversations.filter((item) => item.unreadCount > 0).length;

  const messageMap = useMemo(() => {
    return new Map((activeConversation?.messages ?? []).map((message) => [message.id, message]));
  }, [activeConversation]);

  const replyingToMessage = useMemo(
    () => (replyingToMessageId ? messageMap.get(replyingToMessageId) ?? null : null),
    [messageMap, replyingToMessageId]
  );

  const selectedMessageAction = useMemo(
    () => (selectedMessageActionId ? messageMap.get(selectedMessageActionId) ?? null : null),
    [messageMap, selectedMessageActionId]
  );

  useEffect(() => {
    messageIdsRef.current = new Set(activeConversation?.messages.map((message) => message.id) ?? []);
  }, [activeConversation]);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    if (replyingToMessageId && !messageMap.has(replyingToMessageId)) {
      setReplyingToMessageId(null);
    }

    if (selectedMessageActionId && !messageMap.has(selectedMessageActionId)) {
      setSelectedMessageActionId(null);
      setSelectedMessageDeleteForEveryoneAllowed(false);
      setSelectedMessageActionAnchor(null);
    }
  }, [messageMap, replyingToMessageId, selectedMessageActionId]);

  useEffect(() => {
    if (!viewerIdentity || !localChatKey || !isStoredChatKeyCompatible(localChatKey, viewerIdentity)) {
      return;
    }

    if (!remoteKeyBackupLoaded || syncingKeyBackup) {
      return;
    }

    const storedRecoveryCode = recoveryCode ?? loadStoredRecoveryCode(viewerUserId);
    if (storedRecoveryCode && !recoveryCode) {
      setRecoveryCode(storedRecoveryCode);
    }

    if (remoteKeyBackup?.publicKey === viewerIdentity.publicKey) {
      keyBackupSyncIdentityRef.current = viewerIdentity.publicKey;
      return;
    }

    const currentRecoveryCode = storedRecoveryCode ?? generateRecoveryCode();
    if (!storedRecoveryCode) {
      setRecoveryCode(currentRecoveryCode);
    }

    if (keyBackupSyncIdentityRef.current !== viewerIdentity.publicKey) {
      void syncEncryptedKeyBackup(localChatKey, currentRecoveryCode);
      setRecoveryCodeVisible(true);
    }
  }, [localChatKey, recoveryCode, remoteKeyBackup, remoteKeyBackupLoaded, syncingKeyBackup, viewerIdentity, viewerUserId]);

  useEffect(() => {
    if (!localChatKey) {
      return;
    }

    let cancelled = false;
    const encryptedPreviews = conversations
      .map((item) => ({ item, lastMessage: item.lastMessage }))
      .filter(
        (entry): entry is { item: ChatConversationPreview; lastMessage: ChatMessageRecord } =>
          Boolean(
            entry.lastMessage &&
              entry.item.peer.publicKey &&
              isE2eeCipherAlgorithm(entry.lastMessage.cipherAlgorithm) &&
              !messagePlaintextById[entry.lastMessage.id]
          )
      );

    if (encryptedPreviews.length === 0) {
      return;
    }

    void (async () => {
      const nextEntries = await Promise.all(
        encryptedPreviews.map(async ({ item, lastMessage }) => {
          try {
            const plaintext = await decryptChatText(lastMessage.cipherText, lastMessage.cipherIv, localChatKey, item.peer.publicKey!);
            return [lastMessage.id, plaintext] as const;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) {
        return;
      }

      const resolvedEntries = nextEntries.filter(
        (entry): entry is readonly [string, string] => Array.isArray(entry)
      );
      const updates = Object.fromEntries(resolvedEntries);
      if (Object.keys(updates).length > 0) {
        setMessagePlaintextById((current) => ({ ...current, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversations, localChatKey, messagePlaintextById]);

  useEffect(() => {
    if (!activeConversation || !localChatKey || !activeConversation.peer.publicKey) {
      setDecryptionWarning(null);
      return;
    }

    let cancelled = false;
    const encryptedMessages = activeConversation.messages.filter(
      (message) => isE2eeCipherAlgorithm(message.cipherAlgorithm) && !messagePlaintextById[message.id]
    );

    if (encryptedMessages.length === 0) {
      setDecryptionWarning(null);
      return;
    }

    void (async () => {
      const nextEntries = await Promise.all(
        encryptedMessages.map(async (message) => {
          try {
            const plaintext = await decryptChatText(message.cipherText, message.cipherIv, localChatKey, activeConversation.peer.publicKey!);
            return [message.id, plaintext] as const;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) {
        return;
      }

      const resolvedEntries = nextEntries.filter(
        (entry): entry is readonly [string, string] => Array.isArray(entry)
      );
      const resolvedIds = new Set(resolvedEntries.map((entry) => entry[0]));
      const updates = Object.fromEntries(resolvedEntries);
      if (Object.keys(updates).length > 0) {
        setMessagePlaintextById((current) => ({ ...current, ...updates }));
        setKeySetupError(null);
      }

      const unresolvedMessages = encryptedMessages.filter((message) => !resolvedIds.has(message.id));
      if (unresolvedMessages.length === 0) {
        setDecryptionWarning(null);
        return;
      }

      const hasLegacyCipherMessages = unresolvedMessages.some((message) => !hasChatCipherEnvelope(message.cipherText));
      setDecryptionWarning(
        hasLegacyCipherMessages
          ? "Some older encrypted messages were locked with an earlier chat key and cannot be opened on this device."
          : "Some encrypted messages still need the matching private key on this device."
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversation, localChatKey, messagePlaintextById]);

  useEffect(() => {
    if (!activeConversation || !localChatKey || !activeConversation.peer.publicKey) {
      return;
    }

    const upgradeableMessages = activeConversation.messages.filter(
      (message) =>
        ((!isE2eeCipherAlgorithm(message.cipherAlgorithm) &&
          message.cipherText.trim()) ||
          (isE2eeCipherAlgorithm(message.cipherAlgorithm) &&
            !hasChatCipherEnvelope(message.cipherText) &&
            Boolean(messagePlaintextById[message.id]))) &&
        !migratingMessageIdsRef.current.has(message.id)
    );

    if (upgradeableMessages.length === 0) {
      return;
    }

    upgradeableMessages.forEach((message) => {
      migratingMessageIdsRef.current.add(message.id);
    });

    let cancelled = false;

    void (async () => {
      try {
        const updates = await Promise.all(
          upgradeableMessages.map(async (message) => {
            const plaintext = isE2eeCipherAlgorithm(message.cipherAlgorithm)
              ? messagePlaintextById[message.id]
              : message.cipherText;

            if (!plaintext) {
              throw new Error("We could not load a decryptable copy of this message.");
            }

            return {
              messageId: message.id,
              ...(await encryptChatText(plaintext, localChatKey, activeConversation.peer.publicKey!))
            };
          })
        );

        const response = await fetchChatEndpoint(`/api/chats/${encodeURIComponent(activeConversation.id)}/messages/encryption`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: updates })
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("This browser was signed out or switched to another account. Sign in again before upgrading older messages.");
          }

          throw new Error(data?.error?.message ?? "We could not upgrade this chat to end-to-end encryption.");
        }

        const migratedMessages = Array.isArray(data?.items) ? (data.items as ChatMessageRecord[]) : [];
        const migratedById = new Map(migratedMessages.map((message) => [message.id, message]));
        const plaintextUpdates = Object.fromEntries(
          upgradeableMessages
            .map((message) => [
              message.id,
              isE2eeCipherAlgorithm(message.cipherAlgorithm) ? messagePlaintextById[message.id] : message.cipherText
            ])
            .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
        );

        if (cancelled) {
          return;
        }

        setMessagePlaintextById((current) => ({ ...current, ...plaintextUpdates }));
        setActiveConversation((current) =>
          current && current.id === activeConversation.id
            ? {
                ...current,
                messages: current.messages.map((message) => migratedById.get(message.id) ?? message)
              }
            : current
        );
        setConversations((current) =>
          current.map((item) =>
            item.id === activeConversation.id && item.lastMessage
              ? {
                  ...item,
                  lastMessage: migratedById.get(item.lastMessage.id) ?? item.lastMessage
                }
              : item
          )
        );
      } catch {
        setSendError("We could not upgrade some older messages on this device.");
        return;
      } finally {
        upgradeableMessages.forEach((message) => {
          migratingMessageIdsRef.current.delete(message.id);
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversation, localChatKey, messagePlaintextById]);

  const messageTimeline = useMemo(() => {
    const items: Array<
      | { key: string; type: "day"; label: string }
      | { key: string; type: "message"; message: ChatMessageRecord }
    > = [];

    if (!activeConversation) {
      return items;
    }

    let currentDay = "";
    for (const message of activeConversation.messages) {
      const nextDay = new Date(message.createdAt).toDateString();
      if (nextDay !== currentDay) {
        currentDay = nextDay;
        items.push({ key: `day-${currentDay}`, type: "day", label: formatMessageDay(message.createdAt) });
      }
      items.push({ key: message.id, type: "message", message });
    }

    return items;
  }, [activeConversation]);

  const seenOwnMessageIds = useMemo(() => {
    const seenIds = new Set<string>();
    if (!activeConversation?.peerLastReadMessageId) {
      return seenIds;
    }

    for (const message of activeConversation.messages) {
      if (isOwnChatMessage(message, viewerUserId, viewerMembershipId)) {
        seenIds.add(message.id);
      }

      if (message.id === activeConversation.peerLastReadMessageId) {
        break;
      }
    }

    return seenIds;
  }, [activeConversation, viewerMembershipId, viewerUserId]);

  const latestIncomingMessage = useMemo(() => {
    if (!activeConversation) return null;

    for (let index = activeConversation.messages.length - 1; index >= 0; index -= 1) {
      const message = activeConversation.messages[index];
      if (message.senderUserId !== viewerUserId) {
        return message;
      }
    }

    return null;
  }, [activeConversation, viewerUserId]);

  useEffect(() => {
    if (!activeConversationId) return;

    if (composerFocusTimeoutRef.current) {
      clearTimeout(composerFocusTimeoutRef.current);
    }

    composerFocusTimeoutRef.current = setTimeout(() => {
      composerRef.current?.focus();
    }, 60);

    return () => {
      if (composerFocusTimeoutRef.current) {
        clearTimeout(composerFocusTimeoutRef.current);
        composerFocusTimeoutRef.current = null;
      }
    };
  }, [activeConversationId]);

  useEffect(() => {
    if (activeConversationId && realtimeState === "live") {
      setSessionExpired(false);
    }
  }, [activeConversationId, realtimeState]);

  useEffect(() => {
    const conversationId = activeConversationId ?? "";
    if (!conversationId) {
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let connectInFlight = false;
    let reconnectAttempt = 0;

    function clearReconnectTimer() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function canKeepSocketAlive() {
      return !cancelled && navigator.onLine && document.visibilityState === "visible";
    }

    function closeSocket(reason?: string) {
      clearReconnectTimer();

      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close(1000, reason);
      }

      socket = null;
    }

    function syncMissedMessages() {
      void loadConversationDetail(conversationId, {
        silent: true,
        preserveActiveConversation: true
      });
    }

    function scheduleReconnect() {
      if (!canKeepSocketAlive()) {
        setRealtimeState(navigator.onLine ? "idle" : "offline");
        return;
      }

      clearReconnectTimer();
      reconnectAttempt += 1;
      const delay = Math.min(15000, 1000 * 2 ** Math.min(reconnectAttempt - 1, 4));
      const jitter = Math.floor(Math.random() * 400);
      setRealtimeState("reconnecting");
      reconnectTimer = setTimeout(() => {
        void connect(true);
      }, delay + jitter);
    }

    async function connect(syncOnOpen = false) {
      if (!canKeepSocketAlive()) {
        setRealtimeState(navigator.onLine ? "idle" : "offline");
        return;
      }

      if (connectInFlight) {
        return;
      }

      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        if (syncOnOpen) {
          syncMissedMessages();
        }
        return;
      }

      connectInFlight = true;
      setRealtimeState(reconnectAttempt > 0 ? "reconnecting" : "connecting");

      try {
        const response = await fetchChatEndpoint(`/api/chats/socket-token?conversationId=${encodeURIComponent(conversationId)}`, {
          cache: "no-store"
        });
        const data = await response.json().catch(() => null);

        if (response.status === 401) {
          connectInFlight = false;
          setRealtimeState("idle");
          return;
        }

        if (!response.ok || cancelled || typeof data?.wsUrl !== "string") {
          connectInFlight = false;
          scheduleReconnect();
          return;
        }

        socket = new WebSocket(data.wsUrl);

        socket.onopen = () => {
          connectInFlight = false;
          reconnectAttempt = 0;
          setSessionExpired(false);
          setRealtimeState("live");
          if (syncOnOpen) {
            syncMissedMessages();
          }
        };

        socket.onmessage = (event) => {
          if (cancelled) {
            return;
          }

          try {
            const payload = JSON.parse(event.data) as {
              type?: string;
              payload?: { messageId?: string };
            };

            if (payload.type === "chat.sync" || payload.type === "chat.read") {
              void loadConversationDetail(conversationId, {
                silent: true,
                preserveActiveConversation: true
              });
              return;
            }

            if (payload.type !== "chat.message") {
              return;
            }

            const messageId = typeof payload.payload?.messageId === "string" ? payload.payload.messageId : null;
            if (messageId && messageIdsRef.current.has(messageId)) {
              return;
            }

            void loadConversationDetail(conversationId, {
              silent: true,
              preserveActiveConversation: true
            });
          } catch {
            return;
          }
        };

        socket.onerror = () => {
          socket?.close();
        };

        socket.onclose = () => {
          connectInFlight = false;
          socket = null;

          if (cancelled) {
            return;
          }

          scheduleReconnect();
        };
      } catch {
        connectInFlight = false;
        scheduleReconnect();
      }
    }

    function handleOnline() {
      reconnectAttempt = 0;
      setRealtimeState("reconnecting");
      syncMissedMessages();
      void connect(true);
    }

    function handleOffline() {
      setRealtimeState("offline");
      closeSocket("offline");
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        reconnectAttempt = 0;
        setRealtimeState(navigator.onLine ? "reconnecting" : "offline");
        syncMissedMessages();
        void connect(true);
        return;
      }

      setRealtimeState("idle");
      closeSocket("hidden");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (canKeepSocketAlive()) {
      void connect(true);
    } else {
      setRealtimeState(navigator.onLine ? "idle" : "offline");
    }

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      closeSocket("cleanup");
    };
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }

      void loadConversationDetail(activeConversationId, {
        silent: true,
        preserveActiveConversation: true
      });
    }, realtimeState === "live" ? 4000 : 2200);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeConversationId, realtimeState]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [activeConversation?.id, activeConversation?.messages.length]);

  useEffect(() => {
    if (!activeConversation || !latestIncomingMessage) {
      return;
    }

    if (latestIncomingMessage.id === activeConversation.lastReadMessageId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetchChatEndpoint(`/api/chats/${encodeURIComponent(activeConversation.id)}/read`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messageId: latestIncomingMessage.id }),
          credentials: "same-origin"
        });

        if (response.status === 401) {
          return;
        }

        if (!response.ok || cancelled) {
          return;
        }

        setSessionExpired(false);
        const readAt = new Date().toISOString();

        setActiveConversation((current) =>
          current && current.id === activeConversation.id
            ? { ...current, lastReadMessageId: latestIncomingMessage.id, lastReadAt: readAt }
            : current
        );

        setConversations((current) =>
          current.map((item) =>
            item.id === activeConversation.id
              ? {
                  ...item,
                  unreadCount: 0,
                  lastMessage: activeConversation.messages[activeConversation.messages.length - 1] ?? item.lastMessage,
                  lastActivityAt:
                    activeConversation.messages[activeConversation.messages.length - 1]?.createdAt ?? item.lastActivityAt
                }
              : item
          )
        );
      } catch {
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversation, latestIncomingMessage]);

  function focusComposerSoon() {
    if (composerFocusTimeoutRef.current) {
      clearTimeout(composerFocusTimeoutRef.current);
    }

    composerFocusTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }
      composerRef.current?.focus();
      const currentValue = composerRef.current?.value ?? "";
      const length = currentValue.length;
      composerRef.current?.setSelectionRange(length, length);
    }, 0);
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function resetSwipeReplyPreview() {
    swipeGestureRef.current = null;
    setSwipeReplyPreview(null);
  }

  function buildMessageActionAnchor(target: HTMLElement, isOwnMessage: boolean): MessageActionAnchor {
    const rect = target.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(360, viewportWidth - 24);
    const estimatedHeight = Math.min(420, viewportHeight - 32);
    const preferredLeft = isOwnMessage ? rect.right - width : rect.left;
    const clampedLeft = Math.min(Math.max(12, preferredLeft), viewportWidth - width - 12);
    const preferredTop = rect.top - 12;
    const clampedTop = Math.min(Math.max(12, preferredTop), viewportHeight - estimatedHeight - 12);

    return {
      top: clampedTop,
      left: clampedLeft,
      width
    };
  }

  function openMessageActions(message: ChatMessageRecord, target?: HTMLElement | null, isOwnMessage = false) {
    resetSwipeReplyPreview();
    setSelectedMessageActionId(message.id);
    setSelectedMessageDeleteForEveryoneAllowed(
      canDeleteChatMessageForEveryone(message, viewerMembershipId, Date.now())
    );
    setSelectedMessageActionAnchor(
      typeof window !== "undefined" && target
        ? buildMessageActionAnchor(target, isOwnMessage)
        : null
    );
    setMessageActionError(null);
  }

  function handleMessagePointerDown(
    message: ChatMessageRecord,
    isOwnMessage: boolean,
    event: React.PointerEvent<HTMLDivElement>
  ) {
    if (event.pointerType !== "touch") {
      return;
    }

    if (isDeletedChatMessage(message)) {
      resetSwipeReplyPreview();
      clearLongPressTimer();
      return;
    }

    swipeGestureRef.current = {
      messageId: message.id,
      startX: event.clientX,
      startY: event.clientY,
      isOwnMessage
    };
    setSwipeReplyPreview(null);
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    const target = event.currentTarget;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      openMessageActions(message, target, isOwnMessage);
    }, 420);
  }

  function handleMessagePointerMove(message: ChatMessageRecord, event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") {
      return;
    }

    if (isDeletedChatMessage(message)) {
      resetSwipeReplyPreview();
      clearLongPressTimer();
      return;
    }

    const gesture = swipeGestureRef.current;
    if (!gesture || gesture.messageId !== message.id) {
      return;
    }

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    const directionalOffset = gesture.isOwnMessage ? Math.min(0, deltaX) : Math.max(0, deltaX);
    const absOffset = Math.abs(directionalOffset);
    const absDeltaY = Math.abs(deltaY);

    if (absDeltaY > absOffset && absDeltaY > 10) {
      resetSwipeReplyPreview();
      clearLongPressTimer();
      return;
    }

    if (absOffset > 12 && absOffset > absDeltaY + 6) {
      clearLongPressTimer();
    }

    if (absOffset < 8) {
      setSwipeReplyPreview(null);
      return;
    }

    const nextOffset = Math.max(-78, Math.min(78, directionalOffset));
    setSwipeReplyPreview((current) =>
      current && current.messageId === message.id && current.offsetX === nextOffset
        ? current
        : { messageId: message.id, offsetX: nextOffset }
    );
  }

  function handleMessagePointerCancel() {
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    resetSwipeReplyPreview();
  }

  function handleMessagePointerUp(message: ChatMessageRecord, event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") {
      return;
    }

    if (isDeletedChatMessage(message)) {
      resetSwipeReplyPreview();
      clearLongPressTimer();
      longPressTriggeredRef.current = false;
      lastTapRef.current = null;
      return;
    }

    const gesture = swipeGestureRef.current;
    const directionalOffset =
      gesture && gesture.messageId === message.id
        ? gesture.isOwnMessage
          ? Math.min(0, event.clientX - gesture.startX)
          : Math.max(0, event.clientX - gesture.startX)
        : 0;
    const absOffset = Math.abs(directionalOffset);
    const didLongPress = longPressTriggeredRef.current;
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    resetSwipeReplyPreview();

    if (didLongPress) {
      lastTapRef.current = null;
      return;
    }

    if (absOffset >= 56) {
      lastTapRef.current = null;
      handleReplyToMessage(message.id);
      return;
    }

    if (absOffset >= 14) {
      lastTapRef.current = null;
      return;
    }

    const now = Date.now();
    const previousTap = lastTapRef.current;
    if (previousTap && previousTap.messageId === message.id && now - previousTap.timestamp <= 280) {
      lastTapRef.current = null;
      void handleReactToMessage(message.id, "\u2764\uFE0F");
      return;
    }

    lastTapRef.current = { messageId: message.id, timestamp: now };
  }

  function handleReplyToMessage(messageId: string) {
    const targetMessage = messageMap.get(messageId);
    if (!targetMessage || isDeletedChatMessage(targetMessage)) {
      return;
    }

    resetSwipeReplyPreview();
    setReplyingToMessageId(messageId);
    setSelectedMessageActionId(null);
    setSelectedMessageDeleteForEveryoneAllowed(false);
    setSelectedMessageActionAnchor(null);
    setMessageActionError(null);
    focusComposerSoon();
  }

  async function handleReactToMessage(messageId: string, emoji: string) {
    const targetMessage = messageMap.get(messageId);
    if (!targetMessage || isDeletedChatMessage(targetMessage)) {
      return;
    }

    setMessageActionBusy(true);
    setMessageActionError(null);

    try {
      const response = await fetchChatEndpoint(`/api/chats/messages/${encodeURIComponent(messageId)}/reactions`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emoji })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setMessageActionError(data?.error?.message ?? "We could not react to that message.");
        return;
      }

      const aggregate = Array.isArray(data?.aggregate) ? data.aggregate : [];
      setActiveConversation((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((message) =>
                message.id === messageId ? { ...message, reactions: aggregate } : message
              )
            }
          : current
      );
      setSelectedMessageActionId(null);
      setSelectedMessageDeleteForEveryoneAllowed(false);
      setSelectedMessageActionAnchor(null);
    } catch {
      setMessageActionError("Network issue while reacting to that message.");
    } finally {
      setMessageActionBusy(false);
    }
  }

  async function handleDeleteMessage(scope: DeleteChatMessageScope) {
    if (!selectedMessageAction) {
      return;
    }

    setMessageActionBusy(true);
    setMessageActionError(null);

    try {
      const response = await fetchChatEndpoint(`/api/chats/messages/${encodeURIComponent(selectedMessageAction.id)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setMessageActionError(data?.error?.message ?? "We could not delete that message.");
        return;
      }

      const conversationPreview =
        data?.conversationPreview && typeof data.conversationPreview === "object"
          ? (data.conversationPreview as ChatConversationPreview)
          : null;
      const updatedMessage =
        data?.item && typeof data.item === "object"
          ? (data.item as ChatMessageRecord)
          : null;

      setActiveConversation((current) => {
        if (!current) {
          return current;
        }

        if (scope === "everyone" && updatedMessage) {
          return {
            ...current,
            messages: current.messages.map((message) =>
              message.id === selectedMessageAction.id ? updatedMessage : message
            )
          };
        }

        return {
          ...current,
          messages: current.messages.filter((message) => message.id !== selectedMessageAction.id)
        };
      });

      if (conversationPreview) {
        setConversations((current) => upsertConversationItem(current, conversationPreview));
      }

      if (replyingToMessageId === selectedMessageAction.id) {
        setReplyingToMessageId(null);
      }

      setSelectedMessageActionId(null);
      setSelectedMessageDeleteForEveryoneAllowed(false);
      setSelectedMessageActionAnchor(null);
    } catch {
      setMessageActionError("Network issue while deleting that message.");
    } finally {
      setMessageActionBusy(false);
    }
  }

  async function handleStartChat(username: string) {
    if (startingChat) return;

    setStartingChat(username);
    setStartError(null);

    try {
      const response = await fetchChatEndpoint("/api/chats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientUsername: username })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          setStartError("Your session expired on this browser. Sign in again before opening chats.");
          return;
        }

        setStartError(data?.error?.message ?? "Could not open chat. Try again.");
        return;
      }

      const conversationId = data?.conversation?.id;
      if (!conversationId) {
        setStartError("Something went wrong. Please try again.");
        return;
      }

      router.push(`/messages/${conversationId}`);
    } catch {
      setStartError("Network error. Please check your connection.");
    } finally {
      setStartingChat(null);
    }
  }

  async function handleSendMessage(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const conversationId = activeConversation?.id;
    const nextMessage = draftMessage.trim();
    const peerIdentity = activeConversation?.peer.publicKey ?? null;
    if (!conversationId || !nextMessage || sending) {
      return;
    }

    setSending(true);
    setSendError(null);

    try {
      const chatReady = await ensureChatIdentity();
      if (!chatReady) {
        return;
      }

      const currentLocalKey = localChatKey ?? loadStoredChatKeyMaterial(viewerUserId);
      if (!currentLocalKey) {
        setSendError("This device is missing your private E2EE key.");
        return;
      }

      if (!peerIdentity) {
        setSendError("This user has not finished setting up E2EE chat yet.");
        return;
      }

      const encryptedPayload = await encryptChatText(nextMessage, currentLocalKey, peerIdentity);

      const response = await fetchChatEndpoint(`/api/chats/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messageKind: "text",
          replyToMessageId: replyingToMessageId,
          ...encryptedPayload
        })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          setSendError("Your session expired on this browser. Sign in again before sending messages.");
          return;
        }

        setSendError(data?.error?.message ?? "We could not send this message.");
        return;
      }

      const sentMessage = data?.item as ChatMessageRecord | undefined;
      const conversationPreview = data?.conversationPreview as ChatConversationPreview | undefined;

      if (sentMessage) {
        messageIdsRef.current.add(sentMessage.id);
        setMessagePlaintextById((current) => ({
          ...current,
          [sentMessage.id]: nextMessage
        }));
        setActiveConversation((current) =>
          current && current.id === conversationId
            ? {
                ...current,
                messages: [...current.messages, sentMessage]
              }
            : current
        );
      }

      if (conversationPreview) {
        setConversations((current) => upsertConversationItem(current, { ...conversationPreview, unreadCount: 0 }));
      }

      setDraftMessage("");
      setReplyingToMessageId(null);
      focusComposerSoon();
    } catch {
      setSendError("Network error. Please try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  const activePeer = activeConversation?.peer ?? null;
  const selectedMessageActionIsOwn = Boolean(
    selectedMessageAction && isOwnChatMessage(selectedMessageAction, viewerUserId, viewerMembershipId)
  );
  const selectedMessageActionIsDeleted = Boolean(selectedMessageAction && isDeletedChatMessage(selectedMessageAction));
  const hasCompatibleLocalChatKey = Boolean(
    viewerIdentity && localChatKey && isStoredChatKeyCompatible(localChatKey, viewerIdentity)
  );
  const isE2eeReadyForActiveConversation = Boolean(activePeer?.publicKey && hasCompatibleLocalChatKey);
  const showDecryptionWarning = Boolean(
    decryptionWarning && activeConversationId && !dismissedDecryptionWarningIds[activeConversationId]
  );
  const formattedRecoveryCode = recoveryCode ? formatRecoveryCode(recoveryCode) : "";
  const showRecoveryRestoreCard = Boolean(viewerIdentity && remoteKeyBackup && !hasCompatibleLocalChatKey);
  const showRecoveryCodeCard = Boolean(viewerIdentity && hasCompatibleLocalChatKey && formattedRecoveryCode && recoveryCodeVisible);
  const activePeerStatus = activePeer ? getStatusRing(activePeer.userId) : "away";
  const activePeerInitials = activePeer ? getInitials(activePeer.displayName) : "";
  const activePeerMeta = activePeer
    ? [activePeer.course, activePeer.stream].filter(Boolean).join(" / ") || collegeName
    : collegeName;
  const realtimeLabel =
    realtimeState === "live"
      ? "Live"
      : realtimeState === "offline"
        ? "Offline"
        : realtimeState === "reconnecting"
          ? "Reconnecting"
          : realtimeState === "connecting"
            ? "Syncing"
            : "Paused";

  const navItems = buildPrimaryCampusNav("messages", { unreadCount });

  return (
    <main className="spm-page">
      <div className="spm-blob spm-blob-one" aria-hidden="true" />
      <div className="spm-blob spm-blob-two" aria-hidden="true" />
      <div className="spm-blob spm-blob-three" aria-hidden="true" />

      <div className={`spm-shell${activeConversationId ? " spm-shell-chat-open" : ""}`}>
        <CampusDesktopNavigation navItems={navItems} viewerName={viewerName} viewerUsername={viewerUsername} />

        <section className="spm-list-pane" aria-label="Conversations">
          <div className="spm-list-header">
            <div className="spm-list-header-top">
              <h1 className="spm-list-title">Messages</h1>
              {unreadCount > 0 && (
                <span className="spm-unread-chip">{unreadCount} new</span>
              )}
            </div>

            <label
              className={`spm-ghost-search${focused || query ? " spm-ghost-search-active" : ""}`}
              aria-label="Search campus users"
            >
              <span className="spm-ghost-search-icon"><IconSearch /></span>
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Search doston by handle or name..."
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                id="spm-search-input"
                aria-label="Search chats by name or user ID"
              />
              {isSearching && (
                <button
                  type="button"
                  className="spm-ghost-search-clear"
                  onClick={() => {
                    setQuery("");
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                >
                  x
                </button>
              )}
            </label>
          </div>

          {loadError && (
            <p className="spm-load-error" role="alert">{loadError}</p>
          )}
          {startError && (
            <p className="spm-load-error" role="alert">{startError}</p>
          )}

          <div className="spm-conv-list" role="list" aria-label="Conversation list">
            {isSearching && (
              <>
                {searchLoading && (
                  <div className="spm-search-hint">
                    <span className="spm-search-spinner" aria-hidden="true" />
                    Searching campus...
                  </div>
                )}

                {!searchLoading && searchResults.length === 0 && (
                  <div className="spm-empty-state" role="status">
                    <div className="spm-empty-icon" aria-hidden="true">
                      <IconSearch />
                    </div>
                    <strong>No one found</strong>
                    <span>Try their @username, display name, or roll number.</span>
                  </div>
                )}

                {!searchLoading && searchResults.map((user) => {
                  const initials = getInitials(user.displayName);
                  const isBusy = startingChat === user.username;
                  const isMe = user.username === viewerUsername;
                  return (
                    <div key={user.userId} className="spm-user-result" role="listitem">
                      <div className="spm-conv-avatar-wrap">
                        <div className="spm-conv-avatar spm-pulse-ring spm-pulse-away">
                          {initials}
                        </div>
                      </div>
                      <div className="spm-conv-content">
                        <div className="spm-conv-top">
                          <span className="spm-conv-name">{user.displayName}</span>
                        </div>
                        <span className="spm-conv-preview">@{user.username}</span>
                        {(user.course || user.stream) && (
                          <span className="spm-conv-meta">
                            {[user.course, user.stream].filter(Boolean).join(" / ")}
                          </span>
                        )}
                      </div>
                      {!isMe && (
                        <button
                          type="button"
                          className="spm-start-chat-btn"
                          disabled={isBusy}
                          onClick={() => handleStartChat(user.username)}
                          aria-label={`Start chat with ${user.displayName}`}
                        >
                          {isBusy ? (
                            <span className="spm-search-spinner" aria-hidden="true" />
                          ) : (
                            <IconMessages />
                          )}
                        </button>
                      )}
                      {isMe && (
                        <span className="spm-you-badge">You</span>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {!isSearching && (
              <>
                {visibleConversations.length === 0 && (
                  <div className="spm-empty-state" role="status">
                    <div className="spm-empty-icon" aria-hidden="true">
                      <IconMessages />
                    </div>
                    <strong>No conversations yet</strong>
                    <span>Search doston by their handle or name to start chatting.</span>
                  </div>
                )}

                {visibleConversations.map((item) => {
                  const { text: previewText, isMarket } = getConversationPreviewLabel(item, messagePlaintextById);
                  const statusRing = getStatusRing(item.peer.userId);
                  const initials = getInitials(item.peer.displayName);

                  return (
                    <Link
                      key={item.id}
                      href={`/messages/${item.id}`}
                      role="listitem"
                      className={`spm-conv-item${item.unreadCount > 0 ? " spm-conv-item-unread" : ""}${isMarket ? " spm-conv-item-market" : ""}${item.id === activeConversationId ? " spm-conv-item-active" : ""}`}
                      aria-label={`Chat with ${item.peer.displayName}${item.unreadCount > 0 ? `, ${item.unreadCount} unread` : ""}`}
                      onClick={() => setActiveConversationId(item.id)}
                    >
                      <div className="spm-conv-avatar-wrap">
                        <div className={`spm-conv-avatar spm-pulse-ring spm-pulse-${statusRing}`}>
                          {initials}
                        </div>
                        <span
                          className={`spm-status-dot spm-status-${statusRing}`}
                          aria-label={statusRing === "online" ? "Online" : statusRing === "vibing" ? "Vibing" : "Away"}
                        />
                      </div>

                      <div className="spm-conv-content">
                        <div className="spm-conv-top">
                          <span className="spm-conv-name">{item.peer.displayName}</span>
                          <span className="spm-conv-time" suppressHydrationWarning>
                            {timeAgo(item.lastActivityAt)}
                          </span>
                        </div>
                        <div className="spm-conv-bottom">
                          <span className={`spm-conv-preview${isMarket ? " spm-conv-preview-market" : ""}`}>
                            {previewText}
                          </span>
                          {item.unreadCount > 0 ? (
                            <span className="spm-unread-dot">{item.unreadCount > 9 ? "9+" : item.unreadCount}</span>
                          ) : (
                            <span className="spm-read-check" aria-label="Read"><IconCheck /></span>
                          )}
                        </div>
                        {item.peer.publicKey ? null : (
                          <span className="spm-key-pending">Key setup pending</span>
                        )}
                      </div>

                      {isMarket && <div className="spm-market-glow" aria-hidden="true" />}
                    </Link>
                  );
                })}
              </>
            )}
          </div>

          <div className="spm-list-footer">
            <div className="spm-e2ee-pill" role="status" aria-label="End-to-end encryption status">
              <IconShield />
              {localChatKey && viewerIdentity ? "E2EE ready" : "Secure chat"}
            </div>
            {viewerIdentity && hasCompatibleLocalChatKey && formattedRecoveryCode && (
              <button
                type="button"
                className="spm-e2ee-link"
                onClick={() => setRecoveryCodeVisible((current) => !current)}
              >
                {recoveryCodeVisible ? "Hide recovery key" : "Show recovery key"}
              </button>
            )}
            <span>{collegeName}</span>
          </div>
        </section>

        <section className={`spm-chat-pane${activeConversationId ? " spm-chat-pane-active" : ""}`} aria-label="Active chat area">
          {!activeConversationId && (
            <div className="spm-chat-idle">
              <div className="spm-chat-idle-icon" aria-hidden="true">
                <IconMessages />
              </div>
              <h2 className="spm-chat-idle-title">Select a conversation</h2>
              <p className="spm-chat-idle-sub">
                Private chats use end-to-end encryption once both people have their secure keys set up.
              </p>
              <div className="spm-chat-idle-e2ee">
                <IconShield />
                End-to-end encrypted by Vyb
              </div>

              {(showRecoveryCodeCard || showRecoveryRestoreCard) && (
                <div className="spm-chat-key-card" role="status">
                  {showRecoveryCodeCard && (
                    <>
                      <strong>Save this recovery key</strong>
                      <span>Use it on another device to restore your end-to-end encrypted chats.</span>
                      <code>{formattedRecoveryCode}</code>
                      <div className="spm-chat-key-actions">
                        <button
                          type="button"
                          className="spm-chat-key-button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(formattedRecoveryCode);
                          }}
                        >
                          Copy key
                        </button>
                        <button
                          type="button"
                          className="spm-chat-key-button spm-chat-key-button-ghost"
                          onClick={() => setRecoveryCodeVisible(false)}
                        >
                          Saved it
                        </button>
                      </div>
                    </>
                  )}

                  {showRecoveryRestoreCard && (
                    <>
                      <strong>Restore your encrypted key</strong>
                      <span>Enter the recovery key from your original device to unlock the same E2EE chats here.</span>
                      <div className="spm-chat-key-restore">
                        <input
                          value={restoreRecoveryCode}
                          onChange={(event) => setRestoreRecoveryCode(event.target.value)}
                          placeholder="Enter recovery key"
                          autoCapitalize="characters"
                          spellCheck={false}
                          aria-label="Enter your encrypted chat recovery key"
                        />
                        <button
                          type="button"
                          className="spm-chat-key-button"
                          onClick={() => {
                            void handleRestoreEncryptedKeyBackup();
                          }}
                          disabled={!restoreRecoveryCode.trim() || restoringKeyBackup}
                        >
                          {restoringKeyBackup ? "Restoring..." : "Restore key"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {activeConversationId && (
            <div className="spm-chat-card">
              <header className="spm-chat-header">
                <button
                  type="button"
                  className="spm-chat-back"
                  onClick={() => router.push("/messages")}
                  aria-label="Back to inbox"
                >
                  <IconArrowLeft />
                </button>

                {activePeer ? (
                  <div className="spm-chat-peer">
                    <div className="spm-conv-avatar-wrap">
                      <div className={`spm-conv-avatar spm-pulse-ring spm-pulse-${activePeerStatus}`}>
                        {activePeerInitials}
                      </div>
                      <span className={`spm-status-dot spm-status-${activePeerStatus}`} />
                    </div>
                    <div className="spm-chat-peer-copy">
                      <strong>{activePeer.displayName}</strong>
                      <span>@{activePeer.username}</span>
                      <span>{activePeerMeta}</span>
                    </div>
                  </div>
                ) : (
                  <div className="spm-chat-peer spm-chat-peer-skeleton" aria-hidden="true" />
                )}

                <div className="spm-chat-header-actions">
                  <span className={`spm-chat-live-pill spm-chat-live-pill-${realtimeState}`}>
                    {realtimeLabel}
                  </span>
                  <span className="spm-chat-lock-pill">
                    <IconShield />
                    {isE2eeReadyForActiveConversation ? "E2EE" : "Secure"}
                  </span>
                </div>
              </header>

              {conversationLoading && !activeConversation && (
                <div className="spm-chat-state">
                  <span className="spm-search-spinner" aria-hidden="true" />
                  Opening secure chat...
                </div>
              )}

              {sessionExpired && !activeConversation && (
                <div className="spm-chat-state spm-chat-state-error" role="alert">
                  <strong>Session expired on this browser.</strong>
                  <span>Sign in again to reload this secure conversation and resume realtime sync.</span>
                </div>
              )}

              {!conversationLoading && conversationError && !activeConversation && (
                <div className="spm-chat-state spm-chat-state-error" role="alert">
                  <strong>Could not open this chat.</strong>
                  <span>{conversationError}</span>
                  <button
                      type="button"
                      className="spm-chat-retry"
                      onClick={() => {
                        if (activeConversationId) {
                          void loadConversationDetail(activeConversationId, {
                            silent: false,
                            preserveActiveConversation: false
                          });
                        }
                      }}
                    >
                    Try again
                  </button>
                </div>
              )}

              {activeConversation && (
                <>
                  {(showRecoveryCodeCard || showRecoveryRestoreCard) && (
                    <div className="spm-chat-key-card" role="status">
                      {showRecoveryCodeCard && (
                        <>
                          <strong>Save this recovery key</strong>
                          <span>Use it on your phone or another laptop to restore your end-to-end encrypted chats.</span>
                          <code>{formattedRecoveryCode}</code>
                          <div className="spm-chat-key-actions">
                            <button
                              type="button"
                              className="spm-chat-key-button"
                              onClick={() => {
                                void navigator.clipboard?.writeText(formattedRecoveryCode);
                              }}
                            >
                              Copy key
                            </button>
                            <button
                              type="button"
                              className="spm-chat-key-button spm-chat-key-button-ghost"
                              onClick={() => setRecoveryCodeVisible(false)}
                            >
                              Saved it
                            </button>
                          </div>
                        </>
                      )}

                      {showRecoveryRestoreCard && (
                        <>
                          <strong>Restore your encrypted key</strong>
                          <span>Enter the recovery key from your original device to unlock the same E2EE chats here.</span>
                          <div className="spm-chat-key-restore">
                            <input
                              value={restoreRecoveryCode}
                              onChange={(event) => setRestoreRecoveryCode(event.target.value)}
                              placeholder="Enter recovery key"
                              autoCapitalize="characters"
                              spellCheck={false}
                              aria-label="Enter your encrypted chat recovery key"
                            />
                            <button
                              type="button"
                              className="spm-chat-key-button"
                              onClick={() => {
                                void handleRestoreEncryptedKeyBackup();
                              }}
                              disabled={!restoreRecoveryCode.trim() || restoringKeyBackup}
                            >
                              {restoringKeyBackup ? "Restoring..." : "Restore key"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="spm-chat-thread" ref={threadRef}>
                    {messageTimeline.length === 0 ? (
                      <div className="spm-chat-empty">
                        <div className="spm-chat-empty-icon">
                          <IconMessages />
                        </div>
                        <strong>Say hello</strong>
                        <span>This conversation is ready for your first message.</span>
                      </div>
                    ) : (
                      messageTimeline.map((item) => {
                        if (item.type === "day") {
                          return (
                            <div key={item.key} className="spm-chat-day-divider">
                              <span suppressHydrationWarning>{item.label}</span>
                            </div>
                          );
                        }

                        const message = item.message;
                        const isOwnMessage = isOwnChatMessage(message, viewerUserId, viewerMembershipId);
                        const isDeletedMessage = isDeletedChatMessage(message);
                        const replyTarget = message.replyToMessageId ? messageMap.get(message.replyToMessageId) : null;
                        const reactionSummary = isDeletedMessage
                          ? ""
                          : [...new Set(message.reactions.map((reaction) => reaction.emoji))].join(" ");
                        const isSeenByPeer = isOwnMessage && !isDeletedMessage && seenOwnMessageIds.has(message.id);
                        const receiptLabel = isOwnMessage && !isDeletedMessage ? (isSeenByPeer ? "Seen" : "Sent") : null;
                        const swipeOffsetX = swipeReplyPreview?.messageId === message.id ? swipeReplyPreview.offsetX : 0;
                        const showSwipeReplyCue = Math.abs(swipeOffsetX) >= 10;

                        return (
                          <div
                            key={item.key}
                            className={`spm-chat-message-row${isOwnMessage ? " spm-chat-message-row-self" : ""}`}
                          >
                            {!isOwnMessage && (
                              <div className="spm-chat-mini-avatar" aria-hidden="true">
                                {activePeerInitials}
                              </div>
                            )}

                            {!isOwnMessage && (
                              <button
                                type="button"
                                className="spm-chat-message-trigger"
                                aria-label="Open message actions"
                                onClick={(event) =>
                                  openMessageActions(message, event.currentTarget, false)
                                }
                              >
                                <IconMore />
                              </button>
                            )}

                            <div
                              className={`spm-chat-bubble${isOwnMessage ? " spm-chat-bubble-self" : ""}${message.messageKind === "system" ? " spm-chat-bubble-system" : ""}${showSwipeReplyCue ? " spm-chat-bubble-swipe-active" : ""}`}
                              style={swipeOffsetX ? { transform: `translateX(${swipeOffsetX}px)` } : undefined}
                              onPointerDown={(event) => handleMessagePointerDown(message, isOwnMessage, event)}
                              onPointerMove={(event) => handleMessagePointerMove(message, event)}
                              onPointerUp={(event) => handleMessagePointerUp(message, event)}
                              onPointerCancel={handleMessagePointerCancel}
                            >
                              <div
                                className={`spm-chat-swipe-reply-cue${showSwipeReplyCue ? " is-visible" : ""}${isOwnMessage ? " spm-chat-swipe-reply-cue-self" : ""}`}
                                aria-hidden="true"
                              >
                                <IconReply />
                              </div>
                              {replyTarget && (
                                <div className="spm-chat-reply-preview">
                                  <strong>{isOwnMessage ? "Reply" : `@${activePeer?.username ?? "chat"}`}</strong>
                                  <span>{getReplyPreview(replyTarget, messagePlaintextById)}</span>
                                </div>
                              )}

                              {message.attachment?.url && (
                                <div className="spm-chat-attachment">
                                  <img
                                    src={message.attachment.url}
                                    alt="Shared in chat"
                                    loading="lazy"
                                  />
                                </div>
                              )}

                              <p className="spm-chat-message-text">
                                {getMessageBody(message, messagePlaintextById[message.id], { isOwnMessage })}
                              </p>

                              <div className="spm-chat-message-meta">
                                {reactionSummary ? (
                                  <span className="spm-chat-reaction-pill">{reactionSummary}</span>
                                ) : null}
                                {receiptLabel ? (
                                  <span className={`spm-chat-receipt${isSeenByPeer ? " is-seen" : ""}`}>
                                    {isSeenByPeer ? <IconDoubleCheck /> : <IconCheck />}
                                    {receiptLabel}
                                  </span>
                                ) : null}
                                <span suppressHydrationWarning>{formatMessageTime(message.createdAt)}</span>
                              </div>
                            </div>

                            {isOwnMessage && (
                              <>
                                <button
                                  type="button"
                                  className="spm-chat-message-trigger spm-chat-message-trigger-self"
                                  aria-label="Open message actions"
                                  onClick={(event) =>
                                    openMessageActions(message, event.currentTarget, true)
                                  }
                                >
                                  <IconMore />
                                </button>
                                <div className="spm-chat-mini-avatar spm-chat-mini-avatar-self" aria-hidden="true">
                                  {getInitials(viewerName)}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {selectedMessageAction && (
                    <div
                      className="spm-chat-action-backdrop"
                      role="presentation"
                      onClick={() => {
                        if (!messageActionBusy) {
                          setSelectedMessageActionId(null);
                          setSelectedMessageDeleteForEveryoneAllowed(false);
                          setSelectedMessageActionAnchor(null);
                          setMessageActionError(null);
                        }
                      }}
                    >
                        <div
                          className="spm-chat-action-sheet"
                          role="dialog"
                          aria-modal="true"
                          aria-label="Message actions"
                          onClick={(event) => event.stopPropagation()}
                          style={
                            selectedMessageActionAnchor
                              ? {
                                  top: `${selectedMessageActionAnchor.top}px`,
                                  left: `${selectedMessageActionAnchor.left}px`,
                                  width: `${selectedMessageActionAnchor.width}px`
                                }
                              : undefined
                          }
                        >
                        <div className="spm-chat-action-head">
                          <strong>Message actions</strong>
                          <button
                            type="button"
                            className="spm-chat-action-close"
                            onClick={() => {
                              if (!messageActionBusy) {
                                setSelectedMessageActionId(null);
                                setSelectedMessageDeleteForEveryoneAllowed(false);
                                setSelectedMessageActionAnchor(null);
                                setMessageActionError(null);
                              }
                            }}
                            aria-label="Close message actions"
                          >
                            <IconClose />
                          </button>
                        </div>

                        <div className="spm-chat-action-preview">
                          <span>{getMessageBody(selectedMessageAction, messagePlaintextById[selectedMessageAction.id])}</span>
                        </div>

                        {!selectedMessageActionIsDeleted && (
                          <div className="spm-chat-action-reactions">
                            {CHAT_REACTION_OPTIONS.map((emoji) => (
                              <button
                                key={`${selectedMessageAction.id}-${emoji}`}
                                type="button"
                                className="spm-chat-action-emoji"
                                onClick={() => {
                                  void handleReactToMessage(selectedMessageAction.id, emoji);
                                }}
                                disabled={messageActionBusy}
                                aria-label={`React with ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {messageActionError && (
                          <p className="spm-chat-action-error" role="alert">{messageActionError}</p>
                        )}

                        <div className="spm-chat-action-list">
                          {selectedMessageActionIsOwn && selectedMessageDeleteForEveryoneAllowed && (
                            <button
                              type="button"
                              className="spm-chat-action-button spm-chat-action-button-danger"
                              onClick={() => {
                                void handleDeleteMessage("everyone");
                              }}
                              disabled={messageActionBusy}
                            >
                              <IconTrash />
                              Delete for everyone
                            </button>
                          )}

                          <button
                            type="button"
                            className="spm-chat-action-button spm-chat-action-button-danger"
                            onClick={() => {
                              void handleDeleteMessage("self");
                            }}
                            disabled={messageActionBusy}
                          >
                            <IconTrash />
                            {selectedMessageActionIsOwn ? "Delete for you" : "Delete from your side"}
                          </button>

                          {!selectedMessageActionIsDeleted && (
                            <button
                              type="button"
                              className="spm-chat-action-button"
                              onClick={() => handleReplyToMessage(selectedMessageAction.id)}
                              disabled={messageActionBusy}
                            >
                              <IconReply />
                              Reply
                            </button>
                          )}
                        </div>

                        {selectedMessageActionIsOwn && !selectedMessageActionIsDeleted && !selectedMessageDeleteForEveryoneAllowed && (
                          <p className="spm-chat-action-note">
                            Delete for everyone is available only for 30 minutes after sending.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="spm-chat-composer">
                    {sessionExpired && realtimeState !== "live" && (
                      <p className="spm-chat-compose-error" role="alert">
                        Your session expired on this browser. Sign in again to reload chat history and realtime updates.
                      </p>
                    )}

                    {showDecryptionWarning && activeConversationId && (
                      <div className="spm-chat-compose-note" role="alert">
                        <span>{decryptionWarning}</span>
                        <button
                          type="button"
                          className="spm-chat-compose-note-dismiss"
                          onClick={() => {
                            const next = { ...dismissedDecryptionWarningIds, [activeConversationId]: true } as Record<string, true>;
                            setDismissedDecryptionWarningIds(next);
                            if (typeof window !== "undefined") {
                              window.localStorage.setItem(
                                getDismissedDecryptionWarningStorageKey(viewerUserId),
                                JSON.stringify(next)
                              );
                            }
                          }}
                        >
                          Hide note
                        </button>
                      </div>
                    )}

                    {keySetupError && (
                      <p className="spm-chat-compose-error" role="alert">{keySetupError}</p>
                    )}

                    {sendError && (
                      <p className="spm-chat-compose-error" role="alert">{sendError}</p>
                    )}

                    {replyingToMessage && (
                      <div className="spm-chat-compose-reply">
                        <div className="spm-chat-compose-reply-copy">
                          <strong>Replying to {isOwnChatMessage(
                            replyingToMessage,
                            viewerUserId,
                            viewerMembershipId
                          ) ? "yourself" : `@${activePeer?.username ?? "friend"}`}</strong>
                          <span>{getReplyPreview(replyingToMessage, messagePlaintextById)}</span>
                        </div>
                        <button
                          type="button"
                          className="spm-chat-compose-reply-clear"
                          onClick={() => setReplyingToMessageId(null)}
                          aria-label="Cancel reply"
                        >
                          <IconClose />
                        </button>
                      </div>
                    )}

                    <form className="spm-chat-compose-form" onSubmit={handleSendMessage}>
                      <div className="spm-chat-compose-avatar" aria-hidden="true">
                        {getInitials(viewerName)}
                      </div>

                      <label className="spm-chat-compose-box">
                        <textarea
                          ref={composerRef}
                          value={draftMessage}
                          onChange={(event) => setDraftMessage(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              void handleSendMessage();
                            }
                          }}
                          rows={1}
                          placeholder={`Message ${activePeer?.displayName ?? "your friend"}...`}
                          aria-label="Type a message"
                        />
                      </label>

                      <button
                        type="submit"
                        className={`spm-chat-send${draftMessage.trim() ? " spm-chat-send-active" : ""}`}
                        disabled={!draftMessage.trim() || sending}
                        aria-label="Send message"
                      >
                        {sending || creatingChatIdentity ? <span className="spm-search-spinner" aria-hidden="true" /> : <IconSend />}
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      <CampusMobileNavigation navItems={navItems} />
    </main>
  );
}
