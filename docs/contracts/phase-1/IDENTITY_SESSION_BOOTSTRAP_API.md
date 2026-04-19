# API Contract

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Added the backend session-bootstrap contract for verified KIET-first web authentication.

## 1. Metadata

- API name: Identity Session Bootstrap
- Owner module: `identity`
- Runtime: `apps/backend`
- Consumers: `web`, future `mobile`
- Version: `v1`
- Status: Draft
- Linked LLD: `docs/lld/phase-1/IDENTITY_SERVICE_LLD.md`

## 2. Endpoint Definition

- Method: `POST`
- Path: `/v1/auth/session/bootstrap`
- Public or internal: public through backend
- Purpose: verify a Firebase ID token, enforce launch-domain access, and return the authenticated session payload plus the next route decision

## 3. Authentication and Authorization

- Auth mechanism: Firebase ID token supplied in request body and verified by the backend
- Required roles: authenticated student, faculty, alumni, moderator, or admin account
- Tenant checks: verified email domain and membership resolution must succeed
- Rate limit policy: strict per user and IP

## 4. Request Schema

- Headers: standard JSON request
- Path params: none
- Query params: none
- Body: `idToken`, optional `displayName`

## 5. Response Schema

- Success response: `session`, `profileCompleted`, `nextPath`
- Pagination model: none
- Metadata: none

## 6. Error Schema

- Validation errors: missing token or malformed JSON
- Auth errors: invalid token or unverified email
- Authorization errors: invalid college domain or unresolved campus access
- Domain errors: disallowed launch campus email
- Retryable errors: backend membership resolution failure

## 7. Side Effects

- Tables written: `users` and campus membership records through existing identity/campus logic where needed
- Events emitted: none
- Async jobs triggered: none
- Audit log entries: planned for production

## 8. Idempotency and Concurrency

- Idempotency key needed: no
- Duplicate handling: repeated verified requests should resolve the same user and membership context
- Optimistic locking needed: no

## 9. Observability

- Logs: token verification failures, invalid-domain access, successful session bootstrap
- Metrics: success rate, invalid-domain rejection rate, verification failure rate
- Alerts: repeated token-verification failures or unusual rejection spikes

## 10. Rollout Notes

- Feature flags: none
- Backward compatibility: additive only
- Migration steps: extend the same verification pattern to the remaining authenticated backend edge over time
