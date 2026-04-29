"use client";

import type { ChatGameInviteCardPayload, ChatIdentitySummary, ChatMessageKind } from "@vyb/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { encryptChatText, isStoredChatKeyCompatible, loadStoredChatKeyMaterial } from "../lib/chat-e2ee";
import { CampusAvatarContent } from "./campus-avatar";

type ScribbleStatus = "LOBBY" | "CHOOSING" | "PLAYING" | "ROUND_END" | "FINISHED";
type ConnectionState = "idle" | "connecting" | "live" | "reconnecting" | "offline";
type RoomVisibility = "private" | "public";

type ScribbleSettings = {
  drawTime: 40 | 60 | 90;
  rounds: 3 | 5 | 10;
  maxPlayers: number;
  visibility: RoomVisibility;
  hintsEnabled: boolean;
};

type ScribbleDrawStep = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
};

type ScribblePlayer = {
  userId: string;
  membershipId: string;
  username: string;
  displayName: string;
  connected: boolean;
  score: number;
  correctThisTurn: boolean;
  warnings: number;
  isHost: boolean;
  isDrawer: boolean;
};

type ScribbleRoundScore = {
  membershipId: string;
  displayName: string;
  delta: number;
  totalScore: number;
  isDrawer: boolean;
};

type ScribbleRoundResult = {
  reason: string;
  word: string | null;
  scores: ScribbleRoundScore[];
};

type ScribbleWordChoice = {
  id: string;
  word: string;
  difficulty: "easy" | "medium" | "hard";
  multiplier: number;
};

type ScribbleChatItem = {
  id: string;
  kind: "guess" | "system" | "correct";
  membershipId: string | null;
  displayName: string;
  body: string;
  createdAt: string;
};

type ScribbleSnapshot = {
  roomId: string;
  displayName?: string;
  isSystemPublic?: boolean;
  status: ScribbleStatus;
  viewerMembershipId: string;
  hostMembershipId: string;
  currentDrawerMembershipId: string | null;
  round: number;
  turn: number;
  totalTurns: number;
  timerEndsAt: string | null;
  settings: ScribbleSettings;
  players: ScribblePlayer[];
  currentWord: string | null;
  revealedWord: string | null;
  wordChoices: ScribbleWordChoice[];
  hint: string | null;
  wordLengthHint?: string | null;
  hintLetters: number;
  drawing: ScribbleDrawStep[];
  likeCount: number;
  dislikeCount: number;
  viewerLiked: boolean;
  viewerDisliked: boolean;
  chat: ScribbleChatItem[];
  roundResult?: ScribbleRoundResult | null;
  viewerCorrectThisTurn: boolean;
  invitePath: string;
};

type ScribbleCatalogRoom = {
  roomId: string;
  displayName?: string;
  isSystemPublic?: boolean;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: ScribbleStatus;
  round: number;
  drawTime: number;
  rounds: number;
  hintsEnabled: boolean;
  drawerName: string | null;
};

type ScribbleSocketTokenResponse = {
  wsUrl: string;
  expiresAt: number;
  viewer: {
    userId: string;
    membershipId: string;
    username: string;
    displayName: string;
  };
};

type PendingSocketAction =
  | { type: "create"; settings: ScribbleSettings }
  | { type: "join"; roomId: string };

type ScribbleSocketMessage = {
  type: string;
  payload: Record<string, unknown>;
};

export type ScribbleInviteTarget = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  conversationId?: string | null;
  peerIdentity?: ChatIdentitySummary | null;
  source: "recent" | "suggested";
};

export type ScribbleCommunityTarget = {
  id: string;
  name: string;
  type: string;
  memberCount: number;
};

type ScribbleMultiplayerGameProps = {
  initialRoomCode?: string | null;
  backHref?: string;
  onExit?: () => void;
  initialViewerIdentity?: ChatIdentitySummary | null;
  inviteTargets?: ScribbleInviteTarget[];
  communityTargets?: ScribbleCommunityTarget[];
};

const DEFAULT_SETTINGS: ScribbleSettings = {
  drawTime: 60,
  rounds: 3,
  maxPlayers: 8,
  visibility: "private",
  hintsEnabled: true
};

const SYSTEM_PUBLIC_ROOM_NAME = "vyb-public";
const MAX_CLIENT_DRAWING_STEPS = 5000;
const MAX_QUEUED_SOCKET_MESSAGES = 40;
const SCRIBBLE_CLIENT_ID_STORAGE_KEY = "vyb-scribble-client-id";

const DRAW_COLORS = ["#111827", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#ec4899", "#f8fafc"];

function normalizeRoomCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/gu, "").slice(0, 12);
}

function normalizeClientId(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]/gu, "").slice(0, 80);
}

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getScribbleClientId() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const existing = normalizeClientId(window.sessionStorage.getItem(SCRIBBLE_CLIENT_ID_STORAGE_KEY) ?? "");
    if (existing.length >= 6) {
      return existing;
    }

    const next = normalizeClientId(createClientId());
    window.sessionStorage.setItem(SCRIBBLE_CLIENT_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return normalizeClientId(createClientId());
  }
}

function getCanvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.lineCap = "round";
  context.lineJoin = "round";
  return context;
}

function syncCanvasSize(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const nextWidth = Math.max(1, Math.floor(rect.width * ratio));
  const nextHeight = Math.max(1, Math.floor(rect.height * ratio));

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  const context = getCanvasContext(canvas);
  if (context) {
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  return rect;
}

function clearCanvas(canvas: HTMLCanvasElement) {
  const rect = syncCanvasSize(canvas);
  const context = getCanvasContext(canvas);
  if (!context) {
    return;
  }

  context.clearRect(0, 0, rect.width, rect.height);
}

function drawStep(canvas: HTMLCanvasElement, step: ScribbleDrawStep) {
  const rect = syncCanvasSize(canvas);
  const context = getCanvasContext(canvas);
  if (!context) {
    return;
  }

  context.strokeStyle = step.color;
  context.lineWidth = step.width;
  context.beginPath();
  context.moveTo(step.x1 * rect.width, step.y1 * rect.height);
  context.lineTo(step.x2 * rect.width, step.y2 * rect.height);
  context.stroke();
}

function renderDrawing(canvas: HTMLCanvasElement, steps: ScribbleDrawStep[]) {
  clearCanvas(canvas);
  for (const step of steps) {
    drawStep(canvas, step);
  }
}

function formatTimer(seconds: number) {
  return `${Math.max(0, seconds)}s`;
}

function buildBlankMask(value: string | null | undefined) {
  if (!value) {
    return "Waiting";
  }

  return [...value]
    .map((character) => {
      if (character === " ") {
        return "  ";
      }

      return /[a-z0-9]/iu.test(character) ? "_" : character;
    })
    .join(" ");
}

function buildWordLengths(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-z0-9]/giu, "").length)
    .filter((length) => length > 0)
    .join(" ");
}

function getStatusCopy(snapshot: ScribbleSnapshot | null, drawerName: string | null) {
  if (!snapshot) {
    return "Jump into a public room or start a fresh private one.";
  }

  if (snapshot.status === "LOBBY") {
    if (snapshot.isSystemPublic && snapshot.players.filter((player) => player.connected).length <= 1) {
      return "You are the only one here. You can invite your friends.";
    }

    if (snapshot.isSystemPublic) {
      return "vyb-public starts automatically.";
    }

    return "Lobby is waiting for the host to start.";
  }

  if (snapshot.status === "CHOOSING") {
    return drawerName ? `${drawerName} is choosing a word.` : "Choosing a word.";
  }

  if (snapshot.status === "PLAYING") {
    return drawerName ? `${drawerName} is drawing.` : "Round live.";
  }

  if (snapshot.status === "ROUND_END") {
    return snapshot.revealedWord ? `Word was ${snapshot.revealedWord}.` : "Round ended.";
  }

  return "Final rankings are ready.";
}

function buildRoomSummary(room: ScribbleCatalogRoom) {
  if (room.status === "LOBBY") {
    return `${room.playerCount}/${room.maxPlayers} players`;
  }

  if (room.status === "PLAYING" && room.drawerName) {
    return `${room.drawerName} is drawing`;
  }

  if (room.status === "CHOOSING" && room.drawerName) {
    return `${room.drawerName} is choosing`;
  }

  return room.status.toLowerCase();
}

function buildInviteDraft(inviteLink: string, roomName: string) {
  return `Join my Scribble room ${roomName} on Vyb.\n${inviteLink}`;
}

function buildInviteCardPayload(
  currentSnapshot: ScribbleSnapshot,
  hostDisplayName: string | null,
  inviteLink: string
): ChatGameInviteCardPayload {
  return {
    version: 1,
    type: "game_invite_card",
    gameSlug: "scribble",
    title: "Join my Scribble room",
    subtitle: "Draw. Guess. Repeat.",
    roomId: currentSnapshot.roomId,
    inviteUrl: inviteLink,
    hostName: hostDisplayName,
    statusLabel: currentSnapshot.settings.visibility === "public" ? "Public room" : "Private room"
  };
}

function buildResultDraft(snapshot: ScribbleSnapshot | null, players: ScribblePlayer[]) {
  if (!snapshot) {
    return "Just wrapped a Scribble match on Vyb.";
  }

  const ranking = players
    .slice(0, 3)
    .map((player, index) => `${index + 1}. ${player.displayName} - ${player.score}`)
    .join("\n");

  return `Scribble results for room ${snapshot.roomId}\n${ranking}`;
}

function uniqueInviteTargets(items: ScribbleInviteTarget[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.conversationId ? `conversation:${item.conversationId}` : `user:${item.userId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function ScribbleMultiplayerGame({
  initialRoomCode,
  backHref = "/hub",
  onExit,
  initialViewerIdentity = null,
  inviteTargets = [],
  communityTargets = []
}: ScribbleMultiplayerGameProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const connectPromiseRef = useRef<Promise<void> | null>(null);
  const snapshotRef = useRef<ScribbleSnapshot | null>(null);
  const scoreListRef = useRef<HTMLDivElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const roomIdRef = useRef<string | null>(initialRoomCode ? normalizeRoomCode(initialRoomCode) : null);
  const pendingActionRef = useRef<PendingSocketAction | null>(initialRoomCode ? { type: "join", roomId: normalizeRoomCode(initialRoomCode) } : null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(false);
  const queuedMessagesRef = useRef<ScribbleSocketMessage[]>([]);
  const drawBufferRef = useRef<ScribbleDrawStep[]>([]);
  const drawFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStateRef = useRef<{ pointerId: number; last: { x: number; y: number } } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTickSecondRef = useRef<number | null>(null);
  const previousStatusRef = useRef<ScribbleStatus | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [snapshot, setSnapshot] = useState<ScribbleSnapshot | null>(null);
  const [publicRooms, setPublicRooms] = useState<ScribbleCatalogRoom[]>([]);
  const [setupSettings, setSetupSettings] = useState<ScribbleSettings>(DEFAULT_SETTINGS);
  const [roomSettingsDraft, setRoomSettingsDraft] = useState<ScribbleSettings>(DEFAULT_SETTINGS);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(Boolean(initialRoomCode ? false : false));
  const [joinCode, setJoinCode] = useState(initialRoomCode ? normalizeRoomCode(initialRoomCode) : "");
  const [guessText, setGuessText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [drawColor, setDrawColor] = useState("#111827");
  const [drawWidth, setDrawWidth] = useState(5);
  const [eraserActive, setEraserActive] = useState(false);
  const [shareMode, setShareMode] = useState<"invite" | "results" | null>(null);
  const [shareQuery, setShareQuery] = useState("");
  const [shareBusyKey, setShareBusyKey] = useState<string | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);

  const viewer = snapshot?.players.find((player) => player.membershipId === snapshot.viewerMembershipId) ?? null;
  const drawer = snapshot?.players.find((player) => player.membershipId === snapshot.currentDrawerMembershipId) ?? null;
  const isHost = Boolean(snapshot && snapshot.viewerMembershipId === snapshot.hostMembershipId);
  const isDrawer = Boolean(snapshot && snapshot.viewerMembershipId === snapshot.currentDrawerMembershipId);
  const isSystemPublicRoom = Boolean(snapshot?.isSystemPublic);
  const connectedPlayerCount = snapshot?.players.filter((player) => player.connected).length ?? 0;
  const roomDisplayName = snapshot?.displayName || snapshot?.roomId || SYSTEM_PUBLIC_ROOM_NAME;
  const canvasWordLabel = snapshot?.status === "PLAYING" ? (isDrawer ? "Draw this" : "Guess this") : snapshot?.status === "CHOOSING" ? "Waiting" : snapshot?.status === "ROUND_END" ? "Word" : null;
  const canvasWordValue = snapshot?.status === "PLAYING"
    ? (isDrawer ? snapshot.currentWord ?? "Waiting" : snapshot.hint ?? buildBlankMask(snapshot.revealedWord))
    : snapshot?.status === "ROUND_END"
      ? snapshot.roundResult?.word ?? snapshot.revealedWord ?? "Waiting"
      : snapshot?.status === "CHOOSING"
        ? "Waiting"
        : null;
  const canvasWordLengths = snapshot?.status === "PLAYING" && !isDrawer
    ? snapshot.wordLengthHint || buildWordLengths(snapshot.revealedWord)
    : snapshot?.status === "ROUND_END" && snapshot.revealedWord
      ? buildWordLengths(snapshot.revealedWord)
      : "";
  const canDraw = Boolean(snapshot?.status === "PLAYING" && isDrawer);
  const canGuess = Boolean(snapshot?.status === "PLAYING" && !isDrawer && !snapshot.viewerCorrectThisTurn);
  const sortedPlayers = useMemo(
    () => [...(snapshot?.players ?? [])].sort((left, right) => right.score - left.score || left.displayName.localeCompare(right.displayName)),
    [snapshot?.players]
  );
  const winner = sortedPlayers[0] ?? null;
  const remainingSeconds = snapshot?.timerEndsAt ? Math.max(0, Math.ceil((new Date(snapshot.timerEndsAt).getTime() - now) / 1000)) : 0;
  const inviteLink =
    typeof window === "undefined" || !snapshot
      ? ""
      : `${window.location.origin}${snapshot.invitePath || `/join/scribble?code=${encodeURIComponent(snapshot.roomId)}`}`;
  const inviteDraft = snapshot ? buildInviteDraft(inviteLink, roomDisplayName) : "";
  const resultDraft = useMemo(() => buildResultDraft(snapshot, sortedPlayers), [snapshot, sortedPlayers]);
  const filteredInviteTargets = useMemo(() => {
    const query = shareQuery.trim().toLowerCase();
    return uniqueInviteTargets(inviteTargets).filter((target) => {
      if (!query) {
        return true;
      }

      return target.username.toLowerCase().includes(query) || target.displayName.toLowerCase().includes(query);
    });
  }, [inviteTargets, shareQuery]);

  useEffect(() => {
    snapshotRef.current = snapshot;
    if (snapshot?.roomId) {
      roomIdRef.current = snapshot.roomId;
      setRoomSettingsDraft(snapshot.settings);
    }
  }, [snapshot]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sortedPlayers.length) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (scoreListRef.current) {
        scoreListRef.current.scrollTop = 0;
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [sortedPlayers]);

  useEffect(() => {
    if (!snapshot?.chat.length) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (chatListRef.current) {
        chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [snapshot?.chat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      renderDrawing(canvas, snapshotRef.current?.drawing ?? []);
    });

    resizeObserver.observe(canvas);
    renderDrawing(canvas, snapshotRef.current?.drawing ?? []);

    return () => resizeObserver.disconnect();
  }, [snapshot?.roomId]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    const timer = setTimeout(() => {
      void connectSocket();
    }, 0);

    return () => {
      shouldReconnectRef.current = false;
      clearTimeout(timer);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (drawFlushTimerRef.current) {
        clearTimeout(drawFlushTimerRef.current);
      }
      socketRef.current?.close();
      audioContextRef.current?.close().catch(() => null);
    };
  }, []);

  useEffect(() => {
    if (!initialRoomCode) {
      return;
    }

    const code = normalizeRoomCode(initialRoomCode);
    if (!code) {
      return;
    }

    setJoinCode(code);
    roomIdRef.current = code;
    pendingActionRef.current = { type: "join", roomId: code };
  }, [initialRoomCode]);

  useEffect(() => {
    if (snapshot?.status === "FINISHED" && previousStatusRef.current !== "FINISHED") {
      setResultsOpen(true);
    }

    if (snapshot?.status !== "FINISHED") {
      setResultsOpen(false);
    }

    previousStatusRef.current = snapshot?.status ?? null;
  }, [snapshot?.status]);

  useEffect(() => {
    if (snapshot?.status !== "PLAYING" || remainingSeconds > 6 || remainingSeconds <= 0) {
      lastTickSecondRef.current = null;
      return;
    }

    if (lastTickSecondRef.current === remainingSeconds) {
      return;
    }

    lastTickSecondRef.current = remainingSeconds;
    playTickSound();
  }, [remainingSeconds, snapshot?.status]);

  function updateSetupSettings(next: Partial<ScribbleSettings>) {
    setSetupSettings((current) => ({ ...current, ...next }));
  }

  function updateRoomSettingsDraft(next: Partial<ScribbleSettings>) {
    setRoomSettingsDraft((current) => ({ ...current, ...next }));
  }

  function queueSocketMessage(message: ScribbleSocketMessage) {
    queuedMessagesRef.current = [...queuedMessagesRef.current, message].slice(-MAX_QUEUED_SOCKET_MESSAGES);
  }

  function flushQueuedSocketMessages() {
    const queuedMessages = queuedMessagesRef.current.splice(0, queuedMessagesRef.current.length);
    for (const message of queuedMessages) {
      sendSocketMessage(message);
    }
  }

  function sendSocketMessage(message: ScribbleSocketMessage, options: { queueIfOffline?: boolean } = {}) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      if (options.queueIfOffline) {
        queueSocketMessage(message);
        void connectSocket();
      }
      return false;
    }

    socket.send(JSON.stringify(message));
    return true;
  }

  function appendDrawingStepsToSnapshot(steps: ScribbleDrawStep[]) {
    const currentSnapshot = snapshotRef.current;
    if (!currentSnapshot || steps.length === 0) {
      return;
    }

    snapshotRef.current = {
      ...currentSnapshot,
      drawing: [...currentSnapshot.drawing, ...steps].slice(-MAX_CLIENT_DRAWING_STEPS)
    };
  }

  function resetSnapshotDrawing() {
    const currentSnapshot = snapshotRef.current;
    if (!currentSnapshot) {
      return;
    }

    snapshotRef.current = {
      ...currentSnapshot,
      drawing: []
    };
  }

  function scheduleReconnect() {
    if (!shouldReconnectRef.current || reconnectTimerRef.current) {
      return;
    }

    const activeSocket = socketRef.current;
    if (activeSocket && (activeSocket.readyState === WebSocket.OPEN || activeSocket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (connectPromiseRef.current) {
      return;
    }

    reconnectAttemptRef.current += 1;
    const delay = Math.min(8000, 750 * reconnectAttemptRef.current);
    setConnectionState("reconnecting");
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      void connectSocket();
    }, delay);
  }

  async function connectSocket() {
    const existingSocket = socketRef.current;
    if (existingSocket && (existingSocket.readyState === WebSocket.OPEN || existingSocket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (connectPromiseRef.current) {
      await connectPromiseRef.current;
      return;
    }

    connectPromiseRef.current = (async () => {
      try {
        setConnectionState((current) => (current === "reconnecting" ? "reconnecting" : "connecting"));

        const response = await fetch("/api/games/scribble/socket-token", {
          method: "GET",
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => null)) as ScribbleSocketTokenResponse | { error?: { message?: string } } | null;

        if (!response.ok || !payload || !("wsUrl" in payload)) {
          const message = payload && "error" in payload ? payload.error?.message : null;
          setConnectionState("offline");
          setError(message || "Could not open Scribble realtime.");
          return;
        }

        const staleSocket = socketRef.current;
        if (staleSocket && staleSocket.readyState === WebSocket.CLOSING) {
          return;
        }
        if (staleSocket && staleSocket.readyState === WebSocket.CLOSED) {
          staleSocket.onclose = null;
          staleSocket.onerror = null;
        }

        const socketUrl = new URL(payload.wsUrl);
        const clientId = getScribbleClientId();
        if (clientId) {
          socketUrl.searchParams.set("clientId", clientId);
        }

        const socket = new WebSocket(socketUrl.toString());
        socketRef.current = socket;

        socket.onopen = () => {
          if (socketRef.current !== socket) {
            socket.close();
            return;
          }
          reconnectAttemptRef.current = 0;
          setConnectionState("live");
          setError(null);
          sendSocketMessage({
            type: "scribble.catalog.subscribe",
            payload: {}
          });

          const action = pendingActionRef.current;
          if (action?.type === "create") {
            sendSocketMessage({
              type: "scribble.room.create",
              payload: {
                settings: action.settings
              }
            });
            pendingActionRef.current = null;
            flushQueuedSocketMessages();
            flushDrawBuffer();
            return;
          }

          const joinRoomId = action?.type === "join" ? action.roomId : roomIdRef.current;
          if (joinRoomId) {
            sendSocketMessage({
              type: "scribble.room.join",
              payload: {
                roomId: joinRoomId
              }
            });
            pendingActionRef.current = null;
          }

          flushQueuedSocketMessages();
          flushDrawBuffer();
        };

        socket.onmessage = (event) => {
          if (socketRef.current !== socket) {
            return;
          }

          let message: { type?: string; payload?: unknown } | null = null;
          try {
            message = JSON.parse(String(event.data));
          } catch {
            return;
          }

          if (message?.type === "scribble.state") {
            const incomingSnapshot = message.payload as ScribbleSnapshot;
            const currentSnapshot = snapshotRef.current;
            const nextSnapshot =
              currentSnapshot &&
              currentSnapshot.roomId === incomingSnapshot.roomId &&
              currentSnapshot.status === "PLAYING" &&
              incomingSnapshot.status === "PLAYING" &&
              currentSnapshot.drawing.length > incomingSnapshot.drawing.length
                ? {
                    ...incomingSnapshot,
                    drawing: currentSnapshot.drawing
                  }
                : incomingSnapshot;

            snapshotRef.current = nextSnapshot;
            setSnapshot(nextSnapshot);
            setShowCreateForm(false);
            setNotice(null);
            requestAnimationFrame(() => {
              const canvas = canvasRef.current;
              if (canvas) {
                renderDrawing(canvas, nextSnapshot.drawing ?? []);
              }
            });
            return;
          }

          if (message?.type === "scribble.catalog") {
            const rooms = ((message.payload as { rooms?: ScribbleCatalogRoom[] })?.rooms ?? []).filter(Boolean);
            setPublicRooms(rooms);
            return;
          }

          if (message?.type === "scribble.draw.step") {
            const payload = message.payload as { roomId?: string; steps?: ScribbleDrawStep[] };
            if (payload?.roomId && payload.roomId !== snapshotRef.current?.roomId) {
              return;
            }

            const steps = payload?.steps ?? [];
            appendDrawingStepsToSnapshot(steps);
            const canvas = canvasRef.current;
            if (canvas) {
              for (const step of steps) {
                drawStep(canvas, step);
              }
            }
            return;
          }

          if (message?.type === "scribble.canvas.clear") {
            resetSnapshotDrawing();
            const canvas = canvasRef.current;
            if (canvas) {
              clearCanvas(canvas);
            }
            return;
          }

          if (message?.type === "scribble.notice") {
            const nextNotice = (message.payload as { message?: string })?.message;
            setNotice(nextNotice || null);
            return;
          }

          if (message?.type === "scribble.error") {
            const nextError = (message.payload as { message?: string })?.message;
            setError(nextError || "Scribble realtime error.");
          }
        };

        socket.onclose = () => {
          if (socketRef.current === socket) {
            socketRef.current = null;
            scheduleReconnect();
          }
        };

        socket.onerror = () => {
          if (socketRef.current === socket) {
            setConnectionState("offline");
          }
        };
      } catch {
        setConnectionState("offline");
        setError("Could not open Scribble realtime.");
      } finally {
        connectPromiseRef.current = null;
      }
    })();

    await connectPromiseRef.current;
  }

  async function primeAudio() {
    if (typeof window === "undefined") {
      return;
    }

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume().catch(() => null);
    }
  }

  function playTickSound() {
    const audioContext = audioContextRef.current;
    if (!audioContext) {
      return;
    }

    const startedAt = audioContext.currentTime;
    const isTock = (lastTickSecondRef.current ?? 0) % 2 === 0;
    const clickDuration = 0.038;
    const sampleCount = Math.max(1, Math.floor(audioContext.sampleRate * clickDuration));
    const clickBuffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
    const clickData = clickBuffer.getChannelData(0);

    for (let index = 0; index < sampleCount; index += 1) {
      const ratio = index / sampleCount;
      const decay = Math.exp(-ratio * 18);
      clickData[index] = (Math.random() * 2 - 1) * decay;
    }

    const clickSource = audioContext.createBufferSource();
    const highPass = audioContext.createBiquadFilter();
    const clockBody = audioContext.createBiquadFilter();
    const clickGain = audioContext.createGain();

    clickSource.buffer = clickBuffer;
    highPass.type = "highpass";
    highPass.frequency.setValueAtTime(isTock ? 950 : 1250, startedAt);
    highPass.Q.setValueAtTime(0.55, startedAt);
    clockBody.type = "bandpass";
    clockBody.frequency.setValueAtTime(isTock ? 1850 : 2450, startedAt);
    clockBody.Q.setValueAtTime(isTock ? 5.5 : 7, startedAt);
    clickGain.gain.setValueAtTime(0.0001, startedAt);
    clickGain.gain.exponentialRampToValueAtTime(isTock ? 0.075 : 0.065, startedAt + 0.004);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.055);

    const knock = audioContext.createOscillator();
    const knockGain = audioContext.createGain();
    knock.type = "triangle";
    knock.frequency.setValueAtTime(isTock ? 520 : 680, startedAt);
    knock.frequency.exponentialRampToValueAtTime(isTock ? 430 : 560, startedAt + 0.035);
    knockGain.gain.setValueAtTime(0.0001, startedAt);
    knockGain.gain.exponentialRampToValueAtTime(isTock ? 0.03 : 0.022, startedAt + 0.006);
    knockGain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.075);

    clickSource.connect(highPass);
    highPass.connect(clockBody);
    clockBody.connect(clickGain);
    clickGain.connect(audioContext.destination);
    knock.connect(knockGain);
    knockGain.connect(audioContext.destination);

    clickSource.start(startedAt);
    clickSource.stop(startedAt + clickDuration);
    knock.start(startedAt);
    knock.stop(startedAt + 0.08);
  }

  async function createRoom() {
    await primeAudio();
    setError(null);
    setNotice(null);
    if (sendSocketMessage({ type: "scribble.room.create", payload: { settings: setupSettings } })) {
      return;
    }

    pendingActionRef.current = { type: "create", settings: setupSettings };
    void connectSocket();
  }

  async function joinRoom(codeOverride?: string) {
    await primeAudio();
    const roomId = normalizeRoomCode(codeOverride ?? joinCode);
    if (!roomId) {
      setError("Enter a room code first.");
      return;
    }

    setError(null);
    setNotice(null);
    roomIdRef.current = roomId;
    if (
      sendSocketMessage({
        type: "scribble.room.join",
        payload: { roomId }
      })
    ) {
      return;
    }

    pendingActionRef.current = { type: "join", roomId };
    void connectSocket();
  }

  function startGame() {
    void primeAudio();
    sendSocketMessage({
      type: "scribble.game.start",
      payload: {}
    }, {
      queueIfOffline: true
    });
  }

  function chooseWord(choiceId: string) {
    void primeAudio();
    sendSocketMessage({
      type: "scribble.word.choose",
      payload: { choiceId }
    }, {
      queueIfOffline: true
    });
  }

  function applyRoomSettings() {
    sendSocketMessage({
      type: "scribble.room.updateSettings",
      payload: {
        settings: roomSettingsDraft
      }
    }, {
      queueIfOffline: true
    });
    setNotice("Room settings updated.");
  }

  function submitGuess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = guessText.trim();
    if (!text) {
      return;
    }

    void primeAudio();
    sendSocketMessage({
      type: "scribble.chat.guess",
      payload: { text }
    }, {
      queueIfOffline: true
    });
    setGuessText("");
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(successMessage);
    } catch {
      setNotice(value);
    }
  }

  function clearBoard() {
    sendSocketMessage({
      type: "scribble.canvas.clear",
      payload: {}
    }, {
      queueIfOffline: true
    });
  }

  function reactToDrawing(tone: "like" | "dislike") {
    sendSocketMessage({
      type: tone === "like" ? "scribble.drawing.like" : "scribble.drawing.dislike",
      payload: {}
    }, {
      queueIfOffline: true
    });
  }

  function skipRound() {
    sendSocketMessage({
      type: "scribble.round.skip",
      payload: {}
    }, {
      queueIfOffline: true
    });
  }

  function flushDrawBuffer() {
    drawFlushTimerRef.current = null;
    const steps = drawBufferRef.current.splice(0, drawBufferRef.current.length);
    if (steps.length === 0) {
      return;
    }

    const sent = sendSocketMessage({
      type: "scribble.draw.step",
      payload: { steps }
    });
    if (!sent) {
      drawBufferRef.current.unshift(...steps);
      void connectSocket();
    }
  }

  function enqueueDrawStep(step: ScribbleDrawStep) {
    appendDrawingStepsToSnapshot([step]);
    drawBufferRef.current.push(step);
    if (drawFlushTimerRef.current) {
      return;
    }

    drawFlushTimerRef.current = setTimeout(flushDrawBuffer, 20);
  }

  function getPointerCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1)
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!canDraw) {
      return;
    }

    void primeAudio();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStateRef.current = {
      pointerId: event.pointerId,
      last: getPointerCanvasPoint(event)
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || pointerStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const next = getPointerCanvasPoint(event);
    const last = pointerStateRef.current.last;
    const step = {
      x1: last.x,
      y1: last.y,
      x2: next.x,
      y2: next.y,
      color: eraserActive ? "#f8fafc" : drawColor,
      width: eraserActive ? drawWidth + 6 : drawWidth
    };

    const canvas = canvasRef.current;
    if (canvas) {
      drawStep(canvas, step);
    }

    enqueueDrawStep(step);
    pointerStateRef.current.last = next;
  }

  function handlePointerEnd(event: PointerEvent<HTMLCanvasElement>) {
    if (pointerStateRef.current?.pointerId === event.pointerId) {
      pointerStateRef.current = null;
      flushDrawBuffer();
    }
  }

  function handleExit() {
    shouldReconnectRef.current = false;
    sendSocketMessage({
      type: "scribble.room.leave",
      payload: {}
    });
    socketRef.current?.close(1000, "left room");

    if (onExit) {
      onExit();
      return;
    }

    router.push(backHref);
  }

  async function sendEncryptedDirectMessage({
    conversationId,
    peerIdentity,
    plaintext,
    messageKind
  }: {
    conversationId: string;
    peerIdentity: ChatIdentitySummary;
    plaintext: string;
    messageKind: ChatMessageKind;
  }) {
    if (!initialViewerIdentity) {
      throw new Error("Secure chat is not ready on this account yet.");
    }

    const currentLocalKey = await loadStoredChatKeyMaterial(initialViewerIdentity.userId);
    if (!currentLocalKey) {
      throw new Error("This device is missing your private E2EE key.");
    }

    if (!isStoredChatKeyCompatible(currentLocalKey, initialViewerIdentity)) {
      throw new Error("Open Messages once on this device and restore your secure chat key first.");
    }

    const encryptedPayload = await encryptChatText(plaintext, currentLocalKey, peerIdentity);
    const response = await fetch(`/api/chats/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        messageKind,
        ...encryptedPayload
      })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "We could not send that message.");
    }
  }

  async function shareToTarget(target: ScribbleInviteTarget, draft: string) {
    const activeShareMode = shareMode;
    const currentSnapshot = snapshotRef.current;
    if (!activeShareMode || !currentSnapshot) {
      return;
    }

    setShareBusyKey(target.conversationId ?? target.userId);
    setError(null);

    try {
      let conversationId = target.conversationId ?? null;
      let peerIdentity = target.peerIdentity ?? null;

      if (!conversationId) {
        const response = await fetch("/api/chats", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            recipientUserId: target.userId,
            recipientUsername: target.username
          })
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              conversation?: {
                id?: string;
                peer?: {
                  publicKey?: ChatIdentitySummary | null;
                };
              };
              error?: {
                message?: string;
              };
            }
          | null;

        if (!response.ok || !payload?.conversation?.id) {
          setError(payload?.error?.message ?? "We could not open that chat right now.");
          return;
        }

        conversationId = payload.conversation.id ?? null;
        peerIdentity = payload.conversation.peer?.publicKey ?? null;
      }

      if (!conversationId) {
        setError("We could not prepare that chat right now.");
        return;
      }

      if (!peerIdentity) {
        const response = await fetch(`/api/chats/${encodeURIComponent(conversationId)}`, {
          method: "GET",
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              conversation?: {
                peer?: {
                  publicKey?: ChatIdentitySummary | null;
                };
              };
              error?: {
                message?: string;
              };
            }
          | null;

        if (!response.ok) {
          setError(payload?.error?.message ?? "We could not prepare secure chat for that person.");
          return;
        }

        peerIdentity = payload?.conversation?.peer?.publicKey ?? null;
      }

      if (!peerIdentity) {
        setError("That person has not finished secure chat setup yet.");
        return;
      }

      const plaintext =
        activeShareMode === "invite"
          ? JSON.stringify({
              ...buildInviteCardPayload(currentSnapshot, viewer?.displayName ?? null, inviteLink),
              caption: null
            })
          : draft;
      const messageKind: ChatMessageKind = activeShareMode === "invite" ? "game_invite_card" : "text";

      await sendEncryptedDirectMessage({
        conversationId,
        peerIdentity,
        plaintext,
        messageKind
      });

      setShareMode(null);
      setShareQuery("");
      setNotice(activeShareMode === "invite" ? `Invite sent to ${target.displayName}.` : `Results sent to ${target.displayName}.`);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Network issue while sending that message.");
    } finally {
      setShareBusyKey(null);
    }
  }

  function openPostComposer(draft: string, community?: ScribbleCommunityTarget) {
    const nextDraft = community ? `${draft}\n\nSharing with ${community.name}.` : draft;
    const params = new URLSearchParams({
      kind: "post",
      from: snapshot?.roomId ? `/hub/gameshub/scribble?code=${encodeURIComponent(snapshot.roomId)}` : "/hub/gameshub/scribble",
      draft: nextDraft
    });
    setShareMode(null);
    router.push(`/create?${params.toString()}`);
  }

  if (!snapshot) {
    return (
      <section className="vyb-scribble-shell" style={{ position: "absolute", inset: 0, zIndex: 20, background: "var(--spm-bg)", display: "flex", flexDirection: "column", padding: "1.5rem", overflowY: "auto" }}>
        <div className="vyb-scribble-topbar" style={{ marginBottom: "1.5rem" }}>
          <button type="button" className="vyb-scribble-icon-button" onClick={handleExit} aria-label="Back">
            <span aria-hidden="true">←</span>
          </button>
          <div>
            <span className="vyb-scribble-kicker">Scribble Multiplayer</span>
            <h2>Draw. Guess. Repeat.</h2>
          </div>
          <span className={`vyb-scribble-live-dot is-${connectionState}`}>{connectionState}</span>
        </div>

        {notice ? <p className="vyb-scribble-notice" style={{ marginBottom: "1rem" }}>{notice}</p> : null}
        {error ? <p className="vyb-scribble-error" style={{ marginBottom: "1rem" }}>{error}</p> : null}

        <section style={{ marginBottom: "1rem" }}>
          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.09em", color: "#94a3b8" }}>Public Rooms</span>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: publicRooms.length > 0 ? "#10b981" : "#64748b" }}>
              {publicRooms.length > 0 ? `${publicRooms.length} live` : "No live rooms"}
            </span>
          </div>

          {publicRooms.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {publicRooms.map((room) => {
                const roomName = room.displayName || room.roomId;
                const isFull = room.playerCount >= room.maxPlayers;
                return (
                <div
                  key={room.roomId}
                  style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 1.1rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1rem", transition: "border-color 0.2s" }}
                >
                  {/* Left: room info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Room name + owner */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "1rem", fontWeight: 900, color: "#fff", letterSpacing: "0.06em" }}>{roomName}</span>
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {room.isSystemPublic ? "College public room" : room.hostName}
                      </span>
                    </div>
                    {/* Player count badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "999px", padding: "0.22rem 0.6rem", fontSize: "0.75rem", fontWeight: 800, color: "#34d399" }}>
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        {buildRoomSummary(room)}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{room.drawTime}s · {room.rounds} rounds · {room.hintsEnabled ? "Hints on" : "Hints off"}</span>
                    </div>
                  </div>

                  {/* Right: Join button */}
                  <button
                    type="button"
                    onClick={() => void joinRoom(room.roomId)}
                    disabled={isFull || connectionState === "connecting"}
                    style={{ flexShrink: 0, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: "0.65rem", padding: "0.6rem 1.2rem", fontSize: "0.85rem", fontWeight: 800, cursor: isFull ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: "0.05em", boxShadow: "0 4px 12px rgba(99,102,241,0.35)", transition: "all 0.2s", opacity: isFull ? 0.58 : 1 }}
                  >
                    {isFull ? "Full" : "Join"}
                  </button>
                </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", background: "rgba(255,255,255,0.02)", borderRadius: "1rem", border: "1px dashed rgba(255,255,255,0.08)", textAlign: "center", gap: "0.4rem" }}>
              <span style={{ fontSize: "1.75rem" }}>👻</span>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem", fontWeight: 700 }}>No public rooms live right now.</p>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.78rem" }}>Launch one below and invite your squad.</p>
            </div>
          )}
        </section>

        <div className="vyb-scribble-launch-grid">
          <section className="vyb-scribble-panel">
            <div className="vyb-scribble-panel-head">
              <span>Join room</span>
              <strong>Invite code</strong>
            </div>

            <div className="vyb-scribble-join-box" style={{ display: "flex", gap: "0.5rem" }}>
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(normalizeRoomCode(event.target.value))}
                placeholder="8B2X9"
                aria-label="Scribble room code"
                style={{ flex: 1 }}
              />
              <button type="button" className="vyb-scribble-primary-button" onClick={() => void joinRoom()} disabled={connectionState === "connecting"}>
                JOIN ROOM
              </button>
            </div>
          </section>

          <section className="vyb-scribble-panel">
            <div className="vyb-scribble-panel-head">
              <span>Create room</span>
              <strong>Private or public</strong>
            </div>

            <button type="button" className="vyb-scribble-primary-button" onClick={() => void createRoom()} disabled={connectionState === "connecting"}>
              Launch Scribble Room
            </button>
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className="vyb-scribble-shell" style={{ position: "absolute", inset: 0, zIndex: 20, background: "var(--spm-bg)", display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden" }}>
      <div className="vyb-scribble-topbar">
        <button type="button" className="vyb-scribble-icon-button" onClick={handleExit} aria-label="Back">
          <span aria-hidden="true">←</span>
        </button>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          {canvasWordLabel && canvasWordValue ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.1rem" }}>{canvasWordLabel}</span>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.2rem" }}>
                <strong style={{ fontSize: "1.2rem", color: "#fff", letterSpacing: "0.05em", lineHeight: 1 }}>{canvasWordValue}</strong>
                {canvasWordLengths ? <sup style={{ fontSize: "0.65rem", color: "#34d399", fontWeight: 900 }}>{canvasWordLengths}</sup> : null}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <span className="vyb-scribble-kicker">Room {roomDisplayName}</span>
              <h2>Scribble</h2>
            </div>
          )}
        </div>
        <button type="button" className="vyb-scribble-code-button" onClick={() => setShareMode("invite")}>
          Invite
        </button>
      </div>



      {notice ? <p className="vyb-scribble-notice">{notice}</p> : null}
      {error ? <p className="vyb-scribble-error">{error}</p> : null}

      {snapshot.status === "LOBBY" ? (
        <section className="vyb-scribble-lobby">
          <div className="vyb-scribble-panel">
            <div className="vyb-scribble-panel-head">
              <span>Players</span>
              <strong>
                {isSystemPublicRoom ? connectedPlayerCount : snapshot.players.length}/{snapshot.settings.maxPlayers}
              </strong>
            </div>
            <div className="vyb-scribble-player-grid">
              {snapshot.players.map((player) => (
                <div key={player.membershipId} className={`vyb-scribble-player-chip${player.connected ? "" : " is-offline"}`}>
                  <span className="vyb-scribble-avatar">
                    <CampusAvatarContent userId={player.userId} username={player.username} displayName={player.displayName} />
                  </span>
                  <span>{player.displayName}</span>
                  {player.isHost ? <small>Host</small> : null}
                </div>
              ))}
            </div>
            {isSystemPublicRoom ? (
              connectedPlayerCount <= 1 ? (
                <div className="vyb-scribble-solo-callout">
                  <p>You are the only one here. You can invite your friends.</p>
                  <button type="button" className="vyb-scribble-primary-button" onClick={() => setShareMode("invite")}>
                    Invite
                  </button>
                </div>
              ) : (
                <p className="vyb-scribble-muted">System is starting the next vyb-public round.</p>
              )
            ) : isHost ? (
              <button type="button" className="vyb-scribble-primary-button" onClick={startGame}>
                Start game
              </button>
            ) : (
              <p className="vyb-scribble-muted">Waiting for host to start.</p>
            )}
          </div>

          {isHost && !isSystemPublicRoom ? (
            <div className="vyb-scribble-panel">
              <div className="vyb-scribble-panel-head">
                <span>Host controls</span>
                <strong>{snapshot.settings.visibility === "public" ? "Visible to everyone" : "Invite only"}</strong>
              </div>

              <div className="vyb-scribble-settings-grid">
                <label>
                  <span>Draw time</span>
                  <select
                    value={roomSettingsDraft.drawTime}
                    onChange={(event) => updateRoomSettingsDraft({ drawTime: Number(event.target.value) as ScribbleSettings["drawTime"] })}
                  >
                    <option value={40}>40s</option>
                    <option value={60}>60s</option>
                    <option value={90}>90s</option>
                  </select>
                </label>
                <label>
                  <span>Rounds</span>
                  <select
                    value={roomSettingsDraft.rounds}
                    onChange={(event) => updateRoomSettingsDraft({ rounds: Number(event.target.value) as ScribbleSettings["rounds"] })}
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                  </select>
                </label>
                <label>
                  <span>Max players</span>
                  <input
                    type="number"
                    min={2}
                    max={12}
                    value={roomSettingsDraft.maxPlayers}
                    onChange={(event) => updateRoomSettingsDraft({ maxPlayers: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span>Room type</span>
                  <select
                    value={roomSettingsDraft.visibility}
                    onChange={(event) => updateRoomSettingsDraft({ visibility: event.target.value as RoomVisibility })}
                  >
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </label>
              </div>

              <label className="vyb-scribble-switch">
                <input
                  type="checkbox"
                  checked={roomSettingsDraft.hintsEnabled}
                  onChange={(event) => updateRoomSettingsDraft({ hintsEnabled: event.target.checked })}
                />
                <span>Hints enabled</span>
              </label>

              <button type="button" className="vyb-scribble-secondary-button" onClick={applyRoomSettings}>
                Apply settings
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="vyb-scribble-game-grid">
          <aside className="vyb-scribble-side-column is-left">
            <section className="vyb-scribble-panel vyb-scribble-side-panel vyb-scribble-score-panel">
              <div className="vyb-scribble-panel-head">
                <span>Scoreboard</span>
                <strong>{connectedPlayerCount} live</strong>
              </div>
              <div ref={scoreListRef} className="vyb-scribble-score-list">
                {sortedPlayers.map((player) => {
                    const isYou = player.membershipId === viewer?.membershipId;
                    const hasGuessed = player.correctThisTurn && snapshot.status === "PLAYING";
                    const isDrawing = player.membershipId === snapshot.currentDrawerMembershipId;

                    return (
                      <div key={player.membershipId} className={`vyb-scribble-score-row${isYou ? " is-you" : ""}${hasGuessed ? " has-guessed" : ""}${isDrawing ? " is-drawing" : ""}`}>
                        <strong>{player.displayName}</strong>
                        <small>{isDrawing ? "Drawing" : hasGuessed ? "Guessed" : ""}</small>
                        <b>{player.score}</b>
                      </div>
                    );
                  })}
              </div>
            </section>
          </aside>

          <section className="vyb-scribble-board-column">
            <div className="vyb-scribble-canvas-frame" style={{ position: "relative" }}>
              {/* Overlay timer inside canvas top-left */}
              <div style={{ position: "absolute", top: "0.6rem", left: "0.6rem", pointerEvents: "none", zIndex: 10 }}>
                <div style={{ background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(6px)", color: "#fff", padding: "0.3rem 0.6rem", borderRadius: "0.5rem", fontSize: "0.85rem", fontWeight: 800, border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: "0.35rem", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  {snapshot.status === "PLAYING" ? formatTimer(remainingSeconds) : snapshot.status === "CHOOSING" ? "Wait" : "--"}
                </div>
              </div>



              <canvas
                ref={canvasRef}
                className="vyb-scribble-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                aria-label="Scribble drawing canvas"
              />

              {/* Tools 3-dot button & menu at bottom-right */}
              {!isDrawer && snapshot.status === "PLAYING" ? (
                <div style={{ position: "absolute", bottom: "0.6rem", right: "0.6rem", zIndex: 15, display: "flex", gap: "0.4rem" }}>
                  <button type="button" onClick={() => reactToDrawing("like")} disabled={snapshot.status !== "PLAYING"} className={`vyb-scribble-icon-button ${snapshot.viewerLiked ? "is-active" : ""}`} style={{ width: "2.5rem", height: "2.5rem", borderRadius: "50%", background: snapshot.viewerLiked ? "#10b981" : "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", position: "relative" }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                    {snapshot.likeCount > 0 && <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "#ef4444", fontSize: "0.6rem", padding: "0.1rem 0.3rem", borderRadius: "999px", fontWeight: 800 }}>{snapshot.likeCount}</span>}
                  </button>
                  <button type="button" onClick={() => reactToDrawing("dislike")} disabled={snapshot.status !== "PLAYING"} className={`vyb-scribble-icon-button ${snapshot.viewerDisliked ? "is-active" : ""}`} style={{ width: "2.5rem", height: "2.5rem", borderRadius: "50%", background: snapshot.viewerDisliked ? "#ef4444" : "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", position: "relative" }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                    {snapshot.dislikeCount > 0 && <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "#f59e0b", fontSize: "0.6rem", padding: "0.1rem 0.3rem", borderRadius: "999px", fontWeight: 800 }}>{snapshot.dislikeCount}</span>}
                  </button>
                </div>
              ) : null}

              {isDrawer && snapshot.status === "PLAYING" ? (
                <div style={{ position: "absolute", bottom: "0.6rem", right: "0.6rem", zIndex: 15, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                  {showToolsMenu ? (
                    <div style={{ background: "rgba(15, 23, 42, 0.9)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "1rem", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem", boxShadow: "0 4px 16px rgba(0,0,0,0.4)", width: "200px" }}>
                      <div className="vyb-scribble-swatches" aria-label="Drawing colors" style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", justifyContent: "center" }}>
                        {DRAW_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={drawColor === color && !eraserActive ? "is-active" : ""}
                            style={{ backgroundColor: color, width: "1.5rem", height: "1.5rem", borderRadius: "50%", border: drawColor === color && !eraserActive ? "2px solid #fff" : "2px solid transparent", cursor: "pointer", transition: "transform 0.1s" }}
                            onClick={() => {
                              setDrawColor(color);
                              setEraserActive(false);
                            }}
                            aria-label={`Use ${color}`}
                          />
                        ))}
                      </div>
                      
                      <label className="vyb-scribble-width-control" style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#94a3b8", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase" }}>
                        <span style={{ width: "45px" }}>Stroke</span>
                        <input type="range" min={2} max={18} value={drawWidth} onChange={(event) => setDrawWidth(Number(event.target.value))} style={{ flex: 1, accentColor: "#6366f1" }} />
                      </label>

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button type="button" className={`vyb-scribble-tool-button${eraserActive ? " is-active" : ""}`} onClick={() => setEraserActive((current) => !current)} style={{ flex: 1, background: eraserActive ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)", border: "none", color: "#fff", padding: "0.4rem", borderRadius: "0.5rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
                          Erase
                        </button>
                        <button type="button" className="vyb-scribble-tool-button" onClick={clearBoard} style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", padding: "0.4rem", borderRadius: "0.5rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
                          Clear
                        </button>
                      </div>
                      <button type="button" className="vyb-scribble-tool-button" onClick={skipRound} style={{ width: "100%", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "none", padding: "0.4rem", borderRadius: "0.5rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
                        Skip
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowToolsMenu(!showToolsMenu)}
                    style={{ width: "2.5rem", height: "2.5rem", borderRadius: "50%", background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                  </button>
                </div>
              ) : null}

              {snapshot.status === "CHOOSING" || snapshot.status === "ROUND_END" || snapshot.status === "FINISHED" ? (
                <div className="vyb-scribble-canvas-overlay" style={{ background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(2px)", zIndex: 5 }}>
                  {snapshot.status === "CHOOSING" ? (
                    <div className="vyb-scribble-center-stack">
                      <span className="vyb-scribble-center-kicker">Round {snapshot.round}</span>
                      {isDrawer ? (
                        <>
                          <strong className="vyb-scribble-center-title">Choose a word</strong>
                          <div className="vyb-scribble-word-choices" style={{ display: "flex", gap: "0.6rem", justifyContent: "center", alignItems: "center" }}>
                            {snapshot.wordChoices.map((choice) => (
                              <button key={choice.id} type="button" onClick={() => chooseWord(choice.id)} style={{ padding: "0.7rem 1rem", borderRadius: "0.5rem", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", transition: "transform 0.1s, background 0.1s" }}>
                                <span style={{ fontSize: "0.65rem", color: "#e2e8f0", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 800, background: "rgba(0,0,0,0.2)", padding: "0.1rem 0.5rem", borderRadius: "999px", marginBottom: "0.3rem" }}>{choice.difficulty}</span>
                                <strong style={{ fontSize: "1rem", margin: "0", letterSpacing: "0.02em" }}>{choice.word}</strong>
                                <small style={{ color: "#34d399", fontWeight: 800, fontSize: "0.65rem", marginTop: "0.2rem" }}>x{choice.multiplier}</small>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <strong className="vyb-scribble-center-title">{drawer?.displayName ?? "Someone"} is choosing a word</strong>
                          <span className="vyb-scribble-center-subtitle">Waiting</span>
                        </>
                      )}
                    </div>
                  ) : snapshot.status === "ROUND_END" ? (
                    <div className="vyb-scribble-center-stack">
                      <span className="vyb-scribble-center-kicker">Round {snapshot.round}</span>
                      <strong className="vyb-scribble-center-title">The word was {snapshot.roundResult?.word ?? snapshot.revealedWord ?? "hidden"}</strong>
                      <span className="vyb-scribble-center-subtitle">{snapshot.roundResult?.reason ?? "Round ended."}</span>
                      <div className="vyb-scribble-round-result-list">
                        {(snapshot.roundResult?.scores ?? []).map((item) => (
                          <div key={item.membershipId} className="vyb-scribble-round-result-row">
                            <span>{item.displayName}</span>
                            <strong>{item.delta > 0 ? `+${item.delta}` : "0"}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="vyb-scribble-center-stack">
                      <span className="vyb-scribble-center-kicker">Game</span>
                      <strong className="vyb-scribble-center-title">Final scores are ready</strong>
                    </div>
                  )}
                </div>
              ) : null}
            </div>


          </section>

          <aside className="vyb-scribble-side-column is-right">
            <section className="vyb-scribble-panel vyb-scribble-side-panel vyb-scribble-chat-panel">
              <div className="vyb-scribble-panel-head">
                <span>Guesses</span>
                <strong>{canGuess ? "Your turn" : "Live"}</strong>
              </div>
              <div ref={chatListRef} className="vyb-scribble-chat-list">
                {snapshot.chat.map((item) => (
                  <div key={item.id} className={`vyb-scribble-chat-item is-${item.kind}`}>
                    <span>{item.displayName}</span>
                    <p>{item.body}</p>
                  </div>
                ))}
              </div>
              <form className="vyb-scribble-guess-form" onSubmit={submitGuess}>
                <input
                  value={guessText}
                  onChange={(event) => setGuessText(event.target.value)}
                  placeholder={canGuess ? "Type your guess" : isDrawer ? "Drawer cannot guess" : "Guess locked"}
                  disabled={!canGuess}
                  maxLength={80}
                />
                <button type="submit" disabled={!canGuess || !guessText.trim()}>
                  Send
                </button>
              </form>
            </section>
          </aside>
        </div>
      )}

      {shareMode ? (
        <div
          className="vyb-scribble-sheet-backdrop"
          role="presentation"
          onClick={() => (shareBusyKey ? null : setShareMode(null))}
          style={{ alignItems: "flex-end", padding: 0 }}
        >
          <div
            className="vyb-scribble-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={shareMode === "invite" ? "Share invite" : "Share results"}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "100%",
              borderRadius: "1.25rem 1.25rem 0 0",
              padding: "0",
              background: "#12142a",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "0.75rem 0 0" }}>
              <div style={{ width: "2.5rem", height: "0.25rem", borderRadius: "999px", background: "rgba(255,255,255,0.2)" }} />
            </div>

            {/* Header */}
            <div style={{ padding: "1rem 1.25rem 0.75rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#fff" }}>
                {shareMode === "invite" ? "Invite people" : "Share results"}
              </h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#94a3b8" }}>
                {shareMode === "invite" ? `Room: ${roomDisplayName}` : winner ? `${winner.displayName} leads` : "Game over"}
              </p>
            </div>

            {/* Top actions row — Copy Link only (no Story) */}
            <div style={{ display: "flex", gap: "1.25rem", padding: "0.75rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <button
                type="button"
                onClick={() => void copyText(inviteLink, "Invite link copied.")}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.45rem", background: "none", border: "none", cursor: "pointer", color: "#fff" }}
              >
                <div style={{ width: "2.75rem", height: "2.75rem", borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", display: "grid", placeItems: "center" }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </div>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>COPY</span>
              </button>
              {shareMode === "invite" ? (
                <button
                  type="button"
                  onClick={() => openPostComposer(inviteDraft)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.45rem", background: "none", border: "none", cursor: "pointer", color: "#fff" }}
                >
                  <div style={{ width: "2.75rem", height: "2.75rem", borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", display: "grid", placeItems: "center" }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  </div>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>SHARE</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void copyText(resultDraft, "Results copied.")}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.45rem", background: "none", border: "none", cursor: "pointer", color: "#fff" }}
                >
                  <div style={{ width: "2.75rem", height: "2.75rem", borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", display: "grid", placeItems: "center" }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </div>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>COPY</span>
                </button>
              )}
            </div>

            {/* Divider label */}
            <div style={{ padding: "0.75rem 1.25rem 0.5rem", fontSize: "0.72rem", color: "#94a3b8", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              OR SEND TO A FRIEND
            </div>

            {/* Search bar */}
            <div style={{ padding: "0 1.25rem 0.75rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.65rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "999px", padding: "0.65rem 1rem" }}>
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  value={shareQuery}
                  onChange={(event) => setShareQuery(event.target.value)}
                  placeholder="Search name or username..."
                  aria-label="Search friends"
                  style={{ background: "none", border: "none", outline: "none", color: "#fff", fontSize: "0.9rem", flex: 1, fontWeight: 500 }}
                />
              </label>
            </div>

            {/* People label */}
            <div style={{ padding: "0 1.25rem 0.5rem", fontSize: "0.72rem", color: "#94a3b8", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              PEOPLE
            </div>

            {/* People list */}
            <div style={{ overflowY: "auto", flex: 1, padding: "0 0 1rem" }}>
              {filteredInviteTargets.map((target) => {
                const busyKey = target.conversationId ?? target.userId;
                return (
                  <div
                    key={`${target.source}:${busyKey}`}
                    style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.85rem 1.25rem" }}
                  >
                    <span className="vyb-scribble-avatar" style={{ width: "2.6rem", height: "2.6rem", flexShrink: 0 }}>
                      <CampusAvatarContent
                        userId={target.userId}
                        username={target.username}
                        displayName={target.displayName}
                        avatarUrl={target.avatarUrl ?? null}
                      />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: "0.92rem", fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.02em" }}>{target.displayName}</strong>
                      <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>@{target.username}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void shareToTarget(target, shareMode === "invite" ? inviteDraft : resultDraft)}
                      disabled={Boolean(shareBusyKey)}
                      style={{ background: "#5b4bfc", color: "#fff", border: "none", borderRadius: "999px", padding: "0.5rem 1.15rem", fontSize: "0.82rem", fontWeight: 800, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em", opacity: shareBusyKey === busyKey ? 0.6 : 1, transition: "opacity 0.15s" }}
                    >
                      {shareBusyKey === busyKey ? "..." : shareMode === "invite" ? "INVITE" : "SEND"}
                    </button>
                  </div>
                );
              })}
              {filteredInviteTargets.length === 0 ? (
                <p style={{ margin: "1rem 1.25rem", color: "#94a3b8", fontSize: "0.85rem" }}>No matching friends found.</p>
              ) : null}

              {communityTargets.length > 0 ? (
                <>
                  <div style={{ padding: "0.5rem 1.25rem", fontSize: "0.72rem", color: "#94a3b8", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    COMMUNITIES
                  </div>
                  {communityTargets.map((community) => (
                    <div key={community.id} style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.85rem 1.25rem" }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ display: "block", fontSize: "0.92rem", fontWeight: 800, color: "#fff" }}>{community.name}</strong>
                        <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{community.type} · {community.memberCount} members</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openPostComposer(shareMode === "invite" ? inviteDraft : resultDraft, community)}
                        style={{ background: "#5b4bfc", color: "#fff", border: "none", borderRadius: "999px", padding: "0.5rem 1.15rem", fontSize: "0.82rem", fontWeight: 800, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em" }}
                      >
                        {shareMode === "invite" ? "INVITE" : "SEND"}
                      </button>
                    </div>
                  ))}
                </>
              ) : null}

              {error ? <p style={{ margin: "0 1.25rem", color: "#fecaca", fontSize: "0.82rem" }}>{error}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {resultsOpen ? (
        <div className="vyb-scribble-modal-backdrop" role="presentation">
          <div className="vyb-scribble-result-modal" role="dialog" aria-modal="true" aria-label="Final results">
            <div className="vyb-scribble-panel-head">
              <span>Final scores</span>
              <strong>{winner ? `${winner.displayName} wins` : "Game over"}</strong>
            </div>

            <div className="vyb-scribble-result-list">
              {sortedPlayers.map((player, index) => (
                <div key={player.membershipId} className="vyb-scribble-result-row">
                  <span>{index + 1}</span>
                  <strong>{player.displayName}</strong>
                  <b>{player.score}</b>
                </div>
              ))}
            </div>

            <div className="vyb-scribble-result-actions">
              <button type="button" className="vyb-scribble-secondary-button" onClick={() => setShareMode("results")}>
                Friends in chat
              </button>
              <button type="button" className="vyb-scribble-primary-button" onClick={() => openPostComposer(resultDraft)}>
                Post
              </button>
              <button type="button" className="vyb-scribble-tool-button" onClick={handleExit}>
                Return
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
