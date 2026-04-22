# Social Module LLD

Owner: Social Platform
Last Updated: 2026-04-22
Change Summary: Expanded the Phase 1 social design for immersive stories and vibes, own-story add affordances, story music search and client-side export, and premium playback controls across desktop and mobile.

## 1. Metadata

- Feature name: Social Module Phase 1
- Owner: Social Platform
- Runtime: `apps/backend`
- Phase: Phase 1
- Date: 2026-04-22
- Status: Active
- Linked SRS section: 2.4 Campus Square Feed and 2.6 Moderation
- Linked HLD section: Phase 1 Module Map, Media Architecture, Observability
- Linked ADRs: `ADR_002_STORY_MUSIC_SEARCH_AND_CLIENT_EXPORT.md`

## 2. Problem Statement

We need a trustworthy campus social layer where verified members can create posts, short-form vibes, and time-limited stories, search other users by campus user ID, follow profiles, repost campus content, inspect likers, participate in threaded comments, report unsafe content, and consume immersive story and vibe playback across mobile and desktop. Phase 1 also includes optional royalty-free music composition for one story asset at publish time. The module must remain tenant-safe, community-aware, and ready for future ranking without forcing that complexity into Phase 1.

## 3. Scope

In scope:

- text and image posts
- video vibes
- time-limited stories
- immersive story viewer behaviors, including segmented progress, own-story add affordance, seen-state rings, and viewer audio playback
- royalty-free story music search plus single-asset client-side story music composition before publish
- public profile discovery by campus user ID
- follow and unfollow graph
- feed reads by tenant and community
- comments
- reactions
- threaded replies and comment likes
- post likers list
- repost and quote repost
- story reactions and seen state
- author edit and soft delete for posts and vibes
- responsive desktop and mobile social interaction surfaces
- immersive vibes playback with default sound-on intent, tap pause or resume, and press-and-hold speed-up
- extraction-ready domain boundaries

Out of scope:

- polls
- anonymous posting
- ranking personalization
- direct messaging
- third-party GIF search provider integration
- multi-asset story music export in one batch publish
- backend media transcoding or waveform generation for story music
- premium licensed music catalog ingestion beyond the selected royalty-free provider
- dedicated transcoding fleet for social video

## 4. Owning Module

- Primary owner: `social`
- Runtime boundary: `apps/backend/src/modules/social`
- Secondary dependencies: `campus`, future `media`, future `moderation`

## 5. User Flows

- Flow 1: verified member creates a text, image, or vibe post in a tenant or community scope.
- Flow 2: user opens the feed, sees the latest published posts from allowed scopes, and opens media in a full-screen viewer.
- Flow 3: user searches another member by campus user ID and follows them.
- Flow 4: user publishes a story and followed profiles see it in their story lane while it is active.
- Flow 5: user comments, replies, reacts, or attaches a supported GIF or sticker in a comment thread.
- Flow 6: user inspects likers, direct reposts, or quote reposts an existing post or vibe.
- Flow 7: an author edits or soft-deletes their own post or vibe.
- Flow 8: a viewer opens the story viewer, progresses through stories, marks them seen, and optionally likes a story.
- Flow 9: user reports unsafe social content when moderation support is enabled.
- Flow 10: user selects one story asset, browses the royalty-free music library, previews a 15, 30, 45, or 60 second clip, positions the music sticker, exports the final MP4 in the browser, and then publishes it as a normal story item.
- Flow 11: viewer opens `/vibes`, the active item attempts sound-on playback, a single tap pauses or resumes, and a press-and-hold temporarily boosts playback speed.

## 6. API Design

### `POST /v1/posts`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id, optional community id, body, media references, visibility
- response schema: live published post payload
- error schema: unauthorized scope, invalid media, validation failure
- rate limit policy: moderate per user, tighter burst protection

### `PATCH /v1/posts/{postId}`

- caller: web or future native client
- auth requirement: verified membership required and author-only
- request schema: optional `title`, `body`, `location`
- response schema: updated published post payload
- error schema: post not found, unauthorized author, validation failure
- rate limit policy: moderate per user

### `DELETE /v1/posts/{postId}`

- caller: web or future native client
- auth requirement: verified membership required and author-only
- request schema: none
- response schema: `postId`, `deleted`
- error schema: post not found, unauthorized author
- rate limit policy: moderate per user

### `GET /v1/feed`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id, optional community id, cursor, limit
- response schema: paginated published posts
- error schema: invalid tenant, unauthorized community, bad cursor
- rate limit policy: moderate per user

### `GET /v1/vibes`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id, cursor, limit
- response schema: paginated vibe posts
- error schema: invalid tenant, bad cursor
- rate limit policy: moderate per user

### `GET /v1/posts/{postId}/likes`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: optional `limit`
- response schema: member list for the active post reactions
- error schema: post not found, invalid limit
- rate limit policy: moderate per user

### `POST /v1/stories`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id, media type, media payload, optional caption, and optional client-exported music-backed video reference when story music composition is used
- response schema: created story payload with expiry
- error schema: invalid media, unauthorized scope, validation failure
- rate limit policy: moderate per user

### `GET /v1/stories`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id
- response schema: active stories visible to the current viewer
- error schema: invalid tenant
- rate limit policy: moderate per user

### `GET /api/story-music`

- caller: web story composer only
- auth requirement: same-origin client access; no extra app auth gate in Phase 1
- request schema: search mode accepts optional `q` and `limit`; stream mode accepts `mode=stream` and `trackId`
- response schema: search returns royalty-free track summaries; stream returns proxied audio bytes for the selected track
- error schema: upstream provider unavailable, track missing, invalid query
- rate limit policy: low to moderate per client to protect upstream usage

### `GET /v1/users/search`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id, query, limit
- response schema: matched user summaries plus follow-state and stats
- error schema: invalid tenant, invalid limit
- rate limit policy: moderate per user

### `GET /v1/users/{username}`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id
- response schema: public campus profile, follow stats, and recent posts
- error schema: user not found, invalid tenant
- rate limit policy: moderate per user

### `PUT/DELETE /v1/users/{username}/follow`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id
- response schema: updated follow state and stats snapshot
- error schema: user not found, invalid tenant
- rate limit policy: moderate per user

### `POST /v1/posts/{postId}/comments`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: body, optional parent comment id, optional `mediaUrl`, optional `mediaType`
- response schema: created comment
- error schema: post not found, unauthorized scope, validation failure
- rate limit policy: moderate per user

### `PUT /v1/comments/{commentId}/reactions`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: comment reaction type
- response schema: current comment-like state and aggregate count snapshot
- error schema: comment not found, unauthorized scope
- rate limit policy: moderate per user

### `PUT /v1/posts/{postId}/reactions`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: reaction type
- response schema: current reaction state and aggregate count snapshot
- error schema: post not found, unauthorized scope
- rate limit policy: moderate per user

### `POST /v1/posts/{postId}/repost`

- caller: web or future native client
- auth requirement: verified membership required and completed profile
- request schema: optional `quote`, optional `placement`
- response schema: created repost item in feed or vibe placement
- error schema: post not found, incomplete profile, unauthorized scope
- rate limit policy: moderate per user

### `PUT /v1/stories/{storyId}/reactions`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: story reaction type
- response schema: current story-like state and aggregate count snapshot
- error schema: story not found, unauthorized scope
- rate limit policy: moderate per user

### `PUT /v1/stories/{storyId}/seen`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: none
- response schema: story seen-state acknowledgement
- error schema: story not found, unauthorized scope
- rate limit policy: moderate per user

### `POST /v1/reports`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: `targetType`, `targetId`, `reason`
- response schema: created report summary
- error schema: invalid payload, unauthorized scope
- rate limit policy: moderate per user

## 7. Module Interactions

- calling layer: backend edge
- target module: `social`
- reason: public feed, post, comment, and reaction APIs
- interaction type: direct in-process invocation
- failure handling: return safe API errors

- calling module: `social`
- target module: `campus`
- reason: validate membership permission for feed reads and writes
- interaction type: direct in-process domain call
- failure handling: fail closed for writes, safe fallback for local dev reads where explicitly allowed

- calling module: `social`
- target module: `identity`
- reason: resolve campus user IDs and public profile data for feed authors, search, and follow views
- interaction type: direct in-process repository call
- failure handling: fail closed for writes and return safe empty states for discovery reads when profile data is unavailable

- calling layer: backend edge
- target module: `moderation`
- reason: social surfaces submit content reports through the shared moderation module
- interaction type: direct in-process invocation
- failure handling: return visible report errors without mutating social content state

- calling layer: web story composer
- target module: `apps/web /api/story-music`
- reason: query the approved royalty-free music provider and proxy the selected track back to the browser for export
- interaction type: same-origin web helper request
- failure handling: show visible music-library or stream-fetch errors and keep normal story publishing available

- calling layer: web story composer
- target module: browser-side `ffmpeg.wasm`
- reason: merge one selected visual asset, the selected music clip, and the draggable music sticker into the final MP4 before upload
- interaction type: client-side media composition
- failure handling: abort export, surface safe client error text, and allow publish retry without server mutation

## 8. Data Model Changes

- tables touched: `posts`, `post_media`, `stories`, `story_reactions`, `story_views`, `follows`, `comments`, `comment_reactions`, `reactions`, `user_activity`
- columns added: none beyond HLD baseline
- indexes added: `posts (tenant_id, created_at desc)`, `posts (community_id, created_at desc)`, `comments (post_id, created_at asc)`, `reactions (post_id)`
- unique constraints: `reactions (post_id, membership_id)` for one active reaction per member per post
- soft delete impact: posts and comments use soft delete with status change support
- backfill required: none

## 9. Query Plan

- query name: tenant feed query
- filter fields: `tenant_id`, `status = published`, `deleted_at is null`
- sort order: `created_at desc`
- expected scale: highest read volume in Phase 1
- supporting index: `posts (tenant_id, created_at desc)`
- why this is safe: tenant filter plus cursor pagination

- query name: community feed query
- filter fields: `community_id`, `status = published`, `deleted_at is null`
- sort order: `created_at desc`
- expected scale: medium-high
- supporting index: `posts (community_id, created_at desc)`
- why this is safe: bounded scope and cursor pagination

- query name: comment thread query
- filter fields: `post_id`, `deleted_at is null`
- sort order: `created_at asc`
- expected scale: every post detail view
- supporting index: `comments (post_id, created_at asc)`
- why this is safe: per-post scoped

## 10. Validation and Security

- auth checks: membership must be verified for posting, story creation, following, commenting, reacting, reposting, and reporting
- tenant checks: reads and writes validated through campus-owned context
- input validation: body length, media count, allowed MIME types, campus user-ID resolution, reaction enums, repost quote length, author-only edit/delete gates, story music clip lengths limited to 15 or 30 or 45 or 60 seconds, and story music publish limited to one selected asset at a time
- abuse prevention: post, comment, reaction, and report rate limits plus content status workflow
- audit logging: report creation, moderator removals, and privileged edits
- client behavior notes: vibe playback should attempt sound-on startup with safe muted fallback if the browser blocks autoplay; story viewer audio must remain user-toggleable; own-story bubbles must support separate open-story and add-story interactions

## 11. Observability

- logs: post create, vibe create, story create, feed read, user search, follow state change, comment create, comment reaction upsert, repost create, story seen, story reaction, report create, and post soft delete
- metrics: feed latency, post creation success rate, story publish rate, vibe publish rate, follow conversion, comment volume, repost volume, and story-view completion
- alerts: error spikes on post publish, feed retrieval, or social interaction writes
- trace IDs: required at the backend boundary and through module calls

## 12. Failure Modes

- campus access resolution fails: writes fail closed, reads may fall back only in explicit starter mode
- media registration missing: publish fails closed with a visible client error
- reaction race: last write wins under unique constraint and upsert behavior
- follow race: duplicate follow writes collapse to one relationship
- story expiry race: story reads always filter by active expiry window
- royalty-free music provider unavailable: story music search and streaming fail without blocking plain story publish
- `ffmpeg.wasm` assets fail to load or client export exceeds device capacity: music-backed story export fails locally and the composer should offer retry or publish without music
- browser autoplay policy blocks sound-on startup: vibes or story audio may require an explicit user unmute interaction even when the product defaults to sound-on intent

## 13. Rollout Plan

- feature flags: optional post create flag for first tenant rollout
- migration order: create social tables, publish read endpoint, then post write path
- rollback plan: disable post creation while keeping read-only feed if instability appears

## 14. Test Plan

- unit tests: post validation, story visibility, follow graph, reaction upsert, comment-thread building, repost validation, story music input validation, and soft-delete guards
- integration tests: post create with campus access, post update/delete, story create, story seen, user search, follow update, feed pagination, report create, and story music search helper responses
- client verification: immersive story viewer playback, story audio toggle behavior, own-story add affordance, vibe tap pause or resume, and press-and-hold speed boost on supported browsers
- contract tests: post create, feed read, vibe read, story create/read/react/seen, user search, public profile, follow update, comment create, comment reaction update, post likes, repost create, and post update/delete
- manual QA: create post, browse feed, publish story, follow a user, search by user ID, open public profile, react, inspect likers, comment, reply, repost, report, and browse the immersive vibes route

## 15. Documentation Updates Required

- HLD: if feed scope or moderation flow changes
- SRS: if social scope expands
- Master Plan: when feed ships to first tenant
- API docs: all public social endpoints
- Runbook: feed outage and moderation handling

## 16. Open Questions

- when should the curated GIF and sticker tray move to provider-backed search without slowing comment compose time
- do we need a denormalized feed read model before broader campus launch
