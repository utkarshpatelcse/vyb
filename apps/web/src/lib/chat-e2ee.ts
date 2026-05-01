import type { ChatDevicePairingTransferEnvelope, ChatIdentitySummary } from "@vyb/contracts";

const CHAT_KEY_STORAGE_PREFIX = "vyb-chat-private-key";
const CHAT_RECOVERY_CODE_STORAGE_PREFIX = "vyb-chat-recovery-code";
const CHAT_KEY_VAULT_DB_NAME = "vyb-chat-key-vault";
const CHAT_LEGACY_VAULT_DB_NAMES = ["vyb_identity_vault"];
const CHAT_KEY_VAULT_STORE = "private-keys";
const CHAT_PIN_ATTEMPT_STORE = "pin-attempts";
const CHAT_DEVICE_WRAP_KEY_STORE = "device-wrap-keys";
const CHAT_DEVICE_WRAP_KEY_ID = "identity-private-key-wrap-v1";
const CHAT_MESSAGE_CACHE_DB_NAME = "vyb-chat-message-cache";
const CHAT_MESSAGE_PLAINTEXT_CACHE_STORE = "message-plaintext";
const CHAT_MESSAGE_CACHE_KEY_STORE = "cache-keys";
const CHAT_MESSAGE_CACHE_KEY_ID = "message-plaintext-cache-v1";
const CHAT_MESSAGE_CACHE_ALGORITHM = "AES-GCM/message-plaintext-cache-v1";
const CHAT_KEY_DERIVATION_CACHE = new Map<string, Promise<CryptoKey>>();
const CHAT_KEY_BACKUP_PBKDF2_ITERATIONS = 250000;
const CHAT_PIN_MAX_ATTEMPTS = 5;
const CHAT_PIN_LOCKOUT_MS = 60 * 60 * 1000;
const RECOVERY_PHRASE_WORD_COUNT = 24;
const RECOVERY_PHRASE_WORDS = [
  "anchor", "apple", "april", "arch", "artist", "ash", "aster", "atlas", "atom", "aurora", "autumn", "badge", "bamboo", "banner", "beacon", "berry",
  "blaze", "bloom", "board", "brave", "breeze", "brook", "cabin", "cactus", "camera", "candle", "canvas", "captain", "caramel", "cedar", "chalk", "charm",
  "cherry", "circle", "citron", "cloud", "clover", "coast", "cobalt", "comet", "coral", "cosmos", "cotton", "cove", "crane", "crisp", "crown", "daisy",
  "dawn", "delta", "desert", "dolphin", "drift", "dune", "eagle", "echo", "ember", "emerald", "engine", "evening", "falcon", "feather", "field", "firefly",
  "fjord", "flare", "flora", "forest", "fossil", "fountain", "fox", "frost", "galaxy", "garden", "glade", "glimmer", "globe", "glow", "gold", "granite",
  "grove", "harbor", "harmony", "hazel", "heron", "honey", "horizon", "iceberg", "iris", "island", "ivory", "jacket", "jade", "jasmine", "jelly", "journey",
  "juniper", "karma", "keystone", "kindle", "kite", "lagoon", "lantern", "lavender", "leaf", "legend", "lemon", "linen", "lotus", "lunar", "lyric", "magnet",
  "maple", "marble", "meadow", "melody", "meteor", "midnight", "mist", "monsoon", "moon", "morning", "mosaic", "mountain", "nebula", "nectar", "needle", "nest",
  "nickel", "night", "nova", "oak", "oasis", "ocean", "olive", "onyx", "opal", "orbit", "orchid", "origin", "otter", "owl", "panda", "paper",
  "pearl", "petal", "phoenix", "pine", "planet", "plaza", "plume", "pocket", "polar", "pond", "prairie", "prism", "pulse", "quartz", "quill", "raven",
  "reef", "river", "rocket", "rose", "ruby", "sable", "saffron", "sage", "sail", "salmon", "sand", "scarlet", "school", "shadow", "shore", "signal",
  "silver", "sketch", "sky", "slate", "snow", "solstice", "spark", "spice", "spirit", "spring", "spruce", "star", "stone", "storm", "stream", "sugar",
  "summit", "sunset", "surf", "swallow", "swift", "tangle", "teal", "temple", "thunder", "tidal", "timber", "topaz", "torch", "trail", "traveler", "trident",
  "tulip", "tundra", "twig", "velvet", "vertex", "violet", "vista", "voyage", "water", "wave", "whisper", "willow", "wind", "window", "winter", "wonder",
  "wood", "xenon", "yarrow", "yellow", "yonder", "youth", "zephyr", "zinc", "zone", "acorn", "almond", "amber", "anvil", "arrow", "basil", "beetle",
  "birch", "bronze", "canyon", "caper", "cinder", "citrus", "creek", "cricket", "dahlia", "elm", "fig", "garnet", "ginger", "heather", "indigo", "jet"
] as const;

export const CHAT_IDENTITY_ALGORITHM = "ECDH-P256";
export const CHAT_MESSAGE_CIPHER_ALGORITHM = "ECDH-P256/AES-GCM";
export const CHAT_ATTACHMENT_CIPHER_ALGORITHM = "ECDH-P256/AES-GCM/attachment-v1";
export const CHAT_DEVICE_PAIRING_TRANSFER_ALGORITHM = "ECDH-P256/AES-GCM/device-pairing-v1";
export const CHAT_KEY_BACKUP_WRAPPING_ALGORITHM = "PBKDF2-SHA-256/AES-GCM";
const CHAT_PRIVATE_KEY_STORAGE_WRAPPING_ALGORITHM = "AES-GCM/device-local-v1";

export type StoredChatKeyMaterial = {
  userId: string;
  identityId: string | null;
  publicKey: string;
  privateKey: string | CryptoKey;
  algorithm: string;
  keyVersion: number;
  updatedAt: string;
  wrappedPrivateKey?: string;
  privateKeyIv?: string;
  privateKeyWrappingAlgorithm?: string;
};

type PersistedChatKeyMaterial = Omit<StoredChatKeyMaterial, "privateKey"> & {
  wrappedPrivateKey: string;
  privateKeyIv: string;
  privateKeyWrappingAlgorithm: string;
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
  credentialType?: "legacy_recovery_code" | "pin_and_phrase";
  pinWrappedPrivateKey?: string;
  pinSalt?: string;
  pinIv?: string;
  pinIterations?: number;
  recoveryWrappedPrivateKey?: string;
  recoverySalt?: string;
  recoveryIv?: string;
  recoveryIterations?: number;
  pinWrappedRecoveryPhrase?: string;
  pinRecoveryPhraseIv?: string;
};

type ChatCipherEnvelope = {
  version: number;
  cipherText: string;
  iv: string;
  algorithm: string;
  senderPublicKey: string;
  recipientPublicKey?: string;
};

type CachedChatMessagePlaintextRecord = {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string;
  cipherFingerprint: string;
  plaintextCipherText: string;
  plaintextIv: string;
  algorithm: string;
  cachedAt: string;
};

export type ChatMessagePlaintextCacheLookup = {
  conversationId: string;
  messageId: string;
  cipherText: string;
  cipherIv?: string | null;
};

export type ChatMessagePlaintextCacheSave = ChatMessagePlaintextCacheLookup & {
  userId: string;
  plaintext: string;
};

type EncryptBackupOptions = {
  pin: string;
  userSalt: string;
  recoveryPhrase?: string | null;
};

export type ChatPinAttemptState = {
  userId: string;
  attempts: number;
  lockedUntil: string | null;
  updatedAt: string;
};

function ensureBrowserCrypto() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("This browser cannot enable end-to-end encrypted chat.");
  }

  return subtle;
}

function ensureIndexedDb() {
  if (typeof window === "undefined" || !window.indexedDB) {
    return null;
  }

  return window.indexedDB;
}

function getStorageKey(userId: string) {
  return `${CHAT_KEY_STORAGE_PREFIX}:${userId}`;
}

function getRecoveryCodeStorageKey(userId: string) {
  return `${CHAT_RECOVERY_CODE_STORAGE_PREFIX}:${userId}`;
}

function openChatKeyVault() {
  const indexedDb = ensureIndexedDb();
  if (!indexedDb) {
    return Promise.resolve<IDBDatabase | null>(null);
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(CHAT_KEY_VAULT_DB_NAME, 3);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CHAT_KEY_VAULT_STORE)) {
        database.createObjectStore(CHAT_KEY_VAULT_STORE, { keyPath: "userId" });
      }
      if (!database.objectStoreNames.contains(CHAT_PIN_ATTEMPT_STORE)) {
        database.createObjectStore(CHAT_PIN_ATTEMPT_STORE, { keyPath: "userId" });
      }
      if (!database.objectStoreNames.contains(CHAT_DEVICE_WRAP_KEY_STORE)) {
        database.createObjectStore(CHAT_DEVICE_WRAP_KEY_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the secure chat key vault."));
  });
}

function openChatMessageCache() {
  const indexedDb = ensureIndexedDb();
  if (!indexedDb) {
    return Promise.resolve<IDBDatabase | null>(null);
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(CHAT_MESSAGE_CACHE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CHAT_MESSAGE_PLAINTEXT_CACHE_STORE)) {
        const store = database.createObjectStore(CHAT_MESSAGE_PLAINTEXT_CACHE_STORE, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("conversationId", "conversationId", { unique: false });
      }
      if (!database.objectStoreNames.contains(CHAT_MESSAGE_CACHE_KEY_STORE)) {
        database.createObjectStore(CHAT_MESSAGE_CACHE_KEY_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the secure chat message cache."));
  });
}

async function withChatKeyVaultStore<T>(
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => Promise<T>,
  storeName = CHAT_KEY_VAULT_STORE
) {
  const database = await openChatKeyVault();
  if (!database) {
    return null;
  }

  try {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    return await runner(store);
  } finally {
    database.close();
  }
}

async function withChatMessageCacheStore<T>(
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => Promise<T>,
  storeName = CHAT_MESSAGE_PLAINTEXT_CACHE_STORE
) {
  const database = await openChatMessageCache();
  if (!database) {
    return null;
  }

  try {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    return await runner(store);
  } finally {
    database.close();
  }
}

function readIdbRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
}

function getChatMessagePlaintextCacheId(userId: string, messageId: string) {
  return `${userId}:${messageId}`;
}

async function getChatMessageCipherFingerprint(cipherText: string, cipherIv?: string | null) {
  const digest = await ensureBrowserCrypto().digest("SHA-256", bufferFromText(`${cipherIv ?? ""}:${cipherText}`));
  return bufferToBase64(digest);
}

async function getDeviceMessagePlaintextCacheKey() {
  const stored = await withChatMessageCacheStore(
    "readonly",
    async (store) => {
      const request = store.get(CHAT_MESSAGE_CACHE_KEY_ID);
      return (await readIdbRequest(request)) as { id: string; key: CryptoKey } | undefined;
    },
    CHAT_MESSAGE_CACHE_KEY_STORE
  );

  if (
    stored?.id === CHAT_MESSAGE_CACHE_KEY_ID &&
    isCryptoKey(stored.key) &&
    stored.key.usages.includes("encrypt") &&
    stored.key.usages.includes("decrypt")
  ) {
    return stored.key;
  }

  const key = await ensureBrowserCrypto().generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );

  await withChatMessageCacheStore(
    "readwrite",
    async (store) => {
      const transaction = store.transaction;
      store.put({
        id: CHAT_MESSAGE_CACHE_KEY_ID,
        key,
        algorithm: CHAT_MESSAGE_CACHE_ALGORITHM,
        createdAt: new Date().toISOString()
      });
      await waitForTransaction(transaction);
      return null;
    },
    CHAT_MESSAGE_CACHE_KEY_STORE
  );

  return key;
}

function isCachedChatMessagePlaintextRecord(value: unknown): value is CachedChatMessagePlaintextRecord {
  const parsed = value as Partial<CachedChatMessagePlaintextRecord> | null | undefined;
  return Boolean(
    parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.userId === "string" &&
      typeof parsed.messageId === "string" &&
      typeof parsed.cipherFingerprint === "string" &&
      typeof parsed.plaintextCipherText === "string" &&
      typeof parsed.plaintextIv === "string" &&
      parsed.algorithm === CHAT_MESSAGE_CACHE_ALGORITHM
  );
}

function bufferFromText(value: string) {
  return new TextEncoder().encode(value).buffer;
}

function bufferToText(buffer: ArrayBuffer) {
  return new TextDecoder().decode(buffer);
}

function readLegacyStoredChatKeyMaterial(userId: string) {
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

function removeLegacyStoredChatKeyMaterial(userId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getStorageKey(userId));
}

function clearLegacyChatStorage() {
  if (typeof window === "undefined") {
    return;
  }

  const legacyPrefixes = [
    CHAT_KEY_STORAGE_PREFIX,
    CHAT_RECOVERY_CODE_STORAGE_PREFIX,
    "vyb_chat_private_key",
    "vyb-chat-private-key",
    "vyb-chat-recovery-code"
  ];

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key && legacyPrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) {
      window.localStorage.removeItem(key);
    }
  }
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

function isCryptoKey(value: unknown): value is CryptoKey {
  return typeof CryptoKey !== "undefined" && value instanceof CryptoKey;
}

function isPersistedChatKeyMaterial(value: unknown): value is PersistedChatKeyMaterial {
  const parsed = value as Partial<PersistedChatKeyMaterial> | null | undefined;
  return Boolean(
    parsed &&
      typeof parsed.userId === "string" &&
      typeof parsed.publicKey === "string" &&
      typeof parsed.wrappedPrivateKey === "string" &&
      typeof parsed.privateKeyIv === "string" &&
      parsed.privateKeyWrappingAlgorithm === CHAT_PRIVATE_KEY_STORAGE_WRAPPING_ALGORITHM
  );
}

function isLegacyRawChatKeyMaterial(value: unknown): value is StoredChatKeyMaterial & { privateKey: string } {
  const parsed = value as Partial<StoredChatKeyMaterial> | null | undefined;
  return Boolean(
    parsed &&
      typeof parsed.userId === "string" &&
      typeof parsed.publicKey === "string" &&
      typeof parsed.privateKey === "string" &&
      typeof parsed.algorithm === "string"
  );
}

async function getDevicePrivateKeyWrappingKey() {
  const stored = await withChatKeyVaultStore(
    "readonly",
    async (store) => {
      const request = store.get(CHAT_DEVICE_WRAP_KEY_ID);
      return (await readIdbRequest(request)) as { id: string; key: CryptoKey } | undefined;
    },
    CHAT_DEVICE_WRAP_KEY_STORE
  );

  if (stored?.id === CHAT_DEVICE_WRAP_KEY_ID && isCryptoKey(stored.key)) {
    return stored.key;
  }

  const key = await ensureBrowserCrypto().generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["wrapKey", "unwrapKey"]
  );

  await withChatKeyVaultStore(
    "readwrite",
    async (store) => {
      const transaction = store.transaction;
      store.put({
        id: CHAT_DEVICE_WRAP_KEY_ID,
        key,
        algorithm: CHAT_PRIVATE_KEY_STORAGE_WRAPPING_ALGORITHM,
        createdAt: new Date().toISOString()
      });
      await waitForTransaction(transaction);
      return null;
    },
    CHAT_DEVICE_WRAP_KEY_STORE
  );

  return key;
}

async function importPrivateKeyForStorage(privateKey: string) {
  return ensureBrowserCrypto().importKey(
    "pkcs8",
    base64ToBuffer(privateKey),
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    ["deriveKey", "deriveBits"]
  );
}

async function wrapPrivateKeyForStorage(material: StoredChatKeyMaterial): Promise<PersistedChatKeyMaterial> {
  if (!isCryptoKey(material.privateKey)) {
    const wrappingKey = await getDevicePrivateKeyWrappingKey();
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const privateKey = await importPrivateKeyForStorage(material.privateKey);
    const wrappedPrivateKey = await ensureBrowserCrypto().wrapKey(
      "pkcs8",
      privateKey,
      wrappingKey,
      {
        name: "AES-GCM",
        iv
      }
    );

    return {
      userId: material.userId,
      identityId: material.identityId,
      publicKey: material.publicKey,
      algorithm: material.algorithm,
      keyVersion: material.keyVersion,
      updatedAt: material.updatedAt,
      wrappedPrivateKey: bufferToBase64(wrappedPrivateKey),
      privateKeyIv: bufferToBase64(iv.buffer),
      privateKeyWrappingAlgorithm: CHAT_PRIVATE_KEY_STORAGE_WRAPPING_ALGORITHM
    };
  }

  if (material.wrappedPrivateKey && material.privateKeyIv) {
    return {
      userId: material.userId,
      identityId: material.identityId,
      publicKey: material.publicKey,
      algorithm: material.algorithm,
      keyVersion: material.keyVersion,
      updatedAt: material.updatedAt,
      wrappedPrivateKey: material.wrappedPrivateKey,
      privateKeyIv: material.privateKeyIv,
      privateKeyWrappingAlgorithm: CHAT_PRIVATE_KEY_STORAGE_WRAPPING_ALGORITHM
    };
  }

  if (!material.privateKey.extractable) {
    throw new Error("This secure chat key is non-extractable and is missing its wrapped storage envelope.");
  }

  const wrappingKey = await getDevicePrivateKeyWrappingKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const wrappedPrivateKey = await ensureBrowserCrypto().wrapKey(
    "pkcs8",
    material.privateKey,
    wrappingKey,
    {
      name: "AES-GCM",
      iv
    }
  );

  return {
    userId: material.userId,
    identityId: material.identityId,
    publicKey: material.publicKey,
    algorithm: material.algorithm,
    keyVersion: material.keyVersion,
    updatedAt: material.updatedAt,
    wrappedPrivateKey: bufferToBase64(wrappedPrivateKey),
    privateKeyIv: bufferToBase64(iv.buffer),
    privateKeyWrappingAlgorithm: CHAT_PRIVATE_KEY_STORAGE_WRAPPING_ALGORITHM
  };
}

async function unwrapStoredPrivateKey(
  material: PersistedChatKeyMaterial,
  extractable = false
) {
  const wrappingKey = await getDevicePrivateKeyWrappingKey();
  return ensureBrowserCrypto().unwrapKey(
    "pkcs8",
    base64ToBuffer(material.wrappedPrivateKey),
    wrappingKey,
    {
      name: "AES-GCM",
      iv: new Uint8Array(base64ToBuffer(material.privateKeyIv))
    },
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    extractable,
    ["deriveKey", "deriveBits"]
  );
}

async function hydratePersistedChatKeyMaterial(material: PersistedChatKeyMaterial): Promise<StoredChatKeyMaterial> {
  return {
    userId: material.userId,
    identityId: material.identityId,
    publicKey: material.publicKey,
    privateKey: await unwrapStoredPrivateKey(material, false),
    algorithm: material.algorithm,
    keyVersion: material.keyVersion,
    updatedAt: material.updatedAt,
    wrappedPrivateKey: material.wrappedPrivateKey,
    privateKeyIv: material.privateKeyIv,
    privateKeyWrappingAlgorithm: material.privateKeyWrappingAlgorithm
  };
}

export async function loadStoredChatKeyMaterial(userId: string): Promise<StoredChatKeyMaterial | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = await withChatKeyVaultStore("readonly", async (store) => {
    const request = store.get(userId);
    return (await readIdbRequest(request)) as PersistedChatKeyMaterial | StoredChatKeyMaterial | undefined;
  });

  if (isPersistedChatKeyMaterial(stored)) {
    return hydratePersistedChatKeyMaterial(stored);
  }

  if (isLegacyRawChatKeyMaterial(stored)) {
    await saveStoredChatKeyMaterial(stored);
    const migrated: StoredChatKeyMaterial | null = await loadStoredChatKeyMaterial(userId);
    if (migrated && migrated.publicKey === stored.publicKey) {
      removeLegacyStoredChatKeyMaterial(userId);
      return migrated;
    }

    throw new Error("Secure chat key migration could not be verified.");
  }

  const legacy = readLegacyStoredChatKeyMaterial(userId);
  if (!legacy) {
    return null;
  }

  await saveStoredChatKeyMaterial(legacy);
  const migrated: StoredChatKeyMaterial | null = await loadStoredChatKeyMaterial(userId);
  if (migrated && migrated.publicKey === legacy.publicKey) {
    removeLegacyStoredChatKeyMaterial(userId);
    return migrated;
  }

  throw new Error("Secure chat key migration could not be verified.");
}

export async function saveStoredChatKeyMaterial(material: StoredChatKeyMaterial) {
  if (typeof window === "undefined") {
    return;
  }

  const indexedDb = ensureIndexedDb();
  if (!indexedDb) {
    throw new Error("IndexedDB is required to store secure chat keys on this device.");
  }

  const persisted = await wrapPrivateKeyForStorage(material);
  await withChatKeyVaultStore("readwrite", async (store) => {
    const transaction = store.transaction;
    store.put(persisted);
    await waitForTransaction(transaction);
    return null;
  });

  const verified = await withChatKeyVaultStore("readonly", async (store) => {
    const request = store.get(material.userId);
    return (await readIdbRequest(request)) as PersistedChatKeyMaterial | undefined;
  });
  if (!isPersistedChatKeyMaterial(verified) || verified.publicKey !== material.publicKey) {
    throw new Error("Secure chat key storage verification failed.");
  }

  removeLegacyStoredChatKeyMaterial(material.userId);
}

export async function loadChatPinAttemptState(userId: string) {
  if (typeof window === "undefined") {
    return {
      userId,
      attempts: 0,
      lockedUntil: null,
      updatedAt: new Date().toISOString()
    } satisfies ChatPinAttemptState;
  }

  const stored = await withChatKeyVaultStore(
    "readonly",
    async (store) => {
      const request = store.get(userId);
      return (await readIdbRequest(request)) as ChatPinAttemptState | undefined;
    },
    CHAT_PIN_ATTEMPT_STORE
  );

  const now = Date.now();
  if (!stored || typeof stored.attempts !== "number") {
    return {
      userId,
      attempts: 0,
      lockedUntil: null,
      updatedAt: new Date().toISOString()
    } satisfies ChatPinAttemptState;
  }

  if (stored.lockedUntil && new Date(stored.lockedUntil).getTime() <= now) {
    await clearChatPinAttemptState(userId);
    return {
      userId,
      attempts: 0,
      lockedUntil: null,
      updatedAt: new Date().toISOString()
    } satisfies ChatPinAttemptState;
  }

  return {
    userId,
    attempts: Math.max(0, Math.round(stored.attempts)),
    lockedUntil: typeof stored.lockedUntil === "string" ? stored.lockedUntil : null,
    updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : new Date().toISOString()
  } satisfies ChatPinAttemptState;
}

export async function recordFailedChatPinAttempt(userId: string) {
  const current = await loadChatPinAttemptState(userId);
  const now = new Date();
  const attempts = current.lockedUntil ? current.attempts : current.attempts + 1;
  const next = {
    userId,
    attempts,
    lockedUntil: attempts >= CHAT_PIN_MAX_ATTEMPTS ? new Date(now.getTime() + CHAT_PIN_LOCKOUT_MS).toISOString() : null,
    updatedAt: now.toISOString()
  } satisfies ChatPinAttemptState;

  if (typeof window === "undefined") {
    return next;
  }

  await withChatKeyVaultStore(
    "readwrite",
    async (store) => {
      const transaction = store.transaction;
      store.put(next);
      await waitForTransaction(transaction);
      return null;
    },
    CHAT_PIN_ATTEMPT_STORE
  );

  return next;
}

export async function clearChatPinAttemptState(userId: string) {
  if (typeof window === "undefined") {
    return;
  }

  await withChatKeyVaultStore(
    "readwrite",
    async (store) => {
      const transaction = store.transaction;
      store.delete(userId);
      await waitForTransaction(transaction);
      return null;
    },
    CHAT_PIN_ATTEMPT_STORE
  );
}

export async function clearChatVault() {
  if (typeof window === "undefined") {
    return;
  }

  const indexedDb = ensureIndexedDb();
  if (!indexedDb) {
    clearLegacyChatStorage();
    return;
  }

  await Promise.all(
    [CHAT_KEY_VAULT_DB_NAME, ...CHAT_LEGACY_VAULT_DB_NAMES].map(
      (databaseName) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDb.deleteDatabase(databaseName);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error ?? new Error(`Could not delete ${databaseName}.`));
          request.onblocked = () =>
            reject(new Error(`Secure chat vault ${databaseName} is still open in another tab. Close other VYB tabs and try signing out again.`));
        })
    )
  );
  clearLegacyChatStorage();
}

export function loadStoredRecoveryCode(userId: string) {
  void userId;
  return null;
}

export function saveStoredRecoveryCode(userId: string, recoveryCode: string) {
  void userId;
  void recoveryCode;
}

export async function syncStoredChatKeyIdentity(userId: string, identity: ChatIdentitySummary) {
  const current = await loadStoredChatKeyMaterial(userId);
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

  await saveStoredChatKeyMaterial(next);
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

export function normalizeSecurityPin(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function isValidSecurityPin(value: string) {
  return /^\d{6}$/u.test(normalizeSecurityPin(value));
}

export function normalizeRecoveryPhrase(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/u)
    .filter(Boolean)
    .join(" ");
}

export function isValidRecoveryPhrase(value: string) {
  return normalizeRecoveryPhrase(value).split(" ").filter(Boolean).length === RECOVERY_PHRASE_WORD_COUNT;
}

export function generateRecoveryPhrase() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(RECOVERY_PHRASE_WORD_COUNT));
  return Array.from(bytes, (value) => RECOVERY_PHRASE_WORDS[value]).join(" ");
}

export async function deriveKeyFromPin(pin: string, salt: string) {
  const normalizedPin = normalizeSecurityPin(pin);
  if (!isValidSecurityPin(normalizedPin)) {
    throw new Error("Enter a 6-digit security PIN.");
  }

  const keyMaterial = await ensureBrowserCrypto().importKey(
    "raw",
    new TextEncoder().encode(normalizedPin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return ensureBrowserCrypto().deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: CHAT_KEY_BACKUP_PBKDF2_ITERATIONS
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
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
  const rawMaterial = {
    userId,
    identityId: null,
    publicKey: bufferToBase64(publicKey),
    privateKey: bufferToBase64(privateKey),
    algorithm: CHAT_IDENTITY_ALGORITHM,
    keyVersion: 1,
    updatedAt: new Date().toISOString()
  } satisfies StoredChatKeyMaterial & { privateKey: string };
  const persisted = await wrapPrivateKeyForStorage(rawMaterial);

  return {
    userId,
    identityId: null,
    publicKey: bufferToBase64(publicKey),
    privateKey: await unwrapStoredPrivateKey(persisted, false),
    algorithm: CHAT_IDENTITY_ALGORITHM,
    keyVersion: 1,
    updatedAt: rawMaterial.updatedAt,
    wrappedPrivateKey: persisted.wrappedPrivateKey,
    privateKeyIv: persisted.privateKeyIv,
    privateKeyWrappingAlgorithm: persisted.privateKeyWrappingAlgorithm
  } satisfies StoredChatKeyMaterial;
}

async function deriveBackupWrappingKey(
  secret: string,
  salt: ArrayBuffer,
  iterations = CHAT_KEY_BACKUP_PBKDF2_ITERATIONS,
  options?: {
    minLength?: number;
    emptyError?: string;
  }
) {
  const normalizedSecret = secret.trim();
  if (!normalizedSecret || normalizedSecret.length < (options?.minLength ?? 16)) {
    throw new Error(options?.emptyError ?? "Enter the full recovery secret to restore your E2EE key.");
  }

  const baseKey = await ensureBrowserCrypto().importKey(
    "raw",
    new TextEncoder().encode(normalizedSecret),
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
  if (isCryptoKey(material.privateKey)) {
    return material.privateKey;
  }

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

function getPeerPublicKey(peerIdentity: ChatIdentitySummary | string) {
  return typeof peerIdentity === "string" ? peerIdentity : peerIdentity.publicKey;
}

async function deriveConversationCipherKey(
  material: StoredChatKeyMaterial,
  peerIdentity: ChatIdentitySummary | string
) {
  const peerPublicKey = getPeerPublicKey(peerIdentity);
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
      typeof parsed?.senderPublicKey !== "string"
    ) {
      return null;
    }

    return {
      version: parsed.version,
      cipherText: parsed.cipherText,
      iv: parsed.iv,
      algorithm: parsed.algorithm,
      senderPublicKey: parsed.senderPublicKey,
      recipientPublicKey: typeof parsed.recipientPublicKey === "string" ? parsed.recipientPublicKey : undefined
    };
  } catch {
    return null;
  }
}

export function hasChatCipherEnvelope(value: string) {
  return Boolean(parseChatCipherEnvelope(value));
}

async function exportPrivateKeyForBackup(material: StoredChatKeyMaterial) {
  if (!isCryptoKey(material.privateKey)) {
    return material.privateKey;
  }

  if (material.wrappedPrivateKey && material.privateKeyIv) {
    const exportablePrivateKey = await unwrapStoredPrivateKey(
      {
        userId: material.userId,
        identityId: material.identityId,
        publicKey: material.publicKey,
        algorithm: material.algorithm,
        keyVersion: material.keyVersion,
        updatedAt: material.updatedAt,
        wrappedPrivateKey: material.wrappedPrivateKey,
        privateKeyIv: material.privateKeyIv,
        privateKeyWrappingAlgorithm: CHAT_PRIVATE_KEY_STORAGE_WRAPPING_ALGORITHM
      },
      true
    );
    return bufferToBase64(await ensureBrowserCrypto().exportKey("pkcs8", exportablePrivateKey));
  }

  if (!material.privateKey.extractable) {
    throw new Error("This device key is non-extractable and cannot be backed up without its wrapped vault envelope.");
  }

  return bufferToBase64(await ensureBrowserCrypto().exportKey("pkcs8", material.privateKey));
}

async function buildPlaintextKeyMaterialForBackup(material: StoredChatKeyMaterial) {
  return {
    userId: material.userId,
    identityId: material.identityId,
    publicKey: material.publicKey,
    privateKey: await exportPrivateKeyForBackup(material),
    algorithm: material.algorithm,
    keyVersion: material.keyVersion,
    updatedAt: material.updatedAt
  } satisfies StoredChatKeyMaterial & { privateKey: string };
}

export async function createChatDevicePairingRequestKey() {
  const keyPair = await ensureBrowserCrypto().generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    ["deriveKey", "deriveBits"]
  );

  const [publicKey, privateKey] = await Promise.all([
    ensureBrowserCrypto().exportKey("raw", keyPair.publicKey),
    ensureBrowserCrypto().exportKey("pkcs8", keyPair.privateKey)
  ]);

  return {
    publicKey: bufferToBase64(publicKey),
    privateKey: bufferToBase64(privateKey),
    algorithm: CHAT_IDENTITY_ALGORITHM
  };
}

async function importDevicePairingPrivateKey(privateKey: string) {
  return ensureBrowserCrypto().importKey(
    "pkcs8",
    base64ToBuffer(privateKey),
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    false,
    ["deriveKey", "deriveBits"]
  );
}

async function deriveDevicePairingTransferKey(privateKey: CryptoKey, publicKeyString: string) {
  const publicKey = await importPublicKeyString(publicKeyString);
  return ensureBrowserCrypto().deriveKey(
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
  );
}

export async function encryptStoredChatKeyMaterialForDevicePairing(
  material: StoredChatKeyMaterial,
  requesterPublicKey: string
): Promise<ChatDevicePairingTransferEnvelope> {
  const privateKey = await importPrivateKey(material);
  const transferKey = await deriveDevicePairingTransferKey(privateKey, requesterPublicKey);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(await buildPlaintextKeyMaterialForBackup(material)));
  const cipherBuffer = await ensureBrowserCrypto().encrypt(
    {
      name: "AES-GCM",
      iv
    },
    transferKey,
    plaintext
  );

  return {
    version: 1,
    cipherText: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv.buffer),
    algorithm: CHAT_DEVICE_PAIRING_TRANSFER_ALGORITHM,
    senderPublicKey: material.publicKey,
    recipientPublicKey: requesterPublicKey
  };
}

export async function decryptStoredChatKeyMaterialFromDevicePairing(
  envelope: ChatDevicePairingTransferEnvelope,
  requesterPrivateKey: string,
  userId: string
) {
  if (envelope.algorithm !== CHAT_DEVICE_PAIRING_TRANSFER_ALGORITHM) {
    throw new Error("This device pairing transfer uses an unsupported encryption algorithm.");
  }

  const privateKey = await importDevicePairingPrivateKey(requesterPrivateKey);
  const transferKey = await deriveDevicePairingTransferKey(privateKey, envelope.senderPublicKey);
  const plaintextBuffer = await ensureBrowserCrypto().decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(base64ToBuffer(envelope.iv))
    },
    transferKey,
    base64ToBuffer(envelope.cipherText)
  );
  const parsed = JSON.parse(bufferToText(plaintextBuffer)) as StoredChatKeyMaterial & { privateKey: string };

  if (parsed.userId !== userId || parsed.publicKey !== envelope.senderPublicKey || typeof parsed.privateKey !== "string") {
    throw new Error("This device pairing transfer does not match your account identity.");
  }

  return {
    userId: parsed.userId,
    identityId: parsed.identityId ?? null,
    publicKey: parsed.publicKey,
    privateKey: parsed.privateKey,
    algorithm: parsed.algorithm || CHAT_IDENTITY_ALGORITHM,
    keyVersion: Number.isFinite(Number(parsed.keyVersion)) ? Math.max(1, Math.round(Number(parsed.keyVersion))) : 1,
    updatedAt: parsed.updatedAt || new Date().toISOString()
  } satisfies StoredChatKeyMaterial & { privateKey: string };
}

export async function encryptStoredChatKeyMaterialForBackup(
  material: StoredChatKeyMaterial,
  options: EncryptBackupOptions
) {
  const normalizedPin = normalizeSecurityPin(options.pin);
  if (!isValidSecurityPin(normalizedPin)) {
    throw new Error("Enter a 6-digit security PIN before backing up this device.");
  }

  const pinSaltText = options.userSalt.trim();
  if (!pinSaltText) {
    throw new Error("A stable account salt is required to back up the encrypted key.");
  }

  const plaintext = new TextEncoder().encode(JSON.stringify(await buildPlaintextKeyMaterialForBackup(material)));
  const pinIv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const pinKey = await deriveKeyFromPin(normalizedPin, pinSaltText);
  const pinCipherBuffer = await ensureBrowserCrypto().encrypt(
    {
      name: "AES-GCM",
      iv: pinIv
    },
    pinKey,
    plaintext
  );

  const backup: EncryptedChatKeyBackup = {
    version: 2,
    publicKey: material.publicKey,
    algorithm: material.algorithm,
    keyVersion: material.keyVersion,
    wrappingAlgorithm: CHAT_KEY_BACKUP_WRAPPING_ALGORITHM,
    wrappedPrivateKey: bufferToBase64(pinCipherBuffer),
    salt: bufferToBase64(bufferFromText(pinSaltText)),
    iv: bufferToBase64(pinIv.buffer),
    iterations: CHAT_KEY_BACKUP_PBKDF2_ITERATIONS,
    updatedAt: new Date().toISOString(),
    credentialType: "pin_and_phrase",
    pinWrappedPrivateKey: bufferToBase64(pinCipherBuffer),
    pinSalt: bufferToBase64(bufferFromText(pinSaltText)),
    pinIv: bufferToBase64(pinIv.buffer),
    pinIterations: CHAT_KEY_BACKUP_PBKDF2_ITERATIONS
  };

  const normalizedRecoveryPhrase = normalizeRecoveryPhrase(options.recoveryPhrase ?? "");
  if (normalizedRecoveryPhrase) {
    if (!isValidRecoveryPhrase(normalizedRecoveryPhrase)) {
      throw new Error("The recovery phrase must contain 24 words.");
    }

    const recoverySalt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const recoveryIv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const recoveryKey = await deriveBackupWrappingKey(normalizedRecoveryPhrase, recoverySalt.buffer, CHAT_KEY_BACKUP_PBKDF2_ITERATIONS, {
      minLength: 24,
      emptyError: "Enter the full recovery phrase to restore your E2EE key."
    });
    const recoveryCipherBuffer = await ensureBrowserCrypto().encrypt(
      {
        name: "AES-GCM",
        iv: recoveryIv
      },
      recoveryKey,
      plaintext
    );

    backup.recoveryWrappedPrivateKey = bufferToBase64(recoveryCipherBuffer);
    backup.recoverySalt = bufferToBase64(recoverySalt.buffer);
    backup.recoveryIv = bufferToBase64(recoveryIv.buffer);
    backup.recoveryIterations = CHAT_KEY_BACKUP_PBKDF2_ITERATIONS;

    const phraseIv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const phraseCipherBuffer = await ensureBrowserCrypto().encrypt(
      {
        name: "AES-GCM",
        iv: phraseIv
      },
      pinKey,
      new TextEncoder().encode(normalizedRecoveryPhrase)
    );
    backup.pinWrappedRecoveryPhrase = bufferToBase64(phraseCipherBuffer);
    backup.pinRecoveryPhraseIv = bufferToBase64(phraseIv.buffer);
  }

  return backup;
}

async function decryptBackupPayload(
  wrappedPrivateKey: string,
  iv: string,
  wrappingKey: CryptoKey
) {
  const plaintextBuffer = await ensureBrowserCrypto().decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(base64ToBuffer(iv))
    },
    wrappingKey,
    base64ToBuffer(wrappedPrivateKey)
  );
  return JSON.parse(new TextDecoder().decode(plaintextBuffer)) as StoredChatKeyMaterial;
}

export async function decryptStoredChatKeyMaterialFromBackup(
  backup: EncryptedChatKeyBackup,
  secret: string
) {
  const normalizedPin = normalizeSecurityPin(secret);
  const normalizedPhrase = normalizeRecoveryPhrase(secret);

  if ((backup.version ?? 1) >= 2) {
    if (isValidSecurityPin(normalizedPin)) {
      const pinSalt = bufferToText(base64ToBuffer(backup.pinSalt ?? backup.salt));
      const wrappingKey = await deriveKeyFromPin(normalizedPin, pinSalt);
      const parsed = await decryptBackupPayload(
        backup.pinWrappedPrivateKey ?? backup.wrappedPrivateKey,
        backup.pinIv ?? backup.iv,
        wrappingKey
      );

      if (
        typeof parsed?.userId !== "string" ||
        typeof parsed?.publicKey !== "string" ||
        typeof parsed?.privateKey !== "string" ||
        parsed.publicKey !== backup.publicKey
      ) {
        throw new Error("This security PIN restored a different key than the one linked to this account.");
      }

      return parsed;
    }

    if (backup.recoveryWrappedPrivateKey && backup.recoverySalt && backup.recoveryIv && isValidRecoveryPhrase(normalizedPhrase)) {
      const wrappingKey = await deriveBackupWrappingKey(
        normalizedPhrase,
        base64ToBuffer(backup.recoverySalt),
        backup.recoveryIterations ?? CHAT_KEY_BACKUP_PBKDF2_ITERATIONS,
        {
          minLength: 24,
          emptyError: "Enter the full 24-word recovery phrase to restore your E2EE key."
        }
      );
      const parsed = await decryptBackupPayload(backup.recoveryWrappedPrivateKey, backup.recoveryIv, wrappingKey);

      if (
        typeof parsed?.userId !== "string" ||
        typeof parsed?.publicKey !== "string" ||
        typeof parsed?.privateKey !== "string" ||
        parsed.publicKey !== backup.publicKey
      ) {
        throw new Error("This recovery phrase restored a different key than the one linked to this account.");
      }

      return parsed;
    }

    throw new Error("Enter your 6-digit security PIN or the full 24-word recovery phrase.");
  }

  const wrappingKey = await deriveBackupWrappingKey(secret, base64ToBuffer(backup.salt), backup.iterations, {
    minLength: 16,
    emptyError: "Enter the full recovery code to restore your E2EE key."
  });
  const parsed = await decryptBackupPayload(backup.wrappedPrivateKey, backup.iv, wrappingKey);

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

export async function decryptRecoveryPhraseFromBackup(
  backup: EncryptedChatKeyBackup,
  pin: string
) {
  const normalizedPin = normalizeSecurityPin(pin);
  if (!isValidSecurityPin(normalizedPin)) {
    throw new Error("Enter your 6-digit security PIN.");
  }

  if (!backup.pinWrappedRecoveryPhrase || !backup.pinRecoveryPhraseIv) {
    throw new Error("This backup was created before recovery phrase viewing was enabled. Change your PIN once to reseal a viewable recovery phrase.");
  }

  const pinSalt = bufferToText(base64ToBuffer(backup.pinSalt ?? backup.salt));
  const wrappingKey = await deriveKeyFromPin(normalizedPin, pinSalt);
  const plaintextBuffer = await ensureBrowserCrypto().decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(base64ToBuffer(backup.pinRecoveryPhraseIv))
    },
    wrappingKey,
    base64ToBuffer(backup.pinWrappedRecoveryPhrase)
  );

  const phrase = normalizeRecoveryPhrase(new TextDecoder().decode(plaintextBuffer));
  if (!isValidRecoveryPhrase(phrase)) {
    throw new Error("This backup does not contain a valid 24-word recovery phrase.");
  }

  return phrase;
}

export async function encryptChatText(
  plaintext: string,
  material: StoredChatKeyMaterial,
  peerIdentity: ChatIdentitySummary | string
) {
  const peerPublicKey = getPeerPublicKey(peerIdentity);
  const key = await deriveConversationCipherKey(material, peerPublicKey);
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
    recipientPublicKey: peerPublicKey
  };

  return {
    cipherText: JSON.stringify(envelope),
    cipherIv: encodedIv,
    cipherAlgorithm: CHAT_MESSAGE_CIPHER_ALGORITHM
  };
}

type ChatAttachmentCipherMetadata = {
  cipherAlgorithm?: string | null;
  cipherIv?: string | null;
  senderPublicKey?: string | null;
  recipientPublicKey?: string | null;
};

export function isE2eeAttachmentCipher(metadata: ChatAttachmentCipherMetadata | null | undefined) {
  return metadata?.cipherAlgorithm === CHAT_ATTACHMENT_CIPHER_ALGORITHM && Boolean(metadata.cipherIv);
}

export async function encryptChatAttachmentBytes(
  plaintextBytes: ArrayBuffer,
  material: StoredChatKeyMaterial,
  peerIdentity: ChatIdentitySummary | string
) {
  const peerPublicKey = getPeerPublicKey(peerIdentity);
  const key = await deriveConversationCipherKey(material, peerPublicKey);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await ensureBrowserCrypto().encrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    plaintextBytes
  );

  return {
    encryptedBytes: cipherBuffer,
    cipherAlgorithm: CHAT_ATTACHMENT_CIPHER_ALGORITHM,
    cipherIv: bufferToBase64(iv.buffer),
    senderPublicKey: material.publicKey,
    recipientPublicKey: peerPublicKey
  };
}

export async function decryptChatAttachmentBytes(
  cipherBytes: ArrayBuffer,
  metadata: ChatAttachmentCipherMetadata,
  material: StoredChatKeyMaterial,
  peerIdentity: ChatIdentitySummary | string
) {
  if (!isE2eeAttachmentCipher(metadata) || !metadata.cipherIv) {
    throw new Error("This chat attachment is missing its encryption envelope.");
  }

  const peerPublicKey =
    metadata.senderPublicKey === material.publicKey
      ? metadata.recipientPublicKey ?? getPeerPublicKey(peerIdentity)
      : metadata.recipientPublicKey === material.publicKey
        ? metadata.senderPublicKey
        : getPeerPublicKey(peerIdentity);

  if (!peerPublicKey) {
    throw new Error("This chat attachment cannot be opened without the peer public key.");
  }

  const key = await deriveConversationCipherKey(material, peerPublicKey);
  return ensureBrowserCrypto().decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(base64ToBuffer(metadata.cipherIv))
    },
    key,
    cipherBytes
  );
}

export async function decryptChatText(
  cipherText: string,
  cipherIv: string,
  material: StoredChatKeyMaterial,
  peerIdentity: ChatIdentitySummary | string
) {
  const envelope = parseChatCipherEnvelope(cipherText);
  const peerPublicKey =
    envelope?.senderPublicKey === material.publicKey
      ? envelope.recipientPublicKey ?? getPeerPublicKey(peerIdentity)
      : envelope?.recipientPublicKey === material.publicKey
        ? envelope.senderPublicKey
        : getPeerPublicKey(peerIdentity);
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

export async function loadCachedChatMessagePlaintexts(
  userId: string,
  items: ChatMessagePlaintextCacheLookup[]
) {
  if (typeof window === "undefined" || items.length === 0) {
    return {};
  }

  try {
    const uniqueItems = Array.from(
      new Map(items.map((item) => [item.messageId, item])).values()
    );
    const fingerprints = new Map(
      await Promise.all(
        uniqueItems.map(async (item) => [
          item.messageId,
          await getChatMessageCipherFingerprint(item.cipherText, item.cipherIv)
        ] as const)
      )
    );
    const cachedRows = await withChatMessageCacheStore("readonly", async (store) => {
      const requests = uniqueItems.map((item) => store.get(getChatMessagePlaintextCacheId(userId, item.messageId)));
      return (await Promise.all(requests.map((request) => readIdbRequest(request)))) as unknown[];
    });

    if (!cachedRows?.length) {
      return {};
    }

    const cacheKey = await getDeviceMessagePlaintextCacheKey();
    const entries = await Promise.all(
      cachedRows.map(async (row) => {
        if (!isCachedChatMessagePlaintextRecord(row)) {
          return null;
        }

        const item = uniqueItems.find((candidate) => candidate.messageId === row.messageId);
        if (
          !item ||
          row.userId !== userId ||
          row.conversationId !== item.conversationId ||
          row.cipherFingerprint !== fingerprints.get(item.messageId)
        ) {
          return null;
        }

        const decrypted = await ensureBrowserCrypto().decrypt(
          {
            name: "AES-GCM",
            iv: new Uint8Array(base64ToBuffer(row.plaintextIv))
          },
          cacheKey,
          base64ToBuffer(row.plaintextCipherText)
        );
        return [row.messageId, bufferToText(decrypted)] as const;
      })
    );

    return Object.fromEntries(
      entries.filter((entry): entry is readonly [string, string] => Array.isArray(entry))
    );
  } catch {
    return {};
  }
}

export async function saveCachedChatMessagePlaintexts(items: ChatMessagePlaintextCacheSave[]) {
  if (typeof window === "undefined" || items.length === 0) {
    return;
  }

  try {
    const cacheKey = await getDeviceMessagePlaintextCacheKey();
    const uniqueItems = Array.from(
      new Map(items.map((item) => [`${item.userId}:${item.messageId}`, item])).values()
    );
    const records = await Promise.all(
      uniqueItems.map(async (item) => {
        const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
        const plaintextCipherText = await ensureBrowserCrypto().encrypt(
          {
            name: "AES-GCM",
            iv
          },
          cacheKey,
          bufferFromText(item.plaintext)
        );

        return {
          id: getChatMessagePlaintextCacheId(item.userId, item.messageId),
          userId: item.userId,
          conversationId: item.conversationId,
          messageId: item.messageId,
          cipherFingerprint: await getChatMessageCipherFingerprint(item.cipherText, item.cipherIv),
          plaintextCipherText: bufferToBase64(plaintextCipherText),
          plaintextIv: bufferToBase64(iv.buffer),
          algorithm: CHAT_MESSAGE_CACHE_ALGORITHM,
          cachedAt: new Date().toISOString()
        } satisfies CachedChatMessagePlaintextRecord;
      })
    );

    await withChatMessageCacheStore("readwrite", async (store) => {
      const transaction = store.transaction;
      records.forEach((record) => store.put(record));
      await waitForTransaction(transaction);
      return null;
    });
  } catch {
    // Plaintext cache is an optional local speed-up. E2EE still works without it.
  }
}


