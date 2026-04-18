# Vyb Engineering Rulebook

Owner: Engineering Leadership
Last Updated: 2026-04-18
Change Summary: Added multi-surface client rules with explicit PWA and desktop-quality responsive requirements.

This rulebook is mandatory. These rules are not optional and are intended to prevent architectural drift, undocumented changes, and unsafe shortcuts.

## 1. Documentation Rules

1. Every feature starts with an LLD.
2. Every architecture change updates the HLD.
3. Every requirement change updates the SRS.
4. Every phase or scope update changes the Master Plan.
5. Every new external service, cache, queue, SDK, or cloud component requires an ADR.
6. No pull request is complete until code and docs match.
7. Every document must show an owner, a last updated date, and change summary where applicable.

## 2. Architecture Rules

1. All public backend traffic must pass through the API Gateway.
2. No client may call internal services directly.
3. Each service owns its own domain logic, data access layer, and background jobs.
4. Cross-service database writes are forbidden.
5. Service boundaries cannot be bypassed for speed.
6. Shared code must stay small and generic. Business logic must not move into shared packages.
7. If a feature cannot clearly name its owning service, the design is incomplete.

## 3. Service Introduction Rules

1. A new service may be introduced only with an ADR.
2. The ADR must explain why the existing services are not enough.
3. The ADR must explain expected load, cost, failure modes, and rollback plan.
4. The HLD must be updated before the service is added to the repo.
5. The Master Plan must mention the service introduction and rollout phase.

## 4. Client Platform Rules

1. Backend APIs must remain client-agnostic.
2. Every feature must define mobile and desktop behavior before UI coding starts.
3. Responsive web quality is mandatory. Desktop cannot be treated as a stretched mobile screen.
4. Shared UI across web and native should happen through tokens, contracts, validation, and app-core logic first.
5. Surface-specific components belong in their own web or native package.
6. DOM-specific logic must not leak into shared packages.
7. Any native-only device integration must be isolated from shared domain logic.
8. Phase 1 web work must preserve PWA installability and app-shell behavior on supported mobile browsers.

## 5. API Rules

1. Every API must have a documented contract.
2. Every endpoint must define request schema, response schema, error schema, auth requirements, and rate limit policy.
3. API ownership must be explicit.
4. No endpoint may return tenant data without tenant authorization checks.
5. No endpoint may expose internal database structure directly.
6. Breaking API changes require versioning or a migration plan.
7. Service-to-service calls must be listed in the feature LLD.

## 6. Database Rules

1. Every tenant-scoped table must include `tenant_id`.
2. Every auditable table must include `created_at`, `updated_at`, and `deleted_at`.
3. Every many-to-many table must have uniqueness constraints.
4. Every production query path must have reviewed indexes.
5. Every schema change must document migration steps, backfill needs, and rollback plan.
6. Direct SQL or direct Data Connect operations may be added only by the owning service.
7. Soft delete is the default for user-generated content.
8. Hard delete must be documented and approved for privacy or retention flows only.
9. Query limits and pagination are mandatory for list APIs.
10. Every query added in a hot path must note why its indexes are sufficient.

## 7. Data Connect Rules

1. Operations must be organized per service under `packages/dataconnect/<service>`.
2. Generated SDKs must not be edited by hand.
3. Sensitive mutations must not be directly exposed to clients without review.
4. If a client-facing operation is deployed, compatibility risk for older clients must be considered.
5. Admin SDK usage must stay inside backend services and scripts, never in the web app.

## 8. Security Rules

1. Authentication does not equal authorization. Both must be checked.
2. Rate limiting is mandatory for public APIs.
3. Sensitive actions must be audited.
4. No secrets may be stored in frontend code.
5. Any feature involving money, identity masking, or student records requires explicit security review.
6. App Check must be considered for all Firebase-backed client traffic.
7. File uploads must validate MIME type, file size, and tenant ownership.
8. A new college or domain cannot go live without an auditable admin approval decision.

## 9. Media Rules

1. Media uploads must follow the approved storage path convention.
2. Client-side compression is allowed for large images, but original quality rules must be documented.
3. Metadata registration must succeed before content is published.
4. Reels or videos require explicit size, duration, and moderation policies.

## 10. Background Job Rules

1. Every worker job must be idempotent.
2. Every async job must define retries, dead-letter behavior, and ownership.
3. Every async workflow must define how failure is surfaced to users or admins.

## 11. Observability Rules

1. Every service must emit structured logs.
2. Every request must carry a request ID or trace ID.
3. Error messages exposed to clients must be safe and stable.
4. Privileged actions must be written to `audit_logs`.
5. High-risk user actions should also emit `user_activity` where useful.

## 12. Product Delivery Rules

1. If a feature is not in the current phase plan, it does not get built casually.
2. V1 must solve the strongest utility problem before adding high-risk extras.
3. A flashy feature does not beat a reliable feature.
4. Anonymous, wallet, competition, and marketplace features require deeper policy docs before implementation.

## 13. Definition Of Ready

A task is ready only if:

- scope is clear
- owning service is known
- LLD exists
- API contracts are defined
- schema impact is defined
- indexes are reviewed
- mobile and desktop behavior is defined where UI is involved
- acceptance criteria are written

## 14. Definition Of Done

A task is done only if:

- code is merged
- tests pass or documented exceptions exist
- docs are updated
- observability is added
- security implications are addressed
- responsive behavior is verified for affected UI
- migration steps are documented if needed
- rollout and rollback notes exist for risky changes

## 15. Mandatory Documents Per Feature

Each feature must link to:

- relevant SRS section
- relevant HLD section
- its own LLD
- API contract
- schema changes
- test plan
- rollout notes
- client behavior notes where UI is involved

## 16. Anti-Patterns That Are Forbidden

- adding a service without an ADR
- direct client access to privileged business logic
- direct writes into another service's tables
- undocumented third-party SDKs
- undocumented database indexes
- implementing features from chat discussions only
- shipping code with stale docs
- shipping mobile-only UI that breaks on desktop
- leaking web-only assumptions into shared packages
