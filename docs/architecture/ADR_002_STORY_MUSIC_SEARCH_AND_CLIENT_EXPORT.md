# Vyb ADR 002: Story Music Search and Client Export

Owner: Architecture Team
Last Updated: 2026-04-22
Change Summary: Accepted Openverse-backed royalty-free story music search through a web helper route and client-side `ffmpeg.wasm` export for one selected story asset in Phase 1.

## 1. Metadata

- ADR ID: ADR-002
- Title: Story Music Search and Client Export
- Status: Accepted
- Date: 2026-04-22
- Owner: Architecture Team

## 2. Context

- Phase 1 stories now support optional music-backed publishing for the responsive web client.
- The engineering rulebook requires an ADR for any new external service or SDK.
- We need a royalty-free track source that can be queried from the web experience without introducing a paid catalog or a new backend media pipeline in Phase 1.
- We also need a way to merge one selected story image or video, a chosen clip of the track, and a rendered music sticker into the final upload artifact before the story is published.
- The current Phase 1 system does not operate a backend transcoding fleet, queue, or worker pool for media composition.

## 3. Decision

- Use Openverse audio search as the approved Phase 1 royalty-free track source.
- Expose the music catalog to the web composer through the same-origin helper route `apps/web/app/api/story-music/route.ts`.
- Proxy the selected track bytes through the same helper route so the browser can compose against a stable same-origin stream URL.
- Use `@ffmpeg/ffmpeg` and `@ffmpeg/util` in the browser to export one selected story asset plus one chosen music clip plus one rendered music sticker into a final MP4.
- Keep story music export limited to one selected story asset at a time in Phase 1.
- Keep the backend social publish contract unchanged by publishing the client-exported MP4 as a normal video story.

## 4. Alternatives Considered

- Option A: Pixabay or another royalty-free catalog provider.
- Option B: Server-side transcoding and catalog search inside the backend monolith.
- Option C: Do not ship story music in Phase 1.

## 5. Why This Decision

- benefits
  - Openverse provides a royalty-free search surface without adding a paid licensing workflow in Phase 1.
  - The same-origin web helper keeps provider details outside the public client code paths and allows simple response shaping.
  - Client-side `ffmpeg.wasm` composition avoids introducing a backend worker, queue, or transcoding service before launch.
  - Publishing the final MP4 through the existing story upload flow preserves the current backend contract.
- tradeoffs
  - Export performance now depends on the device, browser memory budget, and network quality.
  - The feature is intentionally limited to one selected story asset at a time.
  - Upstream Openverse availability now affects story music search and stream fetch success.
- operational impact
  - Frontend deploys must continue to bundle and load `ffmpeg.wasm` assets correctly.
  - The web helper route must remain observable because failures can come from either the upstream provider or the browser export path.
  - Story viewer playback must handle browser autoplay restrictions gracefully.
- cost impact
  - No new backend compute service is required in Phase 1.
  - Web clients bear the composition cost locally, which reduces server cost but shifts performance variability to the edge.

## 6. Security and Reliability Impact

- security implications
  - The client never receives privileged backend credentials for audio search or upload.
  - The helper route must only proxy the approved provider and should not become a generic fetch tunnel.
  - Final story uploads still pass through existing storage and social publish validation.
- failure modes
  - Openverse search or track fetch may fail temporarily.
  - `ffmpeg.wasm` assets may fail to load or may exceed memory limits on weaker devices.
  - Browser autoplay rules may still require an explicit unmute interaction for viewer playback.
- rollback path
  - Hide the story music controls in the web composer while preserving normal story publishing.
  - Keep previously published music-backed stories playable because they are stored as normal MP4 stories.

## 7. Documentation Impact

- HLD sections to update: Media Architecture, request flow, and Phase 1 module notes
- SRS sections to update: Campus Square stories and multi-surface playback requirements
- LLDs affected: Social Module Phase 1
- API contracts affected: Story publish contract, vibes contract, and the new story music helper contract

## 8. Rollout Plan

- step 1: ship the web helper route for search and stream proxying
- step 2: ship the story composer controls for track search, clip selection, and sticker placement
- step 3: ship client-side MP4 export with bounded clip lengths of 15, 30, 45, and 60 seconds
- step 4: verify story viewer playback for embedded audio plus browser mute fallback behavior

## 9. Exit Criteria

- users can search and select a royalty-free track from the composer
- users can export one selected story asset with the chosen clip and music sticker into an MP4
- the final file uploads through the existing story publish flow
- published music-backed stories can play back with audio inside the immersive story viewer
