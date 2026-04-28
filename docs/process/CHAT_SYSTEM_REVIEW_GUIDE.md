# Chat System Review Guide

Owner: Product and Engineering
Last Updated: 2026-04-28
Change Summary: Updated the realtime model for immediate open-room delivery, active conversation loading, and lower-cost reconciliation refreshes.

## 1. Purpose

This document explains how chat works today in the codebase, not just how it was originally planned. Use it to review the current system before fixing or extending chat.

Primary implementation sources:

- `apps/web/src/components/campus-messages-shell.tsx`
- `apps/web/src/lib/chat-e2ee.ts`
- `apps/web/app/api/chats/*`
- `apps/backend/src/modules/chat/index.mjs`
- `apps/backend/src/modules/chat/repository.mjs`
- `apps/backend/src/modules/chat/realtime-hub.mjs`

Supporting design docs:

- `docs/architecture/ADR_003_PHASE1_CHAT_REALTIME_AND_E2EE.md`
- `docs/contracts/phase-1/CHAT_MESSAGING_API.md`
- `docs/lld/phase-1/CHAT_SERVICE_LLD.md`

## 2. Current Architecture

Chat is split into four layers:

1. Web UI and local crypto
2. Next.js web API proxy routes under `apps/web/app/api/chats/*`
3. Backend chat module in `apps/backend/src/modules/chat`
4. Firebase Storage plus WebSocket fanout for selected realtime updates

System of record:

- Chat identities, conversations, participants, messages, and reactions are stored through Firebase Data Connect in the backend chat module.
- Encrypted key backups and per-user hidden-message state are stored in Firebase Storage.
- Encrypted image attachments are stored in Firebase Storage.
- Live updates are pushed through the backend WebSocket server at `/ws/chat`.

Important boundary:

- Plaintext chat message text must stay in the client.
- The backend stores ciphertext and attachment metadata only.

## 3. What Is Actually Live Today

Implemented in live code:

- One-to-one direct conversations only
- Client-side E2EE key generation using Web Crypto ECDH P-256
- Public key publication to backend
- Local private-key storage in browser `localStorage`
- Recovery-code-based encrypted private-key backup to Firebase Storage
- Recovery-code restore on a new device
- Encrypted text messages
- Read receipts
- Emoji reactions
- Delete for self
- Delete for everyone within 30 minutes
- Swipe-to-reply UI
- WebSocket-based conversation sync
- Live typing indicators over the same backend WebSocket connection
- Automatic reconnect plus polling fallback
- Legacy-message encryption upgrade flow for older messages

Documented but not fully live in current UI flow:

- Online presence indicators
- Encrypted image attachment sending from the composer
- Dedicated `vibe_card` and `deal_card` send flow from the composer

Notes on the gap:

- Backend contracts and storage paths for encrypted attachments already exist.
- Message kinds `image`, `vibe_card`, and `deal_card` exist in contracts and backend validation.
- The current composer send path in `campus-messages-shell.tsx` sends only `messageKind: "text"`.
- The current UI shows share-preview state for shared posts, but that state is cleared after send and is not posted as a distinct card payload yet.

## 4. End-to-End Message Flow

### 4.1 Opening inbox

1. Web calls `GET /api/chats`
2. Web proxy calls backend `GET /v1/chats`
3. Backend resolves viewer tenant and membership
4. Backend returns conversation previews and viewer active public identity

### 4.2 Opening a conversation

1. Web calls `GET /api/chats/{conversationId}`
2. Backend validates that the viewer is a participant
3. Backend returns:
   - peer profile summary
   - peer public key summary if available
   - encrypted messages
   - read markers
   - viewer active public identity

### 4.3 Sending a message

1. Client checks that E2EE identity exists locally
2. Client checks that peer public key exists
3. Client encrypts plaintext with Web Crypto
4. Client posts ciphertext to `POST /api/chats/{conversationId}/messages`
5. Backend stores ciphertext in `chat_messages`
6. Backend updates last-message metadata
7. Backend emits a WebSocket `chat.message` event
8. Recipient reloads conversation detail and decrypts locally

### 4.4 Marking read

1. Client auto-detects latest incoming message
2. Client calls `PUT /api/chats/{conversationId}/read`
3. Backend updates participant read marker
4. Backend emits `chat.read`
5. Other client reloads conversation state

### 4.5 Reactions

1. Client calls `PUT /api/chats/messages/{messageId}/reactions`
2. Backend upserts or removes the reaction
3. Backend emits `chat.sync`
4. Conversation reload updates reaction aggregate

## 5. E2EE Model

Algorithms used in the web client:

- Identity key: `ECDH-P256`
- Message cipher label: `ECDH-P256/AES-GCM`
- Backup wrapping label: `PBKDF2-SHA-256/AES-GCM`

How encryption works:

1. Each user has one active ECDH keypair
2. Client stores:
   - public key
   - private key
   - algorithm
   - key version
   in browser `localStorage`
3. Client publishes only the public key to backend
4. For a conversation, client derives a shared AES-GCM key from:
   - its private key
   - peer public key
5. Ciphertext envelope includes:
   - ciphertext
   - iv
   - algorithm
   - sender public key
   - recipient public key

Important limitation:

- Phase 1 is effectively single-key-per-account.
- The backend refuses replacing a published public key with a different one.
- If a device has the wrong private key for the account, the correct action is restore, not regenerate.

## 6. Key Lifecycle

### 6.1 First-time setup on the original device

When a user opens chat and no active identity exists:

1. Client generates a new ECDH keypair
2. Private key is stored in browser `localStorage`
3. Public key is published through `PUT /api/chats/keys`
4. Backend stores the identity
5. Client auto-creates an encrypted backup if possible
6. Client generates and stores a recovery code locally

### 6.2 Backup creation

Backup is automatic after a valid local key and active identity exist.

Stored locally:

- private key in `localStorage`
- recovery code in `localStorage`

Stored remotely:

- encrypted backup JSON in Firebase Storage path:
  `chat/{tenantId}/users/{userId}/e2ee-key-backup.json`

Backup encryption behavior:

- Recovery code is normalized and used with PBKDF2-SHA-256
- Iterations are `250000`
- Derived key wraps the serialized local key material with AES-GCM

### 6.3 New device behavior

When a user signs into a different browser or a cleaned browser:

1. Backend still returns the active public identity
2. Client checks local `localStorage`
3. If local private key is missing or incompatible:
   - client fetches remote encrypted backup
   - client prompts for recovery code
4. User enters recovery code
5. Client decrypts backup locally
6. Client verifies restored public key matches backend active identity
7. Restored private key is saved into local `localStorage`

If backup exists but recovery code is not entered:

- conversation can open
- encrypted messages cannot be decrypted
- sending is blocked

If backup does not exist:

- the app shows:
  `This account has E2EE chats, but no encrypted key backup is saved yet. Open the original device once to create the backup.`

### 6.4 Sign-out behavior

Current code behavior:

- Signing out does not clear the chat private key from browser `localStorage`.
- Signing out does not clear the stored recovery code from browser `localStorage`.
- Chat safety relies on the session cookie plus viewer-user checks, not automatic local key deletion.

Implication:

- If the same user signs back into the same browser, the local key remains available.
- If another user signs into the same browser, the app detects account mismatch and blocks chat usage.

### 6.5 Account switch behavior

Current client protections:

- Conversation load checks if response `viewer.userId` differs from the expected browser user
- If mismatch happens, client sets a session-expired or switched-account state
- Chat actions surface messages like:
  - `This browser is now signed into another account. Open each account in a separate browser or private window.`
  - `This browser was signed out or switched to another account. Sign in again to continue secure chat.`

### 6.6 Key rotation behavior

Current status:

- Real rotation is not supported.
- Backend rejects publishing a different public key for an existing account.
- The intended flow is restore the original private key, not rotate to a new keypair.

This is one of the most important product limitations to review.

## 7. Realtime Model

Transport used today:

- Backend WebSocket server using `ws`
- Path: `/ws/chat`
- Short-lived signed socket token generated by `GET /api/chats/socket-token`

How realtime works today:

1. Client requests socket token for one conversation
2. Web route signs payload with internal key
3. Client opens WebSocket to backend
4. Backend verifies token and participant access
5. Backend emits:
   - `chat.message`
   - `chat.read`
   - `chat.sync`
6. Client does not trust partial event payloads as full source of truth
7. For `chat.message`, the open room appends the message payload immediately and uses detail reload only as recovery or reconciliation
8. Conversation selection triggers an immediate detail fetch before waiting for the periodic fallback

Resilience behavior:

- reconnect with exponential backoff
- reconnect on visibility regain
- reconnect on browser coming online
- reconciliation refresh every `30000ms` when WebSocket is live
- degraded fallback refresh every `7000ms` while connecting or reconnecting and the tab is visible

Important note:

- Realtime Database presence paths are documented in design docs, but the current live code path visible here uses backend WebSockets for message-sync and typing events.

## 8. Message Types

Contract-supported message kinds:

- `text`
- `image`
- `vibe_card`
- `deal_card`
- `system`

Live composer behavior today:

- only sends `text`

Delete-for-everyone behavior:

- message content is replaced by marker `__vyb_chat_deleted__`
- cipher algorithm is replaced by `deleted`
- attachment metadata is cleared

Delete-for-self behavior:

- message is hidden only for the current user
- hidden message IDs are stored in Firebase Storage path:
  `chat/{tenantId}/users/{userId}/hidden-messages.json`

## 9. Attachments

Backend support exists for encrypted image attachments:

- upload route: `POST /v1/chats/media/upload`
- allowed mime types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `image/heic`
  - `image/heif`
- max encrypted image size: `12 MB`
- stored path:
  `chat/{tenantId}/users/{userId}/{assetId}.bin`

Security property:

- Backend stores the uploaded attachment as opaque encrypted bytes
- Content type in storage is `application/octet-stream`
- original mime type is saved as metadata only

Important review note:

- The upload API exists, but the current main composer flow is not wired to use it.
- Attachment rendering UI exists for `message.attachment.url`, but sending flow is incomplete.

## 10. Security Rules and Checks

Backend checks:

- authenticated membership required
- tenant match required
- participant-only access to conversation detail and send
- reply target must be from same conversation
- reaction emoji must be from allowlist
- delete-for-everyone only by sender and only within 30 minutes
- key backup public key must match the active identity

Client checks:

- refuses send if local private key missing
- refuses send if peer public key missing
- refuses creating new incompatible key when backend already has one

## 11. Current Gaps and Risks

These are the main issues worth reviewing and probably fixing:

1. The chat docs describe attachments, vibe cards, deal cards, typing, and presence more completely than the current UI actually delivers.
2. Sign-out does not purge local private keys or local recovery codes from the browser.
3. True multi-device key management is not implemented.
4. Key rotation is not implemented.
5. Composer currently sends only `text`, even though contracts and backend support richer message kinds.
6. Attachment upload exists on backend but is not wired into the main send flow.
7. Shared-post preview state exists in UI, but send path clears it instead of sending a distinct card payload.
8. Realtime behavior is mostly sync-and-refetch, not full local event-state application.
9. Polling fallback is active, which is helpful, but it can hide underlying realtime weaknesses.
10. The existing LLD says status is planned, but substantial chat code is already live, so docs are partially behind implementation.

## 12. Recommended Fix Order

If the goal is to harden chat, the safest order is:

1. Align docs with live behavior
2. Decide the intended product behavior for sign-out and shared-browser safety
3. Wire encrypted image attachment sending end to end
4. Implement real `vibe_card` and `deal_card` send behavior
5. Implement or remove typing and presence claims
6. Add explicit recovery-code management UI
7. Design proper key rotation and multi-device strategy

## 13. Review Questions

Use these while reviewing:

1. Should sign-out clear local private keys on shared devices?
2. Should recovery code be re-shown on demand in settings?
3. Do we want one key per account, or one key per device?
4. Are we okay blocking sends until peer publishes a key?
5. Should delete-for-self stay in Firebase Storage, or move into database state?
6. Should WebSocket remain the realtime channel, or should Realtime Database handle more of the fanout model?
7. Do we want attachments and share cards in this release, or should docs be narrowed to current reality?

## 14. Short Truth Summary

The current chat system is a partially-hardened Phase 1 E2EE direct-message implementation.

It already supports:

- one-to-one encrypted text chat
- local private key storage
- encrypted recovery backup and restore
- reactions
- read receipts
- delete actions
- websocket sync

It is not yet complete for:

- multi-device key management
- true key rotation
- typed presence features
- fully wired encrypted image sending
- fully wired vibe-card and deal-card sending
