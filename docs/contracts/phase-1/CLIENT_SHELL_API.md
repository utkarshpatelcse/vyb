# API Contract

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Documented the backend-driven client-shell payload used by the public SSR landing surface and clarified that authenticated users move to `/home`.

## 1. Metadata

- API name: Client Shell
- Owner module: backend edge layer
- Runtime: `apps/backend`
- Consumers: `web`
- Version: `v1`
- Status: Draft
- Linked LLD: `docs/lld/phase-1/IDENTITY_SERVICE_LLD.md`

## 2. Endpoint Definition

- Method: `GET`
- Path: `/v1/client-shell`
- Public or internal: public through backend
- Purpose: provide lightweight backend-driven SSR content for the public Phase 1 landing surface before authenticated users enter `/home`

## 3. Authentication and Authorization

- Auth mechanism: none
- Required roles: none
- Tenant checks: none
- Rate limit policy: moderate per IP

## 4. Request Schema

- Headers: none required
- Path params: none
- Query params: none
- Body: none

## 5. Response Schema

- Success response: shell metadata, launch-campus descriptor, hero copy, product pillars, Phase 1 scope, trust points
- Pagination model: none
- Metadata: none

## 6. Error Schema

- Validation errors: none expected
- Auth errors: none
- Authorization errors: none
- Domain errors: none
- Retryable errors: backend unavailable

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

- Logs: landing payload reads
- Metrics: response latency and availability
- Alerts: high 5xx rate

## 10. Rollout Notes

- Feature flags: none
- Backward compatibility: additive only
- Migration steps: keep the payload intentionally small so the landing page stays lightweight
