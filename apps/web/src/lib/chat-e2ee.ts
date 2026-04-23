import type { ChatIdentitySummary } from "@vyb/contracts";

const CHAT_KEY_STORAGE_PREFIX = "vyb-chat-private-key";
const CHAT_KEY_DERIVATION_CACHE = new Map<string, Promise<CryptoKey>>();

export const CHAT_IDENTITY_ALGORITHM = "ECDH-P256";
export const CHAT_MESSAGE_CIPHER_ALGORITHM = "ECDH-P256/AES-GCM";

export type StoredChatKeyMaterial = {
  userId: string;
  identityId: string | null;
  publicKey: string;
  privateKey: string;
  algorithm: string;
  keyVersion: number;
  updatedAt: string;
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
  return ensureBrowserCrypto().importKey(
    "raw",
    base64ToBuffer(identity.publicKey),
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
  peerIdentity: ChatIdentitySummary
) {
  const cacheKey = `${material.publicKey}:${peerIdentity.publicKey}`;
  const cached = CHAT_KEY_DERIVATION_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = Promise.all([importPrivateKey(material), importPublicKey(peerIdentity)]).then(
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

  return {
    cipherText: bufferToBase64(cipherBuffer),
    cipherIv: bufferToBase64(iv.buffer),
    cipherAlgorithm: CHAT_MESSAGE_CIPHER_ALGORITHM
  };
}

export async function decryptChatText(
  cipherText: string,
  cipherIv: string,
  material: StoredChatKeyMaterial,
  peerIdentity: ChatIdentitySummary
) {
  const key = await deriveConversationCipherKey(material, peerIdentity);
  const decrypted = await ensureBrowserCrypto().decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(base64ToBuffer(cipherIv))
    },
    key,
    base64ToBuffer(cipherText)
  );

  return new TextDecoder().decode(decrypted);
}
