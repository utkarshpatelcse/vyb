# VYB Chat Security v2 Implementation Notes

## What is implemented in this slice

### 1. PIN-based E2EE key backup
- Chat private keys are now stored with an `IndexedDB`-first flow in the browser.
- Existing legacy `localStorage` chat keys are migrated into `IndexedDB` when the user opens chat on the same device.
- New encrypted key backups can now be wrapped with:
  - a **6-digit security PIN** using `PBKDF2-SHA-256` with `250,000` iterations
  - a **24-word recovery phrase** as a fallback wrapper for emergency restore
- The encrypted backup payload is versioned so legacy recovery-code backups still remain restorable.

### 2. New device restore
- If the cloud key backup exists and the device does not have the local private key, the chat UI now prompts for:
  - the 6-digit security PIN, or
  - the 24-word recovery phrase
- Legacy recovery-code backups are still supported by the restore helper for older users/devices.

### 3. Message TTL data model
- `chat_messages` now has:
  - `expires_at`
  - `is_starred`
  - `is_saved`
- New messages default to a `30 day` expiry on the backend when no explicit expiry is supplied.
- Expired messages that are not starred/saved are filtered out of normal chat responses.

### 4. Janitor foundation
- Added `clearExpiredChatMessages()` in the backend chat repository.
- Added a runnable script:
  - `pnpm chat:janitor`
- The janitor soft-deletes expired messages, deletes associated Firebase Storage blobs, re-syncs conversation previews, and emits `chat.sync`.

### 5. Phase 2 hygiene and lifecycle
- PIN restore now locks for 1 hour after 5 failed PIN attempts on the device.
- The 24-word recovery phrase can still be used during a PIN lockout.
- Sign-out clears the chat key vault and legacy chat key storage before normal auth logout.
- The message action sheet supports star/save and expiry updates.
- Messages with an active expiry show a small clock indicator.
- Web screenshot suspicion hooks send an encrypted system message for `PrintScreen` and page-hidden events.

## What still needs follow-up

### 1. PIN UX hardening
- The PIN is not rotated or changed yet.
- There is no dedicated settings page for updating the PIN.

### 2. Recovery phrase UX
- The phrase is generated and shown in the chat UI, but there is no PDF/export flow yet.
- There is no phrase re-reveal flow after the user dismisses it.

### 3. Sign-out and device hygiene
- Main app sign-out now clears the chat key vault before auth logout.
- Dev-session-only sign-out buttons still call Firebase directly and should be brought onto the shared secure sign-out helper if they become user-facing.

### 4. TTL product features
- TTL selection is exposed in the message action sheet for existing messages.
- New message composer-level default TTL selection is still not exposed; messages currently default to 30 days when sent.

### 5. Screenshot guard
- Web fallback detection is implemented with `PrintScreen` and `visibilitychange`.
- Browser screenshot detection is still best-effort and may produce false positives or miss native/mobile screenshots.

## Current restore rules

### Existing device
- If the device already has the correct private key in `IndexedDB`, chat works normally.

### New device
- If cloud backup exists, the user restores with:
  - PIN first, or
  - recovery phrase if the PIN is forgotten

### Legacy users
- If the account still has the older backup format, the legacy recovery-code restore path still works.

## Recommended next phase
1. Add a dedicated chat security settings surface for PIN creation/change/reset.
2. Add composer-level default TTL controls.
3. Bring dev-session-only sign-out paths onto the secure cleanup helper if needed.
4. Add encrypted image rendering and card-message composition flows.
