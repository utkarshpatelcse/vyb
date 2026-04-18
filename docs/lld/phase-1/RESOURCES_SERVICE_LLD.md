# Resources Service LLD

## 1. Metadata

- Feature name: Resources Service Phase 1
- Owner: Academic Platform
- Phase: Phase 1
- Date: 2026-04-18
- Status: Draft
- Linked SRS section: 2.4 Resource Vault and 2.5 Moderation
- Linked HLD section: Resources Service, Media Architecture, Query and Performance Rules
- Linked ADRs: None yet

## 2. Problem Statement

We need an academic resource vault where verified members can upload and browse notes and academic files under tenant-safe rules. The system must support course metadata, future search improvements, and moderation without turning Phase 1 into a complex document management platform.

## 3. Scope

In scope:

- resource metadata creation
- notes and academic file registration
- browse by tenant and course
- recent resource listing
- moderation handoff

Out of scope:

- full-text search engine
- plagiarism detection
- assignment grading
- faculty workflows beyond basic upload capability

## 4. Owning Service

- Primary owner: `resources-service`
- Secondary dependencies: `campus-service`, `media-service`, `moderation-service`

## 5. User Flows

- Flow 1: verified member uploads a note file, creates resource metadata, and associates it with a course.
- Flow 2: user browses recent resources or filters by course.
- Flow 3: user opens a resource detail page and accesses attached files.
- Flow 4: user reports a harmful or invalid resource for moderation review.

## 6. API Design

### `POST /v1/resources`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id, course id, title, description, type, file references
- response schema: created resource with file metadata
- error schema: invalid course, unauthorized tenant, invalid file references
- rate limit policy: moderate per user

### `GET /v1/resources`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant id, optional course id, cursor, limit, sort
- response schema: paginated resource list
- error schema: invalid tenant, invalid course, bad cursor
- rate limit policy: moderate per user

### `GET /v1/resources/{resourceId}`

- caller: web or future native client
- auth requirement: verified membership required
- response schema: resource detail with file metadata
- error schema: not found, unauthorized scope
- rate limit policy: moderate per user

## 7. Service-To-Service Calls

- caller service: `resources-service`
- callee service: `campus-service`
- reason: validate tenant membership and upload access
- sync or async: sync
- failure handling: reject upload or read request

- caller service: `resources-service`
- callee service: `media-service`
- reason: validate file registration and ownership before publish
- sync or async: sync
- failure handling: keep resource draft or reject creation

- caller service: `resources-service`
- callee service: `moderation-service`
- reason: create review case for reported resources
- sync or async: async preferred
- failure handling: retry asynchronously

## 8. Data Model Changes

- tables touched: `courses`, `resources`, `resource_files`, `audit_logs`, `user_activity`
- columns added: none beyond HLD baseline
- indexes added: `resources (tenant_id, created_at desc)`, `resources (course_id, created_at desc)`, `resource_files (resource_id)`
- unique constraints: `resource_files (resource_id, storage_path)`
- soft delete impact: resources and files use soft delete for moderation and recovery flows
- backfill required: initial course catalog seed per tenant

## 9. Query Plan

- query name: recent resources by tenant
- filter fields: `tenant_id`, `status = published`, `deleted_at is null`
- sort order: `created_at desc`
- expected scale: medium-high academic browsing
- supporting index: `resources (tenant_id, created_at desc)`
- why this is safe: tenant-bounded with cursor pagination

- query name: resources by course
- filter fields: `course_id`, `status = published`, `deleted_at is null`
- sort order: `created_at desc`
- expected scale: high around exams
- supporting index: `resources (course_id, created_at desc)`
- why this is safe: selective course filter

- query name: files by resource
- filter fields: `resource_id`, `deleted_at is null`
- sort order: `created_at asc`
- expected scale: per detail view
- supporting index: `resource_files (resource_id)`
- why this is safe: narrow lookup

## 10. Validation and Security

- auth checks: verified membership required
- tenant checks: course and resource must belong to the caller's tenant
- input validation: title, description length, resource type, file count, MIME type
- abuse prevention: upload quotas, report flow, moderation state
- audit logging: moderator removals and admin catalog edits

## 11. Observability

- logs: resource create, browse, detail read, moderation report trigger
- metrics: upload success rate, browse latency, course-filter usage, report rate
- alerts: spikes in invalid upload attempts or failed file registration
- trace IDs: required across access and media validation

## 12. Failure Modes

- course mismatch with tenant: reject create request
- missing file registration: reject resource publish
- moderation downstream delay: accept report and retry
- large file or bad MIME type: fail fast with validation error

## 13. Rollout Plan

- feature flags: optional upload enablement per tenant
- migration order: create course and resource tables, seed course data, enable browse before upload if needed
- rollback plan: keep existing resources readable while disabling new uploads

## 14. Test Plan

- unit tests: course ownership checks, metadata validation, file registration validation
- integration tests: resource create, browse by tenant, browse by course, detail fetch
- contract tests: create and list resources APIs
- manual QA: upload note, browse by course, open detail, report resource

## 15. Documentation Updates Required

- HLD: if resource taxonomy changes
- SRS: if upload permissions or resource types change
- Master Plan: when first tenant resource vault goes live
- API docs: create, list, and detail endpoints
- Runbook: course seeding and upload support guide

## 16. Open Questions

- should course catalog be globally templated with tenant overrides or fully tenant-owned from the start
- should faculty uploads receive a separate trust path from student uploads in Phase 1
