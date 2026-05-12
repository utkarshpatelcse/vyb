# Community Connect Surface LLD

## 1. Metadata

- Feature name: Community Connect Surface V1
- Owner: Product and Backend Platform
- Runtime: `apps/web` and `apps/backend`
- Phase: Phase 1
- Date: 2026-05-12
- Status: Draft
- Linked SRS section: 2.2 Tenant and Community Management, 2.4 Campus Square Feed, 2.6 Direct Messaging, 2.7 Moderation
- Linked HLD section: Phase 1 Module Map, Data Architecture, Authentication and Authorization, Realtime and E2EE Notes
- Linked ADRs: None. This feature stays inside the existing Phase 1 web plus backend modular monolith topology.

## 2. Problem Statement

Vyb needs a high-priority community surface that makes verified campus belonging obvious without hiding the feature under games, events, or a generic social feed. Students should immediately see their official campus circles, open the right community context, post or browse community-scoped activity, and still reach private one-to-one E2EE chats from the same connection surface.

The existing messages surface already contains the private chat system and a placeholder community tab. Community V1 turns that placeholder into the primary `Connect` experience: community first, private chats second. This avoids adding another crowded top-level navigation item while still giving communities priority over games, events, market, and generic discovery.

## 3. Scope

In scope:

- Rename the user-facing mental model from chats-only to `Connect`, while keeping compatible `/messages` routes during V1.
- Make the community tab the default surface when a user opens Connect without a specific conversation.
- Render `My Communities` from the campus module with official circle grouping.
- Show community cards with name, type, member count, membership role/status, visibility, and latest activity where available.
- Add community detail API and UI foundation for `Feed`, `Resources`, `Members`, and `Events`.
- Link each Connect community card to `/messages/community/{slug}` for V1 route compatibility.
- Use existing social feed support for community-scoped posts through `communityId`.
- Support community feed comments through the existing secured social thread sheet.
- Show bounded community-owned resources and events inside the community detail tabs using `communityId`.
- Keep private one-to-one E2EE chat as the second tab and preserve existing chat URLs.
- Enforce tenant membership and community membership checks before community reads or writes.
- Keep moderation hooks available through existing report flows for posts/comments in community scope.
- Document query/index expectations before scaling beyond the first campus.

Out of scope:

- Fully realtime community group chat.
- E2EE community rooms.
- Anonymous community posting and anonymous community comments.
- Personal community creation by all users.
- Inter-community battles, advanced rankings, points, wallet, and money flows.
- New deployable services, Redis, Pub/Sub, or search infrastructure.

## 4. Owning Service

- Primary owner: `campus` for communities, memberships, visibility, and member lists.
- Secondary dependencies: `social` for community-scoped feed and engagement, `resources` for resource previews, `chat` for private E2EE tab, `moderation` for reports and later review queues.

## 5. User Flows

- Flow 1: A verified user opens Connect. The Community tab loads first and shows official communities such as campus-wide, branch, batch, section, and hostel.
- Flow 2: The user switches to Chats and continues using the existing one-to-one E2EE inbox without community data entering encrypted chat storage.
- Flow 3: The user opens a community card and sees a detail surface with scoped feed, resources, members, and events.
- Flow 4: The user creates a post from a community context. The web composer sends `communityId`, and the social module verifies the active community membership before publishing.
- Flow 5: The user opens a community post thread, reacts, replies, or comments. The social module resolves the owning post from the supplied post/comment id and verifies active community membership before any data is returned or mutation is applied.
- Flow 6: The user opens Members and sees a paginated, tenant-safe list of verified members in that community.
- Flow 7: The user opens Resources or Events and sees published items attached to that exact community, with links back to Vault and Event hosting surfaces.
- Flow 8: The user reports harmful community-scoped content. The target content remains owned by its domain module, and the report goes through the shared moderation path.

## 6. API Design

### `GET /v1/communities/my`

- caller: web or future native client
- auth requirement: verified tenant membership required
- request schema: no body; optional `include` query may later accept `summary`
- response schema: tenant summary, viewer membership summary, grouped `communities[]`
- error schema: unauthenticated, no verified membership, connector timeout
- rate limit policy: moderate per user
- idempotency rules: read-only

### `GET /v1/communities/{slug}`

- caller: web or future native client
- auth requirement: verified tenant membership required; member-only communities require active `community_memberships` row
- request schema: path param `slug`
- response schema: tenant summary, community summary, viewer community role/status, counts and latest activity summary
- error schema: unauthenticated, no verified membership, community not found, forbidden community
- rate limit policy: moderate per user
- idempotency rules: read-only

### `GET /v1/communities/{slug}/members`

- caller: web or future native client
- auth requirement: verified tenant membership required; community visibility rules enforced
- request schema: path param `slug`, optional `cursor`, optional `limit`
- response schema: community id/slug, `items[]`, `nextCursor`
- current implementation note: the members tab loads a bounded first page and uses `nextCursor` for server-backed page fetches.
- error schema: unauthenticated, forbidden, invalid cursor, connector timeout
- rate limit policy: moderate per user, stricter for high-volume scrolling
- idempotency rules: read-only

### `GET /v1/feed?communityId={id}`

- caller: web or future native client
- auth requirement: verified tenant membership plus community read permission
- request schema: existing feed query params plus `communityId`
- response schema: existing paginated feed response
- error schema: invalid community, unauthorized community, bad cursor
- rate limit policy: moderate per user
- idempotency rules: read-only

### `POST /v1/posts` with `communityId`

- caller: web or future native client
- auth requirement: verified tenant membership plus active membership in the target community
- request schema: existing social post payload with `communityId`, `placement: "feed"`, and V1 text-post fields
- response schema: created feed item
- error schema: invalid tenant, forbidden community, invalid body, invalid media
- rate limit policy: moderate per user with burst protection
- idempotency rules: no idempotency key in this slice

### Community-scoped social interactions

- caller: web or future native client
- auth requirement: verified tenant membership plus active membership in the target post's community
- covered endpoints: post likes list, post reactions, comments, comment reactions, reposts, author edits, and author deletes
- authorization rule: backend must load the target post from the supplied post id or comment id, then reject with `FORBIDDEN_COMMUNITY` when the viewer is not an active member of that community
- leak-prevention rule: public profile feeds and companion reads must not expose community-scoped posts to non-members
- identity rule: community posts and reposts force `allowAnonymousComments: false`; anonymous community comments are rejected by the existing post-level anonymous-comment guard
- abuse rule: backend applies per-member short-window burst limits to comment writes, reactions, reposts, thread reads, and content-management mutations

### Community-owned resources and events

- caller: web server component only in this slice
- auth requirement: verified tenant membership plus active membership in the target community
- resource source: `GET /v1/resources?tenantId={tenantId}&communityId={communityId}&limit=4`
- event source: current campus event store/dashboard with `communityId` on each event record
- response rule: only published resources and published events whose `communityId` matches the opened community are rendered
- security rule: resource reads and writes fail closed when the viewer is not a member of the target community; event dashboard reads hide community-owned events when the viewer is not a member

## 7. Service-To-Service Calls

- caller service: `social`
- callee service: `campus`
- reason: authorize community-scoped feed reads, post writes, comments, reactions, reposts, and reports
- sync or async: sync in-process domain call
- failure handling: fail closed for writes and return forbidden for reads

- caller service: `resources`
- callee service: `campus`
- reason: authorize community resource previews and uploads
- sync or async: sync in-process domain call
- failure handling: hide inaccessible resources and reject unauthorized uploads

- caller service: `apps/web`
- callee service: public backend APIs only
- reason: load community and chat data through stable client-agnostic contracts
- sync or async: HTTP
- failure handling: render partial states; private chats must still load if community summary fails

## 8. Data Model Changes

- tables touched: `communities`, `community_memberships`, `tenant_memberships`, `posts`, `resources`, `reports`, `audit_logs`, `user_activity`
- columns added: `resources.community_id`; event store records include `communityId` in the serialized event payload
- indexes added: verify `communities (tenant_id, slug)`, `communities (tenant_id, type, created_at desc)`, `community_memberships (community_id, membership_id)`, `community_memberships (membership_id, joined_at asc)`, `posts (community_id, created_at desc)`, `resources (community_id, created_at desc)`
- unique constraints: keep `communities (tenant_id, slug)` and `community_memberships (community_id, membership_id)`
- soft delete impact: deleted communities, memberships, posts, and resources must be excluded by default
- backfill required: seed official communities for each live tenant and create official `community_memberships` from profile fields

## 9. Query Plan

- query name: list my communities
- filter fields: `membership_id`, `deleted_at is null`
- sort order: `joined_at asc`, grouped in application by community type
- expected scale: one request per Connect open
- supporting index: `community_memberships (membership_id, joined_at asc)`
- why this is safe: returns only the viewer's memberships, not a tenant-wide scan

- query name: community detail by slug
- filter fields: `tenant_id`, `slug`, `deleted_at is null`
- sort order: none
- expected scale: one request per community detail open
- supporting index: unique `communities (tenant_id, slug)`
- why this is safe: exact match inside tenant boundary

- query name: community members page
- filter fields: `community_id`, `deleted_at is null`
- sort order: `joined_at asc` or cursor-backed key order
- expected scale: high for large official communities
- supporting index: `community_memberships (community_id, joined_at asc)`
- why this is safe: cursor pagination avoids loading the whole community
- current web behavior: the community page asks for a bounded first page and fetches more pages through `/api/communities/{slug}/members` when the user expands the member list.

- query name: community feed
- filter fields: `community_id`, `status = published`, `deleted_at is null`
- sort order: `created_at desc`
- expected scale: high for active communities
- supporting index: `posts (community_id, created_at desc)`
- why this is safe: existing feed pagination can constrain every read

- query name: community tab resource preview
- filter fields: `tenant_id`, `community_id`, `status = published`, `deleted_at is null`
- sort order: `created_at desc`
- expected scale: low per community detail open
- supporting index: `resources (community_id, created_at desc)` plus tenant check
- why this is safe: preview is bounded, starts from a selective community id, and the resources module verifies community membership before returning rows

- query name: community tab event preview
- filter fields: `tenant_id`, `community_id`, `status = published`
- sort order: event dashboard order
- expected scale: low per community detail open
- supporting index: current event dashboard store is tenant-scoped; community filtering is applied before rendering
- why this is safe: event dashboard reads hide community-owned events from non-members and the preview stays bounded

## 10. Validation and Security

- auth checks: every endpoint requires backend edge-authenticated viewer context.
- tenant checks: every community read/write must resolve the viewer's active tenant membership and compare it with the community tenant.
- target-post checks: every post/comment interaction must resolve the owning post and verify active community membership when `posts.community_id` is present.
- input validation: community slug is normalized, cursor/limit are bounded, and body fields for posts/resources continue through owning module validation.
- abuse prevention: rate limits on list/detail/member reads, stricter write limits for post/comment/reaction/repost/report flows, no anonymous community posting or anonymous community comments in V1.
- audit logging: privileged community creation, membership changes, moderation actions, and emergency locks must be auditable.
- privacy boundary: private one-to-one chats remain E2EE. Community content is not stored in chat tables and is not E2EE in V1 because moderation and safety require reviewable content.

## 11. Observability

- logs: community list read, community detail read, member page read, community authorization denial, community post creation, report creation.
- metrics: community list latency, detail latency, member page latency, forbidden-community count, community feed latency, report rate by community.
- alerts: spikes in forbidden access, connector timeouts, community feed errors, report surges.
- trace IDs: required through backend edge and module logs.

## 12. Failure Modes

- community list fails: user sees a community load error while the Chats tab remains usable.
- chat identity missing: current secure chat setup path remains unchanged; community tab should not require chat key setup.
- community membership missing: official community repair job or bootstrap should recreate it; user sees limited tenant-level communities until repaired.
- feed query slow: community detail can render header and tabs while feed shows a retry state.
- member query unavailable: after community authorization, the backend may return the viewer's own member row as a bounded degraded response until `ListCommunityMembers` is deployed.
- community post forbidden: composer and thread actions stay disabled for non-members, and backend rejects any forged `communityId`, post id, or comment id with `FORBIDDEN_COMMUNITY`.
- moderation spike: admins may lock/mute future room surfaces; V1 feed writes can be disabled by feature flag while reads remain available.

## 13. Rollout Plan

- feature flags: optional `communityConnectV1` UI flag and backend route flag if rollout needs staged tenant enablement.
- migration order: docs, enriched contracts, Data Connect operations, backend read APIs, web community tab, community detail route, feed integration, member list cursor pagination, moderation hardening.
- rollback plan: restore Chats as default tab and hide community detail links while leaving existing community data untouched.

## 14. Test Plan

- unit tests: community slug validation, grouping rules, permission checks, cursor parsing.
- integration tests: list communities, detail by slug, members page, community-scoped feed authorization, forbidden cross-tenant access.
- contract tests: `/v1/communities/my`, `/v1/communities/{slug}`, `/v1/communities/{slug}/members`.
- manual QA: mobile Connect default tab, desktop Connect split layout, switch between Community and Chats, open private conversation, open community card, create community-scoped post, open thread, comment, reply, react, expand members, view resource preview, view event preview, and report content.

## 15. Documentation Updates Required

- HLD: document Connect surface and private chat/community boundary.
- SRS: document Community V1 requirements and acceptance criteria.
- Master Plan: mark Community Connect V1 as the current focused implementation slice.
- API docs: update list-my contract and add detail/members contracts.
- Runbook: later add community seeding and emergency moderation handling.

## 16. Open Questions

- Should the user-facing nav label become `Connect` immediately or only after the community tab has real data?
- Should official communities be repaired synchronously during profile update or through a backend maintenance job?
- Should `section` and `hostel` communities be auto-created only when profile fields are present, or pre-seeded by admins?
- What is the first tenant's exact official community template for KIET?
