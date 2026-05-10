# Runtime Inventory

Scan scope: repository-wide high-impact security pass for Vyb at commit 8e9ac0f.
Scan date: 2026-05-11 Asia/Calcutta.
Workspace: S:\vyb-main.
Artifact root: S:\vyb-main\.codex-security-scans\8e9ac0f_20260511T002722+0530.

## Working tree note

The repository already had user changes before this scan. This pass did not modify application source files. The scan artifacts are isolated under `.codex-security-scans`.

## Entry points and runtimes

- `apps/web`: Next.js app with 78 API route files under `apps/web/app/api` and client/server helpers under `apps/web/src`.
- `apps/backend`: Node HTTP and WebSocket backend with 30 source/data files under `apps/backend/src`.
- `packages/config` and `packages/validation`: shared configuration and validation helpers, 7 source files in scope.
- Firebase/Data Connect/Storage configuration: `firebase.json`, `storage.rules`, and generated Data Connect clients referenced by the app.
- Public and authenticated HTTP surfaces: auth session bootstrap, profile/social feed, anonymous identity reveal admin routes, events/registrations, marketplace listings/media, resources, games, chat, story music proxy.
- Realtime surfaces: chat WebSocket, social WebSocket, and scribble game WebSocket.
- Local fallback file serving: social and market media file routes.

## Trust boundaries

- Browser to Next API routes via session cookies and CSRF/origin checks where implemented.
- Next API routes to backend via internal API key and viewer context forwarding.
- Backend to Firebase/Data Connect/Storage with service credentials.
- Tenant and membership boundaries enforced by live membership resolution.
- Admin-only boundary for anonymous author identity reveal.
- Client-side E2EE boundary for chat private key material, recovery phrases, and cloud backup blobs.
- Server-side outbound fetch boundary in the story music proxy.

## Seed input

No CVE, GHSA, advisory, or vulnerability-family seed was provided. Discovery prioritized high-impact repository surfaces from the threat model.

## Coverage limits

This was a bounded repository-wide pass without subagents because the user did not explicitly request delegated agents. High-risk surfaces listed in the coverage ledger were traced; the exhaustive checklist remains an auditable file inventory rather than a claim that every file was manually read end to end.
