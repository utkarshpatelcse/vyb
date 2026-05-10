# Validation Report

Validation method: static source-to-sink trace with repository evidence. Dynamic validation was not attempted because the vulnerable flows depend on authenticated app sessions, backend storage, Firebase/Data Connect, and Openverse integration; static trace is proportionate for these repository-wide candidates and preserves the exact source/control/sink tuple.

## Validation rubric

- [x] Attacker-controlled or attacker-influenced input reaches the candidate entrypoint.
- [x] The relevant trust boundary is in scope for the threat model.
- [x] Existing controls were identified and checked against the claimed bypass.
- [x] The sink or security impact is visible in repository code.
- [ ] A live end-to-end proof was executed against a configured deployment.

## FIND-001: E2EE key backup PIN lockout is bypassable offline

Candidate id: `FIND-001`.
Instance key: `chat-e2ee-key-backup-pin-offline`.
Ledger row id: `CHAT-E2EE-BACKUP`.
Root-control file:line: `apps/backend/src/modules/chat/repository.mjs:1993` and `apps/backend/src/modules/chat/repository.mjs:1279`.
Affected locations: `apps/backend/src/modules/chat/index.mjs:166`, `apps/backend/src/modules/chat/repository.mjs:1316`, `apps/web/src/lib/chat-e2ee.ts:954`, `apps/web/src/lib/chat-e2ee.ts:1448`, `apps/web/src/components/security-settings-shell.tsx:826`.
Confidence: high.
Disposition: reportable; survives validation: yes.

### Rubric checklist

- [x] Attacker input/precondition: an attacker with the victim's authenticated web session can call the key-backup GET route.
- [x] Entrypoint: `GET /api/chats/key-backup` forwards to backend `GET /v1/chats/key-backup`.
- [x] Sink/control: backend returns a normalized backup blob containing PIN-wrapped private key material and KDF parameters.
- [x] Existing control checked: attempt lockout is separate from backup fetch and is called by client code after local decrypt failure.
- [ ] Runtime proof: no live Firebase-backed deployment was available in this scan.

### Evidence observed

- Backend route `apps/backend/src/modules/chat/index.mjs:166` returns `await getChatKeyBackup(viewer)` for authenticated viewers.
- Repository helper `apps/backend/src/modules/chat/repository.mjs:1993` downloads `e2ee-key-backup.json`, normalizes it, and returns `{ backup }` without requiring a PIN, PIN proof, or checking lockout state.
- Backup normalization at `apps/backend/src/modules/chat/repository.mjs:1279` preserves `pinWrappedPrivateKey`, `pinSalt`, `pinIv`, and `pinIterations` at lines `1316` through `1319`.
- Client crypto derives the PIN key from a normalized 6-digit PIN at `apps/web/src/lib/chat-e2ee.ts:954` with `CHAT_KEY_BACKUP_PBKDF2_ITERATIONS = 250000` at line `19`.
- Client restore at `apps/web/src/lib/chat-e2ee.ts:1448` uses the returned backup fields to try local decryption at lines `1457` through `1462`.
- The only failure counter path is voluntary client behavior: `verifyPinProtectedBackup()` checks the server gate at `apps/web/src/components/security-settings-shell.tsx:831`, tries local decrypt at line `839`, then records a failed attempt at line `846`. An attacker can skip this UI flow after fetching the blob.
- Attempt state can be cleared through `DELETE /v1/chats/key-backup/attempts` at `apps/backend/src/modules/chat/index.mjs:208` and `clearChatKeyBackupPinAttemptState()` at `apps/backend/src/modules/chat/repository.mjs:2433`, further showing that the server is not the verifier of the PIN.

### Remaining uncertainty

The scan did not measure practical cracking time for the 6-digit PIN with 250,000 PBKDF2 iterations on commodity hardware. The bypass of server-side lockout does not depend on that measurement; a 1,000,000-value PIN space is finite and offline once the blob is returned.

### Minimal next step

Add an integration test that calls the backup GET route while attempt state is locked and asserts that PIN-wrapped private key material is not returned without a server-validated unlock.

## FIND-002: Story music proxy does not block DNS-resolved private addresses

Candidate id: `FIND-002`.
Instance key: `story-music-openverse-url-ssrf`.
Ledger row id: `STORY-MUSIC-SSRF`.
Root-control file:line: `apps/web/app/api/story-music/route.ts:84` and `apps/web/app/api/story-music/route.ts:100`.
Affected locations: `apps/web/app/api/story-music/route.ts:116`, `apps/web/app/api/story-music/route.ts:187`, `apps/web/app/api/story-music/route.ts:209`.
Confidence: medium.
Disposition: reportable; survives validation: yes, with catalog-control precondition.

### Rubric checklist

- [x] Attacker input/precondition: a public request supplies `mode=stream` and `trackId`; attacker must be able to select or influence an Openverse track whose detail `url` is attacker-controlled.
- [x] Entrypoint: public `GET /api/story-music?mode=stream&trackId=...`.
- [x] Sink/control: server calls `fetch()` on the catalog-provided URL.
- [x] Existing controls checked: scheme, hostname string, literal private IP, redirects, content type, and content length.
- [ ] Runtime proof: no live Openverse-controlled test record or local app server proof was executed.

### Evidence observed

- Public stream mode is selected at `apps/web/app/api/story-music/route.ts:187`; `trackId` is read at line `188`.
- The route fetches Openverse track details at `apps/web/app/api/story-music/route.ts:193` and uses `detail.url` at line `209`.
- `isSafeAudioSourceUrl()` at `apps/web/app/api/story-music/route.ts:84` parses and checks the URL string. The final allow decision at line `100` only checks `parsed.hostname` with literal private IPv4/IPv6 helpers.
- `fetchAudioSource()` at `apps/web/app/api/story-music/route.ts:116` calls `fetchWithTimeout()` on the allowed URL at line `121` and recursively follows redirects after rechecking URL strings at line `134`.
- There is no DNS resolution step and no check of the resolved address family/range before `fetch()`.
- The route accepts `application/octet-stream` and streams up to 24 MB, which can disclose internal responses that match those response constraints.

### Remaining uncertainty

The repository does not prove whether an arbitrary attacker can create or modify an Openverse audio record with a chosen URL. If Openverse is treated as a fully trusted allowlist provider, exploitability drops. If Openverse is a public catalog of contributor/provider URLs, the issue remains a server-side request boundary flaw.

### Minimal next step

Add a unit test around the URL allow function plus a network-layer helper that resolves hostnames and rejects loopback, private, link-local, and metadata ranges before fetch and after redirects.

## Validation closure table

| Ledger row id | Instance key | Root-control file:line | Entrypoint/source | Sink/control | Disposition | Counterevidence or proof gap | Survives |
|---|---|---|---|---|---|---|---|
| CHAT-E2EE-BACKUP | `chat-e2ee-key-backup-pin-offline` | `apps/backend/src/modules/chat/repository.mjs:1993` | authenticated key backup GET | backup blob with PIN-wrapped private key and KDF parameters | reportable | no live deployment proof; static route trace is complete | yes |
| STORY-MUSIC-SSRF | `story-music-openverse-url-ssrf` | `apps/web/app/api/story-music/route.ts:100` | public story music stream route | server-side fetch of catalog URL without resolved-IP check | reportable | requires attacker-influenceable Openverse detail URL | yes |
| AUTH-SESSION | n/a | `apps/web/app/api/auth/session/route.ts:124` | session POST | session cookie bootstrap | suppressed | production same-origin/session controls present | no |
| CHAT-REALTIME | n/a | `apps/backend/src/modules/chat/realtime-hub.mjs:15` | WebSocket upgrade token | HMAC token and conversation authz | suppressed | signature, expiry, and access checks present | no |
| SOCIAL-ADMIN-IDENTITY | n/a | `apps/backend/src/modules/social/index.mjs:1286` | admin identity reveal route | anonymous identity disclosure | suppressed | backend admin-role guard present | no |
| SOCIAL-MEDIA-PATHS | n/a | `apps/web/src/lib/social-media-server.ts:91` | local media file route | filesystem path resolution | suppressed | canonical root check present | no |
| EVENTS-REGISTRATION | n/a | `apps/web/src/lib/events-fallback.ts:941` | registration list/export/manage | attendee registration data | suppressed | host-only guard present | no |
| STORAGE-RULES | n/a | `storage.rules:57` | Firebase Storage read | public social media object reads | deferred | product privacy expectations unclear | uncertain |
| REMAINING-ROUTES | n/a | `artifacts/exhaustive-file-checklist.md` | lower-priority routes/components | mixed | deferred | bounded scan did not manually close every file | uncertain |
