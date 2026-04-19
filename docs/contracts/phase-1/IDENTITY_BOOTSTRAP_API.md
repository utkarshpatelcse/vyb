# API Contract

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Updated contract language for the Phase 1 modular monolith backend.

## 1. Metadata

- API name: Identity Bootstrap
- Owner module: `identity`
- Runtime: `apps/backend`
- Consumers: `web`, future `mobile`
- Version: `v1`
- Status: Draft
- Linked LLD: `docs/lld/phase-1/IDENTITY_SERVICE_LLD.md`

## 2. Endpoint Definition

- Method: `POST`
- Path: `/v1/auth/bootstrap`
- Public or internal: public through backend
- Purpose: create or hydrate the internal user and return onboarding status

## 3. Authentication and Authorization

- Auth mechanism: Firebase ID token verified at the backend edge; starter scaffold supports local dev headers
- Required roles: authenticated user
- Tenant checks: none at bootstrap, tenant resolution may still return pending
- Rate limit policy: strict per user and IP

## 4. Request Schema

- Headers: auth token or approved local dev identity headers
- Path params: none
- Query params: none
- Body: `displayName?`, `avatarUrl?`

## 5. Response Schema

- Success response: user profile, onboarding stage, verification info
- Pagination model: none
- Metadata: none

## 6. Error Schema

- Validation errors: malformed body
- Auth errors: invalid or missing auth token
- Authorization errors: blocked account state
- Domain errors: unsupported identity state
- Retryable errors: downstream campus module resolution timeout

## 7. Side Effects

- Tables written: `users`, later `audit_logs`, later membership bootstrap side effects
- Events emitted: none in starter
- Async jobs triggered: none
- Audit log entries: planned for production

## 8. Idempotency and Concurrency

- Idempotency key needed: no
- Duplicate handling: bootstrap must upsert by `firebaseUid`
- Optimistic locking needed: no

## 9. Observability

- Logs: bootstrap attempts and failures
- Metrics: bootstrap success rate
- Alerts: repeated bootstrap failure spikes

## 10. Rollout Notes

- Feature flags: not required initially
- Backward compatibility: additive only
- Migration steps: keep contract stable while implementation moves fully onto backend module handlers
