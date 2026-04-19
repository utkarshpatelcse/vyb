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

We need a trustworthy campus feed where verified members can create text and image posts, comment, react, and later report unsafe content. The module must remain tenant-safe, community-aware, and ready for future ranking and reels without forcing that complexity into Phase 1.

## 3. Scope

In scope:

- text and image posts
- feed reads by tenant and community
- comments
- reactions
- publish state handling
- extraction-ready domain boundaries

Out of scope:

- reels
- polls
- anonymous posting
- ranking personalization
- direct messaging

## 4. Owning Module

- Primary owner: `social`
- Runtime boundary: `apps/backend/src/modules/social`
- Secondary dependencies: `campus`, future `media`, future `moderation`

## 5. User Flows

- Flow 1: verified member creates a text or image post in a tenant or community scope.
- Flow 2: user opens the feed and sees the latest published posts from allowed scopes.
- Flow 3: user comments or reacts on a post.
- Flow 4: user later reports a post or comment when moderation support is enabled.

## 6. API Design

### `POST /v1/posts`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id, optional community id, body, media references, visibility
- response schema: post payload with publish status
- error schema: unauthorized scope, invalid media, validation failure
- rate limit policy: moderate per user, tighter burst protection

### `GET /v1/feed`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id, optional community id, cursor, limit
- response schema: paginated published posts
- error schema: invalid tenant, unauthorized community, bad cursor
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
- target module: future `media`
- reason: validate media registration before publish
- interaction type: direct call first, later extractable
- failure handling: keep post in draft or pending state

## 8. Data Model Changes

- tables touched: `posts`, `post_media`, `comments`, `reactions`, `audit_logs`, `user_activity`
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

- auth checks: membership must be verified for posting, commenting, and reacting
- tenant checks: reads and writes validated through campus-owned context
- input validation: body length, media count, allowed MIME types, reaction enum
- abuse prevention: post and comment rate limits, content status workflow
- audit logging: moderator removals and privileged edits when moderation lands

## 11. Observability

- logs: post create, feed read, comment create, reaction upsert
- metrics: feed latency, post creation success rate, comment volume
- alerts: error spikes on post publish or feed retrieval
- trace IDs: required at the backend boundary and through module calls

## 12. Failure Modes

- campus access resolution fails: writes fail closed, reads may fall back only in explicit starter mode
- media registration missing: post remains draft or pending
- reaction race: last write wins under unique constraint and upsert behavior

## 13. Rollout Plan

- feature flags: optional post create flag for first tenant rollout
- migration order: create social tables, publish read endpoint, then post write path
- rollback plan: disable post creation while keeping read-only feed if instability appears

## 14. Test Plan

- unit tests: post validation, reaction upsert, feed cursor handling
- integration tests: post create with campus access, comment create, feed pagination
- contract tests: post create, feed read, comment create, reaction update
- manual QA: create post, browse feed, react, comment

## 15. Documentation Updates Required

- HLD: if feed scope or moderation flow changes
- SRS: if social scope expands
- Master Plan: when feed ships to first tenant
- API docs: all public social endpoints
- Runbook: feed outage and moderation handling

## 16. Open Questions

- should image posts publish instantly or always enter `pending` for first rollout
- do we need a denormalized feed read model before first campus launch
