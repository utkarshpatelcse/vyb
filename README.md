# Vyb

Modular-monolith campus platform architecture with a responsive web client in Phase 1 and a future native mobile client.

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
- Backend social and resources modules now persist local dev data to JSON-backed stores
- Firebase Data Connect admin SDKs are generated and the schema/connectors compile successfully
- Identity, campus, social, and resources modules now attempt live Data Connect reads/writes with local fallback
- The `vyb` Data Connect service is deployed in `asia-south1` on project `vybnet-e2242`
- Firebase Admin now isolates Data Connect connectors per app instance to avoid cross-connector operation cache collisions
- Local dev can fall back to a configured tenant slug/domain while the stricter domain lookup path is still being hardened
- Unknown college domains are intended to flow into an admin-reviewed college join-request workflow instead of creating tenants automatically

## Starter Commands

- `pnpm dev`
- `pnpm dev:web`
- `pnpm dev:backend`
- `node scripts/run-firebase-cli.mjs dataconnect:sdk:generate`
- `node scripts/bootstrap-dataconnect.mjs --tenant-name "Your College" --tenant-slug your-college --domain yourcollege.edu`

## Core Directories

- `apps/web` for the Next.js web client
- `apps/mobile` for the future native mobile client
- `apps/backend` for the Phase 1 modular-monolith backend
- `packages/contracts` for API contracts
- `packages/validation` for shared schemas
- `packages/app-core` for client-safe shared business-flow logic
- `packages/design-tokens` for shared design language
- `packages/ui-web` for web-only UI primitives
- `packages/ui-native` for native-only UI primitives
- `packages/dataconnect` for database connectors and operations
- `docs` for the living architecture and product documentation
