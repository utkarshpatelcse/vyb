# Overview

Vyb is a multi-tenant campus platform with a Next.js web app (`apps/web`) and a Node.js modular-monolith backend (`apps/backend`). The product handles verified campus identity, social feeds, stories/vibes, resources, marketplace/event flows, direct encrypted chat, realtime WebSocket updates, games, admin moderation, Firebase Data Connect persistence, Firebase Storage media, and local fallback stores used mainly for development or degraded operation.

Primary assets are authenticated viewer sessions, tenant and membership boundaries, profile and campus identity data, social content, anonymous-post identity metadata, encrypted chat metadata and key-backup material, media storage paths and download URLs, admin/moderation privileges, internal API keys, Firebase credentials/session cookies, and realtime socket authorization tokens.

# Threat Model, Trust Boundaries, and Assumptions

Main trust boundaries:

- Browser to Next.js API routes: cookies, CSRF-protected auth bootstrap requests, form data, JSON bodies, upload payloads, and websocket token requests are attacker-controlled until validated.
- Next.js API routes to backend: server-side proxy calls use Firebase session cookies or development-only internal headers. Production must not accept local/demo secrets.
- Backend to Firebase Data Connect and Storage: repository code constructs queries, mutations, storage paths, metadata, and signed/public download URLs.
- Realtime WebSockets: short-lived HMAC tokens bridge the web session boundary to backend socket upgrade handlers for chat, social feed fanout, and Scribble.
- Multi-tenant data boundary: almost every product surface must preserve tenantId, userId, membershipId, role, and resource ownership checks.
- Admin boundary: super-admin and moderation endpoints may reveal anonymous identities, mutate controls, or expose operational state.
- Client-side encryption boundary: chat content confidentiality depends on browser crypto, trusted-device flows, key backup wrapping, and not leaking private keys or decrypted plaintext through APIs/logs/storage.

Attacker-controlled inputs include route params, query strings, JSON bodies, uploaded media metadata and bytes, social text/comment content, story music URLs/searches, usernames/profile links, chat message envelopes, websocket query parameters, and local browser state. Operator-controlled inputs include environment variables, Firebase service configuration, deployment host/proxy headers, and Data Connect schema state. Developer-controlled inputs include seed data, local JSON fallbacks, generated SDKs, build scripts, and dev-only demo auth behavior.

Important assumptions:

- Production deployments provide non-local `VYB_INTERNAL_API_KEY` and `VYB_SESSION_SECRET`.
- Backend socket upgrade handlers verify HMAC tokens and enforce resource authorization after token verification.
- Firebase Auth/session cookies are the production authentication source; demo headers and local JSON stores are development or fallback surfaces and should fail closed where writes matter.
- User-generated HTML should never be rendered unsanitized; React text rendering is a mitigation only when code avoids `dangerouslySetInnerHTML` and unsafe URL sinks.

# Attack Surface, Mitigations, and Attacker Stories

High-value attack surfaces:

- Session bootstrap and cookie handling in `apps/web/app/api/auth/session/route.ts` and session encoding in `apps/web/src/lib/dev-session.ts`.
- Backend request context and internal auth in `apps/backend/src/lib/request-context.mjs` and `apps/backend/src/lib/internal-auth.mjs`.
- Web-to-backend proxy helpers in `apps/web/src/lib/backend.ts` and route handlers under `apps/web/app/api`.
- Realtime authorization in `apps/web/src/lib/client-socket-url.ts`, socket-token routes, and backend realtime hubs under `apps/backend/src/modules/*/realtime-hub.mjs`.
- Tenant-scoped repository functions in social, chat, events, market, resources, and identity modules.
- Media upload/download code in web and backend social/market/events/chat media helpers.
- Admin identity-reveal and moderation APIs under `apps/web/app/api/admin` and backend moderation/social controls.
- Client-side encrypted chat and key-backup code in `apps/web/src/lib/chat-e2ee.ts` plus chat backend repository functions.

Existing mitigations visible in the repository include HMAC-signed session and socket tokens, production guards against local internal keys, same-origin and CSRF checks for session bootstrap, tenant/membership fields carried through contracts, Firebase-backed session support, backend auth context creation, route-specific validation, Data Connect parameterized SDK calls, React default escaping, and short-lived realtime tokens.

Realistic attacker stories:

- A signed-in student attempts horizontal access across tenants, conversations, marketplace/event resources, or anonymous identities.
- A malicious user submits crafted text, URLs, metadata, or media to trigger XSS, SSRF, storage-path confusion, or content-policy bypasses.
- An attacker manipulates reverse-proxy headers or environment-dependent URL construction to receive unusable or cross-origin realtime URLs, or to trick clients into connecting to an unintended websocket endpoint.
- A user replays, tampers with, or forges websocket tokens to join another chat, tenant social stream, or game identity.
- A compromised browser session attempts to exfiltrate chat key backup data or abuse trusted-device pairing.

Out-of-scope or lower-realism stories include attacks requiring write access to production environment variables, direct Firebase project administration, or local development-only stores without a path to production deployment.

# Severity Calibration (Critical, High, Medium, Low)

Critical issues would include production authentication bypass, HMAC/session secret disclosure, arbitrary tenant-wide admin access, direct exfiltration of chat private keys or unencrypted message content, or write access across all tenants.

High issues would include cross-tenant data reads/writes, unauthorized chat conversation websocket subscription, anonymous identity deanonymization by non-admin users, stored XSS in campus-wide feeds/stories/messages, SSRF into internal services, or accepting local/demo internal keys in production.

Medium issues would include same-tenant object-level authorization failures, realtime event leakage with limited content, CSRF on meaningful state changes, upload validation gaps leading to unwanted content hosting, token replay within an overly long window, or proxy/header handling that reliably breaks production realtime availability.

Low issues would include information leaks in logs/error messages, UI-only state confusion, denial-of-service opportunities with constrained impact, malformed response drift that causes feature outage without data exposure, or development-only weaknesses that are clearly guarded from production.
