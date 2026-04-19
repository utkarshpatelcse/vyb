# API Contract Template

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Updated template language for the Phase 1 modular monolith backend.

## 1. Metadata

- API name:
- Owner module:
- Runtime:
- Consumers:
- Version:
- Status:
- Linked LLD:

## 2. Endpoint Definition

- Method:
- Path:
- Public or internal:
- Purpose:

## 3. Authentication and Authorization

- Auth mechanism:
- Required roles:
- Tenant checks:
- Rate limit policy:

## 4. Request Schema

- headers:
- path params:
- query params:
- body:

## 5. Response Schema

- success response:
- pagination model:
- metadata:

## 6. Error Schema

- validation errors:
- auth errors:
- authorization errors:
- domain errors:
- retryable errors:

## 7. Side Effects

- tables written:
- events emitted:
- async jobs triggered:
- audit log entries:

## 8. Idempotency and Concurrency

- idempotency key needed:
- duplicate handling:
- optimistic locking needed:

## 9. Observability

- logs:
- metrics:
- alerts:

## 10. Rollout Notes

- feature flags:
- backward compatibility:
- migration steps:
