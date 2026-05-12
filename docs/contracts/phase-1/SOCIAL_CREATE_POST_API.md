# API Contract

Owner: Architecture Team
Last Updated: 2026-05-12
Change Summary: Added explicit Community Connect posting and target-post authorization for `communityId` writes.

## 1. Metadata

- API name: Create Post
- Owner module: `social`
- Runtime: `apps/backend`
- Consumers: `web`, future `mobile`
- Version: `v1`
- Status: Active
- Linked LLD: `docs/lld/phase-1/SOCIAL_SERVICE_LLD.md`

## 2. Endpoint Definition

- Method: `POST`
- Path: `/v1/posts`
- Public or internal: public through backend
- Purpose: create a published feed or vibe post within an authorized tenant/community scope

## 3. Authentication and Authorization

- Auth mechanism: backend edge verified identity
- Required roles: verified membership
- Tenant checks: membership must be valid for target tenant
- Community checks: when `communityId` is present, the viewer must have an active `community_memberships` row for that community in the same tenant
- Identity checks: when `communityId` is present, anonymous posting is rejected and anonymous comments are disabled on the created post
- Rate limit policy: moderate with burst protection

## 4. Request Schema

- Headers: auth token or approved local dev identity headers
- Path params: none
- Query params: none
- Body: `tenantId`, optional `communityId`, `membershipId`, `kind`, optional `placement`, optional `title`, `body`, optional `mediaUrl`, optional `location`
- Community Connect note: `/messages/community/{slug}` posts send `communityId`, `placement: "feed"`, `kind: "text"`, and no anonymous flag in V1
- Upload note: media is expected to be uploaded to Firebase Storage before this publish request is issued

## 5. Response Schema

- Success response: created published `item`
- Pagination model: none
- Metadata: none

## 6. Error Schema

- Validation errors: missing content, invalid kind, invalid media payload
- Auth errors: unauthenticated
- Authorization errors: invalid tenant/community scope, viewer is not a member of the target community
- Throttle errors: `RATE_LIMITED` with `retry-after` when publish or companion-write bursts exceed policy
- Domain errors: referenced community not found
- Retryable errors: media registration or moderation handoff failure

## 7. Side Effects

- Tables written: `posts`, `post_media`, and later `user_activity`
- Events emitted: future moderation and notification events
- Async jobs triggered: optional moderation review
- Audit log entries: moderator actions only, not normal create

## 8. Idempotency and Concurrency

- Idempotency key needed: no for initial Phase 1
- Duplicate handling: client retries may create duplicate drafts unless idempotency is added later
- Optimistic locking needed: no

## 9. Observability

- Logs: post create attempt, validation failure, community authorization failure, publish status
- Metrics: create success rate and vibe publish rate
- Alerts: create failure spike

## 10. Rollout Notes

- Feature flags: post creation may be gated per tenant
- Backward compatibility: additive fields only
- Migration steps: keep the public contract stable while post writes remain Data Connect-backed and market/social fallbacks stay disabled

## 11. Companion Write Endpoints

- `PATCH /v1/posts/{postId}` updates author-owned `title`, `body`, or `location`
- `DELETE /v1/posts/{postId}` soft-deletes an author-owned post or vibe
- `POST /v1/posts/{postId}/repost` creates a direct repost or quote repost in `feed` or `vibe` placement
- Companion writes against an existing community-scoped post must verify the viewer still belongs to that post's community before applying author edits, deletes, reposts, comments, or reactions.
