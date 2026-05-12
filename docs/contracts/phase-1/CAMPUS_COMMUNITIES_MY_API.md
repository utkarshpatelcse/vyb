# API Contract

Owner: Architecture Team
Last Updated: 2026-05-12
Change Summary: Expanded the List My Communities response for the Community Connect V1 surface while preserving backward-compatible fields.

## 1. Metadata

- API name: List My Communities
- Owner module: `campus`
- Runtime: `apps/backend`
- Consumers: `web`, future `mobile`
- Version: `v1`
- Status: Draft
- Linked LLD: `docs/lld/phase-1/CAMPUS_SERVICE_LLD.md`, `docs/lld/phase-1/COMMUNITY_CONNECT_SURFACE_LLD.md`

## 2. Endpoint Definition

- Method: `GET`
- Path: `/v1/communities/my`
- Public or internal: public through backend
- Purpose: return tenant summary, viewer membership summary, and communities for the active membership so the Connect surface can render Community as its primary tab

## 3. Authentication and Authorization

- Auth mechanism: backend edge verified identity
- Required roles: verified membership
- Tenant checks: resolved membership must belong to exactly one active tenant context
- Rate limit policy: moderate per user

## 4. Request Schema

- Headers: auth token or approved local dev identity headers
- Path params: none
- Query params: optional `include=summary` may be added later for activity metadata
- Body: none

## 5. Response Schema

- Success response: `tenant`, optional `viewer`, and `communities[]`
- Pagination model: none
- Metadata: community list is intentionally bounded by the viewer's memberships; tenant-wide discovery uses a separate future endpoint

Required backward-compatible community fields:

```json
{
  "id": "community-id",
  "name": "CSE Batch 2028",
  "type": "batch",
  "memberCount": 184
}
```

Additive Community Connect V1 fields:

```json
{
  "id": "community-id",
  "name": "CSE Batch 2028",
  "slug": "cse-batch-2028",
  "type": "batch",
  "visibility": "tenant",
  "memberCount": 184,
  "membershipRole": "member",
  "joinedAt": "2026-05-12T10:00:00.000Z",
  "isOfficial": true,
  "isMember": true,
  "latestActivityAt": "2026-05-12T10:00:00.000Z"
}
```

## 6. Error Schema

- Validation errors: none expected
- Auth errors: unauthenticated
- Authorization errors: no verified membership
- Domain errors: unresolved tenant or empty onboarding state
- Retryable errors: connector timeout

## 7. Side Effects

- Tables written: none
- Events emitted: none
- Async jobs triggered: none
- Audit log entries: none

## 8. Idempotency and Concurrency

- Idempotency key needed: no
- Duplicate handling: not applicable
- Optimistic locking needed: no

## 9. Observability

- Logs: community list reads, access denials
- Metrics: membership resolution latency, community list latency
- Alerts: spikes in tenant mismatch or access-denied responses

## 10. Rollout Notes

- Feature flags: none
- Backward compatibility: additive only; existing clients can continue reading `id`, `name`, `type`, and `memberCount`
- Migration steps: keep response contract stable while backend module moves fully onto Data Connect-backed membership context and Community Connect V1 renders richer fields where present
