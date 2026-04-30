import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ConnectCoordinate,
  ConnectDailyLevelResponse,
  ConnectDifficulty,
  ConnectDot,
  ConnectHintResponse,
  ConnectLeaderboardEntry,
  ConnectPublicLevel,
  ConnectSubmitResponse
} from "@vyb/contracts";
import { getFirebaseDataConnect, loadRootEnv } from "@vyb/config";
import type { DevSession } from "./dev-session";

loadRootEnv();

const DAY_MS = 24 * 60 * 60_000;
const HINT_COOLDOWN_SECONDS = 5;
const HINT_GHOST_SECONDS = 3;
const HINT_PENALTY_SECONDS = 3;
const DEFAULT_LAUNCH_DATE = "2026-04-28T00:00:00+05:30";
const CONNECT_LEVEL_STORE_ID = process.env.VYB_CONNECT_LEVEL_STORE_ID ?? "official-1000";
const CONNECT_SESSION_TOKEN_PREFIX = "connect.v1";
const CONNECT_LEVELS_SOURCE = process.env.VYB_CONNECT_LEVELS_SOURCE ?? "auto";
const CONNECT_ALLOW_LOCAL_LEVEL_FALLBACK =
  process.env.VYB_CONNECT_ALLOW_LOCAL_LEVEL_FALLBACK === "1" || CONNECT_LEVELS_SOURCE === "auto";
const connectConnectorConfig = {
  connector: "connect",
  serviceId: "vyb",
  location: "asia-south1"
};
let connectLevelStoreSkipLogged = false;
let connectStoreSkipLogged = false;
let connectStoreFallbackLogged = false;

const GET_CONNECT_LEVEL_STORE_QUERY = `
  query GetConnectLevelStoreRuntime($id: String!) {
    connectLevelStore(key: { id: $id }) {
      id
      payloadJson
      totalLevels
      launchDate
      checksum
      updatedAt
    }
  }
`;

const CONNECT_STORE_SCAN_LIMIT = 10_000;
const CONNECT_STORE_SOURCE = process.env.VYB_CONNECT_STORE_SOURCE ?? "auto";
const CONNECT_ALLOW_LOCAL_STORE_FALLBACK =
  process.env.VYB_CONNECT_ALLOW_LOCAL_STORE_FALLBACK === "1" || CONNECT_STORE_SOURCE === "auto";

const LIST_CONNECT_STORE_QUERY = `
  query ListConnectStoreRuntime($tenantId: String!, $sessionLimit: Int!, $scoreLimit: Int!) {
    connectSessions(
      where: { tenantId: { eq: $tenantId }, deletedAt: { isNull: true } }
      orderBy: [{ startedAt: DESC }]
      limit: $sessionLimit
    ) {
      sessionId
      tenantId
      userId
      username
      displayName
      levelId
      dailyIndex
      dailyKey
      startedAt
      lastHintAt
      hintsUsed
      completedAt
      elapsedCentiseconds
      adjustedCentiseconds
    }
    connectScores(
      where: { tenantId: { eq: $tenantId }, deletedAt: { isNull: true } }
      orderBy: [{ completedAt: DESC }]
      limit: $scoreLimit
    ) {
      id
      sessionId
      tenantId
      userId
      username
      displayName
      levelId
      dailyIndex
      dailyKey
      startedAt
      completedAt
      elapsedCentiseconds
      hintsUsed
      adjustedCentiseconds
    }
  }
`;

const GET_CONNECT_SESSION_BY_KEY_QUERY = `
  query GetConnectSessionByKeyRuntime($sessionKey: String!) {
    connectSessions(where: { sessionKey: { eq: $sessionKey }, deletedAt: { isNull: true } }, limit: 1) {
      id
    }
  }
`;

const GET_CONNECT_SCORE_BY_KEY_QUERY = `
  query GetConnectScoreByKeyRuntime($scoreKey: String!) {
    connectScores(where: { scoreKey: { eq: $scoreKey }, deletedAt: { isNull: true } }, limit: 1) {
      id
      adjustedCentiseconds
      elapsedCentiseconds
      hintsUsed
      completedAt
    }
  }
`;

const CREATE_CONNECT_SESSION_MUTATION = `
  mutation CreateConnectSessionRuntime(
    $id: String!
    $sessionKey: String!
    $sessionId: String!
    $tenantId: String!
    $userId: String!
    $username: String!
    $displayName: String!
    $levelId: Int!
    $dailyIndex: Int!
    $dailyKey: String!
    $startedAt: Timestamp!
    $lastHintAt: Timestamp
    $hintsUsed: Int!
    $completedAt: Timestamp
    $elapsedCentiseconds: Int
    $adjustedCentiseconds: Int
  ) {
    connectSession_insert(
      data: {
        id: $id
        sessionKey: $sessionKey
        sessionId: $sessionId
        tenantId: $tenantId
        userId: $userId
        username: $username
        displayName: $displayName
        levelId: $levelId
        dailyIndex: $dailyIndex
        dailyKey: $dailyKey
        startedAt: $startedAt
        lastHintAt: $lastHintAt
        hintsUsed: $hintsUsed
        completedAt: $completedAt
        elapsedCentiseconds: $elapsedCentiseconds
        adjustedCentiseconds: $adjustedCentiseconds
        createdAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    )
  }
`;

const UPDATE_CONNECT_SESSION_MUTATION = `
  mutation UpdateConnectSessionRuntime(
    $id: String!
    $sessionId: String!
    $username: String!
    $displayName: String!
    $lastHintAt: Timestamp
    $hintsUsed: Int!
    $completedAt: Timestamp
    $elapsedCentiseconds: Int
    $adjustedCentiseconds: Int
  ) {
    connectSession_update(
      key: { id: $id }
      data: {
        sessionId: $sessionId
        username: $username
        displayName: $displayName
        lastHintAt: $lastHintAt
        hintsUsed: $hintsUsed
        completedAt: $completedAt
        elapsedCentiseconds: $elapsedCentiseconds
        adjustedCentiseconds: $adjustedCentiseconds
        updatedAt_expr: "request.time"
      }
    )
  }
`;

const CREATE_CONNECT_SCORE_MUTATION = `
  mutation CreateConnectScoreRuntime(
    $id: String!
    $scoreKey: String!
    $sessionId: String!
    $tenantId: String!
    $userId: String!
    $username: String!
    $displayName: String!
    $levelId: Int!
    $dailyIndex: Int!
    $dailyKey: String!
    $startedAt: Timestamp!
    $completedAt: Timestamp!
    $elapsedCentiseconds: Int!
    $hintsUsed: Int!
    $adjustedCentiseconds: Int!
  ) {
    connectScore_insert(
      data: {
        id: $id
        scoreKey: $scoreKey
        sessionId: $sessionId
        tenantId: $tenantId
        userId: $userId
        username: $username
        displayName: $displayName
        levelId: $levelId
        dailyIndex: $dailyIndex
        dailyKey: $dailyKey
        startedAt: $startedAt
        completedAt: $completedAt
        elapsedCentiseconds: $elapsedCentiseconds
        hintsUsed: $hintsUsed
        adjustedCentiseconds: $adjustedCentiseconds
        createdAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    )
  }
`;

const UPDATE_CONNECT_SCORE_MUTATION = `
  mutation UpdateConnectScoreRuntime(
    $id: String!
    $sessionId: String!
    $username: String!
    $displayName: String!
    $startedAt: Timestamp!
    $completedAt: Timestamp!
    $elapsedCentiseconds: Int!
    $hintsUsed: Int!
    $adjustedCentiseconds: Int!
  ) {
    connectScore_update(
      key: { id: $id }
      data: {
        sessionId: $sessionId
        username: $username
        displayName: $displayName
        startedAt: $startedAt
        completedAt: $completedAt
        elapsedCentiseconds: $elapsedCentiseconds
        hintsUsed: $hintsUsed
        adjustedCentiseconds: $adjustedCentiseconds
        updatedAt_expr: "request.time"
      }
    )
  }
`;

type StoredConnectLevel = {
  level_id: number;
  grid_size: number;
  dots: ConnectDot[];
  solution_path: ConnectCoordinate[];
  difficulty: ConnectDifficulty;
};

type ConnectLevelSeedFile = {
  launchDate?: string;
  totalLevels?: number;
  levels?: StoredConnectLevel[];
};

type StoredConnectSession = {
  sessionId: string;
  tenantId: string;
  userId: string;
  username: string;
  displayName: string;
  levelId: number;
  dailyIndex: number;
  dailyKey: string;
  startedAt: string;
  lastHintAt: string | null;
  hintsUsed: number;
  completedAt: string | null;
  elapsedSeconds: number | null;
  adjustedTimeSeconds: number | null;
};

type StoredConnectScore = {
  scoreId: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  username: string;
  displayName: string;
  levelId: number;
  dailyIndex: number;
  dailyKey: string;
  startedAt: string;
  completedAt: string;
  elapsedSeconds: number;
  hintsUsed: number;
  adjustedTimeSeconds: number;
};

type ConnectSessionDbRecord = {
  id?: string;
  sessionId?: string;
  tenantId?: string;
  userId?: string;
  username?: string;
  displayName?: string;
  levelId?: number;
  dailyIndex?: number;
  dailyKey?: string;
  startedAt?: string;
  lastHintAt?: string | null;
  hintsUsed?: number;
  completedAt?: string | null;
  elapsedCentiseconds?: number | null;
  adjustedCentiseconds?: number | null;
};

type ConnectScoreDbRecord = {
  id?: string;
  sessionId?: string;
  tenantId?: string;
  userId?: string;
  username?: string;
  displayName?: string;
  levelId?: number;
  dailyIndex?: number;
  dailyKey?: string;
  startedAt?: string;
  completedAt?: string;
  elapsedCentiseconds?: number;
  hintsUsed?: number;
  adjustedCentiseconds?: number;
};

type ConnectStore = {
  sessions: StoredConnectSession[];
  scores: StoredConnectScore[];
};

type DailyState = {
  dailyIndex: number;
  dailyKey: string;
  levelId: number;
  launchDate: string;
  nextResetAt: string;
};

type ConnectSessionTokenPayload = Omit<StoredConnectSession, "sessionId">;

export type ConnectDailyHubSnapshot = {
  dailyKey: string;
  totalSolvers: number;
  viewerBest: ConnectLeaderboardEntry | null;
  viewerStreak: number;
  leaderboard: ConnectLeaderboardEntry[];
};

const emptyStore: ConnectStore = {
  sessions: [],
  scores: []
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getConnectSessionSecret() {
  return (
    process.env.VYB_CONNECT_SESSION_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.FIREBASE_PROJECT_ID ??
    "vyb-connect-local-session-secret"
  );
}

function signConnectSessionPayload(encodedPayload: string) {
  return createHmac("sha256", getConnectSessionSecret()).update(encodedPayload).digest("base64url");
}

function signaturesEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function createConnectSessionToken(session: StoredConnectSession) {
  const payload: ConnectSessionTokenPayload = {
    tenantId: session.tenantId,
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    levelId: session.levelId,
    dailyIndex: session.dailyIndex,
    dailyKey: session.dailyKey,
    startedAt: session.startedAt,
    lastHintAt: session.lastHintAt,
    hintsUsed: session.hintsUsed,
    completedAt: session.completedAt,
    elapsedSeconds: session.elapsedSeconds,
    adjustedTimeSeconds: session.adjustedTimeSeconds
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${CONNECT_SESSION_TOKEN_PREFIX}.${encodedPayload}.${signConnectSessionPayload(encodedPayload)}`;
}

function decodeConnectSessionToken(viewer: DevSession, sessionId: string): StoredConnectSession | null {
  const [prefix, version, encodedPayload, signature] = sessionId.split(".");

  if (`${prefix}.${version}` !== CONNECT_SESSION_TOKEN_PREFIX || !encodedPayload || !signature) {
    return null;
  }

  if (!signaturesEqual(signature, signConnectSessionPayload(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<ConnectSessionTokenPayload>;
    const levelId = normalizeInteger(payload.levelId);
    const dailyIndex = normalizeInteger(payload.dailyIndex);
    const hintsUsed = normalizeInteger(payload.hintsUsed);
    const startedAt = payload.startedAt;
    const lastHintAt = payload.lastHintAt;
    const completedAt = payload.completedAt;
    const elapsedSeconds = payload.elapsedSeconds;
    const adjustedTimeSeconds = payload.adjustedTimeSeconds;

    if (
      payload.tenantId !== viewer.tenantId ||
      payload.userId !== viewer.userId ||
      typeof payload.username !== "string" ||
      typeof payload.displayName !== "string" ||
      !Number.isFinite(levelId) ||
      !Number.isFinite(dailyIndex) ||
      typeof payload.dailyKey !== "string" ||
      !isValidIsoDate(startedAt) ||
      !(lastHintAt === null || isValidIsoDate(lastHintAt)) ||
      !Number.isFinite(hintsUsed) ||
      !(completedAt === null || isValidIsoDate(completedAt)) ||
      !(elapsedSeconds === null || typeof elapsedSeconds === "number") ||
      !(adjustedTimeSeconds === null || typeof adjustedTimeSeconds === "number")
    ) {
      return null;
    }

    return {
      sessionId,
      tenantId: payload.tenantId,
      userId: payload.userId,
      username: payload.username,
      displayName: payload.displayName,
      levelId,
      dailyIndex,
      dailyKey: payload.dailyKey,
      startedAt,
      lastHintAt,
      hintsUsed,
      completedAt,
      elapsedSeconds,
      adjustedTimeSeconds
    };
  } catch {
    return null;
  }
}

function refreshConnectSessionToken(session: StoredConnectSession) {
  session.sessionId = createConnectSessionToken(session);
  return session.sessionId;
}

function normalizeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : Number.NaN;
}

function normalizeCoordinate(value: unknown): ConnectCoordinate | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const point = value as Partial<ConnectCoordinate>;
  const x = normalizeInteger(point.x);
  const y = normalizeInteger(point.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

export function normalizeConnectPath(value: unknown): ConnectCoordinate[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const pathCells = value.map((point) => normalizeCoordinate(point));

  if (pathCells.some((point) => point === null)) {
    return null;
  }

  return pathCells as ConnectCoordinate[];
}

function coordinatesEqual(left: ConnectCoordinate, right: ConnectCoordinate) {
  return left.x === right.x && left.y === right.y;
}

function cellKey(point: ConnectCoordinate) {
  return `${point.x}:${point.y}`;
}

function getWorkspaceRoot() {
  const configuredRoot = process.env.VYB_WORKSPACE_ROOT;
  if (configuredRoot) {
    return path.resolve(configuredRoot);
  }

  const cwd = process.cwd();
  return path.basename(cwd) === "web" && path.basename(path.dirname(cwd)) === "apps" ? path.resolve(cwd, "../..") : cwd;
}

function getConnectLevelsPath() {
  return process.env.VYB_CONNECT_LEVELS_PATH ? path.resolve(process.env.VYB_CONNECT_LEVELS_PATH) : path.join(getWorkspaceRoot(), "data", "connect-levels.json");
}

function getConnectDc() {
  return getFirebaseDataConnect(connectConnectorConfig);
}

function isGoogleApplicationCredentialsPathUsable() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  if (!credentialsPath || credentialsPath.startsWith("{")) {
    return false;
  }

  return existsSync(path.resolve(credentialsPath));
}

function hasUsableFirebaseAdminCredentials() {
  return Boolean(
    process.env.FIREBASE_ADMIN_CREDENTIALS_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64 ||
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
      isGoogleApplicationCredentialsPathUsable() ||
      (process.env.FIREBASE_PROJECT_ID &&
        (process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL) &&
        (process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY))
  );
}

function canUseGoogleMetadataCredentials() {
  return Boolean(process.env.K_SERVICE || process.env.K_REVISION || process.env.K_CONFIGURATION);
}

function shouldLoadDataconnectLevelStore() {
  if (CONNECT_LEVELS_SOURCE === "local") {
    if (!CONNECT_ALLOW_LOCAL_LEVEL_FALLBACK) {
      throw new Error("Local Connect level storage is disabled. Set VYB_CONNECT_LEVELS_SOURCE=dataconnect.");
    }
    return false;
  }

  if (CONNECT_LEVELS_SOURCE === "dataconnect") {
    return true;
  }

  if (CONNECT_ALLOW_LOCAL_LEVEL_FALLBACK) {
    return hasUsableFirebaseAdminCredentials() || canUseGoogleMetadataCredentials();
  }

  return true;
}

function shouldUseDataconnectConnectStore() {
  if (CONNECT_STORE_SOURCE === "local") {
    if (!CONNECT_ALLOW_LOCAL_STORE_FALLBACK) {
      throw new Error("Local Connect score storage is disabled. Set VYB_CONNECT_STORE_SOURCE=dataconnect.");
    }
    return false;
  }

  if (CONNECT_STORE_SOURCE === "dataconnect") {
    return true;
  }

  const canUseDataconnect = hasUsableFirebaseAdminCredentials() || canUseGoogleMetadataCredentials();
  if (!canUseDataconnect && CONNECT_ALLOW_LOCAL_STORE_FALLBACK && !connectStoreSkipLogged) {
    connectStoreSkipLogged = true;
    console.warn("[connect-data] DataConnect score store unavailable; using explicit local fallback.", {
      reason: "firebase-admin-credentials-unavailable"
    });
  }
  return canUseDataconnect;
}

function getConnectStoreRoot() {
  if (process.env.VYB_CONNECT_STORE_ROOT) {
    return path.join(process.env.VYB_CONNECT_STORE_ROOT, "vyb-connect");
  }

  if (process.env.VERCEL) {
    return path.join("/tmp", "vyb-connect");
  }

  const configuredRoot =
    process.env.VYB_LOCAL_MEDIA_ROOT ??
    process.env.TMPDIR ??
    process.env.TEMP ??
    process.env.TMP ??
    path.join(getWorkspaceRoot(), ".tmp");

  return path.join(configuredRoot, "vyb-connect");
}

function resolveConnectStorePath(tenantId: string) {
  const rootPath = path.resolve(getConnectStoreRoot());
  const fileName = `${tenantId}.json`;
  const absolutePath = path.resolve(rootPath, fileName);
  const relativeCheck = path.relative(rootPath, absolutePath);

  if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
    throw new Error("Invalid local Connect store path.");
  }

  return absolutePath;
}

function getLaunchDate(seedFile?: ConnectLevelSeedFile) {
  return process.env.VYB_CONNECT_LAUNCH_DATE ?? seedFile?.launchDate ?? DEFAULT_LAUNCH_DATE;
}

function getDailyKey(launchDate: string, elapsedDays: number) {
  const launchDay = launchDate.match(/^(\d{4})-(\d{2})-(\d{2})/u);

  if (!launchDay) {
    return `day-${elapsedDays}`;
  }

  const year = Number(launchDay[1]);
  const month = Number(launchDay[2]) - 1;
  const day = Number(launchDay[3]);
  return new Date(Date.UTC(year, month, day + elapsedDays)).toISOString().slice(0, 10);
}

function getDailyState(levelCount: number, seedFile?: ConnectLevelSeedFile): DailyState {
  const launchDate = getLaunchDate(seedFile);
  const launchTime = new Date(launchDate).getTime();

  if (!Number.isFinite(launchTime)) {
    throw new Error("Connect launch date is invalid.");
  }

  const elapsedDays = Math.max(0, Math.floor((Date.now() - launchTime) / DAY_MS));
  const normalizedIndex = ((elapsedDays % levelCount) + levelCount) % levelCount;
  const resetStart = launchTime + elapsedDays * DAY_MS;

  return {
    dailyIndex: elapsedDays,
    dailyKey: getDailyKey(launchDate, elapsedDays),
    levelId: normalizedIndex + 1,
    launchDate,
    nextResetAt: new Date(resetStart + DAY_MS).toISOString()
  };
}

function normalizeLevel(rawLevel: Partial<StoredConnectLevel>): StoredConnectLevel | null {
  const levelId = normalizeInteger(rawLevel.level_id);
  const gridSize = normalizeInteger(rawLevel.grid_size);

  if (!Number.isFinite(levelId) || !Number.isFinite(gridSize) || gridSize < 2) {
    return null;
  }

  if (!Array.isArray(rawLevel.dots) || !Array.isArray(rawLevel.solution_path)) {
    return null;
  }

  const dots = rawLevel.dots
    .map((dot) => {
      const normalized = normalizeCoordinate(dot);
      const id = normalizeInteger(dot?.id);
      return normalized && Number.isFinite(id) ? { id, ...normalized } : null;
    })
    .filter((dot): dot is ConnectDot => dot !== null);
  const solutionPath = rawLevel.solution_path.map((point) => normalizeCoordinate(point)).filter((point): point is ConnectCoordinate => point !== null);
  const difficulty = rawLevel.difficulty ?? "Intro";

  if (dots.length !== rawLevel.dots.length || solutionPath.length !== gridSize * gridSize) {
    return null;
  }

  return {
    level_id: levelId,
    grid_size: gridSize,
    dots,
    solution_path: solutionPath,
    difficulty
  };
}

function normalizeSeedFile(payload: ConnectLevelSeedFile, sourceLabel: string) {
  const levels = Array.isArray(payload.levels) ? payload.levels.map((level) => normalizeLevel(level)).filter((level): level is StoredConnectLevel => level !== null) : [];

  if (levels.length === 0) {
    throw new Error(`Connect levels are not seeded in ${sourceLabel}.`);
  }

  return {
    seedFile: payload,
    levels
  };
}

async function loadDataconnectSeedFile() {
  if (!shouldLoadDataconnectLevelStore()) {
    if (!connectLevelStoreSkipLogged) {
      connectLevelStoreSkipLogged = true;
      console.info("[connect-data] DataConnect level store skipped; using local seed file.", {
        storeId: CONNECT_LEVEL_STORE_ID,
        reason: "firebase-admin-credentials-unavailable"
      });
    }
    return null;
  }

  try {
    const response = (await getConnectDc().executeGraphqlRead(GET_CONNECT_LEVEL_STORE_QUERY, {
      operationName: "GetConnectLevelStoreRuntime",
      variables: {
        id: CONNECT_LEVEL_STORE_ID
      }
    })) as { data?: { connectLevelStore?: { payloadJson?: string | null } | null } };
    const store = response.data?.connectLevelStore;

    if (!store?.payloadJson) {
      if (!CONNECT_ALLOW_LOCAL_LEVEL_FALLBACK) {
        throw new Error(`Connect level store ${CONNECT_LEVEL_STORE_ID} is missing in DataConnect.`);
      }
      return null;
    }

    return normalizeSeedFile(JSON.parse(store.payloadJson) as ConnectLevelSeedFile, `DataConnect store ${CONNECT_LEVEL_STORE_ID}`);
  } catch (error) {
    if (!CONNECT_ALLOW_LOCAL_LEVEL_FALLBACK) {
      throw error;
    }

    console.warn("[connect-data] DataConnect level store unavailable; falling back to local seed file.", {
      storeId: CONNECT_LEVEL_STORE_ID,
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

async function loadSeedFile() {
  const dataconnectSeed = await loadDataconnectSeedFile();
  if (dataconnectSeed) {
    return dataconnectSeed;
  }

  const seedPath = getConnectLevelsPath();
  try {
    const payload = JSON.parse(await readFile(seedPath, "utf8")) as ConnectLevelSeedFile;
    return normalizeSeedFile(payload, seedPath);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Connect levels are not seeded")) {
      throw error;
    }

    throw new Error("Connect levels are not seeded. Import the generated payload into DataConnect or add it at `data/connect-levels.json`.");
  }
}

function toPublicLevel(level: StoredConnectLevel): ConnectPublicLevel {
  return {
    levelId: level.level_id,
    gridSize: level.grid_size,
    dots: clone(level.dots),
    difficulty: level.difficulty
  };
}

function parseStoreJson(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeStore(raw: unknown, tenantId: string): ConnectStore {
  const parsed = raw && typeof raw === "object" ? (raw as Partial<ConnectStore>) : null;
  return {
    sessions: Array.isArray(parsed?.sessions)
      ? parsed.sessions.filter((session): session is StoredConnectSession => Boolean(session && session.tenantId === tenantId && session.sessionId))
      : [],
    scores: Array.isArray(parsed?.scores)
      ? parsed.scores.filter((score): score is StoredConnectScore => Boolean(score && score.tenantId === tenantId && score.scoreId))
      : []
  };
}

function toCentiseconds(value: number | null) {
  return value === null ? null : Math.max(0, Math.round(value * 100));
}

function fromCentiseconds(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Number((value / 100).toFixed(2)) : null;
}

function buildConnectSessionKey(session: Pick<StoredConnectSession, "tenantId" | "userId" | "dailyKey" | "levelId">) {
  return [session.tenantId, session.userId, session.dailyKey, session.levelId].join(":");
}

function buildConnectScoreKey(score: Pick<StoredConnectScore, "tenantId" | "userId" | "dailyKey" | "levelId">) {
  return [score.tenantId, score.userId, score.dailyKey, score.levelId].join(":");
}

function mapDbSession(record: ConnectSessionDbRecord, tenantId: string): StoredConnectSession | null {
  const levelId = normalizeInteger(record.levelId);
  const dailyIndex = normalizeInteger(record.dailyIndex);
  const hintsUsed = normalizeInteger(record.hintsUsed);

  if (
    record.tenantId !== tenantId ||
    typeof record.sessionId !== "string" ||
    typeof record.userId !== "string" ||
    typeof record.username !== "string" ||
    typeof record.displayName !== "string" ||
    !Number.isFinite(levelId) ||
    !Number.isFinite(dailyIndex) ||
    typeof record.dailyKey !== "string" ||
    !isValidIsoDate(record.startedAt) ||
    !(record.lastHintAt === null || record.lastHintAt === undefined || isValidIsoDate(record.lastHintAt)) ||
    !Number.isFinite(hintsUsed) ||
    !(record.completedAt === null || record.completedAt === undefined || isValidIsoDate(record.completedAt))
  ) {
    return null;
  }

  return {
    sessionId: record.sessionId,
    tenantId,
    userId: record.userId,
    username: record.username,
    displayName: record.displayName,
    levelId,
    dailyIndex,
    dailyKey: record.dailyKey,
    startedAt: record.startedAt,
    lastHintAt: record.lastHintAt ?? null,
    hintsUsed,
    completedAt: record.completedAt ?? null,
    elapsedSeconds: fromCentiseconds(record.elapsedCentiseconds),
    adjustedTimeSeconds: fromCentiseconds(record.adjustedCentiseconds)
  };
}

function mapDbScore(record: ConnectScoreDbRecord, tenantId: string): StoredConnectScore | null {
  const levelId = normalizeInteger(record.levelId);
  const dailyIndex = normalizeInteger(record.dailyIndex);
  const hintsUsed = normalizeInteger(record.hintsUsed);
  const elapsedCentiseconds = normalizeInteger(record.elapsedCentiseconds);
  const adjustedCentiseconds = normalizeInteger(record.adjustedCentiseconds);

  if (
    record.tenantId !== tenantId ||
    typeof record.sessionId !== "string" ||
    typeof record.userId !== "string" ||
    typeof record.username !== "string" ||
    typeof record.displayName !== "string" ||
    !Number.isFinite(levelId) ||
    !Number.isFinite(dailyIndex) ||
    typeof record.dailyKey !== "string" ||
    !isValidIsoDate(record.startedAt) ||
    !isValidIsoDate(record.completedAt) ||
    !Number.isFinite(hintsUsed) ||
    !Number.isFinite(elapsedCentiseconds) ||
    !Number.isFinite(adjustedCentiseconds)
  ) {
    return null;
  }

  return {
    scoreId: record.id ?? buildConnectScoreKey({ tenantId, userId: record.userId, dailyKey: record.dailyKey, levelId }),
    sessionId: record.sessionId,
    tenantId,
    userId: record.userId,
    username: record.username,
    displayName: record.displayName,
    levelId,
    dailyIndex,
    dailyKey: record.dailyKey,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    elapsedSeconds: elapsedCentiseconds / 100,
    hintsUsed,
    adjustedTimeSeconds: adjustedCentiseconds / 100
  };
}

async function loadDataconnectStore(tenantId: string): Promise<ConnectStore> {
  const response = (await getConnectDc().executeGraphqlRead(LIST_CONNECT_STORE_QUERY, {
    operationName: "ListConnectStoreRuntime",
    variables: {
      tenantId,
      sessionLimit: CONNECT_STORE_SCAN_LIMIT,
      scoreLimit: CONNECT_STORE_SCAN_LIMIT
    }
  })) as { data?: { connectSessions?: ConnectSessionDbRecord[]; connectScores?: ConnectScoreDbRecord[] } };

  return {
    sessions: (response.data?.connectSessions ?? []).map((session) => mapDbSession(session, tenantId)).filter((session): session is StoredConnectSession => session !== null),
    scores: (response.data?.connectScores ?? []).map((score) => mapDbScore(score, tenantId)).filter((score): score is StoredConnectScore => score !== null)
  };
}

async function loadLocalStore(tenantId: string) {
  const storePath = resolveConnectStorePath(tenantId);

  try {
    const storeJson = await readFile(storePath, "utf8");
    return normalizeStore(parseStoreJson(storeJson), tenantId);
  } catch {
    return clone(emptyStore);
  }
}

async function writeLocalStore(tenantId: string, store: ConnectStore) {
  const storePath = resolveConnectStorePath(tenantId);
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store)}\n`, "utf8");
}

async function getConnectDbRecordId(query: string, operationName: string, keyName: "sessionKey" | "scoreKey", keyValue: string) {
  const response = (await getConnectDc().executeGraphqlRead(query, {
    operationName,
    variables: {
      [keyName]: keyValue
    }
  })) as { data?: { connectSessions?: Array<{ id?: string }>; connectScores?: Array<{ id?: string }> } };

  return response.data?.connectSessions?.[0]?.id ?? response.data?.connectScores?.[0]?.id ?? null;
}

async function upsertConnectSession(session: StoredConnectSession) {
  const sessionKey = buildConnectSessionKey(session);
  const existingId = await getConnectDbRecordId(GET_CONNECT_SESSION_BY_KEY_QUERY, "GetConnectSessionByKeyRuntime", "sessionKey", sessionKey);
  const variables = {
    sessionId: session.sessionId,
    username: session.username,
    displayName: session.displayName,
    lastHintAt: session.lastHintAt,
    hintsUsed: session.hintsUsed,
    completedAt: session.completedAt,
    elapsedCentiseconds: toCentiseconds(session.elapsedSeconds),
    adjustedCentiseconds: toCentiseconds(session.adjustedTimeSeconds)
  };

  if (existingId) {
    await getConnectDc().executeGraphql(UPDATE_CONNECT_SESSION_MUTATION, {
      operationName: "UpdateConnectSessionRuntime",
      variables: {
        id: existingId,
        ...variables
      }
    });
    return;
  }

  await getConnectDc().executeGraphql(CREATE_CONNECT_SESSION_MUTATION, {
    operationName: "CreateConnectSessionRuntime",
    variables: {
      id: randomUUID(),
      sessionKey,
      tenantId: session.tenantId,
      userId: session.userId,
      levelId: session.levelId,
      dailyIndex: session.dailyIndex,
      dailyKey: session.dailyKey,
      startedAt: session.startedAt,
      ...variables
    }
  });
}

async function upsertConnectScore(score: StoredConnectScore) {
  const scoreKey = buildConnectScoreKey(score);
  const existingId = await getConnectDbRecordId(GET_CONNECT_SCORE_BY_KEY_QUERY, "GetConnectScoreByKeyRuntime", "scoreKey", scoreKey);
  const variables = {
    sessionId: score.sessionId,
    username: score.username,
    displayName: score.displayName,
    startedAt: score.startedAt,
    completedAt: score.completedAt,
    elapsedCentiseconds: toCentiseconds(score.elapsedSeconds) ?? 0,
    hintsUsed: score.hintsUsed,
    adjustedCentiseconds: toCentiseconds(score.adjustedTimeSeconds) ?? 0
  };

  if (existingId) {
    await getConnectDc().executeGraphql(UPDATE_CONNECT_SCORE_MUTATION, {
      operationName: "UpdateConnectScoreRuntime",
      variables: {
        id: existingId,
        ...variables
      }
    });
    return;
  }

  await getConnectDc().executeGraphql(CREATE_CONNECT_SCORE_MUTATION, {
    operationName: "CreateConnectScoreRuntime",
    variables: {
      id: score.scoreId || randomUUID(),
      scoreKey,
      tenantId: score.tenantId,
      userId: score.userId,
      levelId: score.levelId,
      dailyIndex: score.dailyIndex,
      dailyKey: score.dailyKey,
      ...variables
    }
  });
}

async function writeDataconnectStore(store: ConnectStore) {
  const bestScoresByKey = new Map<string, StoredConnectScore>();

  for (const score of store.scores) {
    const key = buildConnectScoreKey(score);
    const current = bestScoresByKey.get(key);
    if (!current || compareStoredScores(score, current) < 0) {
      bestScoresByKey.set(key, score);
    }
  }

  await Promise.all([
    ...store.sessions.map((session) => upsertConnectSession(session)),
    ...[...bestScoresByKey.values()].map((score) => upsertConnectScore(score))
  ]);
}

function shouldFallbackToLocalStore(error: unknown) {
  if (!CONNECT_ALLOW_LOCAL_STORE_FALLBACK) {
    throw new Error(
      `Connect score store requires DataConnect. ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!connectStoreFallbackLogged) {
    connectStoreFallbackLogged = true;
    console.warn("[connect-data] DataConnect score store failed; using explicit local fallback.", {
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return true;
}

async function loadStore(tenantId: string) {
  if (shouldUseDataconnectConnectStore()) {
    try {
      return await loadDataconnectStore(tenantId);
    } catch (error) {
      shouldFallbackToLocalStore(error);
    }
  }

  return loadLocalStore(tenantId);
}

async function writeStore(tenantId: string, store: ConnectStore) {
  if (shouldUseDataconnectConnectStore()) {
    try {
      await writeDataconnectStore(store);
      return;
    } catch (error) {
      shouldFallbackToLocalStore(error);
    }
  }

  await writeLocalStore(tenantId, store);
}

async function transactStore<T>(tenantId: string, mutate: (store: ConnectStore) => T | Promise<T>) {
  const store = await loadStore(tenantId);
  const result = await mutate(store);
  await writeStore(tenantId, store);
  return {
    store,
    result
  };
}

function getViewerUsername(viewer: DevSession) {
  return viewer.email.split("@")[0] || "vyb-student";
}

function compareStoredScores(left: StoredConnectScore, right: StoredConnectScore) {
  if (left.adjustedTimeSeconds !== right.adjustedTimeSeconds) {
    return left.adjustedTimeSeconds - right.adjustedTimeSeconds;
  }

  if (left.elapsedSeconds !== right.elapsedSeconds) {
    return left.elapsedSeconds - right.elapsedSeconds;
  }

  if (left.hintsUsed !== right.hintsUsed) {
    return left.hintsUsed - right.hintsUsed;
  }

  return new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime();
}

function getBestScoreForUser(store: ConnectStore, tenantId: string, dailyKey: string, levelId: number, userId: string) {
  let bestScore: StoredConnectScore | null = null;

  for (const score of store.scores) {
    if (score.tenantId !== tenantId || score.dailyKey !== dailyKey || score.levelId !== levelId || score.userId !== userId) {
      continue;
    }

    if (!bestScore || compareStoredScores(score, bestScore) < 0) {
      bestScore = score;
    }
  }

  return bestScore;
}

function getLatestSessionForViewer(store: ConnectStore, tenantId: string, dailyKey: string, levelId: number, userId: string) {
  let latestSession: StoredConnectSession | null = null;

  for (const session of store.sessions) {
    if (session.tenantId !== tenantId || session.dailyKey !== dailyKey || session.levelId !== levelId || session.userId !== userId) {
      continue;
    }

    if (!latestSession || new Date(session.startedAt).getTime() > new Date(latestSession.startedAt).getTime()) {
      latestSession = session;
    }
  }

  return latestSession;
}

function getRankedEntries(store: ConnectStore, tenantId: string, dailyKey: string, levelId: number): ConnectLeaderboardEntry[] {
  const bestScoresByUser = new Map<string, StoredConnectScore>();

  for (const score of store.scores) {
    if (score.tenantId !== tenantId || score.dailyKey !== dailyKey || score.levelId !== levelId) {
      continue;
    }

    const currentBest = bestScoresByUser.get(score.userId);
    if (!currentBest || compareStoredScores(score, currentBest) < 0) {
      bestScoresByUser.set(score.userId, score);
    }
  }

  let previousAdjustedTimeSeconds: number | null = null;
  let previousRank = 0;

  return [...bestScoresByUser.values()]
    .sort(compareStoredScores)
    .map((score, index) => {
      const organizationRank = previousAdjustedTimeSeconds === score.adjustedTimeSeconds ? previousRank : index + 1;
      previousAdjustedTimeSeconds = score.adjustedTimeSeconds;
      previousRank = organizationRank;

      return {
        rank: organizationRank,
        organizationRank,
        userId: score.userId,
        username: score.username,
        displayName: score.displayName,
        elapsedSeconds: score.elapsedSeconds,
        hintsUsed: score.hintsUsed,
        adjustedTimeSeconds: score.adjustedTimeSeconds,
        completedAt: score.completedAt
      };
    });
}

function getVisibleLeaderboardEntries(entries: ConnectLeaderboardEntry[]) {
  let previousAdjustedTimeSeconds: number | null = null;
  let previousRank = 0;

  return entries.map((entry, index) => {
    const rank = previousAdjustedTimeSeconds === entry.adjustedTimeSeconds ? previousRank : index + 1;
    previousAdjustedTimeSeconds = entry.adjustedTimeSeconds;
    previousRank = rank;

    return {
      ...entry,
      rank
    };
  });
}

function buildDailyResponse(store: ConnectStore, viewer: DevSession, session: StoredConnectSession, level: StoredConnectLevel, dailyState: DailyState): ConnectDailyLevelResponse {
  const rankedEntries = getVisibleLeaderboardEntries(getRankedEntries(store, viewer.tenantId, dailyState.dailyKey, dailyState.levelId));

  return {
    game: "connect",
    sessionId: session.sessionId,
    dailyIndex: dailyState.dailyIndex,
    dailyKey: dailyState.dailyKey,
    launchDate: dailyState.launchDate,
    nextResetAt: dailyState.nextResetAt,
    serverStartedAt: session.startedAt,
    hintsUsed: session.hintsUsed,
    level: toPublicLevel(level),
    leaderboard: rankedEntries.slice(0, 10),
    viewerBest: rankedEntries.find((entry) => entry.userId === viewer.userId) ?? null
  };
}

function pruneOldSessions(store: ConnectStore) {
  const oldestAllowed = Date.now() - 7 * DAY_MS;
  store.sessions = store.sessions.filter((session) => new Date(session.startedAt).getTime() >= oldestAllowed || session.completedAt !== null);
}

function buildViewerStreak(store: ConnectStore, tenantId: string, userId: string, currentDailyKey: string) {
  const solvedDailyKeys = new Set(
    store.scores
      .filter((score) => score.tenantId === tenantId && score.userId === userId)
      .map((score) => score.dailyKey)
  );
  const currentDay = new Date(`${currentDailyKey}T00:00:00.000Z`);

  if (Number.isNaN(currentDay.getTime())) {
    return 0;
  }

  let streak = 0;
  if (!solvedDailyKeys.has(currentDailyKey)) {
    currentDay.setUTCDate(currentDay.getUTCDate() - 1);
  }

  while (true) {
    const dailyKey = currentDay.toISOString().slice(0, 10);
    if (!solvedDailyKeys.has(dailyKey)) {
      break;
    }

    streak += 1;
    currentDay.setUTCDate(currentDay.getUTCDate() - 1);
  }

  return streak;
}

export async function getDailyConnectHubSnapshot(viewer: DevSession): Promise<ConnectDailyHubSnapshot> {
  const { seedFile, levels } = await loadSeedFile();
  const dailyState = getDailyState(levels.length, seedFile);
  const store = await loadStore(viewer.tenantId);
  const rankedEntries = getVisibleLeaderboardEntries(getRankedEntries(store, viewer.tenantId, dailyState.dailyKey, dailyState.levelId));

  return {
    dailyKey: dailyState.dailyKey,
    totalSolvers: rankedEntries.length,
    viewerBest: rankedEntries.find((entry) => entry.userId === viewer.userId) ?? null,
    viewerStreak: buildViewerStreak(store, viewer.tenantId, viewer.userId, dailyState.dailyKey),
    leaderboard: rankedEntries.slice(0, 10)
  };
}

export async function startDailyConnectSession(viewer: DevSession): Promise<ConnectDailyLevelResponse> {
  const { seedFile, levels } = await loadSeedFile();
  const dailyState = getDailyState(levels.length, seedFile);
  const level = levels.find((candidate) => candidate.level_id === dailyState.levelId);

  if (!level) {
    throw new Error("Today's Connect level could not be found.");
  }

  const username = getViewerUsername(viewer);
  const { store, result: session } = await transactStore(viewer.tenantId, (store) => {
    pruneOldSessions(store);
    const existingSession = getLatestSessionForViewer(store, viewer.tenantId, dailyState.dailyKey, dailyState.levelId, viewer.userId);
    if (existingSession) {
      existingSession.username = username;
      existingSession.displayName = viewer.displayName || username;
      refreshConnectSessionToken(existingSession);
      return existingSession;
    }

    const nextSession: StoredConnectSession = {
      sessionId: "",
      tenantId: viewer.tenantId,
      userId: viewer.userId,
      username,
      displayName: viewer.displayName || username,
      levelId: dailyState.levelId,
      dailyIndex: dailyState.dailyIndex,
      dailyKey: dailyState.dailyKey,
      startedAt: new Date().toISOString(),
      lastHintAt: null,
      hintsUsed: 0,
      completedAt: null,
      elapsedSeconds: null,
      adjustedTimeSeconds: null
    };

    const priorBest = getBestScoreForUser(store, viewer.tenantId, dailyState.dailyKey, dailyState.levelId, viewer.userId);
    if (priorBest) {
      nextSession.completedAt = priorBest.completedAt;
      nextSession.elapsedSeconds = priorBest.elapsedSeconds;
      nextSession.hintsUsed = priorBest.hintsUsed;
      nextSession.adjustedTimeSeconds = priorBest.adjustedTimeSeconds;
    }

    refreshConnectSessionToken(nextSession);
    store.sessions.push(nextSession);
    return nextSession;
  });

  return buildDailyResponse(store, viewer, session, level, dailyState);
}

function isCurrentDailySession(session: StoredConnectSession, dailyState: DailyState) {
  return session.dailyKey === dailyState.dailyKey && session.dailyIndex === dailyState.dailyIndex && session.levelId === dailyState.levelId;
}

function getSessionOrThrow(store: ConnectStore, viewer: DevSession, sessionId: string, dailyState?: DailyState) {
  const session = store.sessions.find((candidate) => candidate.sessionId === sessionId && candidate.tenantId === viewer.tenantId && candidate.userId === viewer.userId);

  if (!session) {
    const recoveredSession = decodeConnectSessionToken(viewer, sessionId);

    if (recoveredSession && (!dailyState || isCurrentDailySession(recoveredSession, dailyState))) {
      store.sessions.push(recoveredSession);
      return recoveredSession;
    }

    throw new Error("This Connect session has expired. Open today's puzzle again.");
  }

  if (dailyState && !isCurrentDailySession(session, dailyState)) {
    throw new Error("This Connect session has expired. Open today's puzzle again.");
  }

  return session;
}

function getLevelOrThrow(levels: StoredConnectLevel[], levelId: number) {
  const level = levels.find((candidate) => candidate.level_id === levelId);

  if (!level) {
    throw new Error("Connect level data is missing.");
  }

  return level;
}

function getValidPrefixLength(submittedPath: ConnectCoordinate[], solutionPath: ConnectCoordinate[]) {
  const maxLength = Math.min(submittedPath.length, solutionPath.length);
  let prefixLength = 0;

  while (prefixLength < maxLength && coordinatesEqual(submittedPath[prefixLength], solutionPath[prefixLength])) {
    prefixLength += 1;
  }

  return prefixLength;
}

export async function requestDailyConnectHint(viewer: DevSession, sessionId: string, submittedPath: ConnectCoordinate[]): Promise<ConnectHintResponse> {
  const { seedFile, levels } = await loadSeedFile();
  const dailyState = getDailyState(levels.length, seedFile);
  let hintResponse: ConnectHintResponse | null = null;

  await transactStore(viewer.tenantId, (store) => {
    const session = getSessionOrThrow(store, viewer, sessionId, dailyState);
    const level = getLevelOrThrow(levels, session.levelId);
    const now = Date.now();
    const lastHintTime = session.lastHintAt ? new Date(session.lastHintAt).getTime() : 0;
    const cooldownSeconds = lastHintTime > 0 ? Math.max(0, HINT_COOLDOWN_SECONDS - Math.floor((now - lastHintTime) / 1000)) : 0;

    if (cooldownSeconds > 0) {
      refreshConnectSessionToken(session);
      hintResponse = {
        sessionId: session.sessionId,
        nextMove: null,
        from: null,
        validPrefixLength: getValidPrefixLength(submittedPath, level.solution_path),
        hintsUsed: session.hintsUsed,
        cooldownSeconds,
        ghostExpiresAt: null
      };
      return;
    }

    const validPrefixLength = getValidPrefixLength(submittedPath, level.solution_path);
    const nextMove = level.solution_path[validPrefixLength] ?? null;
    const from = validPrefixLength > 0 ? level.solution_path[validPrefixLength - 1] : null;
    const hintedAt = new Date(now).toISOString();

    if (nextMove) {
      session.hintsUsed += 1;
      session.lastHintAt = hintedAt;
    }

    refreshConnectSessionToken(session);
    hintResponse = {
      sessionId: session.sessionId,
      nextMove: nextMove ? clone(nextMove) : null,
      from: from ? clone(from) : null,
      validPrefixLength,
      hintsUsed: session.hintsUsed,
      cooldownSeconds: nextMove ? HINT_COOLDOWN_SECONDS : 0,
      ghostExpiresAt: nextMove ? new Date(now + HINT_GHOST_SECONDS * 1000).toISOString() : null
    };
  });

  if (!hintResponse) {
    throw new Error("We could not prepare a Connect hint.");
  }

  return hintResponse;
}

function isAdjacentCoordinate(left: ConnectCoordinate, right: ConnectCoordinate) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1;
}

function isCoordinateInsideGrid(point: ConnectCoordinate, gridSize: number) {
  return point.x >= 0 && point.y >= 0 && point.x < gridSize && point.y < gridSize;
}

function isValidConnectSolve(submittedPath: ConnectCoordinate[], level: StoredConnectLevel) {
  if (submittedPath.length !== level.grid_size * level.grid_size) {
    return false;
  }

  const visitedCells = new Set<string>();
  const dotIdsByCell = new Map(level.dots.map((dot) => [cellKey(dot), dot.id]));
  const visitedDotIds: number[] = [];

  for (let index = 0; index < submittedPath.length; index += 1) {
    const point = submittedPath[index];
    const key = cellKey(point);

    if (!isCoordinateInsideGrid(point, level.grid_size) || visitedCells.has(key)) {
      return false;
    }

    if (index > 0 && !isAdjacentCoordinate(submittedPath[index - 1], point)) {
      return false;
    }

    visitedCells.add(key);

    const dotId = dotIdsByCell.get(key);
    if (dotId !== undefined) {
      visitedDotIds.push(dotId);
    }
  }

  return level.dots.every((dot) => visitedDotIds[dot.id - 1] === dot.id) && visitedDotIds.length === level.dots.length;
}

function normalizeClientElapsedSeconds(value: number | null | undefined, serverElapsedSeconds: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return serverElapsedSeconds;
  }

  return Number(Math.min(value, serverElapsedSeconds).toFixed(2));
}

function secondsBetween(startIso: string, endIso: string) {
  const startedAt = new Date(startIso).getTime();
  const endedAt = new Date(endIso).getTime();
  return Number(Math.max(0, (endedAt - startedAt) / 1000).toFixed(2));
}

function buildSubmitResponse(store: ConnectStore, viewer: DevSession, session: StoredConnectSession, message: string, solved: boolean): ConnectSubmitResponse {
  const rankedEntries = getVisibleLeaderboardEntries(getRankedEntries(store, viewer.tenantId, session.dailyKey, session.levelId));

  return {
    solved,
    message,
    sessionId: session.sessionId,
    elapsedSeconds: session.elapsedSeconds,
    hintsUsed: session.hintsUsed,
    adjustedTimeSeconds: session.adjustedTimeSeconds,
    leaderboard: rankedEntries.slice(0, 10),
    viewerBest: rankedEntries.find((entry) => entry.userId === viewer.userId) ?? null
  };
}

export async function submitDailyConnectPath(viewer: DevSession, sessionId: string, submittedPath: ConnectCoordinate[], clientElapsedSeconds?: number | null): Promise<ConnectSubmitResponse> {
  const { seedFile, levels } = await loadSeedFile();
  const dailyState = getDailyState(levels.length, seedFile);
  let submitResponse: ConnectSubmitResponse | null = null;

  await transactStore(viewer.tenantId, (store) => {
    const session = getSessionOrThrow(store, viewer, sessionId, dailyState);
    const level = getLevelOrThrow(levels, session.levelId);
    const priorBest = getBestScoreForUser(store, viewer.tenantId, session.dailyKey, session.levelId, viewer.userId);

    if (priorBest) {
      session.completedAt = priorBest.completedAt;
      session.elapsedSeconds = priorBest.elapsedSeconds;
      session.hintsUsed = priorBest.hintsUsed;
      session.adjustedTimeSeconds = priorBest.adjustedTimeSeconds;
      refreshConnectSessionToken(session);
      submitResponse = buildSubmitResponse(store, viewer, session, "Already solved. Your first valid solve is locked on today's leaderboard.", true);
      return;
    }

    if (session.completedAt) {
      refreshConnectSessionToken(session);
      submitResponse = buildSubmitResponse(store, viewer, session, "Already solved. Your best time is on the leaderboard.", true);
      return;
    }

    if (!isValidConnectSolve(submittedPath, level)) {
      refreshConnectSessionToken(session);
      submitResponse = buildSubmitResponse(store, viewer, session, "All dots must be connected in order before the solve counts.", false);
      return;
    }

    const completedAt = new Date().toISOString();
    const elapsedSeconds = normalizeClientElapsedSeconds(clientElapsedSeconds, secondsBetween(session.startedAt, completedAt));
    const adjustedTimeSeconds = Number((elapsedSeconds + session.hintsUsed * HINT_PENALTY_SECONDS).toFixed(2));

    session.completedAt = completedAt;
    session.elapsedSeconds = elapsedSeconds;
    session.adjustedTimeSeconds = adjustedTimeSeconds;
    refreshConnectSessionToken(session);

    store.scores.push({
      scoreId: randomUUID(),
      sessionId: session.sessionId,
      tenantId: session.tenantId,
      userId: session.userId,
      username: session.username,
      displayName: session.displayName,
      levelId: session.levelId,
      dailyIndex: session.dailyIndex,
      dailyKey: session.dailyKey,
      startedAt: session.startedAt,
      completedAt,
      elapsedSeconds,
      hintsUsed: session.hintsUsed,
      adjustedTimeSeconds
    });

    submitResponse = buildSubmitResponse(store, viewer, session, "Solved. Your adjusted time is live on today's board.", true);
  });

  if (!submitResponse) {
    throw new Error("We could not submit this Connect route.");
  }

  return submitResponse;
}
