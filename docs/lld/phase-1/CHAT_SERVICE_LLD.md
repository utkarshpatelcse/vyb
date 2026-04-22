# Chat Module LLD

Owner: Messaging Platform
Last Updated: 2026-04-22
Change Summary: Defined the Phase 1 encrypted direct-messaging design for one-to-one campus chats, low-cost realtime fanout, market deal cards, and vibe-card sharing.

## 1. Metadata

- Feature name: Chat Module Phase 1
- Owner: Messaging Platform
- Runtime: `apps/backend`
- Phase: Phase 1
- Date: 2026-04-22
- Status: Planned
- Linked SRS section: 2.6 Direct Messaging
- Linked HLD section: Phase 1 Module Map, Realtime and E2EE Notes, Media Architecture
- Linked ADRs: `ADR_003_PHASE1_CHAT_REALTIME_AND_E2EE.md`

## 2. Problem Statement

We need an Instagram-grade direct-message surface that feels realtime, keeps costs low, and preserves tenant safety. Messages must be encrypted in the client before they are sent to backend-owned systems. Phase 1 scope is one-to-one direct messaging only, with inbox search, typing and read indicators, image attachments, vibe-card sharing, and market deal cards.

## 3. Scope

In scope:

- one-to-one encrypted campus chats
- inbox list and conversation view
- campus user search for starting a conversation
- client-generated public-key registration for Web Crypto based E2EE
- encrypted text messages
- encrypted image attachments uploaded as encrypted blobs
- vibe-card share messages
- market deal-card seed messages with accept or decline actions
- swipe-to-reply
- long-press emoji reactions
- read state
- typing state
- online presence indicators
- low-cost realtime fanout through Firebase Realtime Database

Out of scope:

- group chats
- secure multi-device key sync
- message editing
- disappearing messages
- voice-note recording and playback
- video-call or audio-call flows
- custom Socket microservice

## 4. Owning Module

- Primary owner: `chat`
- Runtime boundary: `apps/backend/src/modules/chat`
- Secondary dependencies: `identity`, `campus`, `market`, future `media`

## 5. User Flows

- Flow 1: user opens `/messages`, sees active chats, and filters them through inbox search.
- Flow 2: user searches a campus profile and creates or reuses a one-to-one chat.
- Flow 3: client loads or creates its browser-held E2EE key pair, publishes the public key through the backend, derives a shared secret from the peer public key, encrypts the message payload, and posts only ciphertext to the backend.
- Flow 4: backend stores ciphertext in PostgreSQL through Data Connect, mirrors the encrypted delivery envelope into Firebase Realtime Database, and the recipient conversation updates without polling.
- Flow 5: user attaches an image, encrypts the file in the browser, uploads the encrypted blob, and sends an encrypted attachment message.
- Flow 6: user starts a chat from Marketplace, and the conversation is seeded with a deal card that can be accepted or declined through follow-up messages.
- Flow 7: user long-presses a message to react or swipes right to quote-reply.
- Flow 8: user opens a chat and the client marks the latest message as read while typing status clears.

## 6. API Design

### `GET /v1/chats`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: tenant-scoped inbox read for current viewer
- response schema: conversation previews plus participant summaries and viewer key metadata
- error schema: unauthenticated, invalid tenant context
- rate limit policy: moderate per user

### `POST /v1/chats`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: recipient user ID or username plus optional market deal seed or vibe-share seed
- response schema: created or existing one-to-one conversation with peer key metadata
- error schema: self-chat forbidden, invalid peer, cross-tenant access
- rate limit policy: moderate per user

### `GET /v1/chats/{conversationId}`

- caller: web or future native client
- auth requirement: verified membership required and participant-only
- request schema: optional message limit and before cursor
- response schema: conversation detail, participant summaries, encrypted message records, and read markers
- error schema: not found, unauthorized participant
- rate limit policy: moderate per user

### `POST /v1/chats/{conversationId}/messages`

- caller: web or future native client
- auth requirement: verified membership required and participant-only
- request schema: `messageKind`, ciphertext envelope, optional encrypted attachment metadata, optional reply target
- response schema: stored message record and refreshed conversation preview
- error schema: invalid ciphertext payload, invalid attachment metadata, unauthorized participant
- rate limit policy: moderate per user with burst protection

### `PUT /v1/chats/{conversationId}/read`

- caller: web or future native client
- auth requirement: verified membership required and participant-only
- request schema: `messageId`
- response schema: conversation read acknowledgement
- error schema: invalid message, unauthorized participant
- rate limit policy: moderate per user

### `PUT /v1/chats/messages/{messageId}/reactions`

- caller: web or future native client
- auth requirement: verified membership required and participant-only
- request schema: one emoji reaction
- response schema: active reaction snapshot
- error schema: invalid emoji, unauthorized participant, message not found
- rate limit policy: moderate per user

### `PUT /v1/chats/keys`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: public key, algorithm, key version
- response schema: active published key summary
- error schema: invalid key payload
- rate limit policy: low per user

### `POST /v1/chats/media/upload`

- caller: web or future native client
- auth requirement: verified membership required
- request schema: encrypted file bytes plus MIME and file name metadata
- response schema: encrypted attachment storage reference
- error schema: invalid file, size exceeded, unauthorized participant
- rate limit policy: moderate per user

## 7. Module Interactions

- calling layer: backend edge
- target module: `chat`
- reason: inbox, conversation, key registration, and message persistence APIs
- interaction type: direct in-process invocation
- failure handling: return safe API errors

- calling module: `chat`
- target module: `campus`
- reason: resolve verified membership and tenant authorization for conversation participants
- interaction type: direct in-process domain call
- failure handling: fail closed

- calling module: `chat`
- target module: `identity`
- reason: resolve public profiles for inbox labels, search results, and peer lookups
- interaction type: direct in-process repository call
- failure handling: fail closed for writes and safe empty states for optional reads

- calling module: `chat`
- target module: `market`
- reason: validate listing or request ownership and seed marketplace deal cards
- interaction type: direct in-process domain read
- failure handling: fail closed for invalid listing or request references

- calling module: `chat`
- target module: Firebase Realtime Database
- reason: publish presence, typing, and encrypted delivery fanout
- interaction type: approved external realtime channel
- failure handling: keep encrypted message durable in PostgreSQL and allow the client to recover by refresh

## 8. Data Model Changes

- tables touched: `chat_identities`, `chat_conversations`, `chat_participants`, `chat_messages`, `chat_message_reactions`
- columns added: none outside the new chat-owned tables
- indexes added: `chat_participants (membership_id, updated_at desc)`, `chat_messages (conversation_id, created_at asc)`, `chat_messages (tenant_id, created_at desc)`
- unique constraints: `chat_identities (tenant_id, user_id)`, `chat_conversations (conversation_key)`, `chat_participants (conversation_id, user_id)`, `chat_message_reactions (message_id, membership_id)`
- soft delete impact: conversations and messages use soft delete
- backfill required: none

## 9. Query Plan

- query name: inbox-by-participant
- filter fields: `membership_id`, `deleted_at is null`
- sort order: conversation `last_message_at desc`
- expected scale: medium-high for active daily users
- supporting index: `chat_participants (membership_id, updated_at desc)` plus conversation timestamp read
- why this is safe: participant-scoped and tenant-bound

- query name: conversation message history
- filter fields: `conversation_id`, `deleted_at is null`
- sort order: `created_at asc`
- expected scale: hot path for every chat open
- supporting index: `chat_messages (conversation_id, created_at asc)`
- why this is safe: per-conversation bounded reads with message limit

## 10. Validation and Security

- auth checks: verified membership required for every chat route
- tenant checks: both participants must belong to the same tenant
- input validation: ciphertext, IV, algorithm, reply target, attachment metadata, emoji reaction allowlist, and message kind enum
- abuse prevention: message burst limits, reaction limits, and attachment size limits
- E2EE note: plaintext bodies and plaintext image bytes must never be stored in backend-owned databases
- key-management note: Phase 1 starts with one active browser-held key per account; recovery and multi-device sync are deferred

## 11. Realtime Path Model

- presence path: `/presence/{tenantId}/{userId}`
- typing path: `/typing/{tenantId}/{conversationId}/{userId}`
- delivery path: `/chatEvents/{tenantId}/{conversationId}/{messageId}`
- payload rule: delivery nodes may duplicate encrypted envelopes, but may not expose plaintext bodies

## 12. Observability

- logs: conversation create, message send, message reaction, read update, key publish, encrypted media upload, and realtime fanout failure
- metrics: inbox load latency, message send success rate, realtime fanout latency, read-lag, and attachment upload failure rate
- alerts: spikes in message send failures, key registration failures, or realtime write failures
- trace IDs: required at the backend boundary and through chat module calls

## 13. Failure Modes

- peer has no published key: conversation can open, but encrypted send must block until the peer publishes a key
- browser-held key missing after storage clear: old messages become unreadable on that browser until a future recovery flow exists
- Firebase Realtime Database unavailable: inbox and history still load from backend, but live typing or presence degrades
- encrypted attachment upload fails: plaintext is never sent; composer should keep the draft and surface retry
- invalid deal seed: conversation creation fails with a safe error and no message is written

## 14. Rollout Plan

- feature flags: chat inbox and market-to-chat entry can be rolled out per tenant
- migration order: create chat tables, enable key registration, then inbox and conversation reads, then message writes and realtime fanout
- rollback plan: hide chat entry points and disable message creation while preserving stored ciphertext history

## 15. Test Plan

- unit tests: conversation-key generation, participant authorization, ciphertext validation, reaction validation, and deal seed validation
- integration tests: create chat, list inbox, send encrypted message, mark read, react to message, and upload encrypted attachment
- client verification: inbox search, desktop split pane, mobile sticky composer, swipe-to-reply, long-press reactions, and realtime typing or presence behavior
