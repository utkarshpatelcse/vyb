import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { WebSocketServer } from "ws";
import { getFirebaseDataConnect } from "../../../../../packages/config/src/index.mjs";
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
const scribbleWordConnectorConfig = {
  connector: "connect",
  serviceId: "vyb",
  location: "asia-south1"
};

const GET_SCRIBBLE_WORD_STORE_QUERY = `
  query GetScribbleGameLevelRuntime($id: String!) {
    gamesLevel(key: { id: $id }) {
      id
      payloadJson
      totalLevels
      checksum
      updatedAt
    }
  }
`;

const rooms = new Map();
const connectedSockets = new Set();
let roomCounter = Math.floor(Math.random() * 4096);
let wordBankPromise = null;

function scribbleLog(event, details = {}, level = "log") {
  const logger = typeof console[level] === "function" ? console[level] : console.log;
  logger(`[scribble] ${event}`, {
    at: new Date().toISOString(),
    ...details
  });
}

function summarizeAuth(auth) {
  if (!auth) {
    return null;
  }

  return {
    tenantId: auth.tenantId,
    userId: auth.userId,
    membershipId: auth.membershipId,
    baseMembershipId: auth.baseMembershipId ?? auth.membershipId,
    username: auth.username,
    displayName: auth.displayName
  };
}

function summarizeRoom(room) {
  if (!room) {
    return null;
  }

  const connectedMembershipIds = getConnectedMembershipIds(room);
  return {
    roomId: room.roomId,
    tenantId: room.tenantId,
    displayName: room.displayName,
    status: room.status,
    systemPublic: room.systemPublic,
    hostMembershipId: room.hostMembershipId,
    currentDrawerMembershipId: room.currentDrawerMembershipId,
    connectedPlayers: connectedMembershipIds.length,
    totalPlayers: room.players.size,
    socketGroups: room.socketsByMembership.size,
    order: [...room.order],
    round: room.round,
    turnIndex: room.turnIndex,
    totalTurns: room.totalTurns,
    timerEndsAt: room.timerEndsAt,
    settings: room.settings
  };
}

function summarizePayload(type, payload) {
  if (type === "scribble.draw.step") {
    return {
      roomId: payload.roomId,
      stepCount: Array.isArray(payload.steps) ? payload.steps.length : 0
    };
  }

  if (type === "scribble.chat.guess") {
    return {
      textLength: typeof payload.text === "string" ? payload.text.length : 0
    };
  }

  if (type === "scribble.room.create") {
    return {
      settings: payload.settings
    };
  }

  if (type === "scribble.room.join") {
    return {
      roomId: payload.roomId
    };
  }

  if (type === "scribble.room.updateSettings") {
    return {
      settings: payload.settings
    };
  }

  if (type === "scribble.word.choose") {
    return {
      choiceId: payload.choiceId
    };
  }

  return payload;
}

function getWorkspaceRoot() {
  const cwd = process.cwd();
  return path.basename(cwd) === "backend" && path.basename(path.dirname(cwd)) === "apps" ? path.resolve(cwd, "../..") : cwd;
}

async function loadWordBank() {
  if (!wordBankPromise) {
    wordBankPromise = loadWordBankFromSources();
  }

  return wordBankPromise;
}

function getScribbleWordStoreId() {
  return process.env.VYB_SCRIBBLE_GAME_LEVEL_STORE_ID ?? process.env.VYB_SCRIBBLE_WORD_STORE_ID ?? "scribble-words-v1";
}

function getScribbleWordDc() {
  return getFirebaseDataConnect(scribbleWordConnectorConfig);
}

function normalizeWordBankPayload(payload) {
  return {
    easy: normalizeWordList(payload?.easy),
    medium: normalizeWordList(payload?.medium),
    hard: normalizeWordList(payload?.hard)
  };
}

async function loadWordBankFromDataConnect() {
  if (process.env.VYB_SCRIBBLE_WORDS_SOURCE === "local") {
    return null;
  }

  const response = await getScribbleWordDc().executeGraphqlRead(GET_SCRIBBLE_WORD_STORE_QUERY, {
    operationName: "GetScribbleGameLevelRuntime",
    variables: {
      id: getScribbleWordStoreId()
    }
  });
  const payloadJson = response.data?.gamesLevel?.payloadJson;

  if (typeof payloadJson !== "string" || !payloadJson.trim()) {
    return null;
  }

  return normalizeWordBankPayload(JSON.parse(payloadJson));
}

async function loadWordBankFromFile() {
  return normalizeWordBankPayload(JSON.parse(await readFile(WORD_BANK_PATH, "utf8")));
}

async function loadWordBankFromSources() {
  try {
    const wordBank = await loadWordBankFromDataConnect();
    if (wordBank && wordBank.easy.length > 0 && wordBank.medium.length > 0 && wordBank.hard.length > 0) {
      scribbleLog("word-bank.loaded", {
        source: "dataconnect",
        storeId: getScribbleWordStoreId(),
        counts: {
          easy: wordBank.easy.length,
          medium: wordBank.medium.length,
          hard: wordBank.hard.length
        }
      });
      return wordBank;
    }
  } catch (error) {
    scribbleLog("word-bank.dataconnect-unavailable", {
      storeId: getScribbleWordStoreId(),
      message: error instanceof Error ? error.message : String(error)
    }, "warn");
  }

  const wordBank = await loadWordBankFromFile();
  scribbleLog("word-bank.loaded", {
    source: "local-file",
    path: WORD_BANK_PATH,
    counts: {
      easy: wordBank.easy.length,
      medium: wordBank.medium.length,
      hard: wordBank.hard.length
    }
  });
  return wordBank;
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
    scribbleLog("socket-token.invalid-format", {
      hasToken: typeof token === "string",
      tokenLength: typeof token === "string" ? token.length : 0
    }, "warn");
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
    scribbleLog("socket-token.bad-signature", {
      payloadLength: encodedPayload.length,
      signatureLength: providedSignature.length
    }, "warn");
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
      scribbleLog("socket-token.invalid-payload", {
        payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : []
      }, "warn");
      return null;
    }

    if (payload.exp < Date.now()) {
      scribbleLog("socket-token.expired", {
        auth: summarizeAuth(payload),
        exp: payload.exp,
        now: Date.now()
      }, "warn");
      return null;
    }

    return payload;
  } catch (error) {
    scribbleLog("socket-token.parse-failed", {
      message: error instanceof Error ? error.message : String(error)
    }, "warn");
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
  scribbleLog("client-error", {
    code,
    message,
    roomId: ws.__scribbleRoomId ?? null,
    auth: summarizeAuth(ws.__scribbleAuth)
  }, "warn");
  sendSocket(ws, {
    type: "scribble.error",
    payload: {
      code,
      message
    }
  });
}

function sendNotice(ws, message, tone = "info") {
  sendSocket(ws, {
    type: "scribble.notice",
    payload: {
      tone,
      message
    }
  });
}

function notifyRoom(room, message, tone = "info") {
  for (const sockets of room.socketsByMembership.values()) {
    for (const ws of sockets) {
      sendNotice(ws, message, tone);
    }
  }
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

function normalizeClientId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/gu, "");
  return normalized.length >= 6 && normalized.length <= 80 ? normalized : null;
}

function getConnectionAuth(auth, clientId) {
  const normalizedClientId = normalizeClientId(clientId);
  if (!normalizedClientId) {
    return {
      ...auth,
      baseMembershipId: auth.membershipId
    };
  }

  return {
    ...auth,
    baseMembershipId: auth.membershipId,
    membershipId: `${auth.membershipId}:${normalizedClientId}`
  };
}

function isSystemPublicRoomCode(roomId) {
  return roomId === SYSTEM_PUBLIC_ROOM_CODE || roomId === "PUBLIC" || roomId === "VYB";
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
  scribbleLog("room.created", {
    auth: summarizeAuth(auth),
    room: summarizeRoom(room)
  });
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
  scribbleLog("system-room.created", {
    tenantId,
    room: summarizeRoom(room)
  });
  return room;
}

function ensureSystemPublicRoom(tenantId) {
  const existingRoom = getRoom(tenantId, SYSTEM_PUBLIC_ROOM_CODE);
  if (existingRoom) {
    scribbleLog("system-room.reused", {
      tenantId,
      room: summarizeRoom(existingRoom)
    });
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
      scribbleLog("player.add.rejected-room-full", {
        auth: summarizeAuth(auth),
        room: summarizeRoom(room)
      }, "warn");
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
    scribbleLog("player.added", {
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    });
    return player;
  }

  player.userId = auth.userId;
  player.username = auth.username;
  player.displayName = auth.displayName || auth.username;
  player.connected = true;
  scribbleLog("player.reconnected", {
    auth: summarizeAuth(auth),
    room: summarizeRoom(room)
  });
  return player;
}

function addSocketToRoom(room, ws, auth) {
  const currentSockets = room.socketsByMembership.get(auth.membershipId) ?? new Set();
  currentSockets.add(ws);
  room.socketsByMembership.set(auth.membershipId, currentSockets);
  ws.__scribbleRoomId = room.roomId;
  ws.__scribbleAuth = auth;
  scribbleLog("socket.room-attached", {
    auth: summarizeAuth(auth),
    room: summarizeRoom(room),
    socketsForMembership: currentSockets.size
  });
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
  scribbleLog("system-room.reset.begin", {
    message,
    room: summarizeRoom(room)
  });
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
  const restarted = maybeStartSystemPublicRoom(room);
  scribbleLog("system-room.reset.done", {
    restarted,
    room: summarizeRoom(room)
  });
}

function resetRoomAfterPlayersLeft(room, message) {
  scribbleLog("room.reset-after-players-left.begin", {
    message,
    room: summarizeRoom(room)
  });
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
    player.scoreAtTurnStart = player.score;
  }

  addChat(room, {
    kind: "system",
    membershipId: null,
    displayName: "Scribble",
    body: message
  });
  notifyRoom(room, message);
  emitState(room);
  scribbleLog("room.reset-after-players-left.done", {
    room: summarizeRoom(room)
  });
}

function maybeStartSystemPublicRoom(room) {
  const connectedPlayers = getConnectedMembershipIds(room).length;
  if (!room.systemPublic || room.status !== "LOBBY" || getConnectedMembershipIds(room).length < 2) {
    scribbleLog("system-room.autostart.skipped", {
      reason: !room.systemPublic ? "not-system-room" : room.status !== "LOBBY" ? "not-lobby" : "not-enough-players",
      connectedPlayers,
      room: summarizeRoom(room)
    });
    return false;
  }

  scribbleLog("system-room.autostart.begin", {
    connectedPlayers,
    room: summarizeRoom(room)
  });
  startGame(room, null);
  return true;
}

function finishGame(room) {
  scribbleLog("game.finish.begin", {
    room: summarizeRoom(room)
  });
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
  scribbleLog("game.finish.done", {
    room: summarizeRoom(room)
  });

  if (room.systemPublic) {
    room.resetTimer = setTimeout(() => {
      resetSystemPublicRoom(room, "Next vyb-public game is ready.");
    }, PUBLIC_ROOM_RESET_MS);
  }
}

async function beginNextTurn(room) {
  scribbleLog("turn.begin-next.requested", {
    room: summarizeRoom(room)
  });
  clearRoomTimers(room);
  const connectedMembershipIds = getConnectedMembershipIds(room);

  if (room.systemPublic && connectedMembershipIds.length < 2) {
    scribbleLog("turn.begin-next.system-room-needs-player", {
      connectedMembershipIds,
      room: summarizeRoom(room)
    });
    resetSystemPublicRoom(room, "Waiting for one more player.");
    return;
  }

  if (connectedMembershipIds.length === 0) {
    scribbleLog("turn.begin-next.no-connected-players", {
      room: summarizeRoom(room)
    }, "warn");
    room.status = "LOBBY";
    room.currentDrawerMembershipId = null;
    room.timerEndsAt = null;
    emitState(room);
    return;
  }

  room.totalTurns = getTotalTurns(room);
  if (room.turnIndex >= room.totalTurns) {
    scribbleLog("turn.begin-next.total-turns-complete", {
      connectedMembershipIds,
      room: summarizeRoom(room)
    });
    finishGame(room);
    return;
  }

  const drawerMembershipId = connectedMembershipIds[room.turnIndex % connectedMembershipIds.length];
  scribbleLog("turn.begin-next.drawer-selected", {
    drawerMembershipId,
    connectedMembershipIds,
    room: summarizeRoom(room)
  });
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
    scribbleLog("word.choose.timeout", {
      drawerMembershipId,
      room: summarizeRoom(room)
    }, "warn");
    void chooseWord(room, room.wordChoices[0]?.id, true);
  }, CHOOSE_WORD_TIMEOUT_MS);

  emitState(room);
  scribbleLog("turn.begin-next.ready-for-word", {
    drawerMembershipId,
    wordChoiceCount: room.wordChoices.length,
    room: summarizeRoom(room)
  });
}

async function chooseWord(room, choiceId, automatic = false) {
  if (room.status !== "CHOOSING") {
    scribbleLog("word.choose.ignored", {
      reason: "room-not-choosing",
      choiceId,
      automatic,
      room: summarizeRoom(room)
    }, "warn");
    return;
  }

  const choice = room.wordChoices.find((candidate) => candidate.id === choiceId) ?? room.wordChoices[0];
  if (!choice) {
    scribbleLog("word.choose.no-choice", {
      choiceId,
      automatic,
      room: summarizeRoom(room)
    }, "warn");
    endRound(room, "No word was selected. Round skipped.");
    return;
  }

  scribbleLog("word.choose.accepted", {
    choiceId,
    automatic,
    word: choice.word,
    difficulty: choice.difficulty,
    drawerMembershipId: room.currentDrawerMembershipId,
    room: summarizeRoom(room)
  });
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
  scribbleLog("round.started", {
    word: room.currentWord,
    difficulty: room.currentDifficulty?.difficulty,
    drawTime: room.settings.drawTime,
    room: summarizeRoom(room)
  });
}

function endRound(room, reason) {
  if (room.status !== "PLAYING" && room.status !== "CHOOSING") {
    scribbleLog("round.end.ignored", {
      reason,
      room: summarizeRoom(room)
    }, "warn");
    return;
  }

  scribbleLog("round.end.begin", {
    reason,
    room: summarizeRoom(room)
  });
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
  scribbleLog("round.end.done", {
    reason,
    word,
    room: summarizeRoom(room)
  });

  room.nextTimer = setTimeout(() => {
    room.turnIndex += 1;
    void beginNextTurn(room).catch((error) => {
      scribbleLog("round.next-turn-failed", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        room: summarizeRoom(room)
      }, "error");
    });
  }, ROUND_WRAP_MS);
}

function startGame(room, auth) {
  const isSystemStart = room.systemPublic && auth === null;
  if (!isSystemStart && room.hostMembershipId !== auth?.membershipId) {
    scribbleLog("game.start.rejected", {
      reason: "host-only",
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    }, "warn");
    return false;
  }

  const connectedMembershipIds = getConnectedMembershipIds(room);
  if (connectedMembershipIds.length < 2) {
    scribbleLog("game.start.rejected", {
      reason: "not-enough-players",
      connectedMembershipIds,
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    }, "warn");
    return false;
  }

  scribbleLog("game.start.accepted", {
    isSystemStart,
    connectedMembershipIds,
    auth: summarizeAuth(auth),
    room: summarizeRoom(room)
  });
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

  void beginNextTurn(room).catch((error) => {
    scribbleLog("game.start.begin-next-failed", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      room: summarizeRoom(room)
    }, "error");
  });
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
    scribbleLog("guess.ignored", {
      reason: "round-not-playing",
      auth: summarizeAuth(auth),
      textLength: typeof text === "string" ? text.length : 0,
      room: summarizeRoom(room)
    }, "warn");
    return;
  }

  if (auth.membershipId === room.currentDrawerMembershipId) {
    scribbleLog("guess.rejected", {
      reason: "drawer-cannot-guess",
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    }, "warn");
    sendError(ws, "DRAWER_CANNOT_GUESS", "Drawer cannot guess their own word.");
    return;
  }

  const player = room.players.get(auth.membershipId);
  if (!player || player.correctThisTurn) {
    scribbleLog("guess.ignored", {
      reason: !player ? "player-not-found" : "already-correct",
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    }, "warn");
    return;
  }

  const body = String(text ?? "").trim().slice(0, 80);
  if (!body) {
    scribbleLog("guess.ignored", {
      reason: "empty",
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    }, "warn");
    return;
  }

  if (normalizeGuess(body) !== normalizeGuess(room.currentWord)) {
    scribbleLog("guess.incorrect", {
      auth: summarizeAuth(auth),
      textLength: body.length,
      room: summarizeRoom(room)
    });
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
  scribbleLog("guess.correct", {
    auth: summarizeAuth(auth),
    score,
    drawerMembershipId: room.currentDrawerMembershipId,
    remainingSeconds,
    word: room.currentWord,
    room: summarizeRoom(room)
  });

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
    scribbleLog("draw.step.rejected", {
      reason: room.status !== "PLAYING" ? "round-not-playing" : "not-current-drawer",
      auth: summarizeAuth(auth),
      payload: summarizePayload("scribble.draw.step", payload ?? {}),
      room: summarizeRoom(room)
    }, "warn");
    return;
  }

  const rawSteps = Array.isArray(payload?.steps) ? payload.steps.slice(0, 120) : [payload?.step ?? payload].filter(Boolean);
  const steps = rawSteps.map((step) => normalizeDrawStep(step)).filter(Boolean);
  if (steps.length === 0) {
    scribbleLog("draw.step.ignored", {
      reason: "no-valid-steps",
      auth: summarizeAuth(auth),
      rawStepCount: rawSteps.length,
      room: summarizeRoom(room)
    }, "warn");
    return;
  }

  room.drawing.push(...steps);
  if (room.drawing.length > MAX_DRAWING_STEPS) {
    room.drawing = room.drawing.slice(-MAX_DRAWING_STEPS);
  }

  touchRoom(room);
  broadcastDrawSteps(room, ws, steps);
  scribbleLog("draw.step.accepted", {
    auth: summarizeAuth(auth),
    stepCount: steps.length,
    drawingStepTotal: room.drawing.length,
    roomId: room.roomId
  });
}

function handleClearCanvas(room, auth) {
  if (room.status !== "PLAYING" || auth.membershipId !== room.currentDrawerMembershipId) {
    scribbleLog("canvas.clear.rejected", {
      reason: room.status !== "PLAYING" ? "round-not-playing" : "not-current-drawer",
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    }, "warn");
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
  scribbleLog("canvas.clear.accepted", {
    auth: summarizeAuth(auth),
    room: summarizeRoom(room)
  });
}

function handleReaction(room, auth, tone) {
  if (room.status !== "PLAYING" || auth.membershipId === room.currentDrawerMembershipId) {
    scribbleLog("reaction.rejected", {
      reason: room.status !== "PLAYING" ? "round-not-playing" : "drawer-cannot-react",
      tone,
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    }, "warn");
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
    scribbleLog("reaction.like.updated", {
      auth: summarizeAuth(auth),
      likeCount: room.likeMembershipIds.size,
      dislikeCount: room.dislikeMembershipIds.size,
      roomId: room.roomId
    });
    return;
  }

  if (room.dislikeMembershipIds.has(auth.membershipId)) {
    room.dislikeMembershipIds.delete(auth.membershipId);
    emitState(room);
    scribbleLog("reaction.dislike.removed", {
      auth: summarizeAuth(auth),
      likeCount: room.likeMembershipIds.size,
      dislikeCount: room.dislikeMembershipIds.size,
      roomId: room.roomId
    });
    return;
  }

  room.dislikeMembershipIds.add(auth.membershipId);
  room.likeMembershipIds.delete(auth.membershipId);
  if (room.dislikeMembershipIds.size < 3) {
    emitState(room);
    scribbleLog("reaction.dislike.added", {
      auth: summarizeAuth(auth),
      likeCount: room.likeMembershipIds.size,
      dislikeCount: room.dislikeMembershipIds.size,
      roomId: room.roomId
    });
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
  scribbleLog("reaction.dislike.threshold-cleared-canvas", {
    auth: summarizeAuth(auth),
    drawerMembershipId: room.currentDrawerMembershipId,
    drawerWarnings: drawer?.warnings ?? null,
    room: summarizeRoom(room)
  }, "warn");
}

function updateRoomSettings(room, auth, payload) {
  if (room.hostMembershipId !== auth.membershipId || room.status !== "LOBBY") {
    scribbleLog("room.settings.update.rejected", {
      reason: room.hostMembershipId !== auth.membershipId ? "host-only" : "not-lobby",
      auth: summarizeAuth(auth),
      requestedSettings: payload,
      room: summarizeRoom(room)
    }, "warn");
    return;
  }

  scribbleLog("room.settings.update.begin", {
    auth: summarizeAuth(auth),
    requestedSettings: payload,
    before: summarizeRoom(room)
  });
  room.settings = normalizeSettings({
    ...room.settings,
    ...payload
  });
  emitState(room);
  scribbleLog("room.settings.update.done", {
    auth: summarizeAuth(auth),
    room: summarizeRoom(room)
  });
}

function handleJoinRoom(ws, auth, roomId) {
  scribbleLog("room.join.requested", {
    requestedRoomId: roomId,
    auth: summarizeAuth(auth)
  });
  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId) {
    scribbleLog("room.join.rejected", {
      reason: "invalid-room-code",
      requestedRoomId: roomId,
      auth: summarizeAuth(auth)
    }, "warn");
    sendError(ws, "INVALID_ROOM", "Enter a valid Scribble room code.");
    return;
  }

  const room = isSystemPublicRoomCode(normalizedRoomId) ? ensureSystemPublicRoom(auth.tenantId) : getRoom(auth.tenantId, normalizedRoomId);
  if (!room || room.tenantId !== auth.tenantId) {
    scribbleLog("room.join.rejected", {
      reason: "room-not-found",
      requestedRoomId: roomId,
      normalizedRoomId,
      auth: summarizeAuth(auth),
      activeRoomIds: [...rooms.values()].filter((candidate) => candidate.tenantId === auth.tenantId).map((candidate) => candidate.roomId)
    }, "warn");
    sendError(ws, "ROOM_NOT_FOUND", "That Scribble room is not active.");
    return;
  }

  const player = addOrUpdatePlayer(room, auth);
  if (!player) {
    scribbleLog("room.join.rejected", {
      reason: "room-full",
      normalizedRoomId,
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    }, "warn");
    sendError(ws, "ROOM_FULL", "This Scribble room is full.");
    return;
  }

  addSocketToRoom(room, ws, auth);
  if (maybeStartSystemPublicRoom(room)) {
    scribbleLog("room.join.accepted-autostarted", {
      normalizedRoomId,
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    });
    return;
  }

  emitState(room);
  scribbleLog("room.join.accepted", {
    normalizedRoomId,
    auth: summarizeAuth(auth),
    room: summarizeRoom(room)
  });
}

function handleCreateRoom(ws, auth, settings) {
  scribbleLog("room.create.requested", {
    requestedSettings: settings,
    auth: summarizeAuth(auth)
  });
  const room = createRoom(auth, settings);
  addOrUpdatePlayer(room, auth);
  addSocketToRoom(room, ws, auth);
  emitState(room);
  scribbleLog("room.create.accepted", {
    auth: summarizeAuth(auth),
    room: summarizeRoom(room)
  });
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
  } catch (error) {
    scribbleLog("message.parse-failed", {
      auth: summarizeAuth(auth),
      roomId: ws.__scribbleRoomId ?? null,
      rawLength: typeof rawMessage?.length === "number" ? rawMessage.length : String(rawMessage).length,
      message: error instanceof Error ? error.message : String(error)
    }, "warn");
    return;
  }

  if (!message || typeof message !== "object") {
    scribbleLog("message.ignored-invalid-shape", {
      auth: summarizeAuth(auth),
      roomId: ws.__scribbleRoomId ?? null
    }, "warn");
    return;
  }

  const type = message.type;
  const payload = message.payload && typeof message.payload === "object" ? message.payload : {};
  scribbleLog("message.received", {
    type,
    auth: summarizeAuth(auth),
    roomId: ws.__scribbleRoomId ?? null,
    payload: summarizePayload(type, payload)
  });

  if (type === "scribble.catalog.subscribe") {
    sendSocket(ws, {
      type: "scribble.catalog",
      payload: buildCatalogPayload(auth.tenantId)
    });
    scribbleLog("catalog.sent", {
      auth: summarizeAuth(auth),
      roomCount: buildCatalogPayload(auth.tenantId).rooms.length
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
    scribbleLog("message.rejected-room-required", {
      type,
      auth: summarizeAuth(auth),
      roomId: ws.__scribbleRoomId ?? null
    }, "warn");
    sendError(ws, "ROOM_REQUIRED", "Join a Scribble room first.");
    return;
  }

  touchRoom(room);

  if (type === "scribble.room.updateSettings") {
    updateRoomSettings(room, auth, payload.settings);
    return;
  }

  if (type === "scribble.game.start") {
    scribbleLog("game.start.requested", {
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    });
    if (room.hostMembershipId !== auth.membershipId) {
      scribbleLog("game.start.denied-before-start", {
        reason: "host-only",
        auth: summarizeAuth(auth),
        room: summarizeRoom(room)
      }, "warn");
      sendError(ws, "HOST_ONLY", "Only the host can start Scribble.");
      return;
    }

    const connectedMembershipIds = getConnectedMembershipIds(room);
    if (connectedMembershipIds.length < 2) {
      scribbleLog("game.start.denied-before-start", {
        reason: "not-enough-players",
        connectedMembershipIds,
        auth: summarizeAuth(auth),
        room: summarizeRoom(room)
      }, "warn");
      sendError(ws, "NOT_ENOUGH_PLAYERS", "Scribble needs at least 2 players to start.");
      return;
    }

    if (!startGame(room, auth)) {
      scribbleLog("game.start.failed", {
        auth: summarizeAuth(auth),
        room: summarizeRoom(room)
      }, "warn");
      sendError(ws, "START_FAILED", "Could not start Scribble right now.");
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

  if (type === "scribble.room.leave") {
    scribbleLog("room.leave.requested", {
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    });
    handleSocketClose(ws);
    ws.close(1000, "left room");
    return;
  }

  if (type === "scribble.round.skip" && (auth.membershipId === room.hostMembershipId || auth.membershipId === room.currentDrawerMembershipId)) {
    scribbleLog("round.skip.accepted", {
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    });
    endRound(room, "Round skipped.");
    return;
  }

  if (type === "scribble.round.skip") {
    scribbleLog("round.skip.rejected", {
      reason: "host-or-drawer-only",
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    }, "warn");
    return;
  }

  scribbleLog("message.ignored-unknown-type", {
    type,
    auth: summarizeAuth(auth),
    room: summarizeRoom(room),
    payload: summarizePayload(type, payload)
  }, "warn");
}

function handleSocketClose(ws) {
  if (ws.__scribbleClosedHandled) {
    scribbleLog("socket.close.ignored-already-handled", {
      auth: summarizeAuth(ws.__scribbleAuth),
      roomId: ws.__scribbleRoomId ?? null
    });
    return;
  }

  ws.__scribbleClosedHandled = true;
  connectedSockets.delete(ws);

  const auth = ws.__scribbleAuth;
  const room = getSocketRoom(ws);

  if (!auth || !room) {
    scribbleLog("socket.close.no-room", {
      auth: summarizeAuth(auth),
      roomId: ws.__scribbleRoomId ?? null,
      connectedSockets: connectedSockets.size
    });
    emitCatalog();
    return;
  }

  scribbleLog("socket.close.begin", {
    auth: summarizeAuth(auth),
    room: summarizeRoom(room),
    connectedSockets: connectedSockets.size
  });

  const sockets = room.socketsByMembership.get(auth.membershipId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      room.socketsByMembership.delete(auth.membershipId);
    }
  }

  const stillConnected = room.socketsByMembership.has(auth.membershipId);
  if (stillConnected) {
    scribbleLog("socket.close.membership-still-connected", {
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    });
    emitCatalog(room.tenantId);
    return;
  }

  const player = room.players.get(auth.membershipId);
  if (player) {
    player.connected = false;
    addChat(room, {
      kind: "system",
      membershipId: auth.membershipId,
      displayName: player.displayName,
      body: `${player.displayName} left the room.`
    });
  }

  room.likeMembershipIds.delete(auth.membershipId);
  room.dislikeMembershipIds.delete(auth.membershipId);

  const connectedMembershipIds = getConnectedMembershipIds(room);

  if (!room.systemPublic && room.hostMembershipId === auth.membershipId) {
    const nextHost = connectedMembershipIds[0];
    if (nextHost) {
      room.hostMembershipId = nextHost;
      const nextHostPlayer = room.players.get(nextHost);
      addChat(room, {
        kind: "system",
        membershipId: nextHost,
        displayName: nextHostPlayer?.displayName ?? "Host",
        body: `${nextHostPlayer?.displayName ?? "A player"} is now the host.`
      });
      scribbleLog("room.host.transferred", {
        previousHostMembershipId: auth.membershipId,
        nextHostMembershipId: nextHost,
        room: summarizeRoom(room)
      });
    }
  }

  if (room.systemPublic) {
    compactSystemPublicRoomPlayers(room);

    if (getConnectedMembershipIds(room).length < 2) {
      const message = getConnectedMembershipIds(room).length === 1 ? "Everyone else left. Waiting for one more player." : null;
      if (message) {
        notifyRoom(room, message);
      }
      resetSystemPublicRoom(room, message);
      return;
    }
  }

  if (!room.systemPublic && connectedMembershipIds.length === 0) {
    scribbleLog("room.empty.reset-to-lobby", {
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    });
    clearRoomTimers(room);
    room.status = "LOBBY";
    room.currentDrawerMembershipId = null;
    room.currentWord = null;
    room.currentDifficulty = null;
    room.wordChoices = [];
    room.timerEndsAt = null;
    room.drawing = [];
    room.likeMembershipIds.clear();
    room.dislikeMembershipIds.clear();
    room.revealedWord = null;
    room.roundResult = null;
    emitCatalog(room.tenantId);
    return;
  }

  if (!room.systemPublic && connectedMembershipIds.length < 2 && room.status !== "LOBBY") {
    scribbleLog("room.players-left.reset-active-game", {
      auth: summarizeAuth(auth),
      connectedMembershipIds,
      room: summarizeRoom(room)
    });
    resetRoomAfterPlayersLeft(room, "Everyone else left. Waiting for another player.");
    return;
  }

  if (!room.systemPublic && connectedMembershipIds.length === 1 && room.status === "LOBBY") {
    scribbleLog("room.players-left.single-lobby-player", {
      auth: summarizeAuth(auth),
      connectedMembershipIds,
      room: summarizeRoom(room)
    });
    notifyRoom(room, "Everyone else left. Waiting for another player.");
  }

  if (room.currentDrawerMembershipId === auth.membershipId && (room.status === "PLAYING" || room.status === "CHOOSING")) {
    scribbleLog("room.drawer-left", {
      auth: summarizeAuth(auth),
      room: summarizeRoom(room)
    }, "warn");
    endRound(room, "Drawer left. Round skipped.");
    return;
  }

  emitState(room);
  scribbleLog("socket.close.done", {
    auth: summarizeAuth(auth),
    room: summarizeRoom(room)
  });
}

function cleanupIdleRooms() {
  const now = Date.now();
  let removedRooms = 0;

  for (const [roomId, room] of rooms.entries()) {
    if (room.systemPublic) {
      continue;
    }

    if (now - room.lastActiveAt < ROOM_IDLE_TTL_MS) {
      continue;
    }

    clearRoomTimers(room);
    rooms.delete(roomId);
    removedRooms += 1;
    scribbleLog("room.cleanup.removed-idle", {
      roomKey: roomId,
      idleMs: now - room.lastActiveAt,
      room: summarizeRoom(room)
    });
  }

  if (removedRooms > 0) {
    emitCatalog();
    scribbleLog("room.cleanup.done", {
      removedRooms,
      activeRooms: rooms.size
    });
  }
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

  const payload = buildCatalogPayload(tenantId);
  scribbleLog("public-rooms.request", {
    tenantId,
    roomCount: payload.rooms.length
  });
  sendJson(response, 200, payload);
  return true;
}

export function attachScribbleWebSocketServer(server) {
  const wsServer = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname !== SCRIBBLE_SOCKET_PATH) {
      return;
    }

    scribbleLog("socket.upgrade.request", {
      path: url.pathname,
      host: request.headers.host,
      origin: request.headers.origin ?? null,
      userAgent: request.headers["user-agent"] ?? null,
      hasToken: Boolean(url.searchParams.get("token")),
      clientId: url.searchParams.get("clientId")
    });
    const tokenAuth = verifyScribbleSocketToken(url.searchParams.get("token"));
    if (!tokenAuth) {
      scribbleLog("socket.upgrade.rejected", {
        reason: "unauthorized",
        path: url.pathname,
        host: request.headers.host,
        clientId: url.searchParams.get("clientId")
      }, "warn");
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }

    const auth = getConnectionAuth(tokenAuth, url.searchParams.get("clientId"));
    scribbleLog("socket.upgrade.authorized", {
      auth: summarizeAuth(auth),
      clientId: url.searchParams.get("clientId")
    });

    wsServer.handleUpgrade(request, socket, head, (ws) => {
      ws.__scribbleClosedHandled = false;
      ws.__scribbleAuth = auth;
      connectedSockets.add(ws);
      ws.on("message", (rawMessage) => {
        void handleClientMessage(ws, auth, rawMessage);
      });
      ws.on("close", (code, reason) => {
        scribbleLog("socket.close.event", {
          code,
          reason: reason?.toString?.() ?? "",
          auth: summarizeAuth(ws.__scribbleAuth),
          roomId: ws.__scribbleRoomId ?? null
        });
        handleSocketClose(ws);
      });
      ws.on("error", (error) => {
        scribbleLog("socket.error", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : null,
          auth: summarizeAuth(ws.__scribbleAuth),
          roomId: ws.__scribbleRoomId ?? null
        }, "error");
      });
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
      scribbleLog("socket.connected", {
        auth: summarizeAuth(auth),
        connectedSockets: connectedSockets.size,
        catalogRooms: buildCatalogPayload(auth.tenantId).rooms.length
      });
    });
  });
}
