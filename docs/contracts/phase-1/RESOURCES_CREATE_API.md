# API Contract

Owner: Architecture Team
Last Updated: 2026-05-12
Change Summary: Added optional community ownership and membership authorization for Community Connect resources.

## 1. Metadata

- API name: Create Resource
- Owner module: `resources`
- Runtime: `apps/backend`
- Consumers: `web`, future `mobile`
- Version: `v1`
- Status: Draft
- Linked LLD: `docs/lld/phase-1/RESOURCES_SERVICE_LLD.md`

## 2. Endpoint Definition

- Method: `POST`
- Path: `/v1/resources`
- Public or internal: public through backend
- Purpose: create academic resource metadata before or alongside file registration

## 3. Authentication and Authorization

- Auth mechanism: backend edge verified identity
- Required roles: verified membership
- Tenant checks: membership, tenant, optional course, and optional community must align
- Rate limit policy: moderate per user

## 4. Request Schema

- Headers: auth token or approved local dev identity headers
- Path params: none
- Query params: none
- Body: `tenantId`, `membershipId`, optional `courseId`, optional `communityId`, `title`, `description`, `type`

## 5. Response Schema

- Success response: created `item`
- Pagination model: none
- Metadata: none

## 6. Error Schema

- Validation errors: invalid title, type, or course
- Auth errors: unauthenticated
- Authorization errors: unauthorized tenant, community, or upload scope
- Domain errors: course mismatch, invalid community membership, invalid file registration references
- Retryable errors: media validation timeout

## 7. Side Effects

- Tables written: `resources`, later `resource_files`, `user_activity`
- Community side effect: when `communityId` is present, the created resource remains pending but is attached to that community for later published reads.
- Events emitted: future moderation events
- Async jobs triggered: optional moderation
- Audit log entries: moderator and admin actions only

## 8. Idempotency and Concurrency

- Idempotency key needed: no in starter scope
- Duplicate handling: client retries can duplicate pending resources until idempotency is added
- Optimistic locking needed: no

## 9. Observability

- Logs: resource create attempts and failures
- Metrics: create success rate, moderation pending rate
- Alerts: upload failure spikes

## 10. Rollout Notes

- Feature flags: tenant-level upload flag is acceptable
- Backward compatibility: additive only
- Migration steps: keep contract stable while backend module writes move fully onto Data Connect
