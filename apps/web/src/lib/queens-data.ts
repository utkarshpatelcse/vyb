import "server-only";

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  QueensCoordinate,
  QueensDailyLevelResponse,
  QueensDifficulty,
  QueensHintResponse,
  QueensLeaderboardEntry,
  QueensPublicLevel,
  QueensSubmitResponse
} from "@vyb/contracts";
import { getFirebaseDataConnect, loadRootEnv } from "@vyb/config";
import type { DevSession } from "./dev-session";

loadRootEnv();

const DAY_MS = 24 * 60 * 60_000;
const HINT_COOLDOWN_SECONDS = 5;
const HINT_GLOW_SECONDS = 4;
const HINT_PENALTY_SECONDS = 15;
const ERROR_PENALTY_SECONDS = 5;
const NO_HINT_STREAK_POINTS = 25;
const DEFAULT_LAUNCH_DATE = "2026-05-01T00:00:00+05:30";
const QUEENS_GAME_LEVEL_STORE_ID =
  process.env.VYB_QUEENS_GAME_LEVEL_STORE_ID ?? process.env.VYB_QUEENS_LEVEL_STORE_ID ?? "queens-1000-levels";
const QUEENS_REPLAY_TESTER_EMAILS = new Set([
  "utkarsh.2226cse1210@kiet.edu",
  ...(process.env.VYB_QUEENS_REPLAY_TESTER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
]);
const queensConnectorConfig = {
  connector: "connect",
  serviceId: "vyb",
  location: "asia-south1"
};

const GET_QUEENS_LEVEL_STORE_QUERY = `
  query GetQueensGameLevelRuntime($id: String!) {
    gamesLevel(key: { id: $id }) {
      id
      payloadJson
      totalLevels
      launchDate
      checksum
      updatedAt
    }
  }
`;

type StoredQueensLevel = {
  level_id: number;
  grid_size: number;
  regions: number[][];
  solution: QueensCoordinate[];
  difficulty: QueensDifficulty;
  solution_count?: number;
};

type QueensLevelSeedFile = {
  launchDate?: string;
  totalLevels?: number;
  levels?: StoredQueensLevel[];
};

type StoredQueensSession = {
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
  errorsMade: number;
  leaderboardOptIn: boolean;
  completedAt: string | null;
  elapsedSeconds: number | null;
  adjustedTimeSeconds: number | null;
  streakBonusPoints: number;
};

type StoredQueensScore = {
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
  errorsMade: number;
  adjustedTimeSeconds: number;
  streakBonusPoints: number;
};

type QueensStore = {
  sessions: StoredQueensSession[];
  scores: StoredQueensScore[];
};

type DailyState = {
  dailyIndex: number;
  dailyKey: string;
  levelId: number;
  launchDate: string;
  nextResetAt: string;
};

export type QueensDailyHubSnapshot = {
  dailyKey: string;
  totalSolvers: number;
  viewerBest: QueensLeaderboardEntry | null;
  viewerStreak: number;
  leaderboard: QueensLeaderboardEntry[];
};

const emptyStore: QueensStore = {
  sessions: [],
  scores: []
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : Number.NaN;
}

function normalizeCoordinate(value: unknown): QueensCoordinate | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const point = value as Partial<QueensCoordinate>;
  const x = normalizeInteger(point.x);
  const y = normalizeInteger(point.y);

  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function normalizeQueensCoordinates(value: unknown): QueensCoordinate[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const coordinates = value.map((point) => normalizeCoordinate(point));
  return coordinates.some((point) => point === null) ? null : (coordinates as QueensCoordinate[]);
}

function cellKey(point: QueensCoordinate) {
  return `${point.x}:${point.y}`;
}

function coordinatesEqual(left: QueensCoordinate, right: QueensCoordinate) {
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

function getQueensStoreRoot() {
  if (process.env.VYB_QUEENS_STORE_ROOT) {
    return path.join(process.env.VYB_QUEENS_STORE_ROOT, "vyb-queens");
  }

  if (process.env.VERCEL) {
    return path.join("/tmp", "vyb-queens");
  }

  const configuredRoot =
    process.env.VYB_LOCAL_MEDIA_ROOT ??
    process.env.TMPDIR ??
    process.env.TEMP ??
    process.env.TMP ??
    path.join(getWorkspaceRoot(), ".tmp");

  return path.join(configuredRoot, "vyb-queens");
}

function resolveQueensStorePath(tenantId: string) {
  const rootPath = path.resolve(getQueensStoreRoot());
  const absolutePath = path.resolve(rootPath, `${tenantId}.json`);
  const relativeCheck = path.relative(rootPath, absolutePath);

  if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
    throw new Error("Invalid local Queens store path.");
  }

  return absolutePath;
}

function getLaunchDate(seedFile?: QueensLevelSeedFile) {
  return process.env.VYB_QUEENS_LAUNCH_DATE ?? seedFile?.launchDate ?? DEFAULT_LAUNCH_DATE;
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

function getDailyState(levelCount: number, seedFile?: QueensLevelSeedFile): DailyState {
  const launchDate = getLaunchDate(seedFile);
  const launchTime = new Date(launchDate).getTime();

  if (!Number.isFinite(launchTime)) {
    throw new Error("Queens launch date is invalid.");
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

function normalizeLevel(rawLevel: Partial<StoredQueensLevel>): StoredQueensLevel | null {
  const levelId = normalizeInteger(rawLevel.level_id);
  const gridSize = normalizeInteger(rawLevel.grid_size);

  if (!Number.isFinite(levelId) || !Number.isFinite(gridSize) || gridSize < 4) {
    return null;
  }

  if (!Array.isArray(rawLevel.regions) || rawLevel.regions.length !== gridSize || !Array.isArray(rawLevel.solution)) {
    return null;
  }

  const regions = rawLevel.regions.map((row) => (Array.isArray(row) ? row.map((regionId) => normalizeInteger(regionId)) : []));
  if (regions.some((row) => row.length !== gridSize || row.some((regionId) => !Number.isFinite(regionId) || regionId < 1 || regionId > gridSize))) {
    return null;
  }

  const regionIds = new Set(regions.flat());
  if (regionIds.size !== gridSize) {
    return null;
  }

  const solution = rawLevel.solution.map((point) => normalizeCoordinate(point));
  if (
    solution.length !== gridSize ||
    solution.some((point) => !point || point.x < 0 || point.y < 0 || point.x >= gridSize || point.y >= gridSize)
  ) {
    return null;
  }

  return {
    level_id: levelId,
    grid_size: gridSize,
    regions,
    solution: solution as QueensCoordinate[],
    difficulty: rawLevel.difficulty ?? "Advanced",
    solution_count: rawLevel.solution_count
  };
}

let seedFileCache: { seedFile: QueensLevelSeedFile; levels: StoredQueensLevel[] } | null = null;

function getQueensDc() {
  return getFirebaseDataConnect(queensConnectorConfig);
}

async function loadSeedFile() {
  if (seedFileCache) {
    return seedFileCache;
  }

  const response = (await getQueensDc().executeGraphqlRead(GET_QUEENS_LEVEL_STORE_QUERY, {
      operationName: "GetQueensGameLevelRuntime",
      variables: {
        id: QUEENS_GAME_LEVEL_STORE_ID
      }
  })) as { data?: { gamesLevel?: { payloadJson?: string | null } | null } };
  const payloadJson = response.data?.gamesLevel?.payloadJson;

  if (!payloadJson) {
    throw new Error(`Queens levels are not seeded in DataConnect game level store '${QUEENS_GAME_LEVEL_STORE_ID}'.`);
  }

  const seedFile = JSON.parse(payloadJson) as QueensLevelSeedFile;
  const levels = (seedFile.levels ?? []).map((level) => normalizeLevel(level)).filter((level): level is StoredQueensLevel => level !== null);

  if (levels.length === 0) {
    throw new Error(`Queens levels in DataConnect game level store '${QUEENS_GAME_LEVEL_STORE_ID}' are empty or invalid.`);
  }

  seedFileCache = { seedFile, levels };
  return seedFileCache;
}

async function loadLocalStore(tenantId: string): Promise<QueensStore> {
  const storePath = resolveQueensStorePath(tenantId);
  if (!existsSync(storePath)) {
    return clone(emptyStore);
  }

  const store = JSON.parse(await readFile(storePath, "utf8")) as Partial<QueensStore>;
  return {
    sessions: Array.isArray(store.sessions)
      ? store.sessions.map((session) => ({ ...session, leaderboardOptIn: session.leaderboardOptIn !== false }))
      : [],
    scores: Array.isArray(store.scores) ? store.scores : []
  };
}

async function writeLocalStore(tenantId: string, store: QueensStore) {
  const storePath = resolveQueensStorePath(tenantId);
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function transactStore<T>(tenantId: string, mutate: (store: QueensStore) => T | Promise<T>) {
  const store = await loadLocalStore(tenantId);
  const result = await mutate(store);
  await writeLocalStore(tenantId, store);
  return { store, result };
}

function getViewerUsername(viewer: DevSession) {
  return viewer.email.split("@")[0] || "vyb-student";
}

function canReplayQueens(viewer: DevSession) {
  return QUEENS_REPLAY_TESTER_EMAILS.has(viewer.email.trim().toLowerCase());
}

function toPublicLevel(level: StoredQueensLevel): QueensPublicLevel {
  return {
    levelId: level.level_id,
    gridSize: level.grid_size,
    regionCount: level.grid_size,
    regions: clone(level.regions),
    difficulty: level.difficulty
  };
}

function compareStoredScores(left: StoredQueensScore, right: StoredQueensScore) {
  if (left.adjustedTimeSeconds !== right.adjustedTimeSeconds) {
    return left.adjustedTimeSeconds - right.adjustedTimeSeconds;
  }

  if (left.elapsedSeconds !== right.elapsedSeconds) {
    return left.elapsedSeconds - right.elapsedSeconds;
  }

  if (left.hintsUsed !== right.hintsUsed) {
    return left.hintsUsed - right.hintsUsed;
  }

  if (left.errorsMade !== right.errorsMade) {
    return left.errorsMade - right.errorsMade;
  }

  return new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime();
}

function getBestScoreForUser(store: QueensStore, tenantId: string, dailyKey: string, levelId: number, userId: string) {
  let bestScore: StoredQueensScore | null = null;

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

function getLatestSessionForViewer(store: QueensStore, tenantId: string, dailyKey: string, levelId: number, userId: string) {
  let latestSession: StoredQueensSession | null = null;

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

function getRankedEntries(store: QueensStore, tenantId: string, dailyKey: string, levelId: number): QueensLeaderboardEntry[] {
  const bestScoresByUser = new Map<string, StoredQueensScore>();

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
        errorsMade: score.errorsMade,
        adjustedTimeSeconds: score.adjustedTimeSeconds,
        streakBonusPoints: score.streakBonusPoints,
        completedAt: score.completedAt
      };
    });
}

function buildNoHintStreak(store: QueensStore, tenantId: string, userId: string, currentDailyKey: string) {
  const noHintDailyKeys = new Set(
    store.scores
      .filter((score) => score.tenantId === tenantId && score.userId === userId && score.hintsUsed === 0)
      .map((score) => score.dailyKey)
  );
  const currentDay = new Date(`${currentDailyKey}T00:00:00.000Z`);

  if (Number.isNaN(currentDay.getTime())) {
    return 0;
  }

  let streak = 0;
  if (!noHintDailyKeys.has(currentDailyKey)) {
    currentDay.setUTCDate(currentDay.getUTCDate() - 1);
  }

  while (true) {
    const dailyKey = currentDay.toISOString().slice(0, 10);
    if (!noHintDailyKeys.has(dailyKey)) {
      break;
    }

    streak += 1;
    currentDay.setUTCDate(currentDay.getUTCDate() - 1);
  }

  return streak;
}

function buildDailyResponse(store: QueensStore, viewer: DevSession, session: StoredQueensSession, level: StoredQueensLevel, dailyState: DailyState): QueensDailyLevelResponse {
  const rankedEntries = getRankedEntries(store, viewer.tenantId, dailyState.dailyKey, dailyState.levelId);

  return {
    game: "queens",
    sessionId: session.sessionId,
    dailyIndex: dailyState.dailyIndex,
    dailyKey: dailyState.dailyKey,
    launchDate: dailyState.launchDate,
    nextResetAt: dailyState.nextResetAt,
    serverStartedAt: session.startedAt,
    hintsUsed: session.hintsUsed,
    errorsMade: session.errorsMade,
    leaderboardOptIn: session.leaderboardOptIn,
    sessionCompletedAt: session.completedAt,
    elapsedSeconds: session.elapsedSeconds,
    adjustedTimeSeconds: session.adjustedTimeSeconds,
    streakBonusPoints: session.streakBonusPoints,
    level: toPublicLevel(level),
    leaderboard: rankedEntries.slice(0, 10),
    viewerBest: rankedEntries.find((entry) => entry.userId === viewer.userId) ?? null,
    viewerStreak: buildNoHintStreak(store, viewer.tenantId, viewer.userId, dailyState.dailyKey),
    canReplay: canReplayQueens(viewer)
  };
}

function pruneOldSessions(store: QueensStore) {
  const oldestAllowed = Date.now() - 7 * DAY_MS;
  store.sessions = store.sessions.filter((session) => new Date(session.startedAt).getTime() >= oldestAllowed || session.completedAt !== null);
}

export async function getDailyQueensHubSnapshot(viewer: DevSession): Promise<QueensDailyHubSnapshot> {
  const { seedFile, levels } = await loadSeedFile();
  const dailyState = getDailyState(levels.length, seedFile);
  const store = await loadLocalStore(viewer.tenantId);
  const rankedEntries = getRankedEntries(store, viewer.tenantId, dailyState.dailyKey, dailyState.levelId);

  return {
    dailyKey: dailyState.dailyKey,
    totalSolvers: rankedEntries.length,
    viewerBest: rankedEntries.find((entry) => entry.userId === viewer.userId) ?? null,
    viewerStreak: buildNoHintStreak(store, viewer.tenantId, viewer.userId, dailyState.dailyKey),
    leaderboard: rankedEntries.slice(0, 10)
  };
}

export async function startDailyQueensSession(viewer: DevSession, requestedLeaderboardOptIn = true): Promise<QueensDailyLevelResponse> {
  const { seedFile, levels } = await loadSeedFile();
  const dailyState = getDailyState(levels.length, seedFile);
  const level = levels.find((candidate) => candidate.level_id === dailyState.levelId);

  if (!level) {
    throw new Error("Today's Queens level could not be found.");
  }

  const username = getViewerUsername(viewer);
  const allowReplay = canReplayQueens(viewer);
  const { store, result: session } = await transactStore(viewer.tenantId, (store) => {
    pruneOldSessions(store);
    const existingSession = getLatestSessionForViewer(store, viewer.tenantId, dailyState.dailyKey, dailyState.levelId, viewer.userId);

    if (existingSession && (!allowReplay || !existingSession.completedAt)) {
      existingSession.username = username;
      existingSession.displayName = viewer.displayName || username;
      existingSession.leaderboardOptIn = existingSession.leaderboardOptIn !== false;
      return existingSession;
    }

    const nextSession: StoredQueensSession = {
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
      errorsMade: 0,
      leaderboardOptIn: requestedLeaderboardOptIn,
      completedAt: null,
      elapsedSeconds: null,
      adjustedTimeSeconds: null,
      streakBonusPoints: 0
    };

    const priorBest = getBestScoreForUser(store, viewer.tenantId, dailyState.dailyKey, dailyState.levelId, viewer.userId);
    if (priorBest && !allowReplay) {
      nextSession.completedAt = priorBest.completedAt;
      nextSession.elapsedSeconds = priorBest.elapsedSeconds;
      nextSession.hintsUsed = priorBest.hintsUsed;
      nextSession.errorsMade = priorBest.errorsMade;
      nextSession.adjustedTimeSeconds = priorBest.adjustedTimeSeconds;
      nextSession.streakBonusPoints = priorBest.streakBonusPoints;
    }

    store.sessions.push(nextSession);
    return nextSession;
  });

  return buildDailyResponse(store, viewer, session, level, dailyState);
}

function isCurrentDailySession(session: StoredQueensSession, dailyState: DailyState) {
  return session.dailyKey === dailyState.dailyKey && session.dailyIndex === dailyState.dailyIndex && session.levelId === dailyState.levelId;
}

function getSessionOrThrow(store: QueensStore, viewer: DevSession, sessionId: string, dailyState: DailyState) {
  const session = store.sessions.find((candidate) => candidate.sessionId === sessionId && candidate.tenantId === viewer.tenantId && candidate.userId === viewer.userId);

  if (!session) {
    throw new Error("This Queens session has expired. Open today's puzzle again.");
  }

  if (!isCurrentDailySession(session, dailyState)) {
    throw new Error("This Queens session has expired. Open today's puzzle again.");
  }

  return session;
}

function getLevelOrThrow(levels: StoredQueensLevel[], levelId: number) {
  const level = levels.find((candidate) => candidate.level_id === levelId);

  if (!level) {
    throw new Error("Queens level data is missing.");
  }

  return level;
}

function isCoordinateInsideGrid(point: QueensCoordinate, gridSize: number) {
  return point.x >= 0 && point.y >= 0 && point.x < gridSize && point.y < gridSize;
}

function isNoTouchConflict(left: QueensCoordinate, right: QueensCoordinate) {
  return !coordinatesEqual(left, right) && Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y)) <= 1;
}

function getRegionId(level: StoredQueensLevel | QueensPublicLevel, point: QueensCoordinate) {
  return level.regions[point.x]?.[point.y] ?? 0;
}

function uniqueInsideCoordinates(points: QueensCoordinate[], gridSize: number) {
  const seen = new Set<string>();
  const coordinates: QueensCoordinate[] = [];

  for (const point of points) {
    if (!isCoordinateInsideGrid(point, gridSize)) {
      continue;
    }

    const key = cellKey(point);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    coordinates.push(point);
  }

  return coordinates;
}

function buildConflictReport(level: StoredQueensLevel, submittedQueens: QueensCoordinate[]) {
  const queens = uniqueInsideCoordinates(submittedQueens, level.grid_size);
  const conflictKeys = new Set<string>();
  const reasons = new Set<string>();

  for (const queen of submittedQueens) {
    if (!isCoordinateInsideGrid(queen, level.grid_size)) {
      reasons.add("A queen is outside the board.");
      continue;
    }

    const duplicateCount = submittedQueens.filter((candidate) => coordinatesEqual(candidate, queen)).length;
    if (duplicateCount > 1) {
      conflictKeys.add(cellKey(queen));
      reasons.add("Two queens are on the same cell.");
    }
  }

  for (const { groupBy, reason } of [
    { groupBy: (point: QueensCoordinate) => `row:${point.x}`, reason: "Two queens are in the same row." },
    { groupBy: (point: QueensCoordinate) => `col:${point.y}`, reason: "Two queens are in the same column." },
    { groupBy: (point: QueensCoordinate) => `region:${getRegionId(level, point)}`, reason: "Two queens are in the same colored region." }
  ]) {
    const groups = new Map<string, QueensCoordinate[]>();
    for (const queen of queens) {
      const key = groupBy(queen);
      groups.set(key, [...(groups.get(key) ?? []), queen]);
    }

    for (const group of groups.values()) {
      if (group.length > 1) {
        for (const queen of group) {
          conflictKeys.add(cellKey(queen));
        }
        reasons.add(reason);
      }
    }
  }

  for (let leftIndex = 0; leftIndex < queens.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < queens.length; rightIndex += 1) {
      if (isNoTouchConflict(queens[leftIndex], queens[rightIndex])) {
        conflictKeys.add(cellKey(queens[leftIndex]));
        conflictKeys.add(cellKey(queens[rightIndex]));
        reasons.add("Two queens are touching each other, including diagonal touch.");
      }
    }
  }

  return {
    cells: queens.filter((queen) => conflictKeys.has(cellKey(queen))),
    reason: reasons.size > 0 ? [...reasons].join(" ") : null
  };
}

function buildConflictCells(level: StoredQueensLevel, submittedQueens: QueensCoordinate[]) {
  return buildConflictReport(level, submittedQueens).cells;
}

function isBlockedByQueens(level: StoredQueensLevel, point: QueensCoordinate, queens: QueensCoordinate[]) {
  return queens.some((queen) => {
    if (coordinatesEqual(queen, point)) {
      return true;
    }

    return queen.x === point.x || queen.y === point.y || getRegionId(level, queen) === getRegionId(level, point) || isNoTouchConflict(queen, point);
  });
}

function getImpossibleCells(level: StoredQueensLevel, submittedQueens: QueensCoordinate[]) {
  const queens = uniqueInsideCoordinates(submittedQueens, level.grid_size);
  const impossibleCells: QueensCoordinate[] = [];

  for (let x = 0; x < level.grid_size; x += 1) {
    for (let y = 0; y < level.grid_size; y += 1) {
      const point = { x, y };
      if (isBlockedByQueens(level, point, queens)) {
        impossibleCells.push(point);
      }
    }
  }

  return impossibleCells.filter((point) => !queens.some((queen) => coordinatesEqual(queen, point)));
}

function getCandidateCells(level: StoredQueensLevel, submittedQueens: QueensCoordinate[]) {
  const queens = uniqueInsideCoordinates(submittedQueens, level.grid_size);
  const candidates: QueensCoordinate[] = [];

  for (let x = 0; x < level.grid_size; x += 1) {
    for (let y = 0; y < level.grid_size; y += 1) {
      const point = { x, y };
      if (!isBlockedByQueens(level, point, queens)) {
        candidates.push(point);
      }
    }
  }

  return candidates;
}

function solvePartial(level: StoredQueensLevel, submittedQueens: QueensCoordinate[]) {
  if (buildConflictCells(level, submittedQueens).length > 0) {
    return null;
  }

  const fixedQueens = uniqueInsideCoordinates(submittedQueens, level.grid_size);
  const fixedByRow = new Map<number, QueensCoordinate>();
  const usedColumns = new Set<number>();
  const usedRegions = new Set<number>();
  const solution: QueensCoordinate[] = [];

  for (const queen of fixedQueens) {
    if (fixedByRow.has(queen.x)) {
      return null;
    }
    fixedByRow.set(queen.x, queen);
  }

  function canPlace(point: QueensCoordinate, row: number) {
    const regionId = getRegionId(level, point);
    if (usedColumns.has(point.y) || usedRegions.has(regionId)) {
      return false;
    }

    const previous = solution[row - 1];
    return !previous || !isNoTouchConflict(previous, point);
  }

  function place(row: number): boolean {
    if (row === level.grid_size) {
      return usedRegions.size === level.grid_size;
    }

    const fixedQueen = fixedByRow.get(row);
    const choices = fixedQueen ? [fixedQueen] : Array.from({ length: level.grid_size }, (_, y) => ({ x: row, y }));

    for (const point of choices) {
      if (!canPlace(point, row)) {
        continue;
      }

      const regionId = getRegionId(level, point);
      solution[row] = point;
      usedColumns.add(point.y);
      usedRegions.add(regionId);

      if (place(row + 1)) {
        return true;
      }

      usedColumns.delete(point.y);
      usedRegions.delete(regionId);
      solution.pop();
    }

    return false;
  }

  return place(0) ? clone(solution) : null;
}

function buildIsolationHint(level: StoredQueensLevel, submittedQueens: QueensCoordinate[]) {
  const queens = uniqueInsideCoordinates(submittedQueens, level.grid_size);
  const candidateCells = getCandidateCells(level, queens);
  const occupiedRegions = new Set(queens.map((queen) => getRegionId(level, queen)));

  for (let regionId = 1; regionId <= level.grid_size; regionId += 1) {
    if (occupiedRegions.has(regionId)) {
      continue;
    }

    const regionCandidates = candidateCells.filter((point) => getRegionId(level, point) === regionId);
    if (regionCandidates.length === 1) {
      return { point: regionCandidates[0], regionId };
    }
  }

  return null;
}

function isValidQueensSolve(submittedQueens: QueensCoordinate[], level: StoredQueensLevel) {
  const queens = uniqueInsideCoordinates(submittedQueens, level.grid_size);
  return submittedQueens.length === level.grid_size && queens.length === level.grid_size && buildConflictCells(level, queens).length === 0;
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

function buildSubmitResponse(
  store: QueensStore,
  viewer: DevSession,
  session: StoredQueensSession,
  message: string,
  solved: boolean,
  errorCells: QueensCoordinate[],
  errorReason: string | null = null
): QueensSubmitResponse {
  const rankedEntries = getRankedEntries(store, viewer.tenantId, session.dailyKey, session.levelId);

  return {
    solved,
    message,
    sessionId: session.sessionId,
    errorCells,
    errorReason,
    elapsedSeconds: session.elapsedSeconds,
    hintsUsed: session.hintsUsed,
    errorsMade: session.errorsMade,
    adjustedTimeSeconds: session.adjustedTimeSeconds,
    streakBonusPoints: session.streakBonusPoints,
    leaderboard: rankedEntries.slice(0, 10),
    viewerBest: rankedEntries.find((entry) => entry.userId === viewer.userId) ?? null
  };
}

function pointSet(points: QueensCoordinate[]) {
  return new Set(points.map(cellKey));
}

export async function requestDailyQueensHint(
  viewer: DevSession,
  sessionId: string,
  submittedQueens: QueensCoordinate[],
  submittedMarks: QueensCoordinate[] = []
): Promise<QueensHintResponse> {
  const { seedFile, levels } = await loadSeedFile();
  const dailyState = getDailyState(levels.length, seedFile);
  let hintResponse: QueensHintResponse | null = null;

  await transactStore(viewer.tenantId, (store) => {
    const session = getSessionOrThrow(store, viewer, sessionId, dailyState);
    const level = getLevelOrThrow(levels, session.levelId);
    const now = Date.now();
    const lastHintTime = session.lastHintAt ? new Date(session.lastHintAt).getTime() : 0;
    const cooldownSeconds = lastHintTime > 0 ? Math.max(0, HINT_COOLDOWN_SECONDS - Math.floor((now - lastHintTime) / 1000)) : 0;

    if (cooldownSeconds > 0) {
      hintResponse = {
        sessionId: session.sessionId,
        stage: "complete",
        message: `Hint cooling down: ${cooldownSeconds}s.`,
        reason: `Cooldown protects the leaderboard: each hint can be used once every ${HINT_COOLDOWN_SECONDS} seconds.`,
        errorCells: [],
        autoMarkCells: [],
        nextQueen: null,
        regionId: null,
        hintsUsed: session.hintsUsed,
        errorsMade: session.errorsMade,
        cooldownSeconds,
        hintExpiresAt: null
      };
      return;
    }

    const queens = uniqueInsideCoordinates(submittedQueens, level.grid_size);
    const conflictCells = buildConflictCells(level, submittedQueens);
    const markKeys = pointSet(uniqueInsideCoordinates(submittedMarks, level.grid_size));
    const queenKeys = pointSet(queens);
    let stage: QueensHintResponse["stage"] = "complete";
    let message = "The board is already solved.";
    let reason = "All row, column, region, and no-touch constraints are already satisfied.";
    let autoMarkCells: QueensCoordinate[] = [];
    let nextQueen: QueensCoordinate | null = null;
    let regionId: number | null = null;

    if (conflictCells.length > 0) {
      stage = "conflict";
      message = "Conflict found. A highlighted queen breaks row, column, region, or no-touch rules.";
      reason = "Hints start with conflicts because an invalid queen can make later eliminations misleading.";
    } else if (isValidQueensSolve(queens, level)) {
      stage = "complete";
    } else {
      autoMarkCells = getImpossibleCells(level, queens).filter((point) => !markKeys.has(cellKey(point)) && !queenKeys.has(cellKey(point)));

      if (autoMarkCells.length > 0) {
        stage = "auto-x";
        message = "Auto-X marked cells that cannot hold a queen from your current board.";
        reason = "Those cells are blocked by an existing queen's row, column, region, or no-touch zone.";
      } else {
        const isolationHint = buildIsolationHint(level, queens);
        const completion = solvePartial(level, queens) ?? level.solution;
        const missingQueen = completion.find((point) => !queenKeys.has(cellKey(point))) ?? null;
        nextQueen = isolationHint?.point ?? missingQueen;
        regionId = isolationHint ? isolationHint.regionId : nextQueen ? getRegionId(level, nextQueen) : null;
        stage = nextQueen ? "reveal" : "complete";
        message = isolationHint
          ? `Region ${isolationHint.regionId} has only one viable queen cell.`
          : nextQueen
            ? "Next queen revealed from the solution path."
            : "No hint needed. The board is complete.";
        reason = isolationHint
          ? "Every other cell in that region is blocked by your current queen placements."
          : nextQueen
            ? "No simpler elimination is available from the current board, so the next unsolved solution queen is shown."
            : "Every required queen is already placed without conflicts.";
      }
    }

    if (stage !== "complete") {
      session.hintsUsed += 1;
      session.lastHintAt = new Date(now).toISOString();
    }

    hintResponse = {
      sessionId: session.sessionId,
      stage,
      message,
      reason,
      errorCells: clone(conflictCells),
      autoMarkCells: clone(autoMarkCells),
      nextQueen: nextQueen ? clone(nextQueen) : null,
      regionId,
      hintsUsed: session.hintsUsed,
      errorsMade: session.errorsMade,
      cooldownSeconds: stage === "complete" ? 0 : HINT_COOLDOWN_SECONDS,
      hintExpiresAt: stage === "complete" ? null : new Date(now + HINT_GLOW_SECONDS * 1000).toISOString()
    };
  });

  if (!hintResponse) {
    throw new Error("We could not prepare a Queens hint.");
  }

  return hintResponse;
}

export async function submitDailyQueensSolve(
  viewer: DevSession,
  sessionId: string,
  submittedQueens: QueensCoordinate[],
  clientElapsedSeconds?: number | null
): Promise<QueensSubmitResponse> {
  const { seedFile, levels } = await loadSeedFile();
  const dailyState = getDailyState(levels.length, seedFile);
  let submitResponse: QueensSubmitResponse | null = null;
  const allowReplay = canReplayQueens(viewer);

  await transactStore(viewer.tenantId, (store) => {
    const session = getSessionOrThrow(store, viewer, sessionId, dailyState);
    const level = getLevelOrThrow(levels, session.levelId);
    const priorBest = getBestScoreForUser(store, viewer.tenantId, session.dailyKey, session.levelId, viewer.userId);

    if (priorBest && !allowReplay) {
      session.completedAt = priorBest.completedAt;
      session.elapsedSeconds = priorBest.elapsedSeconds;
      session.hintsUsed = priorBest.hintsUsed;
      session.errorsMade = priorBest.errorsMade;
      session.adjustedTimeSeconds = priorBest.adjustedTimeSeconds;
      session.streakBonusPoints = priorBest.streakBonusPoints;
      submitResponse = buildSubmitResponse(store, viewer, session, "Already solved. Your first valid solve is locked on today's leaderboard.", true, []);
      return;
    }

    if (session.completedAt && !allowReplay) {
      submitResponse = buildSubmitResponse(store, viewer, session, "Already solved. Your best time is on the leaderboard.", true, []);
      return;
    }

    const conflictReport = buildConflictReport(level, submittedQueens);
    const conflictCells = conflictReport.cells;
    if (!isValidQueensSolve(submittedQueens, level)) {
      if (submittedQueens.length === level.grid_size) {
        session.errorsMade += 1;
      }

      const message =
        submittedQueens.length === level.grid_size
          ? "That queen set breaks at least one rule. Fix the red cells and try again."
          : `Place exactly ${level.grid_size} queens before submitting.`;
      submitResponse = buildSubmitResponse(
        store,
        viewer,
        session,
        conflictReport.reason ? `${message} Reason: ${conflictReport.reason}` : message,
        false,
        conflictCells,
        conflictReport.reason
      );
      return;
    }

    const completedAt = new Date().toISOString();
    const elapsedSeconds = normalizeClientElapsedSeconds(clientElapsedSeconds, secondsBetween(session.startedAt, completedAt));
    const adjustedTimeSeconds = Number((elapsedSeconds + session.hintsUsed * HINT_PENALTY_SECONDS + session.errorsMade * ERROR_PENALTY_SECONDS).toFixed(2));
    const priorNoHintStreak = buildNoHintStreak(store, viewer.tenantId, viewer.userId, session.dailyKey);
    const streakBonusPoints = session.hintsUsed === 0 ? Math.min(250, (priorNoHintStreak + 1) * NO_HINT_STREAK_POINTS) : 0;

    session.completedAt = completedAt;
    session.elapsedSeconds = elapsedSeconds;
    session.adjustedTimeSeconds = adjustedTimeSeconds;
    session.streakBonusPoints = streakBonusPoints;

    if (session.leaderboardOptIn) {
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
        errorsMade: session.errorsMade,
        adjustedTimeSeconds,
        streakBonusPoints
      });
    }

    submitResponse = buildSubmitResponse(
      store,
      viewer,
      session,
      session.leaderboardOptIn ? "Solved. Your adjusted time is live on today's Queens board." : "Solved. This run stayed off the leaderboard.",
      true,
      []
    );
  });

  if (!submitResponse) {
    throw new Error("We could not submit this Queens solve.");
  }

  return submitResponse;
}
