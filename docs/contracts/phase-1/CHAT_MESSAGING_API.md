# API Contract

Owner: Architecture Team
Last Updated: 2026-04-22
Change Summary: Documented the Phase 1 encrypted direct-messaging contract for inbox reads, conversation bootstrap, encrypted message sends, reactions, read state, key publication, and encrypted attachment upload.

## Endpoint Definition

- `GET /v1/chats`
- `POST /v1/chats`
- `GET /v1/chats/{conversationId}`
- `POST /v1/chats/{conversationId}/messages`
- `PUT /v1/chats/{conversationId}/read`
- `PUT /v1/chats/messages/{messageId}/reactions`
- `PUT /v1/chats/keys`
- `POST /v1/chats/media/upload`

## Request Highlights

- auth: verified membership required on every chat endpoint
- create chat body: peer identifier plus optional `seedType` of `deal` or `vibe`
- send body: `messageKind`, `cipherText`, `cipherIv`, `cipherAlgorithm`, optional `replyToMessageId`, optional encrypted attachment reference
- read body: `messageId`
- reaction body: one emoji reaction
- key body: public key payload, algorithm, and key version
- media upload body: encrypted file bytes plus file metadata

## Response Highlights

- inbox responses return conversation previews, peer summaries, unread state, and latest message metadata
- conversation responses return participant metadata, viewer key metadata, encrypted message records, and read markers
- send responses return the stored encrypted message record and refreshed conversation preview
- key publish responses return the active public-key summary for the current viewer
- encrypted attachment upload responses return storage path, MIME type, size, and download URL for the encrypted blob

## Core Rules

- only one-to-one conversations are supported in Phase 1
- backend-owned persistence stores ciphertext payloads and encrypted attachment references only
- vibe cards and market deal cards are represented as encrypted message payloads with message kinds that clients know how to render
- Firebase Realtime Database may mirror encrypted delivery envelopes for presence, typing, and fanout, but the system of record remains the backend plus Data Connect path
- Phase 1 starts with one active browser-held key per account and does not promise secure multi-device key sync yet
