# API Contract

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Updated the feed contract for the live campus-social flow with author identity, media payloads, and real published-feed reads.

## 1. Metadata

- API name: List Feed
- Owner module: `social`
- Runtime: `apps/backend`
- Consumers: `web`, future `mobile`
- Version: `v1`
- Status: Draft
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
- Feed items include author summary, post placement, media URL, and location
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
- Migration steps: keep contract stable while feed reads move from the current starter store onto durable production storage
