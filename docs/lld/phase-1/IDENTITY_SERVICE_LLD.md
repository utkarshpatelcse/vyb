# Identity Service LLD

## 1. Metadata

- Feature name: Identity Service Phase 1
- Owner: Backend Platform
- Phase: Phase 1
- Date: 2026-04-18
- Status: Draft
- Linked SRS section: 2.1 Authentication and Identity
- Linked HLD section: Identity Service, Authentication and Authorization
- Linked ADRs: None yet

## 2. Problem Statement

We need a reliable identity layer that maps Firebase-authenticated users into Vyb internal users and prepares them for tenant-scoped access. This service must establish a stable user record, preserve auditability, and avoid embedding tenant membership logic into the web client.

## 3. Scope

In scope:

- Firebase user bootstrap
- internal user creation and update
- normalized profile identity
- domain extraction from verified email
- current user context API
- onboarding state for unknown domains

Out of scope:

- tenant membership ownership
- college join request queue ownership and admin decisions
- faculty workflow customization
- alumni special onboarding
- push token registration

## 4. Owning Service

- Primary owner: `identity-service`
- Secondary dependencies: `campus-service`, `api-gateway`

## 5. User Flows

- Flow 1: User signs in with Firebase, app calls bootstrap, identity creates or updates internal `users` record, then requests membership bootstrap from campus-service.
- Flow 2: User opens app later, gateway verifies token, identity returns canonical `me` profile with resolved membership summary.
- Flow 3: User without a recognized domain receives an onboarding state that sends them into the college join-request flow owned by campus-service.

## 6. API Design

### `POST /v1/auth/bootstrap`

- caller: web client
- auth requirement: Firebase ID token required
- request schema: optional profile hints such as display name and avatar URL
- response schema: internal user record, membership summary, onboarding status
- error schema: invalid token, email not verified, unsupported account state
- rate limit policy: strict per user and IP

### `GET /v1/me`

- caller: web or future native client
- auth requirement: Firebase ID token required
- response schema: user profile, active tenant membership summary, role, onboarding flags
- error schema: unauthorized, user not initialized
- rate limit policy: moderate per user

## 7. Service-To-Service Calls

- caller service: `identity-service`
- callee service: `campus-service`
- reason: resolve tenant domain match and create or update initial membership state
- sync or async: sync during bootstrap
- failure handling: bootstrap succeeds for user creation, membership state returns as pending resolution

- caller service: `identity-service`
- callee service: `campus-service`
- reason: fetch active membership summary for `GET /v1/me`
- sync or async: sync
- failure handling: return user identity and degraded membership summary

- caller service: `identity-service`
- callee service: `campus-service`
- reason: return canonical onboarding state when the email domain is unknown and a college join request is required
- sync or async: sync
- failure handling: user identity still resolves, onboarding falls back to manual support instructions

## 8. Data Model Changes

- tables touched: `users`, `audit_logs`, `user_activity`
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

- auth checks: Firebase token verified at gateway and revalidated where needed
- tenant checks: membership context comes from campus-service, not client
- input validation: sanitize display name, avatar, verification request payload
- abuse prevention: rate limit bootstrap and verification requests
- audit logging: bootstrap, profile changes, verification requests

## 11. Observability

- logs: bootstrap attempts, auth failures, unknown-domain onboarding responses
- metrics: bootstrap success rate, duplicate bootstrap rate, unknown-domain onboarding rate
- alerts: sustained bootstrap failures, unusual unknown-domain onboarding spikes
- trace IDs: required on all requests

## 12. Failure Modes

- Firebase token invalid: user gets unauthorized and is asked to re-authenticate
- campus-service unavailable: user record still exists but onboarding remains pending
- duplicate profile bootstrap race: handled by unique `firebase_uid` and idempotent upsert

## 13. Rollout Plan

- feature flags: none required for Phase 1 bootstrap
- migration order: create `users` table, add indexes, deploy bootstrap endpoint
- rollback plan: keep auth disabled behind gateway if membership bootstrap is unstable

## 14. Test Plan

- unit tests: token claim parsing, bootstrap idempotency, profile normalization
- integration tests: bootstrap flow with mocked campus-service responses
- contract tests: `bootstrap` and `me` APIs plus onboarding-state responses
- manual QA: first login, repeat login, unrecognized domain path

## 15. Documentation Updates Required

- HLD: if auth boundaries change
- SRS: if verification rules change
- Master Plan: when service ships
- API docs: bootstrap and me endpoints
- Runbook: auth bootstrap operational guide

## 16. Open Questions

- should unknown-domain users receive a temporary pending membership shell or remain outside tenant context until approval
- should display name edits remain in identity-service or move to a dedicated profile domain later
