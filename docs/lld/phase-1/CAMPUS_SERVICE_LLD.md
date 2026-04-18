# Campus Service LLD

## 1. Metadata

- Feature name: Campus Service Phase 1
- Owner: Backend Platform
- Phase: Phase 1
- Date: 2026-04-18
- Status: Draft
- Linked SRS section: 2.2 Tenant and Community Management, 2.3 College Join Requests
- Linked HLD section: Campus Service, Data Architecture, Authentication and Authorization
- Linked ADRs: None yet

## 2. Problem Statement

We need a tenant-aware ownership layer for colleges, domains, memberships, communities, and college onboarding requests. Every downstream service depends on this service to know who belongs where and what data they may access.

## 3. Scope

In scope:

- tenant discovery from email domain
- new college join requests for unknown domains
- admin decisions on college join requests
- tenant memberships
- roles and verification status
- communities and community memberships
- membership summary resolution for downstream services

Out of scope:

- timetable or class schedule management
- attendance
- placement cells
- club event management

## 4. Owning Service

- Primary owner: `campus-service`
- Secondary dependencies: `identity-service`, `social-service`, `resources-service`

## 5. User Flows

- Flow 1: bootstrap request arrives from identity-service, campus-service matches email domain to tenant and creates a verified or pending membership.
- Flow 2: a user with an unknown domain submits a college join request with college name, address, website, phone, and requested domains.
- Flow 3: an admin reviews the college join request and can approve, reject, or send it back for changes.
- Flow 4: user opens home and receives active tenant plus relevant communities such as batch, hostel, branch, and general.
- Flow 5: downstream services ask campus-service to validate whether a membership can post or upload into a specific community.

## 6. API Design

### `POST /internal/memberships/bootstrap`

- caller: `identity-service`
- auth requirement: internal service auth only
- request schema: user id, email domain, profile hints
- response schema: tenant match result, membership summary, onboarding flags
- error schema: invalid payload, no tenant match, internal error
- rate limit policy: internal only

### `GET /v1/communities/my`

- caller: web or future native client
- auth requirement: verified membership required
- response schema: active tenant summary and communities grouped by type
- error schema: unauthorized, no active membership
- rate limit policy: moderate per user

### `POST /v1/college-join-requests`

- caller: web or future native client
- auth requirement: authenticated user required
- request schema: college name, address, website, requester contact fields, requested domains
- response schema: request id, status, normalized domain summary
- error schema: invalid payload, duplicate active request, unauthorized
- rate limit policy: low per user and per primary domain

### `GET /admin/college-join-requests`

- caller: admin console
- auth requirement: platform admin required
- response schema: pending and recently decided college join requests
- error schema: unauthorized, forbidden
- rate limit policy: low per admin

### `POST /admin/college-join-requests/{requestId}/decision`

- caller: admin console
- auth requirement: platform admin required
- request schema: decision `approve`, `reject`, or `changes_requested`, plus optional reviewer note
- response schema: updated request status, reviewer note, downstream tenant bootstrap result if approved
- error schema: invalid decision, request not found, forbidden
- rate limit policy: low per admin

### `POST /internal/access/resolve`

- caller: `social-service`, `resources-service`, `moderation-service`
- auth requirement: internal service auth only
- request schema: membership id, tenant id, optional community id, action
- response schema: allowed or denied with canonical context
- error schema: invalid membership, tenant mismatch, forbidden action
- rate limit policy: internal only

## 7. Service-To-Service Calls

- caller service: `identity-service`
- callee service: `campus-service`
- reason: bootstrap membership state
- sync or async: sync
- failure handling: return pending onboarding state

- caller service: `identity-service`
- callee service: `campus-service`
- reason: determine whether an unknown-domain user should be shown a college join-request path
- sync or async: sync
- failure handling: return unresolved onboarding state

- caller service: `social-service`
- callee service: `campus-service`
- reason: authorize posting and reading in tenant or community scope
- sync or async: sync
- failure handling: reject publish or read request

- caller service: `resources-service`
- callee service: `campus-service`
- reason: authorize uploads and tenant-scoped access
- sync or async: sync
- failure handling: reject action

## 8. Data Model Changes

- tables touched: `tenants`, `tenant_domains`, `college_join_requests`, `tenant_memberships`, `communities`, `community_memberships`, `audit_logs`, `user_activity`
- columns added: none beyond HLD baseline
- indexes added: `tenant_domains (domain)`, `college_join_requests (status, created_at desc)`, `college_join_requests (normalized_primary_domain)`, `tenant_memberships (tenant_id, user_id) unique`, `communities (tenant_id, type, created_at desc)`
- unique constraints: `tenant_domains (tenant_id, domain)`, `college_join_requests (normalized_primary_domain)` for active requests, `tenant_memberships (tenant_id, user_id)`, `community_memberships (community_id, membership_id)`
- soft delete impact: memberships and communities use soft delete to preserve history
- backfill required: initial tenant and community seed data per college

## 9. Query Plan

- query name: resolve tenant by email domain
- filter fields: `domain`, `deleted_at is null`
- sort order: none
- expected scale: every first login
- supporting index: `tenant_domains (domain)`
- why this is safe: selective exact match

- query name: membership lookup by tenant and user
- filter fields: `tenant_id`, `user_id`, `deleted_at is null`
- sort order: none
- expected scale: every authenticated request with tenant context
- supporting index: unique `tenant_memberships (tenant_id, user_id)`
- why this is safe: single-row access

- query name: admin college join request queue
- filter fields: `status`, `deleted_at is null`
- sort order: `created_at desc`
- expected scale: low-volume admin operations
- supporting index: `college_join_requests (status, created_at desc)`
- why this is safe: filtered operational queue

- query name: list communities for active membership
- filter fields: `tenant_id`, membership relations, `deleted_at is null`
- sort order: type then name
- expected scale: on home and switcher views
- supporting index: `communities (tenant_id, type, created_at desc)` and `community_memberships (community_id, membership_id)`
- why this is safe: bounded tenant-scoped result set

## 10. Validation and Security

- auth checks: only verified memberships get tenant access
- tenant checks: all community and membership reads require canonical tenant resolution
- input validation: community slug, type, visibility, bootstrap payload, requested college domains, and contact fields
- abuse prevention: block duplicate memberships, duplicate active college requests, and invalid cross-tenant access
- audit logging: membership verification changes, college request decisions, community creation, admin edits

## 11. Observability

- logs: membership bootstrap, college join request submissions, admin decisions, access denials, community fetches
- metrics: verified membership rate, pending verification count, join request volume, decision latency, access resolution latency
- alerts: spike in forbidden access or tenant mismatch errors
- trace IDs: required on all internal access calls

## 12. Failure Modes

- unknown domain: return college join-request onboarding path
- duplicate bootstrap requests: idempotent membership upsert
- duplicate active college requests: return current pending request instead of creating a new one
- corrupted community references: hide inaccessible communities and log anomaly

## 13. Rollout Plan

- feature flags: none for baseline membership model
- migration order: create tenant tables, create college join request table, seed one college, create community templates
- rollback plan: freeze new signups if tenant resolution becomes unreliable

## 14. Test Plan

- unit tests: domain normalization, role resolution, community grouping
- integration tests: bootstrap membership creation, college join request submission, admin approval flow, access resolution, community listing
- contract tests: internal access APIs, `communities/my`, and college join request endpoints
- manual QA: verified student path, unknown-domain path, admin queue review, admin community seed validation

## 15. Documentation Updates Required

- HLD: if tenant model changes
- SRS: if onboarding or community scope changes
- Master Plan: when first tenant is seeded
- API docs: membership bootstrap, college join request, and access resolve
- Runbook: tenant seeding guide

## 16. Open Questions

- should community auto-membership be created synchronously at bootstrap or through a worker
- should approved college requests always auto-create a default community template or allow admin template choice
- should users support switching between multiple verified tenants in Phase 1 or later
