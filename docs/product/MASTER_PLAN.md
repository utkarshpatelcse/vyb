# Vyb Master Plan

Owner: Product and Engineering
Last Updated: 2026-04-22
Change Summary: Added the first-college professional web entry flow, backend-verified session bootstrap, mandatory profile completion gating, the authenticated `/home` feed landing surface, the Phase 1 Cloud Run plus Vercel hosting preparation, the first live campus-social flow for posts, stories, vibes, search, follows, and user IDs, the market dashboard move to live-only Data Connect reads, the richer social engagement layer for likers, reposts, story viewing, immersive vibes, responsive comment threads, story music composition, premium playback controls, and the new encrypted campus-chat rollout plan, plus the campus events hosting and registration flow with team entry, host review, and CSV export.

## 1. Why We Are Building This

Campus life is fragmented across WhatsApp groups, Telegram channels, classroom drives, DMs, and informal networks. Vyb aims to become the unified operating system for verified college life by combining:

- identity and trusted communities
- academic utility
- campus social engagement
- future commerce and growth tools

## 2. Current Strategic Position

We are in architecture and foundation mode.

What is decided:

- Phase 1 backend ships as a modular monolith
- all public backend traffic enters through one backend runtime
- PostgreSQL via Firebase Data Connect is the system of record
- Firebase Storage will hold uploaded media and files
- Firebase Auth is the identity provider
- the platform is multi-tenant, with KIET Group of Institutions Delhi-NCR currently serving only as the first onboarded college and `@kiet.edu` as the only live approved auth domain for now
- the Phase 1 client is responsive web, but the backend and shared packages must stay native-ready
- unknown college domains must go through an admin-reviewed join-request flow
- wallet, competitions, and anonymous features are deferred until the base is stable

What is not started yet:

- production-ready business flows for college join requests
- fully managed moderation and transcoding pipelines for uploaded media

## 3. Core Product Thesis

Students do not stay for empty social feeds. They stay where the network is trusted and useful. Therefore the launch wedge is:

- verified campus identity
- community spaces by batch, branch, and hostel
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
- Campus Square feed with posts, stories, immersive vibes, threaded comments, baseline repost/report flows, and single-asset story music composition
- one-to-one encrypted campus messaging with inbox search, market deal cards, and low-cost realtime presence or typing fanout
- Resource Vault
- moderation
- admin operations

Exit criteria:

- a verified student can join a college cluster
- an unknown-domain student can submit a college join request
- an admin can approve, reject, or send back a college join request
- a user can post to the correct community
- a user can comment, reply, and react inside the live campus feed
- a user can publish a story, add another story from the same own-story bubble, open the immersive story viewer, and browse the dedicated vibes lane
- a supported client can compose one music-backed story clip and play back the published story audio inside the viewer
- a verified student can open the encrypted inbox, start a one-to-one campus chat, and exchange realtime messages with read and typing state
- a user can upload and browse notes
- moderation can review and remove reported content
- the system runs as `web + backend`, not a fleet of early services

### Phase 2: Engagement Refinement

Goal:

- increase habit formation and campus participation

Scope:

- ranking refinement
- creator tooling refinement for vibes and reposts
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
- write ADR if infra or dependency changes

During implementation:

- update progress in this document
- capture major decisions

After implementation:

- update what shipped
- update next actions
- record risks and follow-ups

## 6. Current Completed Work

- product direction aligned around explicit domain boundaries
- multi-surface client strategy defined for web now and native later
- documentation foundation created
- non-negotiable engineering rules defined
- Phase 1 LLDs created for identity, campus, social, and resources
- workspace tooling scaffolded with pnpm workspaces and Turbo
- responsive PWA-first web shell scaffolded
- professional SSR home page and responsive auth shell are now implemented for the current first-college rollout flow
- web shell connected to backend reads with graceful fallback
- Firebase Auth login plus secure cookie-backed web session is scaffolded
- backend session bootstrap now verifies Firebase tokens before issuing the web session cookie
- profile completion is now required before an authenticated user reaches the main in-app home feed
- authenticated users now land on a responsive `/home` feed shell with stories, posts, reels-style navigation, and a separate profile/dashboard route
- the authenticated `/home` route now reads live backend feed data instead of hardcoded placeholder posts
- newly created campus posts now publish directly into the shared feed so other signed-in campus users can see them
- active stories are now stored through the backend and only surface to the author plus followed campus profiles
- a dedicated `/search` route now lets users discover people by user ID and follow or unfollow them
- onboarding now requires a user-chosen campus user ID and the profile/dashboard route now allows changing that user ID later
- the `/dashboard` and public `/u/[username]` profile routes now render real posts and follow counts instead of mock profile data
- the `/vibes` route now reads real backend-backed short-form uploads instead of a fully dummy starter catalog
- profile reads and onboarding saves now persist through Data Connect-backed tenant membership profiles
- Data Connect service config, schema, and domain-owned connectors are scaffolded
- Data Connect connectors compile successfully and generated admin SDKs are available
- shared server config helpers now load root env and initialize Firebase Admin/Data Connect clients
- repo-level deployment assets are now prepared for hosting the backend monolith on Cloud Run
- a repo-level Cloud Build configuration now exists for optional automatic backend deployment from the `main` branch
- a Cloud Run deployment guide and hosting ADR now document the production web plus backend rollout path
- Phase 1 API contracts and query reviews created
- the initial KIET tenant and `@kiet.edu` domain were seeded successfully for the current rollout
- live identity, campus, social-create, and resources-create flows were verified against remote Data Connect
- Phase 1 backend runtime has now been collapsed into one modular monolith app with internal domain modules
- local development is now intended to run as `pnpm dev` or `web + backend`, not six separate terminals
- the campus composer now uploads post/story/vibe media into Firebase Storage before publish, with client-side video optimization before the final upload size gate
- feed and vibes cards now support full-screen media viewing, likers sheets, repost and quote-repost flows, report actions, author edit/delete actions, and optimistic like feedback
- story lanes now render unified rings with seen-state tracking, a dedicated add-story affordance on the author bubble, and an immersive viewer with segmented progress bars, tap navigation, long-press pause, story likes, embedded-audio playback, and mute control
- the story composer now supports royalty-free music search, 15-second to 60-second clip selection, draggable music sticker placement, and client-side MP4 export for one selected story asset before publish
- the `/vibes` route now uses an immersive theater-style mobile and desktop layout, the home feed now surfaces a dedicated vibes teaser row, and active vibe playback defaults to sound-on with tap pause/resume plus press-and-hold speed-up behavior
- comment threads now support replies, comment likes, GIF/sticker attachments, a desktop side-panel treatment, and a mobile bottom-sheet composer
- JSON-backed mutation fallbacks have been removed from the active identity, resources, social, and market write paths
- the market dashboard now reads directly from Data Connect without seeding or rendering JSON-backed preview inventory
- the campus events surface now supports dynamic category discovery, host-configurable interest versus registration versus application flows, team-entry forms, host-side review decisions, and CSV export of registrations in the current fallback-backed web implementation

## 7. Current Next Actions

1. extend backend token verification beyond session bootstrap to the rest of the authenticated API edge
2. implement the college join-request submission and admin decision workflow
3. add backend-edge rate limiting and richer structured error metadata
4. start real upload registration and resource file flows through the media module
5. add moderation publish and review flows for posts, stories, vibes, and resources
6. introduce a simple admin surface for onboarding and moderation operations
7. refine ranking, moderation review ergonomics, and creator-quality media/transcoding behavior on top of the live engagement baseline
8. evaluate low-end-device fallback behavior for client-side story music export and browser autoplay restrictions
9. ship the Phase 1 encrypted campus-chat slice with one-to-one conversations, deal-card entry points, and low-cost realtime fanout

## 8. Decision Log Snapshot

- A dedicated vibes lane ships in Phase 1, while ranking-heavy reels expansion stays deferred
- Phase 1 story music uses a royalty-free search provider plus client-side `ffmpeg.wasm` composition for one selected story asset instead of adding a backend transcoding service
- Phase 1 encrypted chat stays inside the modular monolith with Firebase Realtime Database only for presence, typing, and encrypted delivery fanout, not as a second custom Socket deployable
- Wallet is not part of Phase 1
- Phase 1 backend is a modular monolith, not a multi-deployable service fleet
- `deleted_at`, index strategy, unique constraints, and `user_activity` are mandatory baseline design concerns
- desktop-quality responsive web and future native readiness are both required from the start
- no new college or domain should go live without an auditable admin approval path
- microservices remain a future extraction path, not a default build-time assumption

## 9. Risks To Track

- scope creep into Phase 2 and Phase 3 features
- over-engineering extraction before the first campus launch
- weak content moderation policy
- empty feed problem if utility content is not seeded
- operational complexity if documentation discipline slips
- client-side story music export may be slow on low-end devices or fail under memory pressure
- browser autoplay rules can still force muted startup on some media surfaces until the user interacts
- browser-held E2EE keys create recovery and multi-device limitations until secure key backup or rotation flows are designed
- Firebase Realtime Database rules and availability become part of the chat rollout checklist
