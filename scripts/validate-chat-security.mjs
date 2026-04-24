import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertCheck(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertMissing(source, pattern, message) {
  assertCheck(!pattern.test(source), message);
}

function assertPresent(source, pattern, message) {
  assertCheck(pattern.test(source), message);
}

const chatE2ee = read("apps/web/src/lib/chat-e2ee.ts");
const chatRepository = read("apps/backend/src/modules/chat/repository.mjs");
const lifecycleRoute = read("apps/web/app/api/chats/messages/[messageId]/lifecycle/route.ts");
const sendRoute = read("apps/web/app/api/chats/[conversationId]/messages/route.ts");
const contracts = read("packages/contracts/src/index.ts");

const checks = [
  ["extractable-key-storage", () => {
    assertMissing(chatE2ee, /privateKey:\s*string;/u, "StoredChatKeyMaterial still declares a raw string-only private key.");
    assertMissing(chatE2ee, /localStorage\.setItem/u, "chat-e2ee still writes chat secrets to localStorage.");
    assertPresent(chatE2ee, /wrapKey\(\s*["']pkcs8["']/u, "Private key is not wrapped before IndexedDB persistence.");
    assertPresent(chatE2ee, /unwrapKey\(\s*["']pkcs8["']/u, "Private key is not unwrapped through Web Crypto.");
    assertPresent(chatE2ee, /CHAT_PRIVATE_KEY_STORAGE_WRAPPING_ALGORITHM/u, "Missing private-key storage wrapping marker.");
  }],
  ["blocking-vault-delete", () => {
    assertPresent(chatE2ee, /request\.onerror\s*=\s*\(\)\s*=>\s*reject/u, "Vault delete errors are not rejected.");
    assertPresent(chatE2ee, /request\.onblocked\s*=\s*\(\)\s*=>\s*\n?\s*reject/u, "Vault blocked deletes are not rejected.");
  }],
  ["attachment-ownership", () => {
    assertPresent(chatRepository, /function assertVerifiedChatAttachmentPath/u, "Missing strict attachment path verifier.");
    assertPresent(chatRepository, /async function verifyAttachmentOwnership/u, "Missing server-side attachment ownership verification.");
    assertPresent(chatRepository, /purpose:\s*["']chat_attachment_v1["']/u, "Uploaded attachments do not carry chat ownership metadata.");
    assertPresent(chatRepository, /canJanitorDeleteAttachment\(message\)/u, "Janitor does not gate blob deletion through attachment validation.");
    assertMissing(chatRepository, /payload\.attachment\.storagePath/u, "Message creation still directly trusts payload.attachment.storagePath.");
  }],
  ["immutable-ttl", () => {
    assertPresent(chatRepository, /CLIENT_EXPIRY_FORBIDDEN/u, "Backend does not reject client-supplied expiresAt.");
    assertPresent(chatRepository, /durationKey/u, "Backend does not use durationKey-based TTL.");
    assertMissing(chatRepository, /isStarred:\s*\{\s*eq:\s*false\s*\}/u, "Janitor still lets star bypass expiry.");
    assertMissing(chatRepository, /isSaved:\s*\{\s*eq:\s*false\s*\}/u, "Janitor still lets save bypass expiry.");
    assertMissing(contracts, /expiresAt\?:\s*string\s*\|\s*null/u, "Contracts still allow client expiresAt mutation.");
  }],
  ["api-400-surface", () => {
    assertPresent(lifecycleRoute, /buildChatError/u, "Lifecycle API does not preserve backend 400/403 status codes.");
    assertPresent(sendRoute, /buildChatError/u, "Send-message API does not preserve backend 400/403 status codes.");
  }]
];

const results = [];
for (const [name, run] of checks) {
  run();
  results.push({ name, status: "passed" });
}

console.log(JSON.stringify({
  status: "passed",
  checkedAt: new Date().toISOString(),
  results
}, null, 2));
