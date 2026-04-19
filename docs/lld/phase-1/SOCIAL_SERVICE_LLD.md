# Social Module LLD

## 1. Metadata

- Feature name: Social Module Phase 1
- Owner: Social Platform
- Runtime: `apps/backend`
- Phase: Phase 1
- Date: 2026-04-19
- Status: Draft
- Linked SRS section: 2.4 Campus Square Feed and 2.6 Moderation
- Linked HLD section: Phase 1 Module Map, Media Architecture, Observability
- Linked ADRs: None yet

## 2. Problem Statement

We need a trustworthy campus social layer where verified members can create posts, short-form vibes, and time-limited stories, search other users by campus user ID, follow profiles, and later report unsafe content. The module must remain tenant-safe, community-aware, and ready for future ranking without forcing that complexity into Phase 1.

## 3. Scope

In scope:

- text and image posts
- video vibes
- time-limited stories
- public profile discovery by campus user ID
- follow and unfollow graph
- feed reads by tenant and community
- comments
- reactions
- extraction-ready domain boundaries

Out of scope:

- polls
- anonymous posting
- ranking personalization
- direct messaging

## 4. Owning Module

- Primary owner: `social`
- Runtime boundary: `apps/backend/src/modules/social`
- Secondary dependencies: `campus`, future `media`, future `moderation`

## 5. User Flows

- Flow 1: verified member creates a text, image, or vibe post in a tenant or community scope.
- Flow 2: user opens the feed and sees the latest published posts from allowed scopes.
- Flow 3: user searches another member by campus user ID and follows them.
- Flow 4: user publishes a story and followed profiles see it in their story lane while it is active.
- Flow 5: user comments or reacts on a post.
- Flow 6: user later reports a post or comment when moderation support is enabled.

## 6. API Design

### `POST /v1/posts`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id, optional community id, body, media references, visibility
- response schema: live published post payload
- error schema: unauthorized scope, invalid media, validation failure
- rate limit policy: moderate per user, tighter burst protection

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

### `POST /v1/stories`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id, media type, media payload, optional caption
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
- request schema: body, optional parent comment id
- response schema: created comment
- error schema: post not found, unauthorized scope, validation failure
- rate limit policy: moderate per user

### `PUT /v1/posts/{postId}/reactions`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: reaction type
- response schema: current reaction state and aggregate count snapshot
- error schema: post not found, unauthorized scope
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

## 8. Data Model Changes

- tables touched: `posts`, `post_media`, `stories`, `follows`, `comments`, `reactions`, `audit_logs`, `user_activity`
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

- auth checks: membership must be verified for posting, story creation, following, commenting, and reacting
- tenant checks: reads and writes validated through campus-owned context
- input validation: body length, media count, allowed MIME types, campus user-ID resolution, reaction enum
- abuse prevention: post and comment rate limits, content status workflow
- audit logging: moderator removals and privileged edits when moderation lands

## 11. Observability

- logs: post create, vibe create, story create, feed read, user search, follow state change, comment create, reaction upsert
- metrics: feed latency, post creation success rate, story publish rate, vibe publish rate, follow conversion, comment volume
- alerts: error spikes on post publish or feed retrieval
- trace IDs: required at the backend boundary and through module calls

## 12. Failure Modes

- campus access resolution fails: writes fail closed, reads may fall back only in explicit starter mode
- media registration missing: publish fails closed with a visible client error
- reaction race: last write wins under unique constraint and upsert behavior
- follow race: duplicate follow writes collapse to one relationship
- story expiry race: story reads always filter by active expiry window

## 13. Rollout Plan

- feature flags: optional post create flag for first tenant rollout
- migration order: create social tables, publish read endpoint, then post write path
- rollback plan: disable post creation while keeping read-only feed if instability appears

## 14. Test Plan

- unit tests: post validation, story visibility, follow graph, reaction upsert, feed filtering
- integration tests: post create with campus access, story create, user search, follow update, feed pagination
- contract tests: post create, feed read, vibe read, story create and read, user search, public profile, follow update, comment create, reaction update
- manual QA: create post, browse feed, publish story, follow a user, search by user ID, open public profile, react, comment

## 15. Documentation Updates Required

- HLD: if feed scope or moderation flow changes
- SRS: if social scope expands
- Master Plan: when feed ships to first tenant
- API docs: all public social endpoints
- Runbook: feed outage and moderation handling

## 16. Open Questions

- when durable storage replaces the current starter store, which social entities move first: posts, stories, or follows
- do we need a denormalized feed read model before broader campus launch
