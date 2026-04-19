# Vyb High Level Design

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Switched Phase 1 runtime to a modular monolith backend, preserved extraction-ready domain boundaries, kept college join requests as a first-class campus module concern, clarified the public-landing plus authenticated-home-feed web split, recorded the Phase 1 hosting topology of Vercel plus Cloud Run, and captured the live campus-social flow for user IDs, follows, stories, and vibes.

## 1. Document Purpose

This HLD defines the target architecture for Vyb. It is the source of truth for how we ship Phase 1 as a modular monolith while preserving a clean path to future microservice extraction.

## 2. Product Goal

Vyb should become the digital HQ of campus life. The platform must balance:

- social discovery and campus engagement
- academic collaboration and resource sharing
- verified identity and safety
- future monetization without damaging trust
- a strong experience across mobile, desktop, and future native clients
- Phase 1 mobile users should get an installable PWA experience where supported

## 3. Phase Strategy

### Phase 1: Identity and Utility

- verified authentication
- college and community onboarding
- admin-reviewed college join requests for unknown domains
- Campus Square feed with text and image posts
- campus user IDs, profile search, follows, and time-limited stories
- Resource Vault for notes and academic files
- moderation and admin controls

### Phase 2: Engagement

- short-form video / reels
- richer comments and ranking refinement
- anonymous Nook with strict moderation
- polls and lightweight engagement loops

### Phase 3: Economy

- P2P campus marketplace
- competitions
- wallet and ledger

### Phase 4: AI Growth

- AI career roadmaps
- streaks and progress tracking
- mentor and resource recommendations

## 4. Architecture Decision

Phase 1 runtime will be a modular monolith.

That means:

- Vyb ships with one public backend deployable in Phase 1
- the backend contains domain modules with strict ownership boundaries
- the module boundaries must be good enough that future extraction into microservices is possible without rewriting the whole product
- separate deployables are not the default; extraction is a later optimization, not the starting point

This choice exists because we want:

- lower ops complexity
- simpler local development
- one deployable backend for early hosting
- less distributed failure handling before product-market fit
- cleaner iteration speed while still enforcing domain boundaries

## 5. Core Architecture Principles

- Module boundaries are defined from the beginning.
- Deployment can stay unified while ownership remains explicit.
- Each module owns its domain logic, data access rules, validation, and documentation.
- No direct writes into another module's owned tables, even inside the monolith.
- All public backend traffic enters through one backend boundary in Phase 1.
- Gateway concerns such as auth, rate limiting, request IDs, and input validation live at the backend edge layer.
- Every write path must be auditable.
- Every production feature must be observable.
- Every future service extraction requires an ADR and HLD update.
- Backend APIs must remain client-agnostic so web and native clients can evolve safely.
- Shared UI must happen through design tokens and primitive rules, not by forcing one surface's components onto another.
- Responsive web quality is mandatory; desktop cannot be treated as an afterthought.

## 6. Recommended Repository Shape

```text
vyb/
  apps/
    web/
    mobile/
    backend/
      src/
        lib/
        modules/
          shared/
          identity/
          campus/
          social/
          resources/
          moderation/
          media/
  packages/
    contracts/
    validation/
    app-core/
    design-tokens/
    ui-web/
    ui-native/
    config/
    dataconnect/
      identity/
      campus/
      social/
      resources/
      moderation/
      wallet/
      marketplace/
      competition/
      growth/
  docs/
```

### Client Surface Strategy

- `apps/web` is the Phase 1 shipping client using Next.js and PWA capabilities.
- `apps/web` contains a public SSR landing at `/`, an authenticated home-feed landing at `/home`, and a separate profile/dashboard surface.
- `apps/mobile` is a future React Native / Expo client and must be considered in architecture decisions from the start.
- `apps/backend` is the only Phase 1 backend deployable.
- Shared logic should live in `packages/contracts`, `packages/validation`, and `packages/app-core`.
- Shared styling decisions should live in `packages/design-tokens`.
- Surface-specific components should live in `packages/ui-web` and `packages/ui-native`.
- Do not bake web-only navigation, DOM assumptions, or CSS-specific logic into shared domain packages.

## 7. Phase 1 Deployables

### 7.1 Web App

- Next.js App Router + PWA
- mobile-first UI
- desktop-strong responsive layouts
- server-rendered routes where useful
- public marketing and auth entry routes plus an authenticated home-feed route after onboarding
- direct upload UX for media and resources
- installable app shell with manifest and service worker
- no privileged business logic

### 7.2 Backend Monolith

The backend monolith is the only public backend runtime in Phase 1.

Responsibilities:

- auth token verification at the edge
- App Check verification later where applicable
- request validation
- rate limiting
- request ID and trace propagation
- structured logging
- public API routing
- module orchestration
- Data Connect access for privileged business flows

### 7.3 Phase 1 Hosting Topology

- `apps/web` is recommended to deploy on Vercel for the Phase 1 shipping surface.
- `apps/backend` is recommended to deploy on Google Cloud Run as one public backend service.
- This hosting split does not change the architectural rule that Phase 1 owns one backend deployable, not multiple backend services.
- The backend runtime should use Cloud Run service identity for Firebase Admin and Data Connect access instead of a checked-in service-account JSON path.

### 7.4 Future Native App

- React Native / Expo recommended for Android and iOS
- consumes the same backend APIs and contracts as the web client
- may use surface-specific components, but must reuse shared validation, contracts, and business-flow logic where practical
- feature design must define mobile and desktop behavior before implementation starts

## 8. Phase 1 Module Map

### 8.1 Identity Module

Owns:

- internal user identity
- Firebase Auth mapping
- profile bootstrap
- current user context

### 8.2 Campus Module

Owns:

- tenants (colleges)
- tenant domains
- college join requests and admin review decisions
- memberships
- communities such as batch, branch, hostel, club, and general

### 8.3 Social Module

Owns:

- feed posts
- follow graph
- story visibility and active-story lanes
- public profile discovery by campus user ID
- comments
- reactions
- social ranking metadata
- future reels metadata

### 8.4 Resources Module

Owns:

- academic resources
- course mapping
- file metadata
- vault permissions

### 8.5 Future Modules

- moderation
- media
- notifications
- worker jobs
- wallet
- marketplace
- competitions
- growth AI

These remain module candidates first. They become separate services only through approved extraction.

## 9. Request Flow

### 9.1 Public Request Flow

```text
Client -> Backend edge layer -> Target module -> Data Connect Admin SDK -> PostgreSQL
Client -> Firebase Storage -> Backend media registration flow -> Moderation / worker logic
Unknown-domain user -> Backend edge layer -> Campus module -> college join request queue -> admin decision
```

### 9.2 Internal Interaction Rules

- Web never calls module internals directly.
- Web only calls the public backend APIs plus Firebase Auth / Firebase Storage.
- Module-to-module calls must be explicit and documented in the relevant LLD.
- Prefer direct module invocation inside the monolith over synthetic internal HTTP.
- If asynchronous workflows are needed, start with an outbox pattern. Introduce a broker only through ADR.

### 9.3 Ownership Matrix

| Capability | Owner Module | Read Access | Write Access |
|---|---|---|---|
| Users | Identity | Campus, Social, Resources | Identity |
| Tenant membership | Campus | Identity, Social, Resources, Moderation | Campus |
| Communities | Campus | Social, Resources | Campus |
| College join requests | Campus | Identity, Admin surfaces | Campus |
| Posts | Social | Moderation, Analytics | Social |
| Comments | Social | Moderation | Social |
| Reactions | Social | Analytics | Social |
| Resources | Resources | Campus, Moderation | Resources |
| Media metadata | Media | Social, Resources, Moderation | Media |
| Reports | Moderation | Social, Resources | Moderation |

## 10. Data Architecture

### 10.1 Database Strategy

- Primary database: PostgreSQL via Firebase Data Connect
- Domain-owned connectors and operations remain organized under `packages/dataconnect/<domain>`
- Privileged writes happen through the backend using the Data Connect Admin SDK
- Client SDK usage is allowed only for approved, low-risk read flows

### 10.2 Mandatory Table Standards

Every core table must include:

- `id`
- `created_at`
- `updated_at`
- `deleted_at`

Recommended when relevant:

- `created_by`
- `updated_by`
- `deleted_by`
- `version`

### 10.3 Mandatory Multi-Tenant Rules

- Every tenant-scoped table must include `tenant_id`
- Tenant filtering is never optional in code
- Public queries must validate tenant membership before data access
- Cross-tenant joins in application logic are forbidden unless explicitly documented

### 10.4 Phase 1 Core Tables

- `tenants`
- `tenant_domains`
- `users`
- `tenant_memberships`
- `college_join_requests`
- `communities`
- `community_memberships`
- `posts`
- `post_media`
- `comments`
- `reactions`
- `courses`
- `resources`
- `resource_files`
- `reports`
- `moderation_cases`
- `audit_logs`
- `user_activity`

### 10.5 Required Unique Constraints

- `tenant_domains (tenant_id, domain)`
- `users (firebase_uid)`
- `tenant_memberships (tenant_id, user_id)`
- `college_join_requests (normalized_primary_domain)` when the request is active
- `communities (tenant_id, slug)`
- `community_memberships (community_id, membership_id)`
- `reactions (post_id, membership_id, reaction_type)` or stricter `(post_id, membership_id)` if single reaction only
- `resource_files (resource_id, storage_path)`

### 10.6 Required Phase 1 Indexes

- `posts (tenant_id, created_at desc)`
- `posts (community_id, created_at desc)`
- `comments (post_id, created_at asc)`
- `reactions (post_id)`
- `resources (tenant_id, created_at desc)`
- `resources (course_id, created_at desc)`
- `tenant_memberships (tenant_id, user_id)`
- `college_join_requests (status, created_at desc)`
- `college_join_requests (normalized_primary_domain)`
- `community_memberships (community_id, membership_id)`
- `reports (tenant_id, status, created_at desc)`
- `user_activity (tenant_id, membership_id, created_at desc)`

### 10.7 Soft Delete Policy

- Use `deleted_at` instead of hard delete for user-generated and auditable entities
- Hard delete is allowed only for irreversible privacy or retention workflows and must be handled through approved jobs
- Queries must default to excluding deleted rows

## 11. Authentication and Authorization

- Authentication source: Firebase Auth
- Authentication is verified at the backend edge
- College access control: domain-based verification plus an admin-reviewed onboarding path for unknown domains
- Authorization source of truth: `tenant_memberships` and role claims
- Roles in Phase 1: `student`, `faculty`, `alumni`, `moderator`, `admin`
- Module authorization must not trust client-provided role data
- Unknown domains must never auto-create live tenants without an admin approval record

## 12. Media Architecture

- File storage: Firebase Storage
- Web uploads use client-side compression for large images before upload
- Uploads must include metadata such as `tenant_id`, `uploader_id`, `content_type`, and `origin_module`
- Uploaded media is not publishable until backend metadata registration succeeds
- Reels in Phase 2 require validation for size, duration, MIME type, and transcoding strategy

### Storage Path Convention

```text
tenants/{tenantId}/users/{userId}/social/{postId}/{fileName}
tenants/{tenantId}/users/{userId}/resources/{resourceId}/{fileName}
```

## 13. Observability

Mandatory for the backend:

- structured logs
- request ID
- trace ID
- error taxonomy
- latency metrics
- failure counters
- audit logs for privileged actions

Mandatory per module:

- ownership of its success and failure metrics
- explicit log events for high-risk writes
- clear error shapes at the public API boundary

## 14. Future Microservice Extraction Path

Modules may be extracted later, but only when at least one of these becomes true:

- traffic or latency isolation is needed
- team ownership needs separate deploy cadence
- security or compliance boundaries require isolation
- async processing or scaling patterns become materially different

Extraction rules:

- extract one module at a time
- create the new service directory only when the extraction is approved
- preserve API contracts first
- keep table ownership unchanged
- replace internal module calls with HTTP or async calls only after an ADR
- do not extract multiple modules at once without evidence

## 15. Wallet and Competition Constraints

Wallet is intentionally excluded from Phase 1. When introduced later:

- use double-entry ledger tables
- never store only a mutable balance field
- every transaction must be idempotent
- payouts require reconciliation and audit support
- legal review is mandatory before entry-fee competitions launch

## 16. Recommended Documentation Flow

1. Update `SRS.md`
2. Update `HLD.md` if architecture changes
3. Create or update an LLD
4. Create an ADR if infra or dependency changes
5. Implement
6. Update `MASTER_PLAN.md`

## 17. Open Decisions

- whether to use Data Connect client SDK for any direct read paths in Phase 1
- whether notifications start with email only or include push
- whether search is deferred fully or basic metadata search is introduced in Phase 1
- whether faculty and alumni onboarding use the same verification workflow
- whether approved college join requests auto-seed a default community template or require admin template choice
