# Campus Events Experience LLD

## 1. Metadata

- Feature name: Campus Events Experience
- Owner: Web Platform
- Phase: Phase 2
- Date: 2026-04-22
- Status: Implemented in fallback-backed web flow
- Linked SRS section: 2. Product Goal and Phase 2 engagement refinement
- Linked HLD section: Core Architecture Principles, Client Surface Strategy, Media Architecture
- Linked ADRs: None

## 2. Problem Statement

The events surface cannot stop at a flat "interested" toggle. Campus events vary by format:

- some only need lightweight interest
- some need a structured registration form
- some need host-reviewed applications
- some require team entries instead of solo responses

The host must also be able to manage these registrations, review responses, and export them for offline coordination.

## 3. Scope

In scope:

- live events feed with dynamic categories
- event hosting and editing
- host-configurable response mode: interest, register, apply
- host-configurable entry mode: individual or team
- host-configurable form fields
- per-event registration closing time
- user registration / application submission
- host registration review: approve, waitlist, reject
- host CSV export of registration data
- responsive event detail and host flows

Out of scope:

- payment collection
- QR ticket issuance
- automated reminders
- moderation workflow for events
- persistent backend module beyond current fallback-backed implementation

## 4. Owning Service

- Primary owner: web events domain flow
- Secondary dependencies: identity profile reads, media upload layer, campus membership session

## 5. User Flows

- Flow 1: user opens events, filters live categories dynamically, and discovers upcoming/saved/ended events.
- Flow 2: user taps an event that uses interest mode and marks interest instantly.
- Flow 3: user taps an event that uses registration mode, fills required form fields, and receives immediate confirmation if capacity allows.
- Flow 4: user taps an event that uses application mode, fills form and team details, and submits for host review.
- Flow 5: host creates or edits an event, configures response mode, entry mode, close time, team-size rules, and custom fields.
- Flow 6: host opens the event detail view, reviews submissions, updates status, and exports CSV.

## 6. API Design

### `GET /api/events`

- caller: authenticated web client
- auth requirement: session required
- response schema: `CampusEventsDashboardResponse`
- error schema: unauthenticated
- rate limit policy: moderate per user

### `POST /api/events`

- caller: authenticated host flow
- auth requirement: session plus completed profile
- request schema: event metadata, media, response config, entry config, form config
- response schema: `CreateCampusEventResponse`
- error schema: invalid payload, missing media, invalid team config, profile incomplete
- rate limit policy: low per user

### `PATCH /api/events/{eventId}`

- caller: authenticated host flow
- auth requirement: session plus event ownership
- request schema: event metadata, keep/remove media, response config, entry config, form config
- response schema: `UpdateCampusEventResponse`
- error schema: invalid payload, unauthorized host action
- rate limit policy: low per user

### `POST /api/events/{eventId}/interest`

- caller: authenticated attendee
- auth requirement: session required
- request schema: none
- response schema: `ToggleCampusEventInterestResponse`
- error schema: event not found, wrong response mode
- rate limit policy: moderate per user

### `POST /api/events/{eventId}/register`

- caller: authenticated attendee
- auth requirement: session plus completed profile
- request schema: team name, team members, form answers, note
- response schema: `UpsertCampusEventRegistrationResponse`
- error schema: invalid answers, registrations closed, capacity exceeded, host self-registration
- rate limit policy: moderate per user

### `GET /api/events/{eventId}/registrations`

- caller: authenticated host
- auth requirement: session plus event ownership
- response schema: `CampusEventRegistrationListResponse`
- error schema: unauthorized host action, event not found
- rate limit policy: moderate per host

### `PATCH /api/events/{eventId}/registrations/{registrationId}`

- caller: authenticated host
- auth requirement: session plus event ownership
- request schema: decision status plus optional note
- response schema: `ManageCampusEventRegistrationResponse`
- error schema: registration not found, capacity exceeded on approval
- rate limit policy: moderate per host

### `GET /api/events/{eventId}/registrations/export`

- caller: authenticated host
- auth requirement: session plus event ownership
- response schema: CSV attachment
- error schema: unauthorized host action, export failure
- rate limit policy: low per host

## 7. Service-To-Service Calls

- caller service: events web route
- callee service: identity profile reader
- reason: resolve host and attendee identity for registration records
- sync or async: sync
- failure handling: fail closed for create/register paths

- caller service: events web route
- callee service: media upload layer
- reason: persist event media before event publish or update
- sync or async: sync
- failure handling: delete uploaded media if event metadata save fails

## 8. Data Model Changes

- tables touched: fallback `events-store.json`
- columns added: response mode, registration config, registration summary sources, registrations
- indexes added: none in fallback mode
- unique constraints: one registration per event per attendee in fallback logic
- soft delete impact: events still use deleted status instead of hard removal from active reads
- backfill required: seeded events now cover interest, registration, and application modes

## 9. Query Plan

- query name: dashboard events list
- filter fields: tenant, status, host ownership
- sort order: start time asc
- expected scale: low in fallback mode
- supporting index: none in fallback mode
- why this is safe: file-backed dev flow only

- query name: host registration review list
- filter fields: event id, tenant, host ownership
- sort order: updated time desc
- expected scale: low campus event volume
- supporting index: none in fallback mode
- why this is safe: single-event slice

## 10. Validation and Security

- auth checks: all reads and writes require authenticated viewer session
- tenant checks: every event and registration path is tenant-scoped
- input validation: event timing, registration close time, response mode, entry mode, team-size range, required form answers
- abuse prevention: host cannot register for own event, one active registration record per attendee per event, capacity enforced on instant registration and approval
- audit logging: not yet implemented in fallback path and remains a follow-up for real backend ownership

## 11. Observability

- logs: route-level error reporting through Next route boundaries
- metrics: not yet implemented in fallback path
- alerts: none yet
- trace IDs: inherited from existing web runtime only

## 12. Failure Modes

- invalid form config: host sees request validation error
- registration closed: attendee sees explicit close-state error
- capacity exceeded: attendee or host sees explicit capacity error
- unauthorized host action: request fails closed
- media registration failure: event publish fails and uploaded media is rolled back

## 13. Rollout Plan

- feature flags: none
- migration order: contracts, fallback data model, APIs, host UI, events UI, docs
- rollback plan: revert to interest-only cards and remove nested registration endpoints

## 14. Test Plan

- unit tests: fallback validation helpers and seat-count rules
- integration tests: create, edit, register, apply, host review, export
- contract tests: event create/update/register/manage/export response shapes
- manual QA: interest-only event, instant registration, team application, host review, CSV download, desktop and mobile layouts

## 15. Documentation Updates Required

- HLD: not required, no architecture change
- SRS: optional future refinement if events become committed phase scope
- Master Plan: yes
- API docs: yes in future if backend module is extracted from fallback flow
- Runbook: none yet

## 16. Open Questions

- when should this move from fallback JSON storage to the real backend module
- should approved attendees get wallet-like tickets or QR confirmation later
- should host review actions emit notifications immediately
