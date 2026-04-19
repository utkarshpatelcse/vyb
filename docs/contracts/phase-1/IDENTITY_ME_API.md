# API Contract

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Updated contract language for the Phase 1 modular monolith backend.

## 1. Metadata

- API name: Get Current User
- Owner module: `identity`
- Runtime: `apps/backend`
- Consumers: `web`, future `mobile`
- Version: `v1`
- Status: Draft
- Linked LLD: `docs/lld/phase-1/IDENTITY_SERVICE_LLD.md`

## 2. Endpoint Definition

- Method: `GET`
- Path: `/v1/me`
- Public or internal: public through backend
- Purpose: return canonical user profile and current membership summary

## 3. Authentication and Authorization

- Auth mechanism: Firebase ID token verified at the backend edge; starter scaffold supports local dev headers
- Required roles: authenticated verified user
- Tenant checks: membership summary must belong to the caller
- Rate limit policy: moderate per user

## 4. Request Schema

- Headers: auth token or approved local dev identity headers
- Path params: none
- Query params: none
- Body: none

## 5. Response Schema

- Success response: `user` plus `membershipSummary`
- Pagination model: none
- Metadata: none

## 6. Error Schema

- Validation errors: none expected
- Auth errors: unauthenticated
- Authorization errors: blocked account
- Domain errors: user not bootstrapped
- Retryable errors: downstream campus membership context timeout

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

- Logs: `me` reads and downstream failures
- Metrics: read latency and error rate
- Alerts: elevated 5xx rate

## 10. Rollout Notes

- Feature flags: none
- Backward compatibility: additive only
- Migration steps: keep contract stable while backend module reads move fully onto Data Connect
