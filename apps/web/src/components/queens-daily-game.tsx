"use client";

import type {
  QueensCoordinate,
  QueensDailyLevelResponse,
  QueensHintResponse,
  QueensSubmitResponse
} from "@vyb/contracts";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";

type QueensDailyGameProps = {
  onExit?: () => void;
  backHref?: string;
};

type BoardSnapshot = {
  queens: string[];
  marks: string[];
};

type ActiveHint = {
  stage: QueensHintResponse["stage"];
  errorCells: QueensCoordinate[];
  autoMarkCells: QueensCoordinate[];
  nextQueen: QueensCoordinate | null;
  regionId: number | null;
  expiresAt: string | null;
};

const REGION_COLORS = [
  "#E08A8A", // soft red
  "#7BB5A3", // muted teal
  "#A390E4", // soft purple
  "#E0B371", // soft gold
  "#74A9D1", // soft blue
  "#D98EAA", // soft pink
  "#95BA82", // muted green
  "#D1A78B", // warm beige
  "#6E95A8", // steel blue
  "#B594BC"  // lilac
];

const QUEENS_LEADERBOARD_SETTING_KEY = "vyb-queens-leaderboard-opt-in";
const QUEENS_AUTO_X_SETTING_KEY = "vyb-queens-auto-fill-x";

function readBooleanSetting(key: string, fallback: boolean) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const stored = window.localStorage.getItem(key);
  if (stored === "off" || stored === "false" || stored === "0") {
    return false;
  }

  if (stored === "on" || stored === "true" || stored === "1") {
    return true;
  }

  return fallback;
}

function writeBooleanSetting(key: string, value: boolean) {
  window.localStorage.setItem(key, value ? "on" : "off");
}

function cellKey(point: QueensCoordinate) {
  return `${point.x}:${point.y}`;
}

function pointFromKey(key: string): QueensCoordinate {
  const [x, y] = key.split(":").map((part) => Number.parseInt(part, 10));
  return { x, y };
}

function formatSeconds(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  if (value < 60) {
    return `${value.toFixed(value % 1 === 0 ? 0 : 1)}s`;
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value - minutes * 60);
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Queens request failed.");
  }

  if (!payload) {
    throw new Error("Queens returned an empty response.");
  }

  return payload;
}

function buildSolvedResultFromDaily(daily: QueensDailyLevelResponse): QueensSubmitResponse | null {
  if (daily.canReplay) {
    return null;
  }

  if (!daily.viewerBest && !daily.sessionCompletedAt) {
    return null;
  }

  return {
    solved: true,
    message: daily.leaderboardOptIn
      ? "Already solved. Your first valid solve is locked on today's leaderboard."
      : "Already solved. This run stayed off the leaderboard.",
    sessionId: daily.sessionId,
    errorCells: [],
    errorReason: null,
    elapsedSeconds: daily.viewerBest?.elapsedSeconds ?? daily.elapsedSeconds,
    hintsUsed: daily.viewerBest?.hintsUsed ?? daily.hintsUsed,
    errorsMade: daily.viewerBest?.errorsMade ?? daily.errorsMade,
    adjustedTimeSeconds: daily.viewerBest?.adjustedTimeSeconds ?? daily.adjustedTimeSeconds,
    streakBonusPoints: daily.viewerBest?.streakBonusPoints ?? daily.streakBonusPoints,
    leaderboard: daily.leaderboard,
    viewerBest: daily.viewerBest
  };
}

function buildBoardSnapshot(queens: Set<string>, marks: Set<string>): BoardSnapshot {
  return {
    queens: [...queens],
    marks: [...marks]
  };
}

function getRegionId(regions: number[][], point: QueensCoordinate) {
  return regions[point.x]?.[point.y] ?? 0;
}

function touches(left: QueensCoordinate, right: QueensCoordinate) {
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y)) <= 1;
}

function buildLocalConflicts(regions: number[][], queens: QueensCoordinate[]) {
  const conflictKeys = new Set<string>();
  const reasons = new Set<string>();

  for (const { groupBy, reason } of [
    { groupBy: (point: QueensCoordinate) => `row:${point.x}`, reason: "Two queens are in the same row." },
    { groupBy: (point: QueensCoordinate) => `column:${point.y}`, reason: "Two queens are in the same column." },
    { groupBy: (point: QueensCoordinate) => `region:${getRegionId(regions, point)}`, reason: "Two queens are in the same colored region." }
  ]) {
    const groups = new Map<string, QueensCoordinate[]>();
    for (const queen of queens) {
      const groupKey = groupBy(queen);
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), queen]);
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
      if (touches(queens[leftIndex], queens[rightIndex])) {
        conflictKeys.add(cellKey(queens[leftIndex]));
        conflictKeys.add(cellKey(queens[rightIndex]));
        reasons.add("Two queens are touching each other, including diagonal touch.");
      }
    }
  }

  return {
    keys: conflictKeys,
    reason: reasons.size > 0 ? [...reasons].join(" ") : null
  };
}

function buildGhostMarks(regions: number[][], queens: QueensCoordinate[]) {
  const ghostKeys = new Set<string>();

  for (let x = 0; x < regions.length; x += 1) {
    for (let y = 0; y < regions.length; y += 1) {
      const point = { x, y };
      if (
        queens.some(
          (queen) =>
            cellKey(queen) !== cellKey(point) &&
            (queen.x === x || queen.y === y || getRegionId(regions, queen) === getRegionId(regions, point) || touches(queen, point))
        )
      ) {
        ghostKeys.add(cellKey(point));
      }
    }
  }

  return ghostKeys;
}

export function QueensDailyGame({ onExit, backHref = "/hub/gameshub" }: QueensDailyGameProps) {
  const router = useRouter();
  const [daily, setDaily] = useState<QueensDailyLevelResponse | null>(null);
  const [queenKeys, setQueenKeys] = useState<Set<string>>(() => new Set());
  const [markKeys, setMarkKeys] = useState<Set<string>>(() => new Set());
  const [history, setHistory] = useState<BoardSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hintBusy, setHintBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<QueensSubmitResponse | null>(null);
  const [activeHint, setActiveHint] = useState<ActiveHint | null>(null);
  const [highlightedRegionId, setHighlightedRegionId] = useState<number | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [localCompletionElapsedSeconds, setLocalCompletionElapsedSeconds] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboardPreference, setLeaderboardPreference] = useState(true);
  const [autoFillX, setAutoFillX] = useState(false);
  const autoSubmitKeyRef = useRef("");
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const singleTapTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ key: string; time: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDailyPuzzle() {
      setIsLoading(true);
      setError(null);
      setMessage(null);
      setResult(null);
      setQueenKeys(new Set());
      setMarkKeys(new Set());
      setHistory([]);
      setActiveHint(null);
      setHighlightedRegionId(null);
      setCooldownUntil(null);
      setLocalCompletionElapsedSeconds(null);
      autoSubmitKeyRef.current = "";

      try {
        const nextLeaderboardPreference = readBooleanSetting(QUEENS_LEADERBOARD_SETTING_KEY, true);
        setLeaderboardPreference(nextLeaderboardPreference);
        setAutoFillX(readBooleanSetting(QUEENS_AUTO_X_SETTING_KEY, false));
        const dailyUrl = `/api/games/queens/daily${nextLeaderboardPreference ? "" : "?leaderboard=off"}`;
        const response = await fetch(dailyUrl, { method: "GET" });
        const payload = await readJsonResponse<QueensDailyLevelResponse>(response);

        if (!cancelled) {
          const solvedResult = buildSolvedResultFromDaily(payload);
          setDaily(payload);
          setResult(solvedResult);
          setMessage(solvedResult?.message ?? "Daily Queens is ready.");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "We could not load Queens.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDailyPuzzle();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
      if (singleTapTimerRef.current !== null) {
        window.clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!activeHint?.expiresAt) {
      return;
    }

    const expiresIn = Math.max(0, new Date(activeHint.expiresAt).getTime() - Date.now());
    const timeoutId = window.setTimeout(() => setActiveHint(null), expiresIn);
    return () => window.clearTimeout(timeoutId);
  }, [activeHint]);

  const level = daily?.level ?? null;
  const queens = useMemo(() => [...queenKeys].map(pointFromKey), [queenKeys]);
  const marks = useMemo(() => [...markKeys].map(pointFromKey), [markKeys]);
  const localConflictReport = useMemo(() => (level ? buildLocalConflicts(level.regions, queens) : { keys: new Set<string>(), reason: null }), [level, queens]);
  const localConflictKeys = localConflictReport.keys;
  const placementErrorReason = localConflictReport.reason;
  const hintConflictKeys = useMemo(() => new Set((activeHint?.errorCells ?? []).map(cellKey)), [activeHint]);
  const activeAutoMarkKeys = useMemo(() => new Set((activeHint?.autoMarkCells ?? []).map(cellKey)), [activeHint]);
  const nextQueenKey = activeHint?.nextQueen ? cellKey(activeHint.nextQueen) : null;
  const ghostMarkKeys = useMemo(() => (level ? buildGhostMarks(level.regions, queens) : new Set<string>()), [level, queens]);
  const liveElapsedSeconds = daily ? Math.max(0, (nowMs - new Date(daily.serverStartedAt).getTime()) / 1000) : null;
  const elapsedSeconds = result?.elapsedSeconds ?? localCompletionElapsedSeconds ?? liveElapsedSeconds;
  const cooldownRemaining = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - nowMs) / 1000)) : 0;
  const hasFilledQueens = Boolean(level && queenKeys.size === level.gridSize);

  useEffect(() => {
    if (!level || !hasFilledQueens || submitBusy || result?.solved) {
      return;
    }

    const boardKey = [...queenKeys].sort().join("|");
    if (autoSubmitKeyRef.current === boardKey) {
      return;
    }

    autoSubmitKeyRef.current = boardKey;
    const completedElapsedSeconds = liveElapsedSeconds === null ? null : Number(liveElapsedSeconds.toFixed(2));
    setLocalCompletionElapsedSeconds(completedElapsedSeconds);
    setMessage("Checking board...");
    void submitBoard(completedElapsedSeconds);
  }, [hasFilledQueens, level, queenKeys, result?.solved, submitBusy]);

  function handleExit() {
    if (onExit) {
      onExit();
      return;
    }

    router.replace(backHref);
  }

  function pushHistory(currentQueens = queenKeys, currentMarks = markKeys) {
    setHistory((current) => [...current.slice(-39), buildBoardSnapshot(currentQueens, currentMarks)]);
  }

  function applySnapshot(snapshot: BoardSnapshot) {
    autoSubmitKeyRef.current = "";
    setQueenKeys(new Set(snapshot.queens));
    setMarkKeys(new Set(snapshot.marks));
    setActiveHint(null);
    setLocalCompletionElapsedSeconds(null);
    setResult((current) => (current?.solved ? current : null));
  }

  function cycleCell(point: QueensCoordinate) {
    if (!level || result?.solved) {
      return;
    }

    const key = cellKey(point);
    pushHistory();
    setActiveHint(null);
    setHighlightedRegionId(null);
    setLocalCompletionElapsedSeconds(null);
    setResult((current) => (current?.solved ? current : null));

    if (!markKeys.has(key) && !queenKeys.has(key)) {
      setMarkKeys((current) => new Set(current).add(key));
      setMessage("Cell marked.");
      return;
    }

    if (markKeys.has(key)) {
      setMarkKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      setQueenKeys((current) => new Set(current).add(key));
      setMessage("Queen placed.");
      return;
    }

    setQueenKeys((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setMessage("Cell cleared.");
  }

  function toggleQueen(point: QueensCoordinate) {
    if (!level || result?.solved) {
      return;
    }

    const key = cellKey(point);
    pushHistory();
    setActiveHint(null);
    setHighlightedRegionId(null);
    setLocalCompletionElapsedSeconds(null);
    setMarkKeys((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setQueenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
        setMessage("Queen removed.");
      } else {
        next.add(key);
        setMessage("Queen placed.");
      }
      return next;
    });
  }

  function handlePointerDown(point: QueensCoordinate, event: ReactPointerEvent<HTMLButtonElement>) {
    if (!level || result?.solved) {
      return;
    }

    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setHighlightedRegionId(getRegionId(level.regions, point));
      setMessage(`Region ${getRegionId(level.regions, point)} highlighted.`);
    }, 420);

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleCellClick(point: QueensCoordinate) {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    const key = cellKey(point);
    const now = Date.now();
    const lastTap = lastTapRef.current;

    if (lastTap?.key === key && now - lastTap.time < 280) {
      if (singleTapTimerRef.current !== null) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = null;
      toggleQueen(point);
      return;
    }

    lastTapRef.current = { key, time: now };
    if (singleTapTimerRef.current !== null) {
      window.clearTimeout(singleTapTimerRef.current);
    }

    singleTapTimerRef.current = window.setTimeout(() => {
      cycleCell(point);
      singleTapTimerRef.current = null;
    }, 190);
  }

  function undoMove() {
    if (result?.solved) {
      return;
    }

    setHistory((current) => {
      const previous = current[current.length - 1];
      if (previous) {
        applySnapshot(previous);
        setMessage("Move undone.");
      }
      return current.slice(0, -1);
    });
  }

  function resetBoard() {
    if (result?.solved) {
      return;
    }

    pushHistory();
    autoSubmitKeyRef.current = "";
    setQueenKeys(new Set());
    setMarkKeys(new Set());
    setActiveHint(null);
    setHighlightedRegionId(null);
    setLocalCompletionElapsedSeconds(null);
    setResult(null);
    setMessage("Board reset.");
  }

  async function requestHint() {
    if (!daily || cooldownRemaining > 0 || hintBusy || result?.solved) {
      return;
    }

    setHintBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/games/queens/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: daily.sessionId,
          queens,
          marks
        })
      });
      const payload = await readJsonResponse<QueensHintResponse>(response);
      const hintMessage = payload.reason ? `${payload.message} Reason: ${payload.reason}` : payload.message;

      setDaily((current) =>
        current
          ? {
              ...current,
              sessionId: payload.sessionId,
              hintsUsed: payload.hintsUsed,
              errorsMade: payload.errorsMade
            }
          : current
      );

      if (payload.cooldownSeconds > 0) {
        setCooldownUntil(Date.now() + payload.cooldownSeconds * 1000);
      }

      setActiveHint({
        stage: payload.stage,
        errorCells: payload.errorCells,
        autoMarkCells: payload.autoMarkCells,
        nextQueen: payload.nextQueen,
        regionId: payload.regionId,
        expiresAt: payload.hintExpiresAt
      });

      if (payload.autoMarkCells.length > 0) {
        pushHistory();
        setMarkKeys((current) => {
          const next = new Set(current);
          for (const point of payload.autoMarkCells) {
            next.add(cellKey(point));
          }
          return next;
        });
      }

      if (payload.regionId) {
        setHighlightedRegionId(payload.regionId);
      }

      setMessage(hintMessage);
    } catch (hintError) {
      setError(hintError instanceof Error ? hintError.message : "We could not fetch a hint.");
    } finally {
      setHintBusy(false);
    }
  }

  async function submitBoard(completedElapsedSeconds = localCompletionElapsedSeconds) {
    if (!daily || !level || submitBusy || result?.solved) {
      return;
    }

    setSubmitBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/games/queens/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: daily.sessionId,
          queens,
          clientElapsedSeconds: completedElapsedSeconds
        })
      });
      const payload = await readJsonResponse<QueensSubmitResponse>(response);

      setResult(payload);
      if (!payload.solved) {
        setLocalCompletionElapsedSeconds(null);
        setActiveHint({
          stage: "conflict",
          errorCells: payload.errorCells,
          autoMarkCells: [],
          nextQueen: null,
          regionId: null,
          expiresAt: null
        });
      }

      setDaily((current) =>
        current
          ? {
              ...current,
              sessionId: payload.sessionId,
              hintsUsed: payload.hintsUsed,
              errorsMade: payload.errorsMade,
              leaderboard: payload.leaderboard,
              viewerBest: payload.viewerBest
            }
          : current
      );
      setMessage(payload.errorReason && !payload.message.includes("Reason:") ? `${payload.message} Reason: ${payload.errorReason}` : payload.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We could not submit this board.");
    } finally {
      setSubmitBusy(false);
    }
  }

  async function inviteFriends() {
    const url = `${window.location.origin}/hub/gameshub/queens`;
    const text = "Try today's Queens puzzle on Vyb.";

    try {
      if (navigator.share) {
        await navigator.share({ title: "Vyb Queens", text, url });
        setMessage("Invite opened.");
        return;
      }

      await navigator.clipboard?.writeText(`${text}\n${url}`);
      setMessage("Invite link copied.");
    } catch {
      setMessage("Invite link is ready to share.");
    }
  }

  function toggleLeaderboardPreference() {
    const nextPreference = !leaderboardPreference;
    setLeaderboardPreference(nextPreference);
    writeBooleanSetting(QUEENS_LEADERBOARD_SETTING_KEY, nextPreference);
    setMessage(daily ? "Leaderboard setting saved. It applies from the next game." : "Leaderboard setting saved.");
  }

  function toggleAutoFillX() {
    const nextAutoFill = !autoFillX;
    setAutoFillX(nextAutoFill);
    writeBooleanSetting(QUEENS_AUTO_X_SETTING_KEY, nextAutoFill);
    setMessage(nextAutoFill ? "Auto-fill X enabled." : "Auto-fill X disabled.");
  }

  function renderSettingsMenu() {
    const isLeaderboardPending = daily ? leaderboardPreference !== daily.leaderboardOptIn : false;

    return (
      <div className="vyb-game-settings">
        <button
          type="button"
          className="vyb-game-settings-button"
          onClick={() => setSettingsOpen((current) => !current)}
          aria-label="Game settings"
          aria-expanded={settingsOpen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </button>
        {settingsOpen ? (
          <div className="vyb-game-settings-menu">
            <div className="vyb-game-settings-title">Game settings</div>
            <div className="vyb-game-settings-row">
              <div>
                <strong>Leaderboard</strong>
                <span>{isLeaderboardPending ? "Next game" : daily?.leaderboardOptIn === false ? "Off this game" : "On this game"}</span>
              </div>
              <button
                type="button"
                className={`vyb-game-switch${leaderboardPreference ? " is-on" : ""}`}
                role="switch"
                aria-checked={leaderboardPreference}
                onClick={toggleLeaderboardPreference}
              >
                <span />
              </button>
            </div>
            <div className="vyb-game-settings-row">
              <div>
                <strong>Auto-fill X</strong>
                <span>{autoFillX ? "On" : "Off"}</span>
              </div>
              <button
                type="button"
                className={`vyb-game-switch${autoFillX ? " is-on" : ""}`}
                role="switch"
                aria-checked={autoFillX}
                onClick={toggleAutoFillX}
              >
                <span />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  async function restartTesterRun() {
    if (!daily?.canReplay || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);
    setResult(null);
    setQueenKeys(new Set());
    setMarkKeys(new Set());
    setHistory([]);
    setActiveHint(null);
    setHighlightedRegionId(null);
    setCooldownUntil(null);
    setLocalCompletionElapsedSeconds(null);
    autoSubmitKeyRef.current = "";

    try {
      const nextLeaderboardPreference = readBooleanSetting(QUEENS_LEADERBOARD_SETTING_KEY, true);
      const dailyUrl = `/api/games/queens/daily${nextLeaderboardPreference ? "" : "?leaderboard=off"}`;
      const response = await fetch(dailyUrl, { cache: "no-store" });
      const payload = await readJsonResponse<QueensDailyLevelResponse>(response);

      setDaily(payload);
      setLeaderboardPreference(payload.leaderboardOptIn);
      setAutoFillX(readBooleanSetting(QUEENS_AUTO_X_SETTING_KEY, false));
      setMessage("Replay ready.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "We could not restart Queens.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <section className="vyb-queens-shell">
        <button type="button" className="vyb-queens-back" onClick={handleExit}>
          Back
        </button>
        <div className="vyb-queens-loading">Loading Daily Queens...</div>
      </section>
    );
  }

  if (error && !daily) {
    return (
      <section className="vyb-queens-shell">
        <button type="button" className="vyb-queens-back" onClick={handleExit}>
          Back
        </button>
        <div className="vyb-queens-error">{error}</div>
      </section>
    );
  }

  if (!daily || !level) {
    return null;
  }

  const solvedResult = result?.solved ? result : null;
  const visibleLeaderboard = solvedResult?.leaderboard ?? daily.leaderboard;
  const viewerBest = daily.viewerBest ?? solvedResult?.viewerBest ?? null;
  const boardCells = [];

  for (let x = 0; x < level.gridSize; x += 1) {
    for (let y = 0; y < level.gridSize; y += 1) {
      const point = { x, y };
      const key = cellKey(point);
      const regionId = getRegionId(level.regions, point);
      const regionColor = REGION_COLORS[(regionId - 1) % REGION_COLORS.length];
      const hasQueen = queenKeys.has(key);
      const hasMark = markKeys.has(key);
      const isConflict = localConflictKeys.has(key) || hintConflictKeys.has(key);
      const isGhost = autoFillX && ghostMarkKeys.has(key) && !hasQueen && !hasMark;
      const isHintMark = activeAutoMarkKeys.has(key);
      const isReveal = nextQueenKey === key;
      const isRegionHighlighted = highlightedRegionId === regionId || activeHint?.regionId === regionId;

      boardCells.push(
        <button
          key={key}
          type="button"
          className={[
            "vyb-queens-cell",
            hasQueen ? "is-queen" : "",
            hasMark ? "is-marked" : "",
            isGhost ? "is-ghost-mark" : "",
            isConflict ? "is-conflict" : "",
            isHintMark ? "is-hint-mark" : "",
            isReveal ? "is-reveal" : "",
            isRegionHighlighted ? "is-region-highlighted" : ""
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            {
              "--queens-region-color": regionColor,
              "--queens-region-fill": regionColor
            } as CSSProperties
          }
          onPointerDown={(event) => handlePointerDown(point, event)}
          onPointerUp={clearLongPressTimer}
          onPointerCancel={clearLongPressTimer}
          onPointerLeave={clearLongPressTimer}
          onClick={() => handleCellClick(point)}
          aria-label={`Row ${x + 1}, column ${y + 1}, region ${regionId}`}
          disabled={Boolean(solvedResult)}
        >
          <span className="vyb-queens-cell-bg" />
          {hasQueen ? <span className="vyb-queens-queen">Q</span> : hasMark || isGhost ? <span className="vyb-queens-x">X</span> : null}
        </button>
      );
    }
  }

  if (solvedResult) {
    return (
      <section className="vyb-queens-shell">
        <div className="vyb-queens-topbar">
          <button type="button" className="vyb-queens-icon-button" onClick={handleExit} aria-label="Back">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div className="vyb-queens-pill">
            <span>Time</span>
            <strong>{formatSeconds(solvedResult.elapsedSeconds)}</strong>
          </div>
          <div className="vyb-queens-pill">
            <span>FAT</span>
            <strong>{formatSeconds(solvedResult.adjustedTimeSeconds)}</strong>
          </div>
          {renderSettingsMenu()}
        </div>

        <div className="vyb-queens-result">
          <span>Puzzle solved</span>
          <strong>{formatSeconds(solvedResult.adjustedTimeSeconds)}</strong>
          <small>
            {formatSeconds(solvedResult.elapsedSeconds)} + {solvedResult.hintsUsed * 15}s hints + {solvedResult.errorsMade * 5}s errors
          </small>
          {solvedResult.streakBonusPoints > 0 ? <em>+{solvedResult.streakBonusPoints} Vyb Points</em> : null}
        </div>

        <section className="vyb-queens-leaderboard">
          <div className="vyb-queens-section-head">
            <span>Today's leaderboard</span>
            <strong>{viewerBest ? `You: #${viewerBest.rank}` : "Solved"}</strong>
          </div>
          {visibleLeaderboard.length === 0 ? (
            <p className="vyb-queens-empty">No visible solves yet.</p>
          ) : (
            <div className="vyb-queens-leaderboard-list">
              {visibleLeaderboard.map((entry) => (
                <div key={`${entry.userId}:${entry.completedAt}`} className="vyb-queens-leaderboard-row">
                  <span>#{entry.rank}</span>
                  <strong>{entry.displayName}</strong>
                  <small>{formatSeconds(entry.adjustedTimeSeconds)}</small>
                  <em>Org #{entry.organizationRank}</em>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="vyb-queens-completed-actions">
          {daily.canReplay ? (
            <button type="button" className="vyb-queens-primary" onClick={restartTesterRun}>
              Try Again
            </button>
          ) : null}
          <button type="button" className="vyb-queens-secondary" onClick={() => void inviteFriends()}>
            Invite
          </button>
          <button type="button" className="vyb-queens-primary" onClick={handleExit}>
            Games Hub
          </button>
        </div>
        {message ? <p className="vyb-queens-message is-solved">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="vyb-queens-shell">
      <div className="vyb-queens-topbar">
        <button type="button" className="vyb-queens-icon-button" onClick={handleExit} aria-label="Back">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div className="vyb-queens-pill">
          <span>Time</span>
          <strong>{formatSeconds(elapsedSeconds)}</strong>
        </div>
        <div className="vyb-queens-pill">
          <span>Board</span>
          <strong>{level.gridSize}x{level.gridSize}</strong>
        </div>
        <button type="button" className="vyb-queens-reset" onClick={resetBoard} disabled={submitBusy}>
          Reset
        </button>
        {renderSettingsMenu()}
      </div>

      <div className="vyb-queens-status-strip">
        <div>
          <span>Queens</span>
          <strong>{queenKeys.size}/{level.gridSize}</strong>
        </div>
        <div>
          <span>Hints</span>
          <strong>{daily.hintsUsed}</strong>
        </div>
        <div>
          <span>Errors</span>
          <strong>{daily.errorsMade}</strong>
        </div>
      </div>

      <div className="vyb-queens-board-wrap">
        <div className="vyb-queens-board" style={{ "--queens-grid-size": level.gridSize } as CSSProperties}>
          {boardCells}
        </div>
      </div>

      <div className="vyb-queens-actions">
        <button type="button" className="vyb-queens-secondary" onClick={undoMove} disabled={submitBusy || history.length === 0}>
          Undo
        </button>
        <button type="button" className="vyb-queens-primary" onClick={requestHint} disabled={hintBusy || cooldownRemaining > 0 || submitBusy}>
          {cooldownRemaining > 0 ? `Hint ${cooldownRemaining}s` : hintBusy ? "Hint..." : "Hint"}
        </button>
      </div>

      <div className="vyb-queens-feedback">
        {message ? <p className="vyb-queens-message">{message}</p> : null}
        {placementErrorReason ? <p className="vyb-queens-error">Placement reason: {placementErrorReason}</p> : null}
        {error ? <p className="vyb-queens-error">{error}</p> : null}
      </div>

      <section className="vyb-queens-leaderboard">
        <div className="vyb-queens-section-head">
          <span>Today's leaderboard</span>
          <strong>{daily.viewerBest ? `Your best: #${daily.viewerBest.rank}` : `${daily.viewerStreak} no-hint streak`}</strong>
        </div>
        {daily.leaderboard.length === 0 ? (
          <p className="vyb-queens-empty">No solves yet today.</p>
        ) : (
          <div className="vyb-queens-leaderboard-list">
            {daily.leaderboard.map((entry) => (
              <div key={`${entry.userId}:${entry.completedAt}`} className="vyb-queens-leaderboard-row">
                <span>#{entry.rank}</span>
                <strong>{entry.displayName}</strong>
                <small>{formatSeconds(entry.adjustedTimeSeconds)}</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
