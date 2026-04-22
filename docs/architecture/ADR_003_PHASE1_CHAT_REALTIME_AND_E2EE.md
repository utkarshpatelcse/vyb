# Vyb ADR 003: Phase 1 Chat Realtime and E2EE

Owner: Architecture Team
Last Updated: 2026-04-22
Change Summary: Accepted one-to-one encrypted campus chat inside the modular monolith, with Firebase Realtime Database for low-cost realtime fanout and Web Crypto based client-side E2EE.

## 1. Metadata

- ADR ID: ADR-003
- Title: Phase 1 Chat Realtime and E2EE
- Status: Accepted
- Date: 2026-04-22
- Owner: Architecture Team

## 2. Context

- The product now needs direct campus messaging with typing, read state, and market-originated conversation entry.
- The engineering rulebook forbids casually extracting a second deployable backend service in Phase 1.
- The user explicitly wants low cost, effectively free realtime where possible.
- Message bodies should be encrypted before they leave the client and backend-owned systems should only persist ciphertext.
- The current platform already uses Firebase services and a modular-monolith backend with Data Connect as the system of record.

## 3. Decision

- Introduce a dedicated `chat` module inside the existing backend monolith.
- Persist conversation state and encrypted messages in PostgreSQL through Firebase Data Connect.
- Use Firebase Realtime Database only for approved low-cost realtime fanout of presence, typing, and encrypted delivery events.
- Use the Web Crypto API in the client for Phase 1 E2EE.
- Start with one-to-one conversations only.
- Start with one active browser-held key per account in Phase 1 and defer secure multi-device key sync.
- Do not introduce a custom Socket.io microservice in Phase 1.

## 4. Alternatives Considered

- Option A: Build a dedicated Socket.io microservice for chat.
- Option B: Use Firebase Realtime Database as both the system of record and realtime layer.
- Option C: Keep messaging inside the backend monolith, persist ciphertext in Data Connect, and use Firebase Realtime Database only for realtime fanout.

## 5. Why This Decision

- benefits
  - Preserves the Phase 1 rule of one public backend deployable.
  - Keeps durable chat history in the same system-of-record model as the rest of the app.
  - Uses an existing low-cost Firebase service for presence and typing instead of a second custom service.
  - Allows message payloads to remain ciphertext in backend-owned persistence.
- tradeoffs
  - Chat now spans both PostgreSQL and Firebase Realtime Database.
  - Multi-device E2EE is intentionally incomplete in Phase 1.
  - Realtime delivery depends on Firebase Realtime Database availability and browser auth state.
- operational impact
  - Chat rollout requires Firebase Realtime Database configuration and rules.
  - Backend chat writes must mirror encrypted delivery envelopes to the realtime path.
  - Clients need fallback behavior when realtime is unavailable.
- cost impact
  - Avoids running a second always-on Socket service.
  - Uses Firebase Realtime Database only for lightweight fanout instead of full durable message storage.

## 6. Security and Reliability Impact

- security implications
  - Plaintext message bodies must not be persisted by backend-owned systems.
  - Browser-held private keys become part of the trust model and must never be uploaded.
  - Secure multi-device recovery is not solved in Phase 1 and must be documented clearly.
- failure modes
  - Missing or rotated browser keys can strand old message history for that browser.
  - Realtime delivery may degrade if Firebase Realtime Database auth or rules are misconfigured.
  - Browser storage loss can remove the local private key.
- rollback path
  - Hide chat entry points and disable message sends while preserving ciphertext history.
  - Keep the backend chat module dormant if realtime configuration is unavailable.

## 7. Documentation Impact

- HLD sections to update: Phase 1 strategy, module map, request flow, data architecture, and realtime notes
- SRS sections to update: direct messaging requirements and external systems
- LLDs affected: Chat Module Phase 1
- API contracts affected: chat messaging contract

## 8. Rollout Plan

- step 1: add chat docs, contracts, schema, and backend module
- step 2: enable client key registration and conversation reads
- step 3: enable encrypted sends, reactions, and read state
- step 4: enable Firebase Realtime Database presence, typing, and encrypted delivery fanout
- step 5: wire market-originated deal-card entry and vibe-card share surfaces

## 9. Exit Criteria

- one-to-one encrypted conversations can be created inside the same tenant
- plaintext message bodies are never persisted by backend-owned systems
- inbox and conversation history load from the backend
- presence, typing, and encrypted delivery fanout work through Firebase Realtime Database on supported clients
- chat uses the existing modular monolith rather than a new custom microservice
