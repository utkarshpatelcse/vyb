import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { WebSocketServer } from "ws";
import { sendJson } from "../../lib/http.mjs";

const SCRIBBLE_SOCKET_PATH = "/ws/games/scribble";
const SCRIBBLE_PUBLIC_ROOMS_PATH = "/v1/games/scribble/public-rooms";
const SYSTEM_PUBLIC_ROOM_CODE = "VYBPUBLIC";
const SYSTEM_PUBLIC_ROOM_NAME = "vyb-public";
const SYSTEM_HOST_MEMBERSHIP_ID = "__scribble_system__";
const ROOM_IDLE_TTL_MS = 24 * 60 * 60 * 1000;
const CHOOSE_WORD_TIMEOUT_MS = 15 * 1000;
const ROUND_WRAP_MS = 3500;
const PUBLIC_ROOM_RESET_MS = 5500;
const MAX_DRAWING_STEPS = 5000;
const MAX_PUBLIC_CHAT = 70;
const WORD_BANK_PATH = path.join(getWorkspaceRoot(), "data", "scribble-words.json");

const rooms = new Map();
const connectedSockets = new Set();
let roomCounter = Math.floor(Math.random() * 4096);
let wordBankPromise = null;

function getWorkspaceRoot() {
  const cwd = process.cwd();
  return path.basename(cwd) === "backend" && path.basename(path.dirname(cwd)) === "apps" ? path.resolve(cwd, "../..") : cwd;
}

async function loadWordBank() {
  if (!wordBankPromise) {
    wordBankPromise = readFile(WORD_BANK_PATH, "utf8").then((raw) => {
      const parsed = JSON.parse(raw);
      return {
        easy: normalizeWordList(parsed.easy),
        medium: normalizeWordList(parsed.medium),
        hard: normalizeWordList(parsed.hard)
      };
    });
  }

  return wordBankPromise;
}

function normalizeWordList(value) {
  const words = Array.isArray(value) ? value : [];
  return words
    .map((word) => String(word).trim().replace(/\s+/gu, " "))
    .filter((word) => word.length >= 2 && word.length <= 40);
}

function getSocketSecret() {
  return process.env.VYB_INTERNAL_API_KEY ?? "local-vyb-internal-key";
}

function signPayload(encodedPayload) {
  return createHmac("sha256", getSocketSecret()).update(encodedPayload).digest("base64url");
}

function verifyScribbleSocketToken(token) {
  if (typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (
      typeof payload?.tenantId !== "string" ||
      typeof payload?.userId !== "string" ||
      typeof payload?.membershipId !== "string" ||
      typeof payload?.displayName !== "string" ||
      typeof payload?.username !== "string" ||
      typeof payload?.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function rejectUpgrade(socket, statusCode, statusText) {
  socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function sendSocket(ws, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}

function sendError(ws, code, message) {
  sendSocket(ws, {
    type: "scribble.error",
    payload: {
      code,
      message
    }
  });
}

function touchRoom(room) {
  room.lastActiveAt = Date.now();
}

function normalizeRoomId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/gu, "");
  return normalized.length >= 4 && normalized.length <= 12 ? normalized : null;
}

function getRoomKey(tenantId, roomId) {
  return `${tenantId}:${roomId}`;
}

function getRoom(tenantId, roomId) {
  return rooms.get(getRoomKey(tenantId, roomId)) ?? null;
}

function setRoom(room) {
  rooms.set(getRoomKey(room.tenantId, room.roomId), room);
}

function hasRoom(tenantId, roomId) {
  return rooms.has(getRoomKey(tenantId, roomId));
}

function generateRoomId(tenantId) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    roomCounter = (roomCounter + 1) % 4096;
    const encoded = ((BigInt(Date.now() - 1704067200000) * 4096n) + BigInt(roomCounter)).toString(36).toUpperCase();
    const candidate = encoded.slice(-6).padStart(6, "0");

    if (!hasRoom(tenantId, candidate)) {
      return candidate;
    }
  }

  return randomUUID().replace(/-/gu, "").slice(0, 8).toUpperCase();
}

function clampNumber(value, min, max, fallback) {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(Math.max(numericValue, min), max);
}

function normalizeSettings(input = {}) {
  const drawTime = [40, 60, 90].includes(input.drawTime) ? input.drawTime : 60;
  const rounds = [3, 5, 10].includes(input.rounds) ? input.rounds : 3;
  const visibility = input.visibility === "public" ? "public" : "private";

  return {
    drawTime,
    rounds,
    maxPlayers: Math.round(clampNumber(input.maxPlayers, 2, 12, 8)),
    visibility,
    hintsEnabled: input.hintsEnabled !== false
  };
}

function createRoom(auth, rawSettings) {
  const roomId = generateRoomId(auth.tenantId);
  const settings = normalizeSettings(rawSettings);
  const room = {
    roomId,
    displayName: null,
    tenantId: auth.tenantId,
    status: "LOBBY",
    settings,
    hostMembershipId: auth.membershipId,
    systemPublic: false,
    players: new Map(),
    order: [],
    socketsByMembership: new Map(),
    currentDrawerMembershipId: null,
    currentWord: null,
    currentDifficulty: null,
    wordChoices: [],
    round: 0,
    turnIndex: 0,
    totalTurns: 0,
    timerEndsAt: null,
    drawing: [],
    likeMembershipIds: new Set(),
    dislikeMembershipIds: new Set(),
    chat: [],
    revealedWord: null,
    roundResult: null,
    startedAt: null,
    lastActiveAt: Date.now(),
    chooseTimer: null,
    roundTimer: null,
    nextTimer: null,
    resetTimer: null
  };

  addChat(room, {
    kind: "system",
    membershipId: null,
    displayName: "Scribble",
    body: settings.visibility === "public" ? "Public room created." : "Private room created."
  });

  setRoom(room);
  return room;
}

function createSystemPublicRoom(tenantId) {
  const room = {
    roomId: SYSTEM_PUBLIC_ROOM_CODE,
    displayName: SYSTEM_PUBLIC_ROOM_NAME,
    tenantId,
    status: "LOBBY",
    settings: {
      drawTime: 60,
      rounds: 3,
      maxPlayers: 12,
      visibility: "public",
      hintsEnabled: true
    },
    hostMembershipId: SYSTEM_HOST_MEMBERSHIP_ID,
    systemPublic: true,
    players: new Map(),
    order: [],
    socketsByMembership: new Map(),
    currentDrawerMembershipId: null,
    currentWord: null,
    currentDifficulty: null,
    wordChoices: [],
    round: 0,
    turnIndex: 0,
    totalTurns: 0,
    timerEndsAt: null,
    drawing: [],
    likeMembershipIds: new Set(),
    dislikeMembershipIds: new Set(),
    chat: [],
    revealedWord: null,
    roundResult: null,
    startedAt: null,
    lastActiveAt: Date.now(),
    chooseTimer: null,
    roundTimer: null,
    nextTimer: null,
    resetTimer: null
  };

  addChat(room, {
    kind: "system",
    membershipId: null,
    displayName: "Scribble",
    body: "vyb-public is open for your college."
  });

  setRoom(room);
  return room;
}

function ensureSystemPublicRoom(tenantId) {
  const existingRoom = getRoom(tenantId, SYSTEM_PUBLIC_ROOM_CODE);
  if (existingRoom) {
    return existingRoom;
  }

  return createSystemPublicRoom(tenantId);
}

function toPlayer(auth, connected = true) {
  return {
    userId: auth.userId,
    membershipId: auth.membershipId,
    username: auth.username,
    displayName: auth.displayName || auth.username,
    connected,
    score: 0,
    scoreAtTurnStart: 0,
    correctThisTurn: false,
    warnings: 0,
    joinedAt: new Date().toISOString()
  };
}

function addChat(room, item) {
  room.chat.push({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...item
  });

  if (room.chat.length > MAX_PUBLIC_CHAT) {
    room.chat = room.chat.slice(-MAX_PUBLIC_CHAT);
  }
}

function addOrUpdatePlayer(room, auth) {
  let player = room.players.get(auth.membershipId);

  if (!player) {
    if (getConnectedMembershipIds(room).length >= room.settings.maxPlayers) {
      return null;
    }

    player = toPlayer(auth, true);
    room.players.set(auth.membershipId, player);
    room.order.push(auth.membershipId);
    addChat(room, {
      kind: "system",
      membershipId: auth.membershipId,
      displayName: auth.displayName || auth.username,
      body: `${auth.displayName || auth.username} joined.`
    });
    return player;
  }

  player.userId = auth.userId;
  player.username = auth.username;
  player.displayName = auth.displayName || auth.username;
  player.connected = true;
  return player;
}

function addSocketToRoom(room, ws, auth) {
  const currentSockets = room.socketsByMembership.get(auth.membershipId) ?? new Set();
  currentSockets.add(ws);
  room.socketsByMembership.set(auth.membershipId, currentSockets);
  ws.__scribbleRoomId = room.roomId;
  ws.__scribbleAuth = auth;
}

function clearRoomTimers(room) {
  if (room.chooseTimer) {
    clearTimeout(room.chooseTimer);
    room.chooseTimer = null;
  }

  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  if (room.nextTimer) {
    clearTimeout(room.nextTimer);
    room.nextTimer = null;
  }

  if (room.resetTimer) {
    clearTimeout(room.resetTimer);
    room.resetTimer = null;
  }
}

function getConnectedMembershipIds(room) {
  return room.order.filter((membershipId) => room.players.get(membershipId)?.connected);
}

function getTotalTurns(room) {
  return Math.max(1, getConnectedMembershipIds(room).length) * room.settings.rounds;
}

function pickOne(values, used) {
  const candidates = values.filter((value) => !used.has(value.toLowerCase()));
  const source = candidates.length > 0 ? candidates : values;
  const picked = source[Math.floor(Math.random() * source.length)] ?? "campus";
  used.add(picked.toLowerCase());
  return picked;
}

async function pickWordChoices() {
  const wordBank = await loadWordBank();
  const used = new Set();

  return [
    {
      id: randomUUID(),
      word: pickOne(wordBank.easy, used),
      difficulty: "easy",
      multiplier: 1
    },
    {
      id: randomUUID(),
      word: pickOne(wordBank.medium, used),
      difficulty: "medium",
      multiplier: 1.35
    },
    {
      id: randomUUID(),
      word: pickOne(wordBank.hard, used),
      difficulty: "hard",
      multiplier: 2
    }
  ];
}

function countWordLetters(word) {
  return (word.match(/[a-z0-9]/giu) ?? []).length;
}

function getHintLetterCount(room) {
  if (room.status !== "PLAYING" || !room.currentWord || !room.timerEndsAt || !room.settings.hintsEnabled) {
    return 0;
  }

  const totalMs = room.settings.drawTime * 1000;
  const remainingMs = Math.max(0, new Date(room.timerEndsAt).getTime() - Date.now());
  const elapsedRatio = Math.min(1, Math.max(0, (totalMs - remainingMs) / totalMs));
  const totalLetters = countWordLetters(room.currentWord);

  if (totalLetters === 0) {
    return 0;
  }

  if (elapsedRatio >= 0.72) {
    return Math.min(totalLetters, 2);
  }

  if (elapsedRatio >= 0.45) {
    return 1;
  }

  return 0;
}

function buildHintMask(word, revealCount) {
  let revealed = 0;
  return [...word]
    .map((character) => {
      if (!/[a-z0-9]/iu.test(character)) {
        return character;
      }

      if (revealed < revealCount) {
        revealed += 1;
        return character.toUpperCase();
      }

      return "_";
    })
    .join(" ");
}

function buildWordLengthHint(word) {
  return String(word ?? "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((segment) => countWordLetters(segment))
    .join(" ");
}

function buildRoundResult(room, reason, word) {
  return {
    reason,
    word,
    scores: room.order.flatMap((membershipId) => {
      const player = room.players.get(membershipId);
      if (!player) {
        return [];
      }

      return {
        membershipId: player.membershipId,
        displayName: player.displayName,
        delta: Math.max(0, player.score - (player.scoreAtTurnStart ?? 0)),
        totalScore: player.score,
        isDrawer: membershipId === room.currentDrawerMembershipId
      };
    })
  };
}

function buildSnapshot(room, viewerMembershipId) {
  const isDrawer = room.currentDrawerMembershipId === viewerMembershipId;
  const hintLetters = getHintLetterCount(room);
  const currentPlayer = room.players.get(viewerMembershipId);

  return {
    roomId: room.roomId,
    displayName: room.displayName ?? room.roomId,
    isSystemPublic: Boolean(room.systemPublic),
    status: room.status,
    viewerMembershipId,
    hostMembershipId: room.hostMembershipId,
    currentDrawerMembershipId: room.currentDrawerMembershipId,
    round: room.round,
    turn: room.turnIndex + (room.status === "LOBBY" || room.status === "FINISHED" ? 0 : 1),
    totalTurns: room.totalTurns,
    timerEndsAt: room.timerEndsAt,
    settings: room.settings,
    players: room.order.flatMap((membershipId) => {
      const player = room.players.get(membershipId);
      if (!player) {
        return [];
      }

      return {
        userId: player.userId,
        membershipId: player.membershipId,
        username: player.username,
        displayName: player.displayName,
        connected: player.connected,
        score: player.score,
        correctThisTurn: player.correctThisTurn,
        warnings: player.warnings,
        isHost: membershipId === room.hostMembershipId,
        isDrawer: membershipId === room.currentDrawerMembershipId
      };
    }),
    currentWord: isDrawer || room.status === "ROUND_END" || room.status === "FINISHED" ? room.currentWord : null,
    revealedWord: room.revealedWord,
    wordChoices: isDrawer && room.status === "CHOOSING" ? room.wordChoices : [],
    hint: room.currentWord && !isDrawer ? buildHintMask(room.currentWord, hintLetters) : null,
    wordLengthHint: room.currentWord ? buildWordLengthHint(room.currentWord) : null,
    hintLetters,
    drawing: room.drawing,
    likeCount: room.likeMembershipIds.size,
    dislikeCount: room.dislikeMembershipIds.size,
    viewerLiked: room.likeMembershipIds.has(viewerMembershipId),
    viewerDisliked: room.dislikeMembershipIds.has(viewerMembershipId),
    chat: room.chat,
    roundResult: room.roundResult,
    viewerCorrectThisTurn: Boolean(currentPlayer?.correctThisTurn),
    invitePath: `/join/scribble?code=${encodeURIComponent(room.systemPublic ? SYSTEM_PUBLIC_ROOM_NAME : room.roomId)}`
  };
}

function buildPublicRoomSummary(room) {
  const connectedPlayers = getConnectedMembershipIds(room);
  if (room.settings.visibility !== "public" || (!room.systemPublic && (connectedPlayers.length === 0 || room.status === "FINISHED"))) {
    return null;
  }

  const host = room.players.get(room.hostMembershipId);
  const drawer = room.currentDrawerMembershipId ? room.players.get(room.currentDrawerMembershipId) : null;

  return {
    roomId: room.roomId,
    displayName: room.displayName ?? room.roomId,
    isSystemPublic: Boolean(room.systemPublic),
    hostName: room.systemPublic ? "Vyb" : host?.displayName ?? "Host",
    playerCount: connectedPlayers.length,
    maxPlayers: room.settings.maxPlayers,
    status: room.status,
    round: room.round,
    drawTime: room.settings.drawTime,
    rounds: room.settings.rounds,
    hintsEnabled: room.settings.hintsEnabled,
    drawerName: drawer?.displayName ?? null
  };
}

function buildCatalogPayload(tenantId) {
  ensureSystemPublicRoom(tenantId);

  return {
    rooms: [...rooms.values()]
      .filter((room) => room.tenantId === tenantId)
      .map((room) => buildPublicRoomSummary(room))
      .filter(Boolean)
      .sort((left, right) => Number(right.isSystemPublic) - Number(left.isSystemPublic) || right.playerCount - left.playerCount || left.roomId.localeCompare(right.roomId))
  };
}

function emitCatalog(targetTenantId = null) {
  for (const ws of connectedSockets) {
    const auth = ws.__scribbleAuth;
    if (!auth || (targetTenantId && auth.tenantId !== targetTenantId)) {
      continue;
    }

    sendSocket(ws, {
      type: "scribble.catalog",
      payload: buildCatalogPayload(auth.tenantId)
    });
  }
}

function emitState(room) {
  touchRoom(room);

  for (const [membershipId, sockets] of room.socketsByMembership.entries()) {
    const snapshot = buildSnapshot(room, membershipId);
    for (const ws of sockets) {
      sendSocket(ws, {
        type: "scribble.state",
        payload: snapshot
      });
    }
  }

  emitCatalog(room.tenantId);
}

function compactSystemPublicRoomPlayers(room) {
  if (!room.systemPublic) {
    return;
  }

  room.order = room.order.filter((membershipId) => {
    const player = room.players.get(membershipId);
    if (player?.connected) {
      return true;
    }

    room.players.delete(membershipId);
    room.socketsByMembership.delete(membershipId);
    room.likeMembershipIds.delete(membershipId);
    room.dislikeMembershipIds.delete(membershipId);
    return false;
  });
}

function resetSystemPublicRoom(room, message = null) {
  clearRoomTimers(room);
  room.status = "LOBBY";
  room.currentDrawerMembershipId = null;
  room.currentWord = null;
  room.currentDifficulty = null;
  room.wordChoices = [];
  room.round = 0;
  room.turnIndex = 0;
  room.totalTurns = 0;
  room.timerEndsAt = null;
  room.drawing = [];
  room.likeMembershipIds.clear();
  room.dislikeMembershipIds.clear();
  room.revealedWord = null;
  room.roundResult = null;

  for (const player of room.players.values()) {
    player.correctThisTurn = false;
  }

  if (message) {
    addChat(room, {
      kind: "system",
      membershipId: null,
      displayName: "Scribble",
      body: message
    });
  }

  emitState(room);
  maybeStartSystemPublicRoom(room);
}

function maybeStartSystemPublicRoom(room) {
  if (!room.systemPublic || room.status !== "LOBBY" || getConnectedMembershipIds(room).length < 2) {
    return false;
  }

  startGame(room, null);
  return true;
}

function finishGame(room) {
  clearRoomTimers(room);
  room.status = "FINISHED";
  room.currentDrawerMembershipId = null;
  room.currentWord = null;
  room.currentDifficulty = null;
  room.wordChoices = [];
  room.timerEndsAt = null;
  room.revealedWord = null;
  room.roundResult = null;
  room.likeMembershipIds.clear();
  room.dislikeMembershipIds.clear();
  addChat(room, {
    kind: "system",
    membershipId: null,
    displayName: "Scribble",
    body: "Game finished. Final scores are locked."
  });
  emitState(room);

  if (room.systemPublic) {
    room.resetTimer = setTimeout(() => {
      resetSystemPublicRoom(room, "Next vyb-public game is ready.");
    }, PUBLIC_ROOM_RESET_MS);
  }
}

async function beginNextTurn(room) {
  clearRoomTimers(room);
  const connectedMembershipIds = getConnectedMembershipIds(room);

  if (room.systemPublic && connectedMembershipIds.length < 2) {
    resetSystemPublicRoom(room, "Waiting for one more player.");
    return;
  }

  if (connectedMembershipIds.length === 0) {
    room.status = "LOBBY";
    room.currentDrawerMembershipId = null;
    room.timerEndsAt = null;
    emitState(room);
    return;
  }

  room.totalTurns = getTotalTurns(room);
  if (room.turnIndex >= room.totalTurns) {
    finishGame(room);
    return;
  }

  const drawerMembershipId = connectedMembershipIds[room.turnIndex % connectedMembershipIds.length];
  room.status = "CHOOSING";
  room.currentDrawerMembershipId = drawerMembershipId;
  room.currentWord = null;
  room.currentDifficulty = null;
  room.wordChoices = await pickWordChoices();
  room.round = Math.floor(room.turnIndex / connectedMembershipIds.length) + 1;
  room.timerEndsAt = null;
  room.drawing = [];
  room.revealedWord = null;
  room.roundResult = null;
  room.likeMembershipIds.clear();
  room.dislikeMembershipIds.clear();

  for (const player of room.players.values()) {
    player.scoreAtTurnStart = player.score;
    player.correctThisTurn = false;
  }

  const drawer = room.players.get(drawerMembershipId);
  addChat(room, {
    kind: "system",
    membershipId: drawerMembershipId,
    displayName: drawer?.displayName ?? "Drawer",
    body: `${drawer?.displayName ?? "Drawer"} is choosing a word.`
  });

  room.chooseTimer = setTimeout(() => {
    void chooseWord(room, room.wordChoices[0]?.id, true);
  }, CHOOSE_WORD_TIMEOUT_MS);

  emitState(room);
}

async function chooseWord(room, choiceId, automatic = false) {
  if (room.status !== "CHOOSING") {
    return;
  }

  const choice = room.wordChoices.find((candidate) => candidate.id === choiceId) ?? room.wordChoices[0];
  if (!choice) {
    endRound(room, "No word was selected. Round skipped.");
    return;
  }

  clearRoomTimers(room);
  room.status = "PLAYING";
  room.currentWord = choice.word;
  room.currentDifficulty = choice;
  room.revealedWord = null;
  room.roundResult = null;
  room.timerEndsAt = new Date(Date.now() + room.settings.drawTime * 1000).toISOString();
  room.drawing = [];
  room.likeMembershipIds.clear();
  room.dislikeMembershipIds.clear();

  const drawer = room.players.get(room.currentDrawerMembershipId);
  addChat(room, {
    kind: "system",
    membershipId: room.currentDrawerMembershipId,
    displayName: drawer?.displayName ?? "Drawer",
    body: automatic ? "Word auto-picked. Round started." : "Round started."
  });

  room.roundTimer = setTimeout(() => {
    endRound(room, "Time up.");
  }, room.settings.drawTime * 1000);

  emitState(room);
}

function endRound(room, reason) {
  if (room.status !== "PLAYING" && room.status !== "CHOOSING") {
    return;
  }

  clearRoomTimers(room);
  const word = room.currentWord ?? room.wordChoices[0]?.word ?? null;
  room.status = "ROUND_END";
  room.revealedWord = word;
  room.roundResult = buildRoundResult(room, reason, word);
  room.timerEndsAt = null;
  room.likeMembershipIds.clear();
  room.dislikeMembershipIds.clear();

  addChat(room, {
    kind: "system",
    membershipId: null,
    displayName: "Scribble",
    body: word ? `${reason} Word: ${word}` : reason
  });

  emitState(room);

  room.nextTimer = setTimeout(() => {
    room.turnIndex += 1;
    void beginNextTurn(room);
  }, ROUND_WRAP_MS);
}

function startGame(room, auth) {
  const isSystemStart = room.systemPublic && auth === null;
  if (!isSystemStart && room.hostMembershipId !== auth?.membershipId) {
    return false;
  }

  if (room.systemPublic && getConnectedMembershipIds(room).length < 2) {
    return false;
  }

  clearRoomTimers(room);
  room.status = "CHOOSING";
  room.turnIndex = 0;
  room.round = 1;
  room.startedAt = new Date().toISOString();
  room.drawing = [];
  room.chat = room.chat.slice(-10);
  room.revealedWord = null;
  room.likeMembershipIds.clear();
  room.dislikeMembershipIds.clear();

  for (const player of room.players.values()) {
    player.score = 0;
    player.scoreAtTurnStart = 0;
    player.correctThisTurn = false;
  }

  addChat(room, {
    kind: "system",
    membershipId: isSystemStart ? null : auth.membershipId,
    displayName: isSystemStart ? "Scribble" : auth.displayName || auth.username,
    body: isSystemStart ? "vyb-public game started." : "Game started."
  });

  void beginNextTurn(room);
  return true;
}

function normalizeGuess(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "");
}

function allGuessersDone(room) {
  const connectedGuessers = getConnectedMembershipIds(room).filter((membershipId) => membershipId !== room.currentDrawerMembershipId);
  return connectedGuessers.length > 0 && connectedGuessers.every((membershipId) => room.players.get(membershipId)?.correctThisTurn);
}

function handleGuess(room, ws, auth, text) {
  if (room.status !== "PLAYING" || !room.currentWord) {
    return;
  }

  if (auth.membershipId === room.currentDrawerMembershipId) {
    sendError(ws, "DRAWER_CANNOT_GUESS", "Drawer cannot guess their own word.");
    return;
  }

  const player = room.players.get(auth.membershipId);
  if (!player || player.correctThisTurn) {
    return;
  }

  const body = String(text ?? "").trim().slice(0, 80);
  if (!body) {
    return;
  }

  if (normalizeGuess(body) !== normalizeGuess(room.currentWord)) {
    addChat(room, {
      kind: "guess",
      membershipId: auth.membershipId,
      displayName: player.displayName,
      body
    });
    emitState(room);
    return;
  }

  const remainingSeconds = Math.max(0, (new Date(room.timerEndsAt).getTime() - Date.now()) / 1000);
  const hintPenalty = room.settings.hintsEnabled && getHintLetterCount(room) > 0 ? 0.8 : 1;
  const multiplier = room.currentDifficulty?.multiplier ?? 1;
  const score = Math.max(10, Math.round((50 + 100 * (remainingSeconds / room.settings.drawTime)) * hintPenalty * multiplier));
  const drawer = room.players.get(room.currentDrawerMembershipId);

  player.correctThisTurn = true;
  player.score += score;
  if (drawer) {
    drawer.score += 25;
  }

  addChat(room, {
    kind: "correct",
    membershipId: auth.membershipId,
    displayName: player.displayName,
    body: `${player.displayName} got it.`
  });

  sendSocket(ws, {
    type: "scribble.notice",
    payload: {
      tone: "success",
      message: `Correct! +${score} points`
    }
  });

  emitState(room);

  if (allGuessersDone(room)) {
    room.nextTimer = setTimeout(() => {
      endRound(room, "Everyone guessed it.");
    }, 900);
  }
}

function normalizeDrawStep(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const x1 = clampNumber(value.x1, 0, 1, Number.NaN);
  const y1 = clampNumber(value.y1, 0, 1, Number.NaN);
  const x2 = clampNumber(value.x2, 0, 1, Number.NaN);
  const y2 = clampNumber(value.y2, 0, 1, Number.NaN);
  const color = typeof value.color === "string" && /^#[0-9a-f]{6}$/iu.test(value.color) ? value.color : "#111827";
  const width = clampNumber(value.width, 1, 28, 5);

  if (![x1, y1, x2, y2].every(Number.isFinite)) {
    return null;
  }

  return {
    x1,
    y1,
    x2,
    y2,
    color,
    width
  };
}

function broadcastDrawSteps(room, senderWs, steps) {
  for (const sockets of room.socketsByMembership.values()) {
    for (const ws of sockets) {
      if (ws === senderWs) {
        continue;
      }

      sendSocket(ws, {
        type: "scribble.draw.step",
        payload: {
          roomId: room.roomId,
          steps
        }
      });
    }
  }
}

function handleDrawStep(room, ws, auth, payload) {
  if (room.status !== "PLAYING" || auth.membershipId !== room.currentDrawerMembershipId) {
    return;
  }

  const rawSteps = Array.isArray(payload?.steps) ? payload.steps.slice(0, 120) : [payload?.step ?? payload].filter(Boolean);
  const steps = rawSteps.map((step) => normalizeDrawStep(step)).filter(Boolean);
  if (steps.length === 0) {
    return;
  }

  room.drawing.push(...steps);
  if (room.drawing.length > MAX_DRAWING_STEPS) {
    room.drawing = room.drawing.slice(-MAX_DRAWING_STEPS);
  }

  touchRoom(room);
  broadcastDrawSteps(room, ws, steps);
}

function handleClearCanvas(room, auth) {
  if (room.status !== "PLAYING" || auth.membershipId !== room.currentDrawerMembershipId) {
    return;
  }

  room.drawing = [];
  room.likeMembershipIds.clear();
  room.dislikeMembershipIds.clear();
  addChat(room, {
    kind: "system",
    membershipId: auth.membershipId,
    displayName: auth.displayName || auth.username,
    body: "Canvas cleared."
  });

  for (const sockets of room.socketsByMembership.values()) {
    for (const ws of sockets) {
      sendSocket(ws, {
        type: "scribble.canvas.clear",
        payload: {
          roomId: room.roomId
        }
      });
    }
  }

  emitState(room);
}

function handleReaction(room, auth, tone) {
  if (room.status !== "PLAYING" || auth.membershipId === room.currentDrawerMembershipId) {
    return;
  }

  if (tone === "like") {
    if (room.likeMembershipIds.has(auth.membershipId)) {
      room.likeMembershipIds.delete(auth.membershipId);
    } else {
      room.likeMembershipIds.add(auth.membershipId);
      room.dislikeMembershipIds.delete(auth.membershipId);
    }
    emitState(room);
    return;
  }

  if (room.dislikeMembershipIds.has(auth.membershipId)) {
    room.dislikeMembershipIds.delete(auth.membershipId);
    emitState(room);
    return;
  }

  room.dislikeMembershipIds.add(auth.membershipId);
  room.likeMembershipIds.delete(auth.membershipId);
  if (room.dislikeMembershipIds.size < 3) {
    emitState(room);
    return;
  }

  const drawer = room.players.get(room.currentDrawerMembershipId);
  if (drawer) {
    drawer.warnings += 1;
  }

  room.drawing = [];
  room.likeMembershipIds.clear();
  room.dislikeMembershipIds.clear();
  addChat(room, {
    kind: "system",
    membershipId: room.currentDrawerMembershipId,
    displayName: drawer?.displayName ?? "Drawer",
    body: "Drawing cleared after multiple dislikes."
  });

  for (const sockets of room.socketsByMembership.values()) {
    for (const ws of sockets) {
      sendSocket(ws, {
        type: "scribble.canvas.clear",
        payload: {
          roomId: room.roomId
        }
      });
    }
  }

  emitState(room);
}

function updateRoomSettings(room, auth, payload) {
  if (room.hostMembershipId !== auth.membershipId || room.status !== "LOBBY") {
    return;
  }

  room.settings = normalizeSettings({
    ...room.settings,
    ...payload
  });
  emitState(room);
}

function handleJoinRoom(ws, auth, roomId) {
  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId) {
    sendError(ws, "INVALID_ROOM", "Enter a valid Scribble room code.");
    return;
  }

  const room = normalizedRoomId === SYSTEM_PUBLIC_ROOM_CODE ? ensureSystemPublicRoom(auth.tenantId) : getRoom(auth.tenantId, normalizedRoomId);
  if (!room || room.tenantId !== auth.tenantId) {
    sendError(ws, "ROOM_NOT_FOUND", "That Scribble room is not active.");
    return;
  }

  const player = addOrUpdatePlayer(room, auth);
  if (!player) {
    sendError(ws, "ROOM_FULL", "This Scribble room is full.");
    return;
  }

  addSocketToRoom(room, ws, auth);
  if (maybeStartSystemPublicRoom(room)) {
    return;
  }

  emitState(room);
}

function handleCreateRoom(ws, auth, settings) {
  const room = createRoom(auth, settings);
  addOrUpdatePlayer(room, auth);
  addSocketToRoom(room, ws, auth);
  emitState(room);
}

function getSocketRoom(ws) {
  const roomId = ws.__scribbleRoomId;
  const auth = ws.__scribbleAuth;
  return typeof roomId === "string" && auth ? getRoom(auth.tenantId, roomId) : null;
}

async function handleClientMessage(ws, auth, rawMessage) {
  let message = null;

  try {
    message = JSON.parse(String(rawMessage));
  } catch {
    return;
  }

  if (!message || typeof message !== "object") {
    return;
  }

  const type = message.type;
  const payload = message.payload && typeof message.payload === "object" ? message.payload : {};

  if (type === "scribble.catalog.subscribe") {
    sendSocket(ws, {
      type: "scribble.catalog",
      payload: buildCatalogPayload(auth.tenantId)
    });
    return;
  }

  if (type === "scribble.room.create") {
    handleCreateRoom(ws, auth, payload.settings);
    return;
  }

  if (type === "scribble.room.join") {
    handleJoinRoom(ws, auth, payload.roomId);
    return;
  }

  const room = getSocketRoom(ws);
  if (!room) {
    sendError(ws, "ROOM_REQUIRED", "Join a Scribble room first.");
    return;
  }

  touchRoom(room);

  if (type === "scribble.room.updateSettings") {
    updateRoomSettings(room, auth, payload.settings);
    return;
  }

  if (type === "scribble.game.start") {
    if (!startGame(room, auth)) {
      sendError(ws, "HOST_ONLY", "Only the host can start Scribble.");
    }
    return;
  }

  if (type === "scribble.word.choose") {
    if (auth.membershipId === room.currentDrawerMembershipId) {
      await chooseWord(room, payload.choiceId);
    }
    return;
  }

  if (type === "scribble.draw.step") {
    handleDrawStep(room, ws, auth, payload);
    return;
  }

  if (type === "scribble.canvas.clear") {
    handleClearCanvas(room, auth);
    return;
  }

  if (type === "scribble.chat.guess") {
    handleGuess(room, ws, auth, payload.text);
    return;
  }

  if (type === "scribble.drawing.like") {
    handleReaction(room, auth, "like");
    return;
  }

  if (type === "scribble.drawing.dislike") {
    handleReaction(room, auth, "dislike");
    return;
  }

  if (type === "scribble.round.skip" && (auth.membershipId === room.hostMembershipId || auth.membershipId === room.currentDrawerMembershipId)) {
    endRound(room, "Round skipped.");
  }
}

function handleSocketClose(ws) {
  connectedSockets.delete(ws);

  const auth = ws.__scribbleAuth;
  const room = getSocketRoom(ws);

  if (!auth || !room) {
    emitCatalog();
    return;
  }

  const sockets = room.socketsByMembership.get(auth.membershipId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      room.socketsByMembership.delete(auth.membershipId);
    }
  }

  const stillConnected = room.socketsByMembership.has(auth.membershipId);
  if (stillConnected) {
    emitCatalog(room.tenantId);
    return;
  }

  const player = room.players.get(auth.membershipId);
  if (player) {
    player.connected = false;
  }

  room.likeMembershipIds.delete(auth.membershipId);
  room.dislikeMembershipIds.delete(auth.membershipId);

  if (!room.systemPublic && room.hostMembershipId === auth.membershipId) {
    const nextHost = getConnectedMembershipIds(room)[0];
    if (nextHost) {
      room.hostMembershipId = nextHost;
    }
  }

  if (room.systemPublic) {
    compactSystemPublicRoomPlayers(room);

    if (getConnectedMembershipIds(room).length < 2) {
      resetSystemPublicRoom(room, getConnectedMembershipIds(room).length === 1 ? "Waiting for one more player." : null);
      return;
    }
  }

  if (room.currentDrawerMembershipId === auth.membershipId && (room.status === "PLAYING" || room.status === "CHOOSING")) {
    endRound(room, "Drawer left. Round skipped.");
    return;
  }

  emitState(room);
}

function cleanupIdleRooms() {
  const now = Date.now();

  for (const [roomId, room] of rooms.entries()) {
    if (room.systemPublic) {
      continue;
    }

    if (now - room.lastActiveAt < ROOM_IDLE_TTL_MS) {
      continue;
    }

    clearRoomTimers(room);
    rooms.delete(roomId);
  }

  emitCatalog();
}

setInterval(cleanupIdleRooms, 5 * 60 * 1000).unref?.();

export function getScribbleModuleHealth() {
  return {
    module: "scribble",
    status: "ok",
    activeRooms: rooms.size
  };
}

export function handleScribblePublicRoomsRoute({ request, response, url }) {
  if (request.method !== "GET" || url.pathname !== SCRIBBLE_PUBLIC_ROOMS_PATH) {
    return false;
  }

  const tenantId = typeof url.searchParams.get("tenantId") === "string" && url.searchParams.get("tenantId")?.trim()
    ? url.searchParams.get("tenantId").trim()
    : "tenant-demo";

  sendJson(response, 200, buildCatalogPayload(tenantId));
  return true;
}

export function attachScribbleWebSocketServer(server) {
  const wsServer = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname !== SCRIBBLE_SOCKET_PATH) {
      return;
    }

    const auth = verifyScribbleSocketToken(url.searchParams.get("token"));
    if (!auth) {
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }

    wsServer.handleUpgrade(request, socket, head, (ws) => {
      ws.__scribbleAuth = auth;
      connectedSockets.add(ws);
      ws.on("message", (rawMessage) => {
        void handleClientMessage(ws, auth, rawMessage);
      });
      ws.on("close", () => handleSocketClose(ws));
      ws.on("error", () => handleSocketClose(ws));
      sendSocket(ws, {
        type: "scribble.connected",
        payload: {
          userId: auth.userId,
          membershipId: auth.membershipId
        }
      });
      sendSocket(ws, {
        type: "scribble.catalog",
        payload: buildCatalogPayload(auth.tenantId)
      });
    });
  });
}
