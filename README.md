# Vyb

Owner: Product and Engineering
Last Updated: 2026-04-23
Change Summary: Added the canonical Locked-In UI theme guidance to the shared design system and kept the repo overview aligned with the live social product.

Multi-tenant campus platform architecture with a responsive web client in Phase 1 and a future native mobile client.

## Current State

- Documentation foundation is in place
- Multi-surface client strategy is defined
- Repo scaffolding is prepared for backend, web, mobile, and shared packages
- A PWA-first responsive web shell is scaffolded in `apps/web`
- The web shell can now read backend data with graceful fallback
- The web shell now supports Firebase Auth login plus a secure cookie-backed viewer session for posts/resources
- Authenticated users now land on a responsive `/home` feed surface after onboarding, while `/dashboard` is reserved for profile-style account details
- A single backend runtime now hosts identity, campus, social, and resources modules for Phase 1
- Data Connect schema and domain-owned connectors are scaffolded under `packages/dataconnect`
- Active identity, social, and resources mutations now use Firebase Data Connect as the authoritative persistence path
- Firebase Data Connect admin SDKs are generated and the schema/connectors compile successfully
- Identity, campus, social, and resources modules now fail closed when Data Connect writes are unavailable instead of mutating local JSON stores
- Campus post, story, and vibe media now upload to Firebase Storage before publish requests, and large videos are optimized before the final size gate runs
- The live social surface now supports full-screen post and vibe viewing, likers sheets, repost/report/delete actions, optimistic likes, and responsive threaded comments with replies plus GIF/sticker attachments
- The story composer now supports royalty-free music search, 15/30/45/60-second clip trimming, draggable music sticker placement, and client-side MP4 export for a single story asset
- The story lane and viewer now support own-story add affordances, seen-state rings, progress playback, story likes, embedded-audio playback, and mute or unmute controls
- The dedicated `/vibes` theater now supports immersive desktop and mobile playback, default active audio-on behavior, tap pause or resume, and press-and-hold 2x playback
- The `vyb` Data Connect service is deployed in `asia-south1` on project `vybnet-e2242`
- Firebase Admin now isolates Data Connect connectors per app instance to avoid cross-connector operation cache collisions
- Vyb remains the product brand; any college-specific config in this repo is only rollout reference data for the first onboarded tenant
- Local dev can fall back to a configured tenant slug/domain for the current first onboarded college while the stricter domain lookup path is still being hardened
- Unknown college domains are intended to flow into an admin-reviewed college join-request workflow instead of creating tenants automatically
- The repo now includes Cloud Run deployment assets for the backend monolith and a deployment guide for the current `vybnet-e2242` project

## Starter Commands

- `pnpm dev`
- `pnpm dev:web`
- `pnpm dev:backend`
- `node scripts/run-firebase-cli.mjs dataconnect:sdk:generate`
- `node scripts/bootstrap-dataconnect.mjs --tenant-name "Your College" --tenant-slug your-college --domain yourcollege.edu`

## Production Hosting

- `apps/web` is intended to ship on Vercel
- `apps/backend` is intended to ship on Google Cloud Run
- the repo root [Dockerfile](/e:/CAMPUS%20LOOP/Dockerfile:1) builds the backend monolith container for Cloud Run
- [cloudbuild.backend.yaml](/e:/CAMPUS%20LOOP/cloudbuild.backend.yaml:1) can be used by a Cloud Build trigger so `main` branch pushes automatically redeploy the backend
- deployment steps live in [docs/process/CLOUD_RUN_BACKEND_DEPLOYMENT.md](/e:/CAMPUS%20LOOP/docs/process/CLOUD_RUN_BACKEND_DEPLOYMENT.md:1)

## Core Directories

- `apps/web` for the Next.js web client
- `apps/mobile` for the future native mobile client
- `apps/backend` for the Phase 1 modular-monolith backend
- `packages/contracts` for API contracts
- `packages/validation` for shared schemas
- `packages/app-core` for client-safe shared business-flow logic
- `packages/design-tokens` for shared design language and the canonical Locked-In theme used by all web features
- `packages/ui-web` for web-only UI primitives
- `packages/ui-native` for native-only UI primitives
- `packages/dataconnect` for database connectors and operations
- `docs` for the living architecture and product documentation
