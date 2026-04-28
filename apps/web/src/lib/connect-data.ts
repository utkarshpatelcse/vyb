import "server-only";

import { randomUUID } from "node:crypto";
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
import { getFirebaseDataConnect } from "@vyb/config";
import type { DevSession } from "./dev-session";

const DAY_MS = 24 * 60 * 60_000;
const HINT_COOLDOWN_SECONDS = 5;
const HINT_GHOST_SECONDS = 3;
const HINT_PENALTY_SECONDS = 3;
const DEFAULT_LAUNCH_DATE = "2026-04-28T00:00:00+05:30";
const CONNECT_LEVEL_STORE_ID = process.env.VYB_CONNECT_LEVEL_STORE_ID ?? "official-1000";
const connectConnectorConfig = {
  connector: "connect",
  serviceId: "vyb",
  location: "asia-south1"
};

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
  if (process.env.VYB_CONNECT_LEVELS_SOURCE === "local") {
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
      return null;
    }

    return normalizeSeedFile(JSON.parse(store.payloadJson) as ConnectLevelSeedFile, `DataConnect store ${CONNECT_LEVEL_STORE_ID}`);
  } catch (error) {
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

async function loadStore(tenantId: string) {
  const storePath = resolveConnectStorePath(tenantId);

  try {
    const storeJson = await readFile(storePath, "utf8");
    return normalizeStore(parseStoreJson(storeJson), tenantId);
  } catch {
    return clone(emptyStore);
  }
}

async function writeStore(tenantId: string, store: ConnectStore) {
  const storePath = resolveConnectStorePath(tenantId);
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store)}\n`, "utf8");
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

  return [...bestScoresByUser.values()]
    .sort(compareStoredScores)
    .map((score, index) => ({
      rank: index + 1,
      userId: score.userId,
      username: score.username,
      displayName: score.displayName,
      elapsedSeconds: score.elapsedSeconds,
      hintsUsed: score.hintsUsed,
      adjustedTimeSeconds: score.adjustedTimeSeconds,
      completedAt: score.completedAt
    }));
}

function buildDailyResponse(store: ConnectStore, viewer: DevSession, session: StoredConnectSession, level: StoredConnectLevel, dailyState: DailyState): ConnectDailyLevelResponse {
  const rankedEntries = getRankedEntries(store, viewer.tenantId, dailyState.dailyKey, dailyState.levelId);

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
  const rankedEntries = getRankedEntries(store, viewer.tenantId, dailyState.dailyKey, dailyState.levelId);

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
      return existingSession;
    }

    const nextSession: StoredConnectSession = {
      sessionId: randomUUID(),
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

    store.sessions.push(nextSession);
    return nextSession;
  });

  return buildDailyResponse(store, viewer, session, level, dailyState);
}

function getSessionOrThrow(store: ConnectStore, viewer: DevSession, sessionId: string) {
  const session = store.sessions.find((candidate) => candidate.sessionId === sessionId && candidate.tenantId === viewer.tenantId && candidate.userId === viewer.userId);

  if (!session) {
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
  const { levels } = await loadSeedFile();
  let hintResponse: ConnectHintResponse | null = null;

  await transactStore(viewer.tenantId, (store) => {
    const session = getSessionOrThrow(store, viewer, sessionId);
    const level = getLevelOrThrow(levels, session.levelId);
    const now = Date.now();
    const lastHintTime = session.lastHintAt ? new Date(session.lastHintAt).getTime() : 0;
    const cooldownSeconds = lastHintTime > 0 ? Math.max(0, HINT_COOLDOWN_SECONDS - Math.floor((now - lastHintTime) / 1000)) : 0;

    if (cooldownSeconds > 0) {
      hintResponse = {
        sessionId,
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

    hintResponse = {
      sessionId,
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

function isExactSolution(submittedPath: ConnectCoordinate[], solutionPath: ConnectCoordinate[]) {
  return submittedPath.length === solutionPath.length && submittedPath.every((point, index) => coordinatesEqual(point, solutionPath[index]));
}

function secondsBetween(startIso: string, endIso: string) {
  const startedAt = new Date(startIso).getTime();
  const endedAt = new Date(endIso).getTime();
  return Number(Math.max(0, (endedAt - startedAt) / 1000).toFixed(2));
}

function buildSubmitResponse(store: ConnectStore, viewer: DevSession, session: StoredConnectSession, message: string, solved: boolean): ConnectSubmitResponse {
  const rankedEntries = getRankedEntries(store, viewer.tenantId, session.dailyKey, session.levelId);

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

export async function submitDailyConnectPath(viewer: DevSession, sessionId: string, submittedPath: ConnectCoordinate[]): Promise<ConnectSubmitResponse> {
  const { levels } = await loadSeedFile();
  let submitResponse: ConnectSubmitResponse | null = null;

  await transactStore(viewer.tenantId, (store) => {
    const session = getSessionOrThrow(store, viewer, sessionId);
    const level = getLevelOrThrow(levels, session.levelId);
    const priorBest = getBestScoreForUser(store, viewer.tenantId, session.dailyKey, session.levelId, viewer.userId);

    if (priorBest) {
      session.completedAt = priorBest.completedAt;
      session.elapsedSeconds = priorBest.elapsedSeconds;
      session.hintsUsed = priorBest.hintsUsed;
      session.adjustedTimeSeconds = priorBest.adjustedTimeSeconds;
      submitResponse = buildSubmitResponse(store, viewer, session, "Already solved. Your first valid solve is locked on today's leaderboard.", true);
      return;
    }

    if (session.completedAt) {
      submitResponse = buildSubmitResponse(store, viewer, session, "Already solved. Your best time is on the leaderboard.", true);
      return;
    }

    if (!isExactSolution(submittedPath, level.solution_path)) {
      submitResponse = buildSubmitResponse(store, viewer, session, "All dots must be connected in order before the solve counts.", false);
      return;
    }

    const completedAt = new Date().toISOString();
    const elapsedSeconds = secondsBetween(session.startedAt, completedAt);
    const adjustedTimeSeconds = Number((elapsedSeconds + session.hintsUsed * HINT_PENALTY_SECONDS).toFixed(2));

    session.completedAt = completedAt;
    session.elapsedSeconds = elapsedSeconds;
    session.adjustedTimeSeconds = adjustedTimeSeconds;

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
