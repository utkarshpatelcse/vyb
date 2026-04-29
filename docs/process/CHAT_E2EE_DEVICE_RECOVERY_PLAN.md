# Chat E2EE Device Recovery Plan

Last updated: 2026-04-29

## Goal

Chat must feel continuous on one device, unlock smoothly on a new device, and keep the server unable to decrypt message text or media.

## Product Rules

1. A signed-in device can read chats only after it has a local chat private key.
2. Google/email login proves account ownership, but never decrypts old chats by itself.
3. The easiest recovery path is approval from an existing trusted device.
4. If no trusted device is available, passkey recovery is the primary fallback.
5. A 24-word recovery phrase is the final fallback.
6. A 6-digit code may be used only for temporary pairing, never for long-term key backup encryption.
7. If the user loses every trusted device and never saved passkey/recovery phrase, old E2EE messages remain locked. The app may create a new secure key for new messages after explicit confirmation.

## First Device Flow

1. User signs in.
2. User opens chat.
3. App generates an ECDH identity keypair in Web Crypto.
4. Public key is published to the backend.
5. Private key is stored in the local IndexedDB/WebCrypto vault.
6. App prompts the user to secure recovery:
   - Recommended: create passkey recovery.
   - Required fallback: save 24-word recovery phrase.
7. Until recovery is saved, chat continues but UI shows a low-noise "Recovery not saved" state.

## Add New Device Flow

1. User signs in on the new device.
2. App sees an existing account chat identity but no local private key.
3. New device creates a device-linking keypair and displays:
   - QR code
   - short one-time pairing code
   - expiry countdown
4. Existing trusted device opens "Approve new device".
5. Existing device either scans the QR or enters the pairing code.
6. Existing device shows device name, browser, approximate location, and timestamp.
7. User approves.
8. Existing device encrypts the chat private key for the new device-linking public key.
9. Backend stores only the encrypted transfer packet.
10. New device fetches the packet, decrypts locally, stores the private key in its vault, and opens chat.

## Device Pairing Matrix

Phone to laptop:
- Laptop shows QR and pairing code.
- Phone scans QR or enters code.

Laptop to phone:
- Phone shows QR and pairing code.
- Laptop scans if camera exists, otherwise enters code.

Phone to phone:
- New phone shows QR and code.
- Old phone scans QR or enters code.

Laptop to laptop:
- New laptop shows QR and code.
- Old laptop usually enters the pairing code.

## Lost Device Flow

1. User signs in on a new device.
2. App cannot find a local private key.
3. App offers:
   - Use passkey
   - Enter recovery phrase
   - Approve from another device
4. If passkey or phrase succeeds, encrypted backup decrypts locally and old chats open.
5. If all recovery paths fail, user can choose "Start new secure chats".
6. The backend keeps old messages, but the client marks them locked because the matching key is gone.

## Security Requirements

1. Text and media must be encrypted before upload.
2. Backend must reject unencrypted chat attachments.
3. Backend must reject client-created system messages.
4. Message encryption migration must only update sender-owned eligible messages.
5. Read state should be stored server-side, but peer-visible read receipts must obey privacy settings.
6. Presence, typing, and read-receipt privacy must become server-backed account settings.
7. Trusted devices must be visible and revocable in chat privacy settings.
8. Pairing codes must be one-time, short-lived, and rate-limited.

## Implementation Order

1. Harden existing chat endpoints.
2. Encrypt media attachments end to end.
3. Split read-state persistence from peer-visible read receipts.
4. Add server-backed chat privacy settings.
5. Add trusted-device registry.
6. Add QR/pairing-code device approval.
7. Add passkey-wrapped encrypted key backup.
8. Add recovery phrase fallback and lost-device new-key flow.
