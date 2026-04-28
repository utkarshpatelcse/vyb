# Connect Daily Zip Implementation

## System Architecture

Connect uses a pre-computed level distribution model. Levels are generated locally as a one-time private artifact and can be imported into SQL Connect/DataConnect when the schema deployment path is available. The committed application does not include the level generation script.

The runtime serves one shared daily level to all users using:

```text
current_level = (days_since_launch % 1000) + 1
```

The default launch date is `2026-04-28T00:00:00+05:30` and can be overridden with `VYB_CONNECT_LAUNCH_DATE`.

## Level Generation

Seed generation is local-only and intentionally ignored by Git. The generated JSON must satisfy the schema documented here before it is imported into SQL Connect or used as the local fallback at `data/connect-levels.json`.

Distribution:

```text
1-100    5x5 grid, 6-10 dots
101-200  6x6 grid, 8-12 dots
201-500  7x7 grid, 10-14 dots
501-1000 8x8/9x9 grid, 6-16 dots
```

Generation uses recursive backtracking with a Warnsdorff-style next-move ordering so larger grids do not hang. Each generated level is validated for:

- Full Hamiltonian coverage: `solution_path.length == grid_size * grid_size`.
- Orthogonal adjacency between every consecutive move.
- No repeated coordinates.
- Sequential checkpoint dots sampled from the solution path.
- Dot `1` is always `solution_path[0]`; the highest numbered dot is always the terminal `solution_path[solution_path.length - 1]`.

After generation, the full 1000-level pool is globally shuffled with Fisher-Yates before final `level_id` assignment. This avoids a predictable difficulty curve.

## Gameplay Rules

The client receives only public level data: `levelId`, `gridSize`, `dots`, and `difficulty`. It never receives `solution_path`.

Client-side movement enforces:

- Path must begin on dot `1`.
- Moves must be orthogonally adjacent.
- Filled cells cannot be reused except undoing the previous cell.
- Numbered dots must be visited in exact order.
- The final numbered dot can only be entered as the last grid cell, so the route ends there.

Server-side validation is authoritative. A submission is solved only when the submitted path exactly matches the stored `solution_path`.

## Hint System

Hints are server-backed through `POST /api/games/connect/hint`.

The server compares the submitted path to the solution prefix, truncates to the last valid prefix, and returns only the next correct move. The session stores `hintsUsed` and `lastHintAt`, so the client cannot lower the hint count before scoring.

Cooldown:

```text
5 seconds per hint
```

Visual behavior:

```text
3-second ghost arrow on the next correct cell
```

## Leaderboard And Scoring

Sessions begin when the daily level is fetched. `T_start` is stored server-side at `GET /api/games/connect/daily`. `T_finish` is stored server-side when a valid path is submitted.

Final Adjusted Time:

```text
FAT = (T_finish - T_start) + (hints_used * 3)
```

Leaderboards are scoped by tenant and daily key. The board keeps each user's best result for that daily puzzle, sorted by adjusted time, then raw elapsed time, then hint count.

## Storage

Current fallback level pool:

```text
data/connect-levels.json
```

Current fallback sessions and scores:

```text
<temp-root>/vyb-connect/<tenant-id>.json
```

`temp-root` is resolved from `VYB_CONNECT_STORE_ROOT`, `VYB_LOCAL_MEDIA_ROOT`, `TMPDIR`, `TEMP`, `TMP`, or workspace `.tmp`.

SQL Connect target:

```text
Store the generated payload JSON as the canonical level pool, then keep tenant-scoped sessions/scores in a separate Connect game store table.
```

The local Firebase CLI currently cannot deploy the new SQL Connect schema on this machine because Windows Application Control blocks the downloaded `dataconnect-emulator-3.4.5.exe` binary that Firebase uses for DataConnect builds. Existing SQL Connect queries work, but schema compile/deploy is blocked until that executable is allowed or the deployment is run from an unblocked environment.

## API Surface

```text
GET  /api/games/connect/daily
POST /api/games/connect/hint
POST /api/games/connect/submit
```

All endpoints require the existing Vyb dev session cookie.
