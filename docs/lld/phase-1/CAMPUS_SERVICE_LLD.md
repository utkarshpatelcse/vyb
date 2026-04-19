# Campus Module LLD

## 1. Metadata

- Feature name: Campus Module Phase 1
- Owner: Backend Platform
- Runtime: `apps/backend`
- Phase: Phase 1
- Date: 2026-04-19
- Status: Draft
- Linked SRS section: 2.2 Tenant and Community Management, 2.3 College Join Requests
- Linked HLD section: Phase 1 Module Map, Data Architecture, Authentication and Authorization
- Linked ADRs: None yet

## 2. Problem Statement

We need a tenant-aware module for colleges, domains, memberships, communities, and college onboarding requests. Every downstream module depends on campus ownership to know who belongs where and what data they may access.

## 3. Scope

In scope:

- tenant discovery from email domain
- new college join requests for unknown domains
- admin decisions on college join requests
- tenant memberships
- roles and verification status
- communities and community memberships
- membership summary resolution for downstream modules

Out of scope:

- timetable or class schedule management
- attendance
- placement cells
- club event management

## 4. Owning Module

- Primary owner: `campus`
- Runtime boundary: `apps/backend/src/modules/campus`
- Secondary dependencies: `identity`, `social`, `resources`

## 5. User Flows

- Flow 1: identity resolution reaches campus, campus matches email domain to a tenant and creates a verified membership where possible.
- Flow 2: a user with an unknown domain submits a college join request with college name, address, website, phone, and requested domains.
- Flow 3: an admin reviews the college join request and can approve, reject, or send it back for changes.
- Flow 4: user opens home and receives active tenant plus relevant communities such as batch, hostel, branch, and general.
- Flow 5: downstream modules ask campus logic to validate whether a membership may act in a given tenant or community.

## 6. API Design

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
- response schema: updated request status and downstream tenant bootstrap result if approved
- error schema: invalid decision, request not found, forbidden
- rate limit policy: low per admin

## 7. Module Interactions

- calling module: `identity`
- target module: `campus`
- reason: resolve tenant match and create or fetch membership state
- interaction type: direct in-process call
- failure handling: identity returns unresolved onboarding state

- calling module: `social`
- target module: `campus`
- reason: authorize posting and reading in tenant or community scope
- interaction type: direct in-process call
- failure handling: fail closed for writes

- calling module: `resources`
- target module: `campus`
- reason: authorize uploads and tenant-scoped access
- interaction type: direct in-process call
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

## 10. Validation and Security

- auth checks: only verified memberships get tenant access
- tenant checks: all community and membership reads require canonical tenant resolution
- input validation: community slug, type, visibility, requested domains, and contact fields
- abuse prevention: block duplicate memberships, duplicate active join requests, and invalid cross-tenant access
- audit logging: membership verification changes, college request decisions, community creation, admin edits

## 11. Observability

- logs: membership bootstrap, join request submissions, admin decisions, access denials, community fetches
- metrics: verified membership rate, pending verification count, join request volume, decision latency
- alerts: spike in forbidden access or tenant mismatch errors
- trace IDs: required on all calls

## 12. Failure Modes

- unknown domain: return college join-request onboarding path
- duplicate bootstrap requests: idempotent membership upsert
- duplicate active join requests: return current pending request instead of creating a new one
- corrupted community references: hide inaccessible communities and log anomaly

## 13. Rollout Plan

- feature flags: join-request submission may be soft-launched before admin decisions go live
- migration order: create tenant tables, create join request table, seed one college, create community templates
- rollback plan: freeze new signups if tenant resolution becomes unreliable

## 14. Test Plan

- unit tests: domain normalization, role resolution, community grouping, join request validation
- integration tests: membership creation, join request submission, admin approval flow, community listing
- contract tests: `communities/my` and join request endpoints
- manual QA: verified student path, unknown-domain path, admin queue review

## 15. Documentation Updates Required

- HLD: if tenant model changes
- SRS: if onboarding or community scope changes
- Master Plan: when the first college join request flow ships
- API docs: communities and join request endpoints
- Runbook: tenant seeding and approval guide

## 16. Open Questions

- should community auto-membership be created synchronously at bootstrap or through a worker
- should approved college requests always auto-create a default community template or allow admin template choice
- should users support switching between multiple verified tenants in Phase 1 or later
