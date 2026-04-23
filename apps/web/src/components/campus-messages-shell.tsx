"use client";

import type {
  ChatConversationPreview,
  ChatConversationResponse,
  ChatIdentitySummary,
  ChatMessageRecord,
  UserSearchItem
} from "@vyb/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CHAT_IDENTITY_ALGORITHM,
  createStoredChatKeyMaterial,
  decryptChatText,
  encryptChatText,
  isE2eeCipherAlgorithm,
  isStoredChatKeyCompatible,
  loadStoredChatKeyMaterial,
  saveStoredChatKeyMaterial,
  syncStoredChatKeyIdentity,
  type StoredChatKeyMaterial
} from "../lib/chat-e2ee";

type ActiveConversation = ChatConversationResponse["conversation"];
type RealtimeState = "idle" | "offline" | "connecting" | "reconnecting" | "live";

function getMessageFallbackLabel(message: ChatMessageRecord) {
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

function getMessageBody(message: ChatMessageRecord, plaintextOverride?: string | null) {
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

function useUserSearch(query: string) {
  const [results, setResults] = useState<UserSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
        const response = await fetch(`/api/search-users?q=${encodeURIComponent(trimmed)}`);
        const data = await response.json().catch(() => ({ items: [] }));
        setResults(data?.items ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => {
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
  const [keySetupError, setKeySetupError] = useState<string | null>(null);
  const [messagePlaintextById, setMessagePlaintextById] = useState<Record<string, string>>({});
  const [creatingChatIdentity, setCreatingChatIdentity] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef(0);
  const chatIdentityPromiseRef = useRef<Promise<boolean> | null>(null);
  const migratingMessageIdsRef = useRef<Set<string>>(new Set());
  const messageIdsRef = useRef<Set<string>>(new Set(initialConversation?.messages.map((message) => message.id) ?? []));
  const activeConversationRef = useRef<ActiveConversation | null>(initialConversation);
  const hasChatIdentity = Boolean(viewerIdentity);

  const isSearching = query.trim().length > 0;
  const { results: searchResults, loading: searchLoading } = useUserSearch(query);

  useEffect(() => {
    setConversations(
      initialConversation ? upsertConversationItem(initialItems, buildConversationPreview(initialConversation)) : initialItems
    );
  }, [initialConversation, initialItems]);

  useEffect(() => {
    setViewerIdentity(initialViewerIdentity);
  }, [initialViewerIdentity]);

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
    setKeySetupError(
      "This device does not have the private key for your existing E2EE chats. Restore the original key on this device to read or send encrypted messages."
    );
  }, [viewerIdentity, viewerUserId]);

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
      const response = await fetch(`/api/chats/${encodeURIComponent(conversationId)}`);
      const data = await response.json().catch(() => null);

      if (requestRef.current !== requestId) {
        return;
      }

      if (!response.ok) {
        if (!preserveActiveConversation || !activeConversationRef.current || activeConversationRef.current.id !== conversationId) {
          setActiveConversation(null);
          setConversationError(data?.error?.message ?? "We could not load that chat right now.");
        }
        return;
      }

      const conversation = data?.conversation as ActiveConversation | undefined;
      if (!conversation) {
        if (!preserveActiveConversation || !activeConversationRef.current || activeConversationRef.current.id !== conversationId) {
          setActiveConversation(null);
          setConversationError("This chat is not available right now.");
        }
        return;
      }

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

      const message =
        "This device does not have the private key for your existing E2EE chats. Restore the original key on this device to continue.";
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

        const response = await fetch("/api/chats/keys", {
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

  const visibleConversations = useMemo(() => {
    if (isSearching) return [];
    return conversations;
  }, [conversations, isSearching]);

  const unreadCount = conversations.filter((item) => item.unreadCount > 0).length;

  const messageMap = useMemo(() => {
    return new Map((activeConversation?.messages ?? []).map((message) => [message.id, message]));
  }, [activeConversation]);

  useEffect(() => {
    messageIdsRef.current = new Set(activeConversation?.messages.map((message) => message.id) ?? []);
  }, [activeConversation]);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

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
      return;
    }

    let cancelled = false;
    const encryptedMessages = activeConversation.messages.filter(
      (message) => isE2eeCipherAlgorithm(message.cipherAlgorithm) && !messagePlaintextById[message.id]
    );

    if (encryptedMessages.length === 0) {
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
      const updates = Object.fromEntries(resolvedEntries);
      if (Object.keys(updates).length > 0) {
        setMessagePlaintextById((current) => ({ ...current, ...updates }));
        setKeySetupError(null);
      } else if (encryptedMessages.length > 0) {
        setKeySetupError("We could not decrypt some messages on this device.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversation, localChatKey, messagePlaintextById]);

  useEffect(() => {
    if (!activeConversation || !localChatKey || !activeConversation.peer.publicKey) {
      return;
    }

    const legacyMessages = activeConversation.messages.filter(
      (message) =>
        !isE2eeCipherAlgorithm(message.cipherAlgorithm) &&
        message.cipherText.trim() &&
        !migratingMessageIdsRef.current.has(message.id)
    );

    if (legacyMessages.length === 0) {
      return;
    }

    legacyMessages.forEach((message) => {
      migratingMessageIdsRef.current.add(message.id);
    });

    let cancelled = false;

    void (async () => {
      try {
        const updates = await Promise.all(
          legacyMessages.map(async (message) => ({
            messageId: message.id,
            ...(await encryptChatText(message.cipherText, localChatKey, activeConversation.peer.publicKey!))
          }))
        );

        const response = await fetch(`/api/chats/${encodeURIComponent(activeConversation.id)}/messages/encryption`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: updates })
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error?.message ?? "We could not upgrade this chat to end-to-end encryption.");
        }

        const migratedMessages = Array.isArray(data?.items) ? (data.items as ChatMessageRecord[]) : [];
        const migratedById = new Map(migratedMessages.map((message) => [message.id, message]));
        const plaintextUpdates = Object.fromEntries(legacyMessages.map((message) => [message.id, message.cipherText]));

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
        return;
      } finally {
        legacyMessages.forEach((message) => {
          migratingMessageIdsRef.current.delete(message.id);
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversation, localChatKey]);

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

    const timeoutId = setTimeout(() => {
      composerRef.current?.focus();
    }, 60);

    return () => clearTimeout(timeoutId);
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || hasChatIdentity || creatingChatIdentity) {
      return;
    }

    void ensureChatIdentity();
  }, [activeConversationId, creatingChatIdentity, hasChatIdentity]);

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
        const response = await fetch(`/api/chats/socket-token?conversationId=${encodeURIComponent(conversationId)}`, {
          cache: "no-store"
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || cancelled || typeof data?.wsUrl !== "string") {
          connectInFlight = false;
          scheduleReconnect();
          return;
        }

        socket = new WebSocket(data.wsUrl);

        socket.onopen = () => {
          connectInFlight = false;
          reconnectAttempt = 0;
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

            if (payload.type === "chat.sync") {
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
        const response = await fetch(`/api/chats/${encodeURIComponent(activeConversation.id)}/read`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messageId: latestIncomingMessage.id })
        });

        if (!response.ok || cancelled) {
          return;
        }

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

  async function handleStartChat(username: string) {
    if (startingChat) return;

    setStartingChat(username);
    setStartError(null);

    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientUsername: username })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
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

      const response = await fetch(`/api/chats/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messageKind: "text",
          ...encryptedPayload
        })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
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

      setTimeout(() => {
        composerRef.current?.focus();
      }, 0);
    } catch {
      setSendError("Network error. Please try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  const activePeer = activeConversation?.peer ?? null;
  const isE2eeReadyForActiveConversation = Boolean(activePeer?.publicKey && viewerIdentity && localChatKey && !keySetupError);
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

  const navLinks = (
    <div className="spm-nav-items">
      <Link href="/home" className="spm-nav-icon" title="Home"><IconHome /></Link>
      <button type="button" className="spm-nav-icon spm-nav-icon-active" title="Messages">
        <IconMessages />
        {unreadCount > 0 && <span className="spm-nav-badge">{unreadCount}</span>}
      </button>
      <Link href="/vibes" className="spm-nav-icon" title="Vibes"><IconVibes /></Link>
      <Link href="/market" className="spm-nav-icon" title="Market"><IconMarket /></Link>
    </div>
  );

  return (
    <main className="spm-page">
      <div className="spm-blob spm-blob-one" aria-hidden="true" />
      <div className="spm-blob spm-blob-two" aria-hidden="true" />
      <div className="spm-blob spm-blob-three" aria-hidden="true" />

      <div className={`spm-shell${activeConversationId ? " spm-shell-chat-open" : ""}`}>
        <nav className="spm-nav" aria-label="Global navigation">
          <div className="spm-nav-brand">
            <span className="spm-nav-logo">V</span>
          </div>
          {navLinks}
          <div className="spm-nav-viewer">
            <div className="spm-viewer-avatar" title={viewerName}>
              {getInitials(viewerName)}
            </div>
          </div>
        </nav>

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
                              <span>{item.label}</span>
                            </div>
                          );
                        }

                        const message = item.message;
                        const isOwnMessage =
                          message.senderMembershipId === viewerMembershipId ||
                          message.senderUserId === viewerUserId ||
                          (message.senderMembershipId !== activeConversation.peer.membershipId &&
                            message.senderUserId !== activeConversation.peer.userId);
                        const replyTarget = message.replyToMessageId ? messageMap.get(message.replyToMessageId) : null;
                        const reactionSummary = [...new Set(message.reactions.map((reaction) => reaction.emoji))].join(" ");

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

                            <div
                              className={`spm-chat-bubble${isOwnMessage ? " spm-chat-bubble-self" : ""}${message.messageKind === "system" ? " spm-chat-bubble-system" : ""}`}
                            >
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

                              <p className="spm-chat-message-text">{getMessageBody(message, messagePlaintextById[message.id])}</p>

                              <div className="spm-chat-message-meta">
                                {reactionSummary ? (
                                  <span className="spm-chat-reaction-pill">{reactionSummary}</span>
                                ) : null}
                                <span>{formatMessageTime(message.createdAt)}</span>
                              </div>
                            </div>

                            {isOwnMessage && (
                              <div className="spm-chat-mini-avatar spm-chat-mini-avatar-self" aria-hidden="true">
                                {getInitials(viewerName)}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="spm-chat-composer">
                    {keySetupError && (
                      <p className="spm-chat-compose-error" role="alert">{keySetupError}</p>
                    )}

                    {sendError && (
                      <p className="spm-chat-compose-error" role="alert">{sendError}</p>
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

      <nav className="spm-mobile-nav" aria-label="Mobile navigation">
        <Link href="/home" className="spm-mobile-nav-item" title="Home">
          <IconHome />
          <span>Home</span>
        </Link>
        <button type="button" className="spm-mobile-nav-item spm-mobile-nav-active" title="Messages">
          <span className="spm-mobile-nav-icon-wrap">
            <IconMessages />
            {unreadCount > 0 && <span className="spm-nav-badge">{unreadCount}</span>}
          </span>
          <span>Chats</span>
        </button>
        <Link href="/vibes" className="spm-mobile-nav-item" title="Vibes">
          <IconVibes />
          <span>Vibes</span>
        </Link>
        <Link href="/market" className="spm-mobile-nav-item" title="Market">
          <IconMarket />
          <span>Market</span>
        </Link>
        <Link href={`/u/${viewerUsername}`} className="spm-mobile-nav-item" title="Profile">
          <div className="spm-mobile-nav-avatar">{getInitials(viewerName)}</div>
          <span>You</span>
        </Link>
      </nav>
    </main>
  );
}
