"use client";

import type {
  ConnectCoordinate,
  ConnectDailyLevelResponse,
  ConnectHintResponse,
  ConnectSubmitResponse
} from "@vyb/contracts";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";

type ConnectDailyGameProps = {
  onExit: () => void;
};

type GhostHint = {
  from: ConnectCoordinate | null;
  next: ConnectCoordinate;
  expiresAt: string;
};

function cellKey(point: ConnectCoordinate) {
  return `${point.x}:${point.y}`;
}

function isAdjacent(left: ConnectCoordinate, right: ConnectCoordinate) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1;
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
    throw new Error(payload?.error?.message || "Connect request failed.");
  }

  if (!payload) {
    throw new Error("Connect returned an empty response.");
  }

  return payload;
}

export function ConnectDailyGame({ onExit }: ConnectDailyGameProps) {
  const [daily, setDaily] = useState<ConnectDailyLevelResponse | null>(null);
  const [pathCells, setPathCells] = useState<ConnectCoordinate[]>([]);
  const isDraggingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hintBusy, setHintBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ConnectSubmitResponse | null>(null);
  const [ghostHint, setGhostHint] = useState<GhostHint | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const autoSubmitKeyRef = useRef("");
  const lastAppliedCellKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDailyPuzzle() {
      setIsLoading(true);
      setError(null);
      setMessage(null);
      setResult(null);
      setPathCells([]);
      setGhostHint(null);
      setCooldownUntil(null);
      autoSubmitKeyRef.current = "";

      try {
        const response = await fetch("/api/games/connect/daily", { method: "GET" });
        const payload = await readJsonResponse<ConnectDailyLevelResponse>(response);

        if (!cancelled) {
          setDaily(payload);
          setMessage("Start at dot 1, visit every dot in order, and fill the full grid.");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "We could not load Connect.");
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
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    function endDrag() {
      isDraggingRef.current = false;
      lastAppliedCellKeyRef.current = null;
    }

    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  useEffect(() => {
    if (!ghostHint) {
      return;
    }

    const expiresIn = Math.max(0, new Date(ghostHint.expiresAt).getTime() - Date.now());
    const timeoutId = window.setTimeout(() => setGhostHint(null), expiresIn);
    return () => window.clearTimeout(timeoutId);
  }, [ghostHint]);

  const level = daily?.level ?? null;
  const dotByKey = useMemo(() => new Map((level?.dots ?? []).map((dot) => [cellKey(dot), dot])), [level?.dots]);
  const pathIndexByKey = useMemo(() => new Map(pathCells.map((point, index) => [cellKey(point), index])), [pathCells]);
  const finalDot = level?.dots[level.dots.length - 1] ?? null;
  const visitedDotIds = useMemo(() => {
    const ids = new Set<number>();

    for (const point of pathCells) {
      const dot = dotByKey.get(cellKey(point));
      if (dot) {
        ids.add(dot.id);
      }
    }

    return ids;
  }, [dotByKey, pathCells]);

  const nextDotId = visitedDotIds.size + 1;
  const elapsedSeconds = result?.elapsedSeconds ?? (daily ? Math.max(0, (nowMs - new Date(daily.serverStartedAt).getTime()) / 1000) : null);
  const cooldownRemaining = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - nowMs) / 1000)) : 0;
  const canSubmit = Boolean(
    level &&
      !result?.solved &&
      pathCells.length === level.gridSize * level.gridSize &&
      visitedDotIds.size === level.dots.length &&
      Boolean(finalDot && pathCells[pathCells.length - 1] && cellKey(pathCells[pathCells.length - 1]) === cellKey(finalDot))
  );
  const pathGradientId = daily ? `connect-path-gradient-${daily.sessionId}` : "connect-path-gradient";
  const hintGradientId = daily ? `connect-hint-gradient-${daily.sessionId}` : "connect-hint-gradient";
  const hintMarkerId = daily ? `connect-hint-marker-${daily.sessionId}` : "connect-hint-marker";
  const pathStrokeWidth = level ? Math.max(0.34, Math.min(0.54, 3.2 / level.gridSize)) : 0.44;
  const pathSvgPoints = pathCells.map((point) => `${point.y + 0.5} ${point.x + 0.5}`).join(" ");
  const hintFromPoint = ghostHint?.from ? { x: ghostHint.from.y + 0.5, y: ghostHint.from.x + 0.5 } : null;
  const hintNextPoint = ghostHint ? { x: ghostHint.next.y + 0.5, y: ghostHint.next.x + 0.5 } : null;

  useEffect(() => {
    const pathKey = pathCells.map(cellKey).join("|");

    if (!canSubmit || submitBusy || result || autoSubmitKeyRef.current === pathKey) {
      return;
    }

    autoSubmitKeyRef.current = pathKey;
    setMessage("Route complete. Auto-submitting...");
    void submitRoute();
  }, [canSubmit, pathCells, result, submitBusy]);

  function getPointFromPointer(event: PointerEvent<HTMLDivElement>): ConnectCoordinate | null {
    if (!level) {
      return null;
    }

    const touchedCell = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-connect-x][data-connect-y]");
    const touchedX = touchedCell ? Number.parseInt(touchedCell.dataset.connectX ?? "", 10) : Number.NaN;
    const touchedY = touchedCell ? Number.parseInt(touchedCell.dataset.connectY ?? "", 10) : Number.NaN;

    if (
      Number.isInteger(touchedX) &&
      Number.isInteger(touchedY) &&
      touchedX >= 0 &&
      touchedY >= 0 &&
      touchedX < level.gridSize &&
      touchedY < level.gridSize
    ) {
      return { x: touchedX, y: touchedY };
    }

    const board = event.currentTarget;
    const bounds = board.getBoundingClientRect();
    const style = window.getComputedStyle(board);
    const leftPadding = Number.parseFloat(style.paddingLeft) || 0;
    const topPadding = Number.parseFloat(style.paddingTop) || 0;
    const rightPadding = Number.parseFloat(style.paddingRight) || leftPadding;
    const bottomPadding = Number.parseFloat(style.paddingBottom) || topPadding;
    const gridLeft = bounds.left + leftPadding;
    const gridTop = bounds.top + topPadding;
    const gridWidth = bounds.width - leftPadding - rightPadding;
    const gridHeight = bounds.height - topPadding - bottomPadding;
    const relativeX = event.clientX - gridLeft;
    const relativeY = event.clientY - gridTop;

    if (relativeX < 0 || relativeY < 0 || relativeX > gridWidth || relativeY > gridHeight) {
      return null;
    }

    return {
      x: Math.min(level.gridSize - 1, Math.max(0, Math.floor((relativeY / gridHeight) * level.gridSize))),
      y: Math.min(level.gridSize - 1, Math.max(0, Math.floor((relativeX / gridWidth) * level.gridSize)))
    };
  }

  function buildStraightTargets(from: ConnectCoordinate, to: ConnectCoordinate) {
    if (from.x === to.x) {
      const step = to.y > from.y ? 1 : -1;
      return Array.from({ length: Math.abs(to.y - from.y) }, (_, index) => ({
        x: from.x,
        y: from.y + step * (index + 1)
      }));
    }

    if (from.y === to.y) {
      const step = to.x > from.x ? 1 : -1;
      return Array.from({ length: Math.abs(to.x - from.x) }, (_, index) => ({
        x: from.x + step * (index + 1),
        y: from.y
      }));
    }

    return [];
  }

  function buildDragTargetRoutes(currentPath: ConnectCoordinate[], point: ConnectCoordinate) {
    const head = currentPath[currentPath.length - 1];

    if (!head || isAdjacent(head, point)) {
      return [[point]];
    }

    const straightTargets = buildStraightTargets(head, point);

    if (straightTargets.length > 0) {
      return [straightTargets];
    }

    const rowFirstCorner = { x: head.x, y: point.y };
    const columnFirstCorner = { x: point.x, y: head.y };
    const rowFirst = [...buildStraightTargets(head, rowFirstCorner), ...buildStraightTargets(rowFirstCorner, point)];
    const columnFirst = [...buildStraightTargets(head, columnFirstCorner), ...buildStraightTargets(columnFirstCorner, point)];

    return [rowFirst, columnFirst].filter((targets) => targets.length > 0);
  }

  function advancePath(currentPath: ConnectCoordinate[], point: ConnectCoordinate) {
    if (!level) {
      return { path: currentPath, message: null, blocked: true };
    }

    const key = cellKey(point);
    const existingIndex = currentPath.findIndex((candidate) => cellKey(candidate) === key);

    if (existingIndex === currentPath.length - 1) {
      return { path: currentPath, message: null, blocked: false };
    }

    if (existingIndex === currentPath.length - 2) {
      return { path: currentPath.slice(0, -1), message: "Stepped back one cell.", blocked: false };
    }

    if (existingIndex >= 0) {
      return { path: currentPath, message: "That cell is already filled. Step back or reset to change route.", blocked: true };
    }

    const dot = dotByKey.get(key);

    if (currentPath.length === 0) {
      if (dot?.id !== 1) {
        return { path: currentPath, message: "Start from dot 1.", blocked: true };
      }

      return { path: [point], message: "Good start. Keep the path connected.", blocked: false };
    }

    const previous = currentPath[currentPath.length - 1];
    if (!isAdjacent(previous, point)) {
      return { path: currentPath, message: "Move one cell at a time.", blocked: true };
    }

    if (dot) {
      const currentVisitedDots = new Set<number>();
      for (const currentPoint of currentPath) {
        const currentDot = dotByKey.get(cellKey(currentPoint));
        if (currentDot) {
          currentVisitedDots.add(currentDot.id);
        }
      }

      const expectedDotId = currentVisitedDots.size + 1;
      if (dot.id !== expectedDotId) {
        return { path: currentPath, message: `Next checkpoint is dot ${expectedDotId}.`, blocked: true };
      }

      if (dot.id === level.dots.length && currentPath.length + 1 !== level.gridSize * level.gridSize) {
        return { path: currentPath, message: `Dot ${dot.id} is the finish. Fill every other cell before ending there.`, blocked: true };
      }
    }

    return { path: [...currentPath, point], message: null, blocked: false };
  }

  function applyCell(point: ConnectCoordinate) {
    if (!level || result?.solved) {
      return;
    }

    const pointKey = cellKey(point);
    if (lastAppliedCellKeyRef.current === pointKey) {
      return;
    }
    lastAppliedCellKeyRef.current = pointKey;

    setPathCells((currentPath) => {
      const routes = buildDragTargetRoutes(currentPath, point);
      let bestPath = currentPath;
      let bestMessage: string | null = null;
      let bestBlocked = true;

      for (const targets of routes) {
        let routePath = currentPath;
        let routeMessage: string | null = null;
        let routeBlocked = false;

        for (const target of targets) {
          const outcome = advancePath(routePath, target);
          routePath = outcome.path;
          routeMessage = outcome.message;
          routeBlocked = outcome.blocked;

          if (outcome.blocked) {
            break;
          }
        }

        if (
          routePath.length > bestPath.length ||
          (routePath.length === bestPath.length && !routeBlocked && bestBlocked)
        ) {
          bestPath = routePath;
          bestMessage = routeMessage;
          bestBlocked = routeBlocked;
        }

        if (!routeBlocked && cellKey(routePath[routePath.length - 1] ?? point) === pointKey) {
          break;
        }
      }

      setMessage(bestMessage);
      return bestPath;
    });
  }

  function handleBoardPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    try {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } catch {
      // Some embedded browsers are picky about pointer capture on bubbled targets.
    }
    isDraggingRef.current = true;
    lastAppliedCellKeyRef.current = null;
    const point = getPointFromPointer(event);

    if (point) {
      applyCell(point);
    }
  }

  function handleBoardPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) {
      return;
    }

    event.preventDefault();
    const point = getPointFromPointer(event);

    if (point) {
      applyCell(point);
    }
  }

  function handleBoardPointerEnd(event: PointerEvent<HTMLDivElement>) {
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Capture may already be released by the browser.
    }

    isDraggingRef.current = false;
    lastAppliedCellKeyRef.current = null;
  }

  function handleCellPointerEnter(point: ConnectCoordinate) {
    if (!isDraggingRef.current) {
      return;
    }

    applyCell(point);
  }

  async function requestHint() {
    if (!daily || cooldownRemaining > 0 || hintBusy || result?.solved) {
      return;
    }

    setHintBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/games/connect/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: daily.sessionId,
          path: pathCells
        })
      });
      const payload = await readJsonResponse<ConnectHintResponse>(response);

      setDaily((current) => (current ? { ...current, hintsUsed: payload.hintsUsed } : current));

      if (payload.cooldownSeconds > 0) {
        setCooldownUntil(Date.now() + payload.cooldownSeconds * 1000);
      }

      if (!payload.nextMove) {
        setMessage(payload.cooldownSeconds > 0 ? `Hint cooling down: ${payload.cooldownSeconds}s.` : "No hint needed. The route is complete.");
        return;
      }

      const didTrimPath = payload.validPrefixLength < pathCells.length;
      setPathCells((currentPath) => currentPath.slice(0, payload.validPrefixLength));
      setGhostHint({
        from: payload.from,
        next: payload.nextMove,
        expiresAt: payload.ghostExpiresAt ?? new Date(Date.now() + 3000).toISOString()
      });
      setMessage(didTrimPath ? "Board reset to the last correct move. Follow the arrow." : "Hint revealed the next correct step.");
    } catch (hintError) {
      setError(hintError instanceof Error ? hintError.message : "We could not fetch a hint.");
    } finally {
      setHintBusy(false);
    }
  }

  async function submitRoute() {
    if (!daily || !canSubmit || submitBusy) {
      return;
    }

    setSubmitBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/games/connect/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: daily.sessionId,
          path: pathCells
        })
      });
      const payload = await readJsonResponse<ConnectSubmitResponse>(response);

      setResult(payload);
      setDaily((current) =>
        current
          ? {
              ...current,
              hintsUsed: payload.hintsUsed,
              leaderboard: payload.leaderboard,
              viewerBest: payload.viewerBest
            }
          : current
      );
      setMessage(payload.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We could not submit this route.");
    } finally {
      setSubmitBusy(false);
    }
  }

  function resetRoute() {
    autoSubmitKeyRef.current = "";
    setPathCells([]);
    setGhostHint(null);
    setResult(null);
    setMessage("Route reset. Start again from dot 1.");
  }

  if (isLoading) {
    return (
      <section className="vyb-connect-shell">
        <button type="button" className="vyb-connect-back" onClick={onExit}>
          Back to hub
        </button>
        <div className="vyb-connect-loading">Loading today's Connect...</div>
      </section>
    );
  }

  if (error && !daily) {
    return (
      <section className="vyb-connect-shell">
        <button type="button" className="vyb-connect-back" onClick={onExit}>
          Back to hub
        </button>
        <div className="vyb-connect-error">{error}</div>
      </section>
    );
  }

  if (!daily || !level) {
    return null;
  }

  const gridCells = [];

  for (let x = 0; x < level.gridSize; x += 1) {
    for (let y = 0; y < level.gridSize; y += 1) {
      const point = { x, y };
      const key = cellKey(point);
      const dot = dotByKey.get(key);
      const pathIndex = pathIndexByKey.get(key);
      const isPath = pathIndex !== undefined;
      const isHead = pathIndex === pathCells.length - 1;
      const isGhost = ghostHint ? cellKey(ghostHint.next) === key : false;

      gridCells.push(
        <button
          key={key}
          type="button"
          data-connect-x={x}
          data-connect-y={y}
          onPointerEnter={() => handleCellPointerEnter(point)}
          className={[
            "vyb-connect-cell",
            dot ? "is-dot" : "",
            dot && visitedDotIds.has(dot.id) ? "is-dot-visited" : "",
            dot?.id === nextDotId ? "is-next-dot" : "",
            isPath ? "is-path" : "",
            isHead ? "is-head" : "",
            isGhost ? "is-ghost" : ""
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={dot ? `Dot ${dot.id}` : `Cell ${x + 1}, ${y + 1}`}
        >
          {isPath ? <span className="vyb-connect-step">{pathIndex + 1}</span> : null}
          {dot ? <span className="vyb-connect-dot-label">{dot.id}</span> : null}
        </button>
      );
    }
  }

  return (
    <section className="vyb-connect-shell">
      <div className="vyb-connect-topbar-modern">
        <button type="button" className="vyb-connect-back-icon" onClick={onExit} aria-label="Back">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        
        <div className="vyb-connect-timer-pill">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <strong>{formatSeconds(elapsedSeconds)}</strong>
        </div>

        <div className="vyb-connect-difficulty-pill">
          Difficulty <span>{level.difficulty}</span>
        </div>

        <button type="button" className="vyb-connect-reset-pill" onClick={resetRoute} disabled={submitBusy}>
          Reset
        </button>
      </div>

      <div className="vyb-connect-board-wrap">
        <div
          className="vyb-connect-board"
          style={{ "--connect-grid-size": level.gridSize } as CSSProperties}
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerEnd}
          onPointerCancel={handleBoardPointerEnd}
        >
          <svg className="vyb-connect-path-layer" viewBox={`0 0 ${level.gridSize} ${level.gridSize}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={pathGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="48%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
              <linearGradient id={hintGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
              <marker id={hintMarkerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#34d399" />
              </marker>
            </defs>
            {pathCells.length > 1 ? (
              <polyline
                className="vyb-connect-route-line"
                points={pathSvgPoints}
                fill="none"
                stroke={`url(#${pathGradientId})`}
                strokeWidth={pathStrokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {hintFromPoint && hintNextPoint ? (
              <line
                className="vyb-connect-hint-line"
                x1={hintFromPoint.x}
                y1={hintFromPoint.y}
                x2={hintNextPoint.x}
                y2={hintNextPoint.y}
                stroke={`url(#${hintGradientId})`}
                strokeWidth={pathStrokeWidth + 0.08}
                strokeLinecap="round"
                markerEnd={`url(#${hintMarkerId})`}
              />
            ) : hintNextPoint ? (
              <circle className="vyb-connect-hint-pulse" cx={hintNextPoint.x} cy={hintNextPoint.y} r={pathStrokeWidth} fill={`url(#${hintGradientId})`} />
            ) : null}
          </svg>
          <div className="vyb-connect-board-grid">
            {gridCells}
          </div>
        </div>
      </div>

      {message ? <p className={`vyb-connect-message${result?.solved ? " is-solved" : ""}`}>{message}</p> : null}
      {error ? <p className="vyb-connect-error">{error}</p> : null}

      <div className="vyb-connect-actions-modern">
        <button type="button" className="vyb-connect-action-pill" onClick={() => setPathCells(c => c.slice(0, -1))} disabled={submitBusy || pathCells.length <= 1}>
          Undo
        </button>
        <button type="button" className="vyb-connect-action-pill" onClick={requestHint} disabled={hintBusy || cooldownRemaining > 0 || submitBusy || result?.solved}>
          {cooldownRemaining > 0 ? `Hint ${cooldownRemaining}s` : hintBusy ? "Hint..." : "Hint"}
        </button>
      </div>

      <div className="vyb-connect-how-to-play">
        <div className="vyb-connect-how-to-header">
           <h4>How to play</h4>
        </div>
        <div className="vyb-connect-rules">
          <div className="vyb-connect-rule">
            <div className="vyb-connect-rule-graphic">
               <div className="vyb-connect-rule-dots">
                 <span className="vyb-connect-rule-dot">1</span>
                 <div className="vyb-connect-rule-line"></div>
                 <span className="vyb-connect-rule-dot">2</span>
                 <div className="vyb-connect-rule-line"></div>
                 <span className="vyb-connect-rule-dot">3</span>
               </div>
            </div>
            <p>Connect the<br/>dots in order</p>
          </div>
          <div className="vyb-connect-rule">
            <div className="vyb-connect-rule-graphic">
               <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                 <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="rgba(255,255,255,0.1)"></rect>
                 <path d="M3 9h18M9 21V9M15 3v18"></path>
                 <path d="M6 6v12h6V6h6v12" stroke="#6366f1"></path>
               </svg>
            </div>
            <p>Fill every<br/>cell</p>
          </div>
        </div>
      </div>

      {result?.solved ? (
        <div className="vyb-connect-result">
          <span>Final adjusted time</span>
          <strong>{formatSeconds(result.adjustedTimeSeconds)}</strong>
          <small>{formatSeconds(result.elapsedSeconds)} raw + {result.hintsUsed * 3}s penalty</small>
        </div>
      ) : null}

      <section className="vyb-connect-leaderboard">
        <div className="vyb-connect-section-head">
          <span>Today's leaderboard</span>
          <strong>{daily.viewerBest ? `Your best: #${daily.viewerBest.rank}` : "No solve yet"}</strong>
        </div>
        {daily.leaderboard.length === 0 ? (
          <p className="vyb-connect-empty">No solves yet. Tiny crown sitting unclaimed.</p>
        ) : (
          <div className="vyb-connect-leaderboard-list">
            {daily.leaderboard.map((entry) => (
              <div key={`${entry.userId}:${entry.completedAt}`} className="vyb-connect-leaderboard-row">
                <span>#{entry.rank}</span>
                <strong>{entry.displayName}</strong>
                <small>{formatSeconds(entry.adjustedTimeSeconds)} FAT</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
