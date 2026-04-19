# Identity Module LLD

## 1. Metadata

- Feature name: Identity Module Phase 1
- Owner: Backend Platform
- Runtime: `apps/backend`
- Phase: Phase 1
- Date: 2026-04-19
- Status: Draft
- Linked SRS section: 2.1 Authentication and Identity
- Linked HLD section: Phase 1 Module Map, Authentication and Authorization
- Linked ADRs: None yet

## 2. Problem Statement

We need a reliable identity module that maps Firebase-authenticated users into Vyb internal users and prepares them for tenant-scoped access. The module must establish a stable user record, preserve auditability, and avoid embedding membership logic into the web client.

## 3. Scope

In scope:

- Firebase user bootstrap
- backend session bootstrap from Firebase ID tokens
- internal user creation and update
- normalized profile identity
- domain extraction from verified email
- current user context API
- profile completion state and profile update API
- onboarding state for unknown domains

Out of scope:

- college join request queue ownership
- faculty workflow customization
- alumni special onboarding
- push token registration

## 4. Owning Module

- Primary owner: `identity`
- Runtime boundary: `apps/backend/src/modules/identity`
- Secondary dependencies: `campus` module, backend edge layer

## 5. User Flows

- Flow 1: user signs in with Firebase, backend edge validates identity, identity module creates or updates the internal `users` record, then resolves membership through the campus module.
- Flow 2: user opens the app later, backend edge forwards the authenticated context, identity returns canonical `me` data with membership summary.
- Flow 3: first-launch users from the approved college domain complete a campus profile before reaching the dashboard.
- Flow 4: user without a recognized domain receives an onboarding state that points toward the college join-request flow owned by the campus module.

## 6. API Design

### `POST /v1/auth/bootstrap`

- caller: web or future native client
- auth requirement: authenticated actor context required
- request schema: optional profile hints such as display name and avatar URL
- response schema: internal user record, membership summary, onboarding status
- error schema: invalid actor, invalid payload, unsupported account state
- rate limit policy: strict per user and IP

### `POST /v1/auth/session/bootstrap`

- caller: web auth route or future native client
- auth requirement: Firebase ID token in request body
- request schema: `idToken`, optional display-name hint
- response schema: session payload, profile-completion state, next-path decision
- error schema: invalid token, invalid domain, unverified email, unresolved campus access
- rate limit policy: strict per user and IP

### `GET /v1/me`

- caller: web or future native client
- auth requirement: authenticated actor context required
- response schema: user profile, active tenant membership summary, role, onboarding flags
- error schema: unauthorized, user not initialized
- rate limit policy: moderate per user

### `GET /v1/profile`

- caller: web or future native client
- auth requirement: authenticated actor context required
- response schema: profile-completion state, approved launch domain, saved campus profile
- error schema: unauthorized
- rate limit policy: moderate per user

### `PUT /v1/profile`

- caller: web or future native client
- auth requirement: authenticated actor context required
- request schema: first name, optional last name, course, stream or specialization, year, section, hosteller status, optional hostel and phone number
- response schema: saved campus profile and completion state
- error schema: invalid payload, unauthorized, invalid domain
- rate limit policy: moderate per user

## 7. Module Interactions

- calling module: backend edge layer
- target module: `identity`
- reason: bootstrap and current-user resolution
- interaction type: direct in-process function invocation
- failure handling: safe auth error at the backend boundary

- calling module: `identity`
- target module: `campus`
- reason: resolve tenant membership and onboarding state
- interaction type: direct in-process domain call
- failure handling: identity still resolves while membership falls back to pending or unresolved state

## 8. Data Model Changes

- tables touched: `users`, interim profile store, `audit_logs`, `user_activity`
- columns added: none beyond HLD baseline
- indexes added: `users (firebase_uid) unique`, `users (primary_email)`, `users (deleted_at)`
- unique constraints: `users (firebase_uid)`
- soft delete impact: user records use soft delete for deactivation paths
- backfill required: none

## 9. Query Plan

- query name: lookup user by Firebase UID
- filter fields: `firebase_uid`, `deleted_at is null`
- sort order: none
- expected scale: every authenticated request
- supporting index: unique `firebase_uid`
- why this is safe: single-row hot path

- query name: lookup user by primary email
- filter fields: `primary_email`, `deleted_at is null`
- sort order: none
- expected scale: verification support and ops lookup
- supporting index: `users (primary_email)`
- why this is safe: bounded selective lookup

## 10. Validation and Security

- auth checks: Firebase token verification belongs at the backend edge
- tenant checks: membership context comes from the campus module, not the client
- input validation: sanitize display name, avatar URL, and bootstrap payload
- abuse prevention: rate limit bootstrap and `me` access
- audit logging: bootstrap, profile changes, onboarding state changes where needed

## 11. Observability

- logs: bootstrap attempts, session bootstrap failures, profile updates, unknown-domain onboarding responses
- metrics: bootstrap success rate, duplicate bootstrap rate, profile completion rate, unknown-domain onboarding rate
- alerts: sustained bootstrap failures or unusual onboarding spikes
- trace IDs: required on all requests

## 12. Failure Modes

- invalid actor context: user gets unauthorized and is asked to re-authenticate
- campus resolution unavailable: user record still exists but onboarding remains unresolved
- duplicate profile bootstrap race: handled by unique `firebase_uid` and idempotent upsert behavior

## 13. Rollout Plan

- feature flags: none required for baseline bootstrap
- migration order: create `users` table, add indexes, deploy bootstrap and me handlers
- rollback plan: keep auth-disabled flows behind the backend boundary if bootstrap becomes unstable

## 14. Test Plan

- unit tests: actor parsing, bootstrap idempotency, profile normalization
- integration tests: bootstrap flow with campus resolution and session issuance
- contract tests: `bootstrap`, `session/bootstrap`, `me`, and `profile` endpoints plus onboarding-state responses
- manual QA: first login, repeat login, profile completion, unrecognized domain path

## 15. Documentation Updates Required

- HLD: if identity boundaries change
- SRS: if verification rules change
- Master Plan: when identity shipping status changes
- API docs: bootstrap and me endpoints
- Runbook: auth bootstrap operational guide

## 16. Open Questions

- should unknown-domain users receive a temporary pending membership shell or remain outside tenant context until approval
- should display name edits remain in identity or move to a dedicated profile domain later
