# API Contract

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Updated the create-post contract for the live campus-social flow with direct publish behavior, media payloads, and vibe placement support.

## 1. Metadata

- API name: Create Post
- Owner module: `social`
- Runtime: `apps/backend`
- Consumers: `web`, future `mobile`
- Version: `v1`
- Status: Draft
- Linked LLD: `docs/lld/phase-1/SOCIAL_SERVICE_LLD.md`

## 2. Endpoint Definition

- Method: `POST`
- Path: `/v1/posts`
- Public or internal: public through backend
- Purpose: create a published feed or vibe post within an authorized tenant/community scope

## 3. Authentication and Authorization

- Auth mechanism: backend edge verified identity
- Required roles: verified membership
- Tenant checks: membership must be valid for target tenant/community
- Rate limit policy: moderate with burst protection

## 4. Request Schema

- Headers: auth token or approved local dev identity headers
- Path params: none
- Query params: none
- Body: `tenantId`, optional `communityId`, `membershipId`, `kind`, optional `placement`, optional `title`, `body`, optional `mediaUrl`, optional `location`

## 5. Response Schema

- Success response: created published `item`
- Pagination model: none
- Metadata: none

## 6. Error Schema

- Validation errors: missing content, invalid kind, invalid media payload
- Auth errors: unauthenticated
- Authorization errors: invalid tenant/community scope
- Domain errors: referenced community not found
- Retryable errors: media registration or moderation handoff failure

## 7. Side Effects

- Tables written: `posts`, later `audit_logs` and `user_activity`
- Events emitted: future moderation and notification events
- Async jobs triggered: optional moderation review
- Audit log entries: moderator actions only, not normal create

## 8. Idempotency and Concurrency

- Idempotency key needed: no for initial Phase 1
- Duplicate handling: client retries may create duplicate drafts unless idempotency is added later
- Optimistic locking needed: no

## 9. Observability

- Logs: post create attempt, validation failure, publish status
- Metrics: create success rate and vibe publish rate
- Alerts: create failure spike

## 10. Rollout Notes

- Feature flags: post creation may be gated per tenant
- Backward compatibility: additive fields only
- Migration steps: replace the current starter persistence with durable production storage while keeping the public contract stable
