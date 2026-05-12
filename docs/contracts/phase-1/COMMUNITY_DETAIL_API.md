# API Contract

Owner: Architecture Team
Last Updated: 2026-05-12
Change Summary: Added Community V1 detail, member-list, and community-owned resource/event composition notes for the Connect surface.

## 1. Metadata

- API name: Community Detail and Members
- Owner module: `campus`
- Runtime: `apps/backend`
- Consumers: `web`, future `mobile`
- Version: `v1`
- Status: Implemented foundation
- Linked LLD: `docs/lld/phase-1/COMMUNITY_CONNECT_SURFACE_LLD.md`

## 2. Endpoint Definition

- Method: `GET`
- Path: `/v1/communities/{slug}`
- Public or internal: public through backend
- Purpose: return a tenant-safe community summary for the active viewer

- Method: `GET`
- Path: `/v1/communities/{slug}/members`
- Public or internal: public through backend
- Purpose: return a paginated list of members visible to the active viewer

- Web composition: `/messages/community/{slug}` also renders bounded published resources and campus events whose `communityId` matches the opened community. These records are still owned by the resources and events contracts, not by the campus community API response.

## 3. Authentication and Authorization

- Auth mechanism: backend edge verified identity
- Required roles: verified tenant membership
- Tenant checks: viewer membership tenant must match the community tenant
- Rate limit policy: moderate per user; member pagination may use stricter burst limits

## 4. Request Schema

- headers: auth token or approved local dev identity headers
- path params: `slug`
- query params for detail: none in V1
- query params for members: optional `limit` capped by backend policy; optional opaque `cursor` from the previous response
- body: none

## 4.1 Web Preview Composition

- resources source: `GET /v1/resources?tenantId={tenantId}&communityId={communityId}&limit=4`
- events source: existing campus events dashboard data source used by Hub, filtered by `communityId`
- filter rule: render published resources and published events only when the record belongs to the opened community
- ownership rule: resources and events keep their owning modules, while community detail composes them by `communityId`

## 5. Response Schema

- success response for detail: `tenant`, `community`, `viewer`, and optional `summary`
- success response for members: `community`, `items[]`, `nextCursor`
- pagination model: cursor-backed member pages, no pagination for detail
- metadata: no client-visible database internals

Example detail response:

```json
{
  "tenant": { "id": "tenant-id", "name": "KIET Group of Institutions", "slug": "kiet" },
  "community": {
    "id": "community-id",
    "name": "CSE Batch 2028",
    "slug": "cse-batch-2028",
    "type": "batch",
    "visibility": "tenant",
    "memberCount": 184,
    "latestActivityAt": "2026-05-12T10:00:00.000Z"
  },
  "viewer": { "isMember": true, "role": "member" },
  "summary": {
    "postCount": 24,
    "resourceCount": 8,
    "eventCount": 2,
    "health": "normal"
  }
}
```

Example member item:

```json
{
  "membershipId": "membership-id",
  "userId": "user-id",
  "username": "student01",
  "displayName": "Student One",
  "role": "member",
  "course": "B.Tech",
  "branch": "CSE",
  "batchYear": 2028,
  "section": "A",
  "hostel": null,
  "joinedAt": "2026-05-12T10:00:00.000Z"
}
```

## 6. Error Schema

- validation errors: invalid slug, invalid cursor, invalid limit
- auth errors: unauthenticated
- authorization errors: no verified membership, forbidden community
- domain errors: community not found
- retryable errors: connector timeout

## 7. Side Effects

- tables written: none
- events emitted: none
- async jobs triggered: none
- audit log entries: none for reads; authorization denials may be structured logs
- degraded read behavior: if the member-list Data Connect operation is unavailable after authorization, the backend may return a bounded viewer-only member row so the community detail page remains usable until the operation is deployed

## 8. Idempotency and Concurrency

- idempotency key needed: no
- duplicate handling: not applicable
- optimistic locking needed: no

## 9. Observability

- logs: community detail reads, member page reads, access denials
- metrics: detail latency, members latency, forbidden-community count
- alerts: spikes in forbidden access or connector timeouts

## 10. Rollout Notes

- feature flags: optional `communityConnectV1`
- backward compatibility: additive endpoints; existing `/v1/communities/my` remains valid
- migration steps: seed official communities and memberships before exposing detail links widely; verify member pagination indexes before large-campus launch
