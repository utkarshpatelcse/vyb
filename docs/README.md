# Vyb Documentation Hub

Owner: Architecture and Product
Last Updated: 2026-04-19
Change Summary: Synced the docs hub with the modular monolith Phase 1 architecture.

This directory is the single source of truth for product, architecture, delivery, and engineering process.

## Document Hierarchy

1. `docs/architecture/HLD.md`
   The living High Level Design. It defines system boundaries, module ownership, core architecture, and scaling strategy.
2. `docs/architecture/CLIENT_PLATFORM_STRATEGY.md`
   The multi-surface client strategy for responsive web and future native apps.
3. `docs/process/ENGINEERING_RULEBOOK.md`
   The non-negotiable rules every teammate must follow.
4. `docs/product/SRS.md`
   The living Software Requirements Specification.
5. `docs/product/MASTER_PLAN.md`
   The execution narrative: what we are building, why, what is done, and what comes next.
6. `docs/lld/phase-1/`
   Execution-ready LLDs for the core Phase 1 backend modules.
7. `docs/contracts/phase-1/`
   API contracts for the current public Phase 1 backend endpoints.
8. `docs/query-reviews/phase-1/`
   Query reviews for the hot paths we expect to matter in Phase 1.
9. `docs/templates/LLD_TEMPLATE.md`
   The mandatory template for any feature-level Low Level Design.
10. `docs/templates/API_CONTRACT_TEMPLATE.md`
   The mandatory template for documenting public or internal API contracts.
11. `docs/templates/QUERY_REVIEW_TEMPLATE.md`
   The mandatory template for hot-path queries and index justification.
12. `docs/templates/ADR_TEMPLATE.md`
   The mandatory template for architecture decisions such as Redis, Pub/Sub, caching, search, or a new third-party service.

## Rules For Updating Docs

- Any scope change that affects architecture must update `HLD.md` first.
- Any new feature must have an approved LLD before implementation starts.
- Any new external dependency or infrastructure service must have an ADR.
- Any requirement change must update `SRS.md`.
- Any phase/status/progress update must update `MASTER_PLAN.md`.
- If code changes but docs do not, the task is not done.

## Review Order For New Teammates

1. Read `HLD.md`
2. Read `CLIENT_PLATFORM_STRATEGY.md`
3. Read `ENGINEERING_RULEBOOK.md`
4. Read `SRS.md`
5. Read `MASTER_PLAN.md`
6. Read the relevant Phase 1 LLD or feature LLD
7. Read the matching API contract and query review for hot paths
8. Read the relevant ADRs for the assigned feature

## Ownership

- Product and architecture owners are responsible for keeping these docs current.
- Every contributor is responsible for updating the documents touched by their change.
