# Query Review

Owner: Architecture Team
Last Updated: 2026-04-18
Change Summary: Initial review for resources listing.

## 1. Metadata

- Query name: Recent Resources Query
- Owning service: `resources-service`
- Linked LLD: `docs/lld/phase-1/RESOURCES_SERVICE_LLD.md`
- Reviewer: Architecture Team
- Date: 2026-04-18

## 2. Purpose

- Return recent published resources for a tenant or course.

## 3. Query Shape

- Tables involved: `resources`
- Joins: none on the hot list path
- Filters: `tenant_id`, optional `course_id`, `status = published`, `deleted_at is null`
- Sort order: `created_at desc`
- Limit / pagination: cursor-style limit

## 4. Expected Scale

- Expected rows in table: medium to high, exam spikes
- Expected rows returned: 10-30 per page
- Frequency: high around exams and assignment periods
- Peak traffic assumption: repeated course-filtered refreshes

## 5. Supporting Indexes

- Existing indexes: `resources (tenant_id, created_at desc)`, `resources (course_id, created_at desc)`
- New indexes proposed: none beyond HLD baseline
- Why they are sufficient: both read shapes are covered by the baseline indexes

## 6. Safety Checks

- Tenant filter present: yes
- Deleted rows excluded: yes
- Auth already enforced: yes
- Unbounded scan avoided: yes

## 7. Failure and Degradation

- What happens if query is slow: resource browse becomes frustrating in high-intent flows
- Fallback behavior: show stale cached page or retry prompt
- Timeout policy: strict timeout on hot path

## 8. Review Outcome

- Approved: yes
- Changes required: none
- Notes: full-text search is intentionally deferred to keep this query lean

