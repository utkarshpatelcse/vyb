# API Contract

Owner: Architecture Team
Last Updated: 2026-04-28
Change Summary: Added the companion social WebSocket event contract for active feed and vibe clients.

## 1. Metadata

- API name: List Feed
- Owner module: `social`
- Runtime: `apps/backend`
- Consumers: `web`, future `mobile`
- Version: `v1`
- Status: Active
- Linked LLD: `docs/lld/phase-1/SOCIAL_SERVICE_LLD.md`

## 2. Endpoint Definition

- Method: `GET`
- Path: `/v1/feed`
- Public or internal: public through backend
- Purpose: return a list of published campus-feed posts for a tenant, optionally filtered by community or author

## 3. Authentication and Authorization

- Auth mechanism: backend edge verified identity
- Required roles: verified membership
- Tenant checks: tenant and optional community must be authorized by the campus module
- Rate limit policy: moderate per user

## 4. Request Schema

- Headers: auth token or approved local dev identity headers
- Path params: none
- Query params: `tenantId`, optional `communityId`, optional `authorUserId`, optional `limit`
- Body: none

## 5. Response Schema

- Success response: `tenantId`, `communityId`, `items[]`, `nextCursor`
- Feed items include `id`, `placement`, `kind`, `mediaUrl`, `location`, `title`, `body`, `reactions`, `comments`, `viewerReactionType`, `createdAt`, and `author { userId, username, displayName }`
- The response is sufficient for feed cards, profile grids, lightbox views, likers sheets, and the vibes teaser row without a second list-read call
- Pagination model: simple limit-based read in the current implementation
- Metadata: no total count on hot feed path

## 6. Error Schema

- Validation errors: invalid tenant or limit
- Auth errors: unauthenticated
- Authorization errors: unauthorized tenant/community access
- Domain errors: community not found
- Retryable errors: downstream access resolution timeout

## 7. Side Effects

- Tables written: none
- Events emitted: none
- Async jobs triggered: optional `user_activity` write in future
- Audit log entries: none

## 8. Idempotency and Concurrency

- Idempotency key needed: no
- Duplicate handling: not applicable
- Optimistic locking needed: no

## 9. Observability

- Logs: feed reads and filter context
- Metrics: p95 latency, error rate, empty result rate
- Alerts: degraded feed latency or repeated permission failures

## 10. Rollout Notes

- Feature flags: tenant-level feed rollout flag is acceptable
- Backward compatibility: additive fields only
- Migration steps: keep contract stable while feed reads remain Data Connect-backed and while richer ranking stays deferred

## 11. Companion Interaction Endpoints

- `GET /v1/posts/{postId}/likes` returns the ordered liker list for the selected feed item
- `POST /v1/posts/{postId}/comments` creates top-level comments or replies
- `PUT /v1/comments/{commentId}/reactions` toggles comment likes
- `PUT /v1/posts/{postId}/reactions` toggles the viewer reaction on a post or vibe
- `POST /v1/posts/{postId}/repost` creates a direct repost or quote repost

## 12. Realtime Companion Contract

- `GET /api/social/socket-token` mints a short-lived signed backend WebSocket URL for the current web viewer.
- Backend path: `/ws/social`
- Scope: tenant-level social events for the authenticated viewer membership.
- Events: `social.post.created`, `social.post.updated`, `social.post.deleted`, `social.post.reaction.updated`, `social.comment.created`, `social.comment.deleted`, and `social.comment.reaction.updated`.
- Payload rule: realtime payloads must stay client-safe. Anonymous author metadata, real author IDs for anonymous content, and viewer-specific permissions must not leak through event frames.
- Source-of-truth rule: events are hints for active clients; feed, vibe, comment, and likers HTTP reads remain the durable recovery path.
