# API Contract

Owner: Architecture Team
Last Updated: 2026-04-18
Change Summary: Initial contract for current membership community listing.

## 1. Metadata

- API name: List My Communities
- Owner service: `campus-service`
- Consumers: `web`, future `mobile`, `api-gateway`
- Version: `v1`
- Status: Draft
- Linked LLD: `docs/lld/phase-1/CAMPUS_SERVICE_LLD.md`

## 2. Endpoint Definition

- Method: `GET`
- Path: `/v1/communities/my`
- Public or internal: public through gateway
- Purpose: return tenant summary and communities for the active membership

## 3. Authentication and Authorization

- Auth mechanism: gateway verified identity
- Required roles: verified membership
- Tenant checks: resolved membership must belong to exactly one active tenant context
- Rate limit policy: moderate per user

## 4. Request Schema

- Headers: auth token or demo identity headers
- Path params: none
- Query params: none
- Body: none

## 5. Response Schema

- Success response: `tenant` object and `communities[]`
- Pagination model: none
- Metadata: none

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
- Metrics: membership resolution latency
- Alerts: spikes in tenant mismatch or access-denied responses

## 10. Rollout Notes

- Feature flags: none
- Backward compatibility: additive only
- Migration steps: replace demo payload with Data Connect-backed membership context

