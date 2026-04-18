# API Contract

Owner: Architecture Team
Last Updated: 2026-04-18
Change Summary: Initial contract for resource listing.

## 1. Metadata

- API name: List Resources
- Owner service: `resources-service`
- Consumers: `web`, future `mobile`, `api-gateway`
- Version: `v1`
- Status: Draft
- Linked LLD: `docs/lld/phase-1/RESOURCES_SERVICE_LLD.md`

## 2. Endpoint Definition

- Method: `GET`
- Path: `/v1/resources`
- Public or internal: public through gateway
- Purpose: list recent or course-filtered academic resources for a tenant

## 3. Authentication and Authorization

- Auth mechanism: gateway verified identity
- Required roles: verified membership
- Tenant checks: tenant and course must belong to caller membership context
- Rate limit policy: moderate per user

## 4. Request Schema

- Headers: auth token or demo identity headers
- Path params: none
- Query params: `tenantId`, optional `courseId`, optional `cursor`, optional `limit`
- Body: none

## 5. Response Schema

- Success response: `tenantId`, `courseId`, `items[]`, `nextCursor`
- Pagination model: cursor-based
- Metadata: no total count on hot path

## 6. Error Schema

- Validation errors: invalid tenant, course, or cursor
- Auth errors: unauthenticated
- Authorization errors: unauthorized tenant or course access
- Domain errors: course not found
- Retryable errors: storage metadata read issue

## 7. Side Effects

- Tables written: none
- Events emitted: none
- Async jobs triggered: optional `user_activity` tracking later
- Audit log entries: none

## 8. Idempotency and Concurrency

- Idempotency key needed: no
- Duplicate handling: not applicable
- Optimistic locking needed: no

## 9. Observability

- Logs: resource list reads and filters
- Metrics: browse latency, empty result rate
- Alerts: high 5xx rate on browse endpoints

## 10. Rollout Notes

- Feature flags: upload may be behind a tenant flag while browse is public to verified members
- Backward compatibility: additive only
- Migration steps: connect to Data Connect resource listing operations

