# Query Review

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Updated query review language for the Phase 1 modular monolith backend.

## 1. Metadata

- Query name: Tenant Feed Query
- Owning module: `social`
- Runtime: `apps/backend`
- Linked LLD: `docs/lld/phase-1/SOCIAL_SERVICE_LLD.md`
- Reviewer: Architecture Team
- Date: 2026-04-19

## 2. Purpose

- Return the published feed for a tenant or community in reverse chronological order.

## 3. Query Shape

- Tables involved: `posts`
- Joins: none on the hot list path
- Filters: `tenant_id`, optional `community_id`, `status = published`, `deleted_at is null`
- Sort order: `created_at desc`
- Limit / pagination: cursor-style limit

## 4. Expected Scale

- Expected rows in table: high growth over time
- Expected rows returned: 10-30 per page
- Frequency: highest read traffic in Phase 1
- Peak traffic assumption: feed refreshes dominate reads

## 5. Supporting Indexes

- Existing indexes: `posts (tenant_id, created_at desc)`, `posts (community_id, created_at desc)`
- New indexes proposed: none beyond HLD baseline
- Why they are sufficient: both common filters are supported by descending created-time indexes

## 6. Safety Checks

- Tenant filter present: yes
- Deleted rows excluded: yes
- Auth already enforced: yes
- Unbounded scan avoided: yes

## 7. Failure and Degradation

- What happens if query is slow: feed feels stale or blocked
- Fallback behavior: return cached page or empty-state with retry
- Timeout policy: strict timeout on hot path

## 8. Review Outcome

- Approved: yes
- Changes required: none
- Notes: avoid counts or heavyweight joins on the feed list path
