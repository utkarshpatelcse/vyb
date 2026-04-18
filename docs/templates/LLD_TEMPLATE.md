# Low Level Design Template

Owner: Architecture Team
Last Updated: 2026-04-18
Change Summary: Initial mandatory low level design template for all features.

Use this template for every feature before implementation starts.

## 1. Metadata

- Feature name:
- Owner:
- Phase:
- Date:
- Status:
- Linked SRS section:
- Linked HLD section:
- Linked ADRs:

## 2. Problem Statement

- What exactly are we building?
- Why is it needed now?
- What user problem does it solve?

## 3. Scope

In scope:

- 

Out of scope:

- 

## 4. Owning Service

- Primary owner:
- Secondary dependencies:

## 5. User Flows

- Flow 1:
- Flow 2:

## 6. API Design

For each endpoint include:

- method and path
- caller
- auth requirement
- request schema
- response schema
- error schema
- rate limit policy
- idempotency rules if applicable

## 7. Service-To-Service Calls

List every internal call:

- caller service:
- callee service:
- reason:
- sync or async:
- failure handling:

## 8. Data Model Changes

- tables touched:
- columns added:
- indexes added:
- unique constraints:
- soft delete impact:
- backfill required:

## 9. Query Plan

For each important query:

- query name
- filter fields
- sort order
- expected scale
- supporting index
- why this is safe

## 10. Validation and Security

- auth checks:
- tenant checks:
- input validation:
- abuse prevention:
- audit logging:

## 11. Observability

- logs:
- metrics:
- alerts:
- trace IDs:

## 12. Failure Modes

- what can fail?
- what does the user see?
- what is retried?
- what requires manual intervention?

## 13. Rollout Plan

- feature flags:
- migration order:
- rollback plan:

## 14. Test Plan

- unit tests:
- integration tests:
- contract tests:
- manual QA:

## 15. Documentation Updates Required

- HLD:
- SRS:
- Master Plan:
- API docs:
- Runbook:

## 16. Open Questions

- 
