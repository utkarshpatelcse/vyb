# Vyb High Level Design

Owner: Architecture Team
Last Updated: 2026-04-18
Change Summary: Renamed the product to Vyb and added an admin-reviewed college join-request workflow to the core architecture.

## 1. Document Purpose

This HLD defines the target architecture for Vyb, a service-oriented campus platform that combines verified social interaction, academic utility, and future campus commerce. It is a living document and must be updated whenever the architecture changes.

## 2. Product Goal

Vyb should become the digital HQ of campus life. The platform must balance:

- social discovery and campus engagement
- academic collaboration and resource sharing
- verified identity and safety
- future monetization without damaging trust
- a strong experience across mobile, desktop, and future native clients
- Phase 1 mobile users should get an installable PWA experience where supported

## 3. Phase Strategy

The architecture is service-first from day zero, but product scope is phased to reduce risk.

### Phase 1: Identity and Utility

- verified authentication
- college and community onboarding
- admin-reviewed college join requests for unknown domains
- Campus Square feed with text and image posts
- Resource Vault for notes and academic files
- moderation and admin controls

### Phase 2: Engagement

- short-form video / reels
- comments and richer interaction
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

## 4. Architecture Principles

- Service boundaries are defined from the beginning.
- Deployment can evolve, but ownership boundaries cannot be blurry.
- Each service owns its data, APIs, background jobs, and documentation.
- No direct cross-service database writes.
- All external traffic enters through an API Gateway.
- Every write path must be auditable.
- Every production feature must be observable.
- Every new service or external dependency requires an ADR.
- Every feature must be designed through LLD before coding starts.
- Backend APIs must remain client-agnostic so web and native clients can evolve safely.
- Shared UI must happen through design tokens and primitive rules, not by forcing one surface's components onto another.
- Responsive web quality is mandatory; desktop cannot be treated as an afterthought.

## 5. Recommended Repository Shape

```text
vyb/
  apps/
    web/
    mobile/
    api-gateway/
    identity-service/
    campus-service/
    social-service/
    resources-service/
    media-service/
    moderation-service/
    notification-service/
    worker-service/
    wallet-service/              # Phase 3
    marketplace-service/         # Phase 3
    competition-service/         # Phase 3
    growth-ai-service/           # Phase 4
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
- `apps/mobile` is a future React Native / Expo client and must be considered in architecture decisions from the start.
- Shared logic should live in `packages/contracts`, `packages/validation`, and `packages/app-core`.
- Shared styling decisions should live in `packages/design-tokens`.
- Surface-specific components should live in `packages/ui-web` and `packages/ui-native`.
- Do not bake web-only navigation, DOM assumptions, or CSS-specific logic into shared domain packages.

## 6. Deployable Services

### 6.1 Web App

- Next.js App Router + PWA
- mobile-first UI
- desktop-strong responsive layouts
- server-rendered routes where useful
- direct upload UX for media and resources
- installable app shell with manifest and service worker
- no privileged business logic

### 6.1.1 Future Native App

- React Native / Expo recommended for Android and iOS
- consumes the same gateway APIs and contracts as the web client
- may use surface-specific components, but must reuse shared validation, contracts, and business-flow logic where practical
- feature design must define mobile and desktop behavior before implementation starts

### 6.2 API Gateway

The gateway is mandatory and is the only public entry for backend business APIs.

Responsibilities:

- auth token verification
- App Check verification where applicable
- request validation
- rate limiting
- IP and tenant-aware throttling
- request ID / trace ID injection
- structured logging
- API version routing
- gateway-level caching only where safe

### 6.3 Identity Service

Owns:

- user profile identity
- Firebase Auth mapping
- email/domain verification
- role assignment
- session context for downstream services

### 6.4 Campus Service

Owns:

- tenants (colleges)
- tenant domains
- college join requests and admin review decisions
- memberships
- communities such as batch, branch, hostel, club, general

### 6.5 Social Service

Owns:

- feed posts
- comments
- reactions
- social ranking metadata
- future reels metadata

### 6.6 Resources Service

Owns:

- academic resources
- course mapping
- file metadata
- vault permissions

### 6.7 Media Service

Owns:

- upload orchestration
- file metadata registration
- compression and validation policy
- future transcoding workflow

### 6.8 Moderation Service

Owns:

- reports
- moderation cases
- content state transitions
- abuse controls
- anonymous content review policy

### 6.9 Notification Service

Owns:

- push notification jobs
- digests
- email and in-app notification routing

### 6.10 Worker Service

Owns asynchronous jobs:

- media processing
- moderation fan-out
- notifications
- future search indexing
- future analytics rollups

### 6.11 Future Services

- `wallet-service`
- `marketplace-service`
- `competition-service`
- `growth-ai-service`

These services must not be introduced until their ADRs, HLD updates, and SRS updates are approved.

## 7. Service Interaction Model

### 7.1 Public Request Flow

```text
Client -> API Gateway -> Target Service -> Data Connect Admin SDK -> PostgreSQL
Client -> Firebase Storage -> Media registration API -> Moderation / Worker pipeline
Unknown-domain user -> API Gateway -> Campus Service -> college join request queue -> admin decision
```

### 7.2 Internal Call Rules

- Web never calls internal services directly.
- Web only calls public gateway APIs and Firebase Auth / Firebase Storage.
- Service-to-service communication must be explicit and documented.
- For synchronous internal calls, prefer HTTP/JSON with typed contracts in `packages/contracts`.
- For asynchronous workflows, use an outbox pattern first. Introduce message brokers only through ADR.

### 7.3 Ownership Matrix

| Capability | Owner Service | May Be Read By | May Be Written By |
|---|---|---|---|
| Users | Identity | Gateway, Campus | Identity |
| Tenant membership | Campus | Identity, Social, Resources, Moderation | Campus |
| Communities | Campus | Social, Resources | Campus |
| College join requests | Campus | Identity, Admin surfaces | Campus |
| Posts | Social | Moderation, Analytics | Social |
| Comments | Social | Moderation | Social |
| Reactions | Social | Analytics | Social |
| Resources | Resources | Campus, Moderation | Resources |
| Media metadata | Media | Social, Resources, Moderation | Media |
| Reports | Moderation | Social, Resources | Moderation |

## 8. Data Architecture

## 8.1 Database Strategy

- Primary database: PostgreSQL via Firebase Data Connect
- Service-level connectors and operations stored under `packages/dataconnect/<service>`
- Privileged writes happen through Node services using the Data Connect Admin SDK
- Client SDK usage is allowed only for approved low-risk read flows; sensitive business writes must go through service APIs

## 8.2 Mandatory Table Standards

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

## 8.3 Mandatory Multi-Tenant Rules

- Every tenant-scoped table must include `tenant_id`
- Tenant filtering is never optional in code
- Public queries must validate tenant membership before data access
- Cross-tenant joins in application logic are forbidden unless explicitly documented

## 8.4 Phase 1 Core Tables

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

## 8.5 Required Unique Constraints

- `tenant_domains (tenant_id, domain)`
- `users (firebase_uid)`
- `tenant_memberships (tenant_id, user_id)`
- `college_join_requests (normalized_primary_domain)` when the request is active
- `communities (tenant_id, slug)`
- `community_memberships (community_id, membership_id)`
- `reactions (post_id, membership_id, reaction_type)` or stricter `(post_id, membership_id)` if single reaction only
- `resource_files (resource_id, storage_path)`

## 8.6 Required Phase 1 Indexes

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

## 8.7 Soft Delete Policy

- Use `deleted_at` instead of hard delete for user-generated and auditable entities
- Hard delete is allowed only for irreversible privacy or retention workflows and must be handled through approved jobs
- Queries must default to excluding deleted rows

## 9. Authentication and Authorization

- Authentication source: Firebase Auth
- College access control: domain-based verification plus an admin-reviewed onboarding path for unknown domains
- Authorization source of truth: `tenant_memberships` and role claims
- Roles in Phase 1: `student`, `faculty`, `alumni`, `moderator`, `admin`
- Service authorization must not trust client-provided role data
- Unknown domains must never auto-create live tenants without an admin approval record

## 10. Media Architecture

- File storage: Firebase Storage
- Web uploads use client-side compression for large images before upload
- Uploads must include metadata such as `tenant_id`, `uploader_id`, `content_type`, and `origin_service`
- Uploaded media is not considered publishable until server-side metadata registration succeeds
- Reels in Phase 2 require validation for size, duration, MIME type, and transcoding strategy

### Storage Path Convention

```text
tenants/{tenantId}/users/{userId}/social/{postId}/{fileName}
tenants/{tenantId}/users/{userId}/resources/{resourceId}/{fileName}
```

## 11. Moderation and Safety

- Every reportable entity must be traceable to a verified membership
- Content states: `draft`, `pending`, `published`, `removed`
- Sensitive modules such as anonymous posting, marketplace, and wallet require separate moderation policy documents before launch
- No anonymous feature launches without abuse escalation workflow

## 12. Observability

Mandatory for every service:

- structured logs
- request ID
- trace ID
- error taxonomy
- latency metrics
- failure counters
- audit logs for privileged actions

Recommended later:

- distributed tracing
- SLO dashboards
- alerting per service

## 13. Security Requirements

- Gateway-enforced rate limiting
- input validation at gateway and service boundary
- App Check for Firebase-integrated client traffic
- no secrets in client bundles
- no direct admin SDK usage in web app
- signed URLs or guarded read access for restricted resources where required
- audit logs for moderation and admin actions

## 14. Query and Performance Rules

- No unbounded list queries in production APIs
- Cursor pagination is preferred over offset pagination for feeds
- Hot queries must be reviewed with index support before release
- If a query touches more than one service's owned data, design the join at the API layer, not through direct foreign writes
- High-volume counters should be derived asynchronously once scale requires it

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
- whether approved college join requests auto-seed a default community template or require admin template selection
