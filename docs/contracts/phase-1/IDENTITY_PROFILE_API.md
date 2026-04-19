# API Contract

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Added the Phase 1 campus-profile read and update contract for post-auth onboarding and home-feed gating.

## 1. Metadata

- API name: Identity Profile
- Owner module: `identity`
- Runtime: `apps/backend`
- Consumers: `web`, future `mobile`
- Version: `v1`
- Status: Draft
- Linked LLD: `docs/lld/phase-1/IDENTITY_SERVICE_LLD.md`

## 2. Endpoint Definition

- Method: `GET`, `PUT`
- Path: `/v1/profile`
- Public or internal: public through backend
- Purpose: read and update the post-auth campus profile required before authenticated home-feed access

## 3. Authentication and Authorization

- Auth mechanism: authenticated actor context from the web session bridge or future native token flow
- Required roles: authenticated verified membership
- Tenant checks: actor must resolve to the correct tenant membership and approved launch domain
- Rate limit policy: moderate per user

## 4. Request Schema

- Headers: authenticated viewer context
- Path params: none
- Query params: none
- Body:
  - `GET`: none
  - `PUT`: `firstName`, optional `lastName`, `course`, `stream`, `year`, `section`, `isHosteller`, optional `hostelName`, optional `phoneNumber`

## 5. Response Schema

- Success response: `profileCompleted`, `allowedEmailDomain`, `collegeName`, `profile`
- Pagination model: none
- Metadata: none

## 6. Error Schema

- Validation errors: invalid profile payload
- Auth errors: unauthenticated
- Authorization errors: invalid college domain or missing membership
- Domain errors: none beyond launch-domain enforcement
- Retryable errors: temporary persistence failure

## 7. Side Effects

- Tables written: interim profile persistence plus user display-name updates where needed later
- Events emitted: none
- Async jobs triggered: none
- Audit log entries: planned for production

## 8. Idempotency and Concurrency

- Idempotency key needed: no
- Duplicate handling: `PUT` is an upsert by authenticated user id
- Optimistic locking needed: no

## 9. Observability

- Logs: profile reads and updates
- Metrics: completion rate, update success rate
- Alerts: repeated profile update failures

## 10. Rollout Notes

- Feature flags: none
- Backward compatibility: additive only
- Migration steps: move the interim profile persistence onto final Phase 1 storage once the owned schema is extended while preserving the `/home` post-onboarding route behavior
