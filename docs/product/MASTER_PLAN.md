# Vyb Master Plan

Owner: Product and Engineering
Last Updated: 2026-04-18
Change Summary: Renamed the product to Vyb and formalized admin-reviewed college join requests as part of Phase 1 onboarding.

## 1. Why We Are Building This

Campus life is fragmented across WhatsApp groups, Telegram channels, classroom drives, DMs, and informal networks. Vyb aims to become the unified operating system for verified college life by combining:

- identity and trusted communities
- academic utility
- campus social engagement
- future commerce and growth tools

## 2. Current Strategic Position

We are in architecture and foundation mode.

What is decided:

- the product will be service-first from the beginning
- all public backend traffic will go through an API Gateway
- PostgreSQL via Firebase Data Connect is the system of record
- Firebase Storage will hold uploaded media and files
- Firebase Auth is the identity provider
- the Phase 1 client is responsive web, but the backend and shared packages must stay native-ready
- unknown college domains must go through an admin-reviewed join-request flow
- wallet, competitions, and anonymous features are deferred until the base is stable

What is not started yet:

- production-ready business flows
- deeper business logic implementation
- auth-token verified gateway flow
- moderation publish flow for newly created content

## 3. Core Product Thesis

Students do not stay for empty social feeds. They stay where the network is trusted and useful. Therefore the launch wedge is:

- verified campus identity
- community spaces by batch/branch/hostel
- useful notes and resources
- simple campus feed

## 4. Phase Plan

### Phase 1: Identity and Utility

Goal:

- create a trustworthy campus network with useful daily value

Scope:

- authentication
- tenant onboarding
- college join-request review queue
- memberships and communities
- Campus Square feed with text and image posts
- Resource Vault
- moderation
- admin operations

Exit criteria:

- a verified student can join a college cluster
- an unknown-domain student can submit a college join request
- an admin can approve, reject, or send back a college join request
- a user can post to the correct community
- a user can upload and browse notes
- moderation can review and remove reported content

### Phase 2: Engagement

Goal:

- increase habit formation and campus participation

Scope:

- reels
- richer comments
- reactions refinement
- polls
- anonymous Nook after policy approval

### Phase 3: Economy

Goal:

- unlock trusted peer-to-peer and reward flows

Scope:

- marketplace
- competitions
- wallet

### Phase 4: AI Growth

Goal:

- turn Vyb into a personal growth layer, not just a campus network

Scope:

- AI roadmap generation
- streaks
- resource and mentor recommendations

## 5. Documentation Process

Before implementation:

- update SRS
- update HLD if architecture changes
- write LLD
- write ADR if infra/dependency changes

During implementation:

- update progress in this document
- capture major decisions

After implementation:

- update what shipped
- update next actions
- record risks and follow-ups

## 6. Current Completed Work

- product direction aligned around a service-first architecture
- high-level service boundaries defined
- multi-surface client strategy defined for web and future native apps
- documentation foundation created
- non-negotiable engineering rules defined
- Phase 1 LLDs created for identity, campus, social, and resources services
- workspace tooling scaffolded with pnpm workspaces and Turbo
- responsive PWA-first web shell scaffolded
- web shell connected to gateway reads with graceful fallback
- cookie-backed dev session added for auth-aware local workflow testing
- web route handlers added for gateway-backed post and resource creation
- starter `api-gateway`, `identity-service`, and `campus-service` code scaffolded
- Data Connect service config, schema, and service-owned connectors scaffolded
- Data Connect connectors compile successfully and generated admin SDKs are available
- shared server config helpers now load root env and initialize Firebase Admin/Data Connect clients
- Phase 1 API contracts and query reviews created
- starter `social-service` and `resources-service` code scaffolded
- `api-gateway` now enforces explicit actor context for protected routes and emits request IDs
- `social-service` and `resources-service` now persist local dev state to JSON-backed stores
- identity, campus, social, and resources services now try live Data Connect flows before falling back to local starter data
- Data Connect service deployed to Firebase with campus, identity, social, and resources connectors live
- bootstrap script executed successfully and seeded the first tenant/domain/community scaffold
- Firebase Admin Data Connect access now uses connector-isolated app instances to avoid cross-connector operation collisions
- live identity, campus, social-create, and resources-create flows verified against the remote Data Connect backend

## 7. Current Next Actions

1. freeze Phase 1 scope
2. replace demo header auth with Firebase token verification in the gateway
3. implement the college join-request submission and admin decision workflow
4. add service-level rate limiting and richer structured error metadata
5. start real upload registration and resource file flows through media-service
6. add moderation publish/review flows so pending posts/resources can move into public lists
7. replace dev-session auth shell with Firebase Auth once backend auth verification is enabled

## 8. Decision Log Snapshot

- Reels are not part of Phase 1
- Wallet is not part of Phase 1
- API Gateway is mandatory from the start
- `deleted_at`, index strategy, unique constraints, and `user_activity` are mandatory baseline design concerns
- desktop-quality responsive web and future native readiness are both required from the start
- no new college or domain should go live without an auditable admin approval path

## 9. Risks To Track

- scope creep into Phase 2 and Phase 3 features
- over-engineering too many deployables before the first campus launch
- weak content moderation policy
- empty feed problem if utility content is not seeded
- operational complexity if documentation discipline slips
- current public list queries only return `published` items, so freshly created `pending` content will not appear until moderation or author-preview logic is added
