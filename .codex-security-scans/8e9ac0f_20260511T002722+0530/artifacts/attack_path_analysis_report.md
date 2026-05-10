# Attack Path Analysis Report

Input artifacts: `finding_discovery_report.md`, `validation_report.md`, and `threat_model.md`.

## FIND-001: E2EE key backup PIN lockout is bypassable offline

Candidate id: `FIND-001`.
Instance key: `chat-e2ee-key-backup-pin-offline`.
Ledger row id: `CHAT-E2EE-BACKUP`.

### Affected lines

- Entrypoint/wrapper: `apps/backend/src/modules/chat/index.mjs:166`.
- Root control: `apps/backend/src/modules/chat/repository.mjs:1993` returns the backup blob without a server-side unlock.
- Concrete data exposure: `apps/backend/src/modules/chat/repository.mjs:1316` through `apps/backend/src/modules/chat/repository.mjs:1319` preserve PIN-wrapped private key and KDF metadata.
- Client implementation: `apps/web/src/lib/chat-e2ee.ts:954` derives the PIN key; `apps/web/src/lib/chat-e2ee.ts:1448` decrypts backup material locally.
- Broken lockout placement: `apps/web/src/components/security-settings-shell.tsx:826` through `apps/web/src/components/security-settings-shell.tsx:846` performs the lockout and failed-attempt update in the honest client flow.

### Attack path steps

1. The attacker obtains or reuses a victim authenticated web session.
2. The attacker calls `GET /api/chats/key-backup`, which reaches backend `GET /v1/chats/key-backup`.
3. The backend returns the encrypted key backup blob with `pinWrappedPrivateKey`, `pinSalt`, `pinIv`, and iteration metadata.
4. The attacker does not call `/key-backup/attempts`, so server-side failed-attempt state never increments.
5. The attacker brute-forces the 6-digit PIN offline and decrypts the E2EE private key material.
6. The attacker uses the recovered private key material to access encrypted chat content that a web session alone was not supposed to unlock.

### Attack path facts

- In-scope status: in scope. The threat model names chat E2EE key backup, session compromise, and client E2EE boundaries as high-value surfaces.
- Vector: authenticated same-user web API call followed by offline cryptographic guessing.
- Auth scope: requires victim session access, not admin access, backend credentials, or local device storage.
- Exposure: web route and backend route are production product surfaces.
- Cross-boundary behavior: crosses from web session authorization into E2EE private-key confidentiality.
- Sensitive data: E2EE private key material and recovery phrase-adjacent backup material.
- Existing controls: PBKDF2 slows guesses; server-side attempt state exists but is not required before returning the encrypted blob.
- Counterevidence considered: the blob is encrypted and the attacker needs the account session. This lowers from critical but does not defeat the finding because the server-side lockout and backup PIN are intended to protect the E2EE key from exactly this offline guessing path.

### Severity calibration

Impact is high because successful exploitation exposes chat E2EE private key material and can defeat the confidentiality boundary that should survive mere web-session compromise. Likelihood is moderate: the attacker needs a victim session and offline cracking effort, but the PIN space is only 1,000,000 values and the server no longer limits attempts after the blob is retrieved. Final severity: high. Final priority: P1. Final policy decision: report.

## FIND-002: Story music proxy does not block DNS-resolved private addresses

Candidate id: `FIND-002`.
Instance key: `story-music-openverse-url-ssrf`.
Ledger row id: `STORY-MUSIC-SSRF`.

### Affected lines

- Entrypoint/source: `apps/web/app/api/story-music/route.ts:187` selects public stream mode and `apps/web/app/api/story-music/route.ts:193` fetches the Openverse detail record.
- Root control: `apps/web/app/api/story-music/route.ts:84` and `apps/web/app/api/story-music/route.ts:100` validate only the URL string and hostname literal.
- Sink: `apps/web/app/api/story-music/route.ts:116` and `apps/web/app/api/story-music/route.ts:121` fetch the URL server-side.
- Catalog URL consumption: `apps/web/app/api/story-music/route.ts:209` passes `detail.url` to the fetch helper.

### Attack path steps

1. The attacker causes a selectable Openverse audio detail record to contain a URL under an attacker-controlled hostname, or selects an existing record whose URL is controlled by the attacker.
2. The attacker requests `/api/story-music?mode=stream&trackId=<id>`.
3. The route fetches the Openverse detail record and extracts `detail.url`.
4. `isSafeAudioSourceUrl()` accepts the URL because the hostname string is not localhost, `.local`, or a private IP literal.
5. During server-side `fetch()`, DNS resolves the accepted hostname to a private, loopback, link-local, or metadata address.
6. The server makes the internal request. If the response satisfies the content-type and size gates, the route streams it back; otherwise the route can still be used as a blind internal GET primitive.

### Attack path facts

- In-scope status: in scope. The route is a public Next API route and server-side outbound fetch boundary.
- Vector: public HTTP request selecting a third-party catalog URL.
- Auth scope: unauthenticated public route.
- Exposure: production web API route, assuming story music is deployed.
- Cross-boundary behavior: internet request can cause server-side access to internal network destinations after DNS resolution.
- Sensitive data: possible internal HTTP responses or blind requests to internal services.
- Existing controls: literal private IP filtering, redirect rechecks, content-type checks, and byte limit reduce impact.
- Counterevidence considered: attacker control over `detail.url` depends on Openverse/provider catalog behavior and response disclosure is constrained by content type and length. This lowers severity and confidence but does not defeat the missing resolved-IP control.

### Severity calibration

Impact is medium because the code creates a public SSRF primitive, but exploitation depends on influencing a catalog media URL and response disclosure is constrained. Likelihood is moderate to low without proof of attacker-created Openverse records. Final severity: medium. Final priority: P2. Final policy decision: report.
