# Finding Discovery Report

Discovery method: static source tracing of high-impact repository surfaces from the threat model. No advisory seed was provided.

## Candidate FIND-001: E2EE key backup PIN lockout is bypassable offline

Instance key: `chat-e2ee-key-backup-pin-offline`.
Ledger row: `CHAT-E2EE-BACKUP`.

### Source and entrypoints

- Web route `apps/web/app/api/chats/key-backup/route.ts:10` exposes authenticated GET for key backup.
- Backend route `apps/backend/src/modules/chat/index.mjs:166` maps GET `/v1/chats/key-backup` to `getChatKeyBackup(viewer)`.
- Attempt state routes are separate at `apps/backend/src/modules/chat/index.mjs:190`, `apps/backend/src/modules/chat/index.mjs:199`, and `apps/backend/src/modules/chat/index.mjs:208`.

### Root control and sink

- `apps/backend/src/modules/chat/repository.mjs:1993` downloads and returns the backup blob for the authenticated viewer.
- `apps/backend/src/modules/chat/repository.mjs:1279` normalizes a backup and preserves `pinWrappedPrivateKey`, `pinSalt`, `pinIv`, and related KDF metadata at lines `1316` through `1319`.
- `apps/web/src/lib/chat-e2ee.ts:954` derives the PIN key from a 6-digit PIN with PBKDF2.
- `apps/web/src/lib/chat-e2ee.ts:1448` and `apps/web/src/lib/chat-e2ee.ts:1457` decrypt the returned backup locally with the supplied PIN.

### Existing control

- Server-side attempt state exists with max attempts and lockout constants at `apps/backend/src/modules/chat/repository.mjs:26` and `apps/backend/src/modules/chat/repository.mjs:27`.
- The UI calls `refreshAttemptState()` before decrypting and calls `recordFailedAttempt()` after local decrypt failures in `apps/web/src/components/security-settings-shell.tsx:831`, `apps/web/src/components/security-settings-shell.tsx:839`, and `apps/web/src/components/security-settings-shell.tsx:846`.
- `apps/backend/src/modules/chat/repository.mjs:2433` can clear attempt state for the same authenticated viewer.

### Candidate reason

The server does not verify a PIN or a password-authenticated proof before returning the blob that contains the PIN-wrapped private key and all parameters needed for offline guessing. The lockout is advisory because only the honest client calls the failure counter.

## Candidate FIND-002: Story music proxy does not block DNS-resolved private addresses

Instance key: `story-music-openverse-url-ssrf`.
Ledger row: `STORY-MUSIC-SSRF`.

### Source and entrypoints

- Public stream mode is selected by request query at `apps/web/app/api/story-music/route.ts:187`.
- User-supplied `trackId` selects an Openverse detail record at `apps/web/app/api/story-music/route.ts:188` and `apps/web/app/api/story-music/route.ts:193`.
- The server fetches `detail.url` at `apps/web/app/api/story-music/route.ts:209`.

### Root control and sink

- `isSafeAudioSourceUrl()` at `apps/web/app/api/story-music/route.ts:84` validates only the URL string.
- The final allow decision at `apps/web/app/api/story-music/route.ts:100` rejects private-looking hostname literals but does not resolve hostnames and inspect IP addresses.
- `fetchAudioSource()` at `apps/web/app/api/story-music/route.ts:116` performs the server-side fetch with manual redirect handling.

### Existing control

The route blocks non-http(s), localhost, `.local`, literal private IPv4/IPv6 hostnames, limits redirects, checks content type, and caps streamed bytes to 24 MB. These controls reduce impact but do not stop public hostnames that resolve to private, link-local, or loopback addresses.

### Candidate reason

If a selectable Openverse track points at an attacker-controlled hostname, the route accepts the URL before DNS resolution. The attacker can then resolve that hostname to an internal address during the server-side fetch, creating SSRF reachability from a public route.

## Suppressed during discovery

- Social and market local media traversal: path helpers canonicalize under fixed roots and reject `..` or absolute relative paths.
- Admin anonymous identity reveal: backend requires `isAdminRole()` before returning identity.
- Chat realtime token forgery/access: HMAC signature, expiry, and backend conversation access checks are present.
- Auth/dev-session fallback: local/default internal keys are non-production gated unless an explicit production env flag is set.
- Profile social links: expected user-controlled http(s)/mailto links, no javascript scheme path found.

## Deferred

- Full lower-priority file-by-file manual pass over the exhaustive checklist.
- Product/privacy decision for public Firebase Storage reads under `/social/**`.
