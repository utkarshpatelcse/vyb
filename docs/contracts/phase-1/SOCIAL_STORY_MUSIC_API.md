# API Contract

Owner: Architecture Team
Last Updated: 2026-04-22
Change Summary: Documented the Phase 1 same-origin helper route that powers royalty-free story music search and proxied audio fetch for client-side MP4 export.

## Endpoint Definition

- `GET /api/story-music`
- Purpose: expose the approved royalty-free story music library to the web composer and proxy the selected track back to the browser for client-side export.
- Modes:
  - search mode: `GET /api/story-music?q=<query>&limit=<n>`
  - stream mode: `GET /api/story-music?mode=stream&trackId=<id>`

## Request Highlights

- auth: same-origin web helper access in Phase 1; no extra application auth gate yet
- search query params: optional `q`, optional `limit`
- stream query params: `mode=stream`, `trackId`
- upstream source: Openverse audio search

## Response Highlights

- search mode returns `items[]` with `id`, `title`, `artistName`, `durationSeconds`, optional `artworkUrl`, and same-origin `streamUrl`
- stream mode returns audio bytes for the selected track with a safe content type
- error payload returns stable `{ error: { message } }` JSON in search or lookup failure cases

## Core Rules

- only the approved royalty-free provider is queried in Phase 1
- the helper does not persist tracks or user selections
- the helper exists to support client-side `ffmpeg.wasm` composition; the final upload remains the exported MP4, not the raw audio
- story music composition is limited to one selected story asset at a time, with clip lengths of 15, 30, 45, or 60 seconds
