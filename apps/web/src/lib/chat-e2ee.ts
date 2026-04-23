import type { ChatIdentitySummary } from "@vyb/contracts";

const CHAT_KEY_STORAGE_PREFIX = "vyb-chat-private-key";
const CHAT_RECOVERY_CODE_STORAGE_PREFIX = "vyb-chat-recovery-code";
const CHAT_KEY_DERIVATION_CACHE = new Map<string, Promise<CryptoKey>>();
const CHAT_KEY_BACKUP_PBKDF2_ITERATIONS = 250000;

export const CHAT_IDENTITY_ALGORITHM = "ECDH-P256";
export const CHAT_MESSAGE_CIPHER_ALGORITHM = "ECDH-P256/AES-GCM";
export const CHAT_KEY_BACKUP_WRAPPING_ALGORITHM = "PBKDF2-SHA-256/AES-GCM";

export type StoredChatKeyMaterial = {
  userId: string;
  identityId: string | null;
  publicKey: string;
  privateKey: string;
  algorithm: string;
  keyVersion: number;
  updatedAt: string;
};

export type EncryptedChatKeyBackup = {
  version: number;
  publicKey: string;
  algorithm: string;
  keyVersion: number;
  wrappingAlgorithm: string;
  wrappedPrivateKey: string;
  salt: string;
  iv: string;
  iterations: number;
  updatedAt: string;
};

type ChatCipherEnvelope = {
  version: number;
  cipherText: string;
  iv: string;
  algorithm: string;
  senderPublicKey: string;
  recipientPublicKey: string;
};

function ensureBrowserCrypto() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("This browser cannot enable end-to-end encrypted chat.");
  }

  return subtle;
}

function getStorageKey(userId: string) {
  return `${CHAT_KEY_STORAGE_PREFIX}:${userId}`;
}

function getRecoveryCodeStorageKey(userId: string) {
  return `${CHAT_RECOVERY_CODE_STORAGE_PREFIX}:${userId}`;
}

export function bufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function base64ToBuffer(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

export function loadStoredChatKeyMaterial(userId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getStorageKey(userId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredChatKeyMaterial;
    if (
      typeof parsed?.publicKey !== "string" ||
      typeof parsed?.privateKey !== "string" ||
      typeof parsed?.algorithm !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredChatKeyMaterial(material: StoredChatKeyMaterial) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageKey(material.userId), JSON.stringify(material));
}

export function loadStoredRecoveryCode(userId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getRecoveryCodeStorageKey(userId));
  return raw ? formatRecoveryCode(raw) : null;
}

export function saveStoredRecoveryCode(userId: string, recoveryCode: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeRecoveryCode(recoveryCode);
  window.localStorage.setItem(getRecoveryCodeStorageKey(userId), normalized);
}

export function syncStoredChatKeyIdentity(userId: string, identity: ChatIdentitySummary) {
  const current = loadStoredChatKeyMaterial(userId);
  if (!current || current.publicKey !== identity.publicKey) {
    return null;
  }

  const next: StoredChatKeyMaterial = {
    ...current,
    identityId: identity.id,
    algorithm: identity.algorithm,
    keyVersion: identity.keyVersion,
    updatedAt: identity.updatedAt
  };

  saveStoredChatKeyMaterial(next);
  return next;
}

export function isStoredChatKeyCompatible(
  material: StoredChatKeyMaterial | null | undefined,
  identity: ChatIdentitySummary | null | undefined
) {
  if (!material || !identity) {
    return false;
  }

  return material.publicKey === identity.publicKey && material.algorithm === identity.algorithm;
}

export function normalizeRecoveryCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatRecoveryCode(value: string) {
  const normalized = normalizeRecoveryCode(value);
  return normalized.replace(/(.{4})/g, "$1-").replace(/-$/u, "");
}

export function generateRecoveryCode() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return formatRecoveryCode(Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase());
}

export async function createStoredChatKeyMaterial(userId: string) {
  const subtle = ensureBrowserCrypto();
  const keyPair = await subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    ["deriveKey", "deriveBits"]
  );

  const publicKey = await subtle.exportKey("raw", keyPair.publicKey);
  const privateKey = await subtle.exportKey("pkcs8", keyPair.privateKey);

  return {
    userId,
    identityId: null,
    publicKey: bufferToBase64(publicKey),
    privateKey: bufferToBase64(privateKey),
    algorithm: CHAT_IDENTITY_ALGORITHM,
    keyVersion: 1,
    updatedAt: new Date().toISOString()
  } satisfies StoredChatKeyMaterial;
}

async function deriveBackupWrappingKey(recoveryCode: string, salt: ArrayBuffer, iterations = CHAT_KEY_BACKUP_PBKDF2_ITERATIONS) {
  const normalizedCode = normalizeRecoveryCode(recoveryCode);
  if (!normalizedCode || normalizedCode.length < 16) {
    throw new Error("Enter the full recovery code to restore your E2EE key.");
  }

  const baseKey = await ensureBrowserCrypto().importKey(
    "raw",
    new TextEncoder().encode(normalizedCode),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return ensureBrowserCrypto().deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

async function importPrivateKey(material: StoredChatKeyMaterial) {
  return ensureBrowserCrypto().importKey(
    "pkcs8",
    base64ToBuffer(material.privateKey),
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    false,
    ["deriveKey", "deriveBits"]
  );
}

async function importPublicKey(identity: ChatIdentitySummary) {
  return importPublicKeyString(identity.publicKey);
}

async function importPublicKeyString(publicKey: string) {
  return ensureBrowserCrypto().importKey(
    "raw",
    base64ToBuffer(publicKey),
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    false,
    []
  );
}

async function deriveConversationCipherKey(
  material: StoredChatKeyMaterial,
  peerIdentity: ChatIdentitySummary | string
) {
  const peerPublicKey = typeof peerIdentity === "string" ? peerIdentity : peerIdentity.publicKey;
  const cacheKey = `${material.publicKey}:${peerPublicKey}`;
  const cached = CHAT_KEY_DERIVATION_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = Promise.all([importPrivateKey(material), importPublicKeyString(peerPublicKey)]).then(
    async ([privateKey, publicKey]) =>
      ensureBrowserCrypto().deriveKey(
        {
          name: "ECDH",
          public: publicKey
        },
        privateKey,
        {
          name: "AES-GCM",
          length: 256
        },
        false,
        ["encrypt", "decrypt"]
      )
  );

  CHAT_KEY_DERIVATION_CACHE.set(cacheKey, pending);
  return pending;
}

export function isE2eeCipherAlgorithm(algorithm: string | null | undefined) {
  return algorithm === CHAT_MESSAGE_CIPHER_ALGORITHM;
}

function parseChatCipherEnvelope(value: string): ChatCipherEnvelope | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<ChatCipherEnvelope>;
    if (
      typeof parsed?.version !== "number" ||
      typeof parsed?.cipherText !== "string" ||
      typeof parsed?.iv !== "string" ||
      typeof parsed?.algorithm !== "string" ||
      typeof parsed?.senderPublicKey !== "string" ||
      typeof parsed?.recipientPublicKey !== "string"
    ) {
      return null;
    }

    return {
      version: parsed.version,
      cipherText: parsed.cipherText,
      iv: parsed.iv,
      algorithm: parsed.algorithm,
      senderPublicKey: parsed.senderPublicKey,
      recipientPublicKey: parsed.recipientPublicKey
    };
  } catch {
    return null;
  }
}

export function hasChatCipherEnvelope(value: string) {
  return Boolean(parseChatCipherEnvelope(value));
}

export async function encryptStoredChatKeyMaterialForBackup(
  material: StoredChatKeyMaterial,
  recoveryCode: string
) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await deriveBackupWrappingKey(recoveryCode, salt.buffer);
  const plaintext = new TextEncoder().encode(JSON.stringify(material));
  const cipherBuffer = await ensureBrowserCrypto().encrypt(
    {
      name: "AES-GCM",
      iv
    },
    wrappingKey,
    plaintext
  );

  return {
    version: 1,
    publicKey: material.publicKey,
    algorithm: material.algorithm,
    keyVersion: material.keyVersion,
    wrappingAlgorithm: CHAT_KEY_BACKUP_WRAPPING_ALGORITHM,
    wrappedPrivateKey: bufferToBase64(cipherBuffer),
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    iterations: CHAT_KEY_BACKUP_PBKDF2_ITERATIONS,
    updatedAt: new Date().toISOString()
  } satisfies EncryptedChatKeyBackup;
}

export async function decryptStoredChatKeyMaterialFromBackup(
  backup: EncryptedChatKeyBackup,
  recoveryCode: string
) {
  const wrappingKey = await deriveBackupWrappingKey(recoveryCode, base64ToBuffer(backup.salt), backup.iterations);
  const plaintextBuffer = await ensureBrowserCrypto().decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(base64ToBuffer(backup.iv))
    },
    wrappingKey,
    base64ToBuffer(backup.wrappedPrivateKey)
  );
  const parsed = JSON.parse(new TextDecoder().decode(plaintextBuffer)) as StoredChatKeyMaterial;

  if (
    typeof parsed?.userId !== "string" ||
    typeof parsed?.publicKey !== "string" ||
    typeof parsed?.privateKey !== "string" ||
    parsed.publicKey !== backup.publicKey
  ) {
    throw new Error("This recovery code does not match the encrypted backup for this account.");
  }

  return parsed;
}

export async function encryptChatText(
  plaintext: string,
  material: StoredChatKeyMaterial,
  peerIdentity: ChatIdentitySummary
) {
  const key = await deriveConversationCipherKey(material, peerIdentity);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuffer = await ensureBrowserCrypto().encrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    encoded
  );

  const encodedIv = bufferToBase64(iv.buffer);
  const encodedCipherText = bufferToBase64(cipherBuffer);
  const envelope: ChatCipherEnvelope = {
    version: 1,
    cipherText: encodedCipherText,
    iv: encodedIv,
    algorithm: CHAT_MESSAGE_CIPHER_ALGORITHM,
    senderPublicKey: material.publicKey,
    recipientPublicKey: peerIdentity.publicKey
  };

  return {
    cipherText: JSON.stringify(envelope),
    cipherIv: encodedIv,
    cipherAlgorithm: CHAT_MESSAGE_CIPHER_ALGORITHM
  };
}

export async function decryptChatText(
  cipherText: string,
  cipherIv: string,
  material: StoredChatKeyMaterial,
  peerIdentity: ChatIdentitySummary
) {
  const envelope = parseChatCipherEnvelope(cipherText);
  const peerPublicKey =
    envelope?.senderPublicKey === material.publicKey
      ? envelope.recipientPublicKey
      : envelope?.recipientPublicKey === material.publicKey
        ? envelope.senderPublicKey
        : peerIdentity.publicKey;
  const key = await deriveConversationCipherKey(material, peerPublicKey);
  const decrypted = await ensureBrowserCrypto().decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(base64ToBuffer(envelope?.iv ?? cipherIv))
    },
    key,
    base64ToBuffer(envelope?.cipherText ?? cipherText)
  );

  return new TextDecoder().decode(decrypted);
}
