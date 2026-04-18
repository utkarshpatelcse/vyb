# Query Review

Owner: Architecture Team
Last Updated: 2026-04-18
Change Summary: Initial review for membership context lookup.

## 1. Metadata

- Query name: Membership Context Lookup
- Owning service: `campus-service`
- Linked LLD: `docs/lld/phase-1/CAMPUS_SERVICE_LLD.md`
- Reviewer: Architecture Team
- Date: 2026-04-18

## 2. Purpose

- Resolve the current tenant membership for authenticated requests.

## 3. Query Shape

- Tables involved: `tenant_memberships`, `tenants`, `users`
- Joins: membership to tenant and user
- Filters: `tenant_id`, `user_id`, `deleted_at is null`
- Sort order: none
- Limit / pagination: single-row lookup

## 4. Expected Scale

- Expected rows in table: up to low millions long-term
- Expected rows returned: 1
- Frequency: every authenticated request path
- Peak traffic assumption: one lookup per primary user action

## 5. Supporting Indexes

- Existing indexes: `tenant_memberships (tenant_id, user_id)` from HLD baseline
- New indexes proposed: none beyond baseline
- Why they are sufficient: exact-match lookup on both columns

## 6. Safety Checks

- Tenant filter present: yes
- Deleted rows excluded: yes
- Auth already enforced: yes
- Unbounded scan avoided: yes

## 7. Failure and Degradation

- What happens if query is slow: gateway and downstream endpoints degrade
- Fallback behavior: return pending membership or temporary error
- Timeout policy: low timeout with visible retry path

## 8. Review Outcome

- Approved: yes
- Changes required: none
- Notes: keep this query extremely small and cache cautiously per request scope

