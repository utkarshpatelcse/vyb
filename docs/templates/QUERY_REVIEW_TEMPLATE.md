# Query Review Template

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Updated template language for the Phase 1 modular monolith backend.

## 1. Metadata

- Query name:
- Owning module:
- Runtime:
- Linked LLD:
- Reviewer:
- Date:

## 2. Purpose

- What business need does this query serve?

## 3. Query Shape

- tables involved:
- joins:
- filters:
- sort order:
- limit / pagination:

## 4. Expected Scale

- expected rows in table:
- expected rows returned:
- frequency:
- peak traffic assumption:

## 5. Supporting Indexes

- existing indexes:
- new indexes proposed:
- why they are sufficient:

## 6. Safety Checks

- tenant filter present:
- deleted rows excluded:
- auth already enforced:
- unbounded scan avoided:

## 7. Failure and Degradation

- what happens if query is slow:
- fallback behavior:
- timeout policy:

## 8. Review Outcome

- approved:
- changes required:
- notes:
