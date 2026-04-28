import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp, getFirebaseDataConnect } from "../../../../../packages/config/src/index.mjs";
import { getProfileByUserId, getProfileByUsername } from "../identity/profile-repository.mjs";
import { trackActivity } from "../moderation/repository.mjs";
import { getChatPresenceSnapshot } from "./presence-store.mjs";
import { emitChatRealtimeEvent } from "./realtime-hub.mjs";

const CHAT_CONNECTOR_CONFIG = {
  connector: "chat",
  serviceId: "vyb",
  location: "asia-south1"
};

const CHAT_INBOX_LIMIT = 60;
const CHAT_MESSAGE_LIMIT = 120;
const END_TO_END_CHAT_ALGORITHM = "ECDH-P256/AES-GCM";
const CHAT_KEY_BACKUP_WRAPPING_ALGORITHM = "PBKDF2-SHA-256/AES-GCM";
const CHAT_DELETE_FOR_EVERYONE_WINDOW_MS = 30 * 60 * 1000;
const CHAT_HIDDEN_MESSAGE_LIMIT = 2000;
const CHAT_KEY_BACKUP_PIN_MAX_ATTEMPTS = 5;
const CHAT_KEY_BACKUP_PIN_LOCKOUT_MS = 60 * 60 * 1000;
const CHAT_DEFAULT_MESSAGE_TTL_KEY = "30d";
const CHAT_MESSAGE_TTL_OPTIONS = new Map([
  ["instant", 0],
  ["1h", 60 * 60 * 1000],
  ["24h", 24 * 60 * 60 * 1000],
  ["7d", 7 * 24 * 60 * 60 * 1000],
  ["30d", 30 * 24 * 60 * 60 * 1000],
  ["90d", 90 * 24 * 60 * 60 * 1000]
]);
const CHAT_DELETED_MESSAGE_ALGORITHM = "deleted";
const CHAT_DELETED_MESSAGE_MARKER = "__vyb_chat_deleted__";
const CHAT_ALLOWED_REACTION_EMOJIS = new Set([
  "\u2764\uFE0F",
  "\uD83D\uDD25",
  "\uD83D\uDE02",
  "\uD83D\uDE0D",
  "\uD83D\uDC4D",
  "\uD83D\uDE2E",
  "\uD83D\uDE22",
  "\uD83D\uDC4F",
  "\uD83D\uDE2D",
  "\uD83D\uDE21",
  "\uD83C\uDF89",
  "\uD83D\uDE0E"
]);
const CHAT_REACTION_EMOJIS = new Set(["❤️", "🔥", "😂", "😍", "👍", "😮", "😢", "👏"]);
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/ogg"]);
const AUDIO_MIME_TYPES = new Set(["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav", "audio/aac"]);
const SUPPORTED_CHAT_ATTACHMENT_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES, ...AUDIO_MIME_TYPES]);
const MAX_ENCRYPTED_CHAT_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_ENCRYPTED_CHAT_VIDEO_BYTES = 32 * 1024 * 1024;
const MAX_ENCRYPTED_CHAT_AUDIO_BYTES = 16 * 1024 * 1024;
const CHAT_ATTACHMENT_STORAGE_PATH_PATTERN =
  /^chat\/([^/]+)\/users\/([^/]+)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.bin$/iu;

class ChatSecurityError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "ChatSecurityError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function getChatErrorResponse(error, fallbackCode = "CHAT_FAILED") {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 502;
  return {
    statusCode,
    code: typeof error?.code === "string" ? error.code : fallbackCode,
    message: error instanceof Error ? error.message : "Chat service is unavailable right now."
  };
}

const GET_CHAT_IDENTITY_BY_USER_QUERY = `
  query GetChatIdentityByUser($tenantId: UUID!, $userId: UUID!) {
    chatIdentities(
      where: {
        tenantId: { eq: $tenantId }
        userId: { eq: $userId }
        deletedAt: { isNull: true }
      }
      orderBy: [{ updatedAt: DESC }]
      limit: 1
    ) {
      id
      tenantId
      userId
      membershipId
      publicKey
      algorithm
      keyVersion
      updatedAt
    }
  }
`;

const GET_CHAT_CONVERSATION_BY_KEY_QUERY = `
  query GetChatConversationByKey($conversationKey: String!) {
    chatConversations(
      where: {
        conversationKey: { eq: $conversationKey }
        deletedAt: { isNull: true }
      }
      limit: 1
    ) {
      id
      tenantId
      conversationKey
      kind
      createdByUserId
      lastMessageId
      lastMessageAt
      createdAt
      updatedAt
    }
  }
`;

const GET_CHAT_CONVERSATION_BY_ID_QUERY = `
  query GetChatConversationById($conversationId: UUID!) {
    chatConversations(
      where: {
        id: { eq: $conversationId }
        deletedAt: { isNull: true }
      }
      limit: 1
    ) {
      id
      tenantId
      conversationKey
      kind
      createdByUserId
      lastMessageId
      lastMessageAt
      createdAt
      updatedAt
    }
  }
`;

const LIST_CHAT_PARTICIPANTS_BY_MEMBERSHIP_QUERY = `
  query ListChatParticipantsByMembership($membershipId: UUID!, $limit: Int!) {
    chatParticipants(
      where: {
        membershipId: { eq: $membershipId }
        deletedAt: { isNull: true }
      }
      orderBy: [{ updatedAt: DESC }]
      limit: $limit
    ) {
      id
      tenantId
      conversationId
      membershipId
      userId
      lastReadMessageId
      lastReadAt
      createdAt
      updatedAt
    }
  }
`;

const LIST_CHAT_PARTICIPANTS_BY_CONVERSATION_QUERY = `
  query ListChatParticipantsByConversation($conversationId: UUID!, $limit: Int!) {
    chatParticipants(
      where: {
        conversationId: { eq: $conversationId }
        deletedAt: { isNull: true }
      }
      orderBy: [{ createdAt: ASC }]
      limit: $limit
    ) {
      id
      tenantId
      conversationId
      membershipId
      userId
      lastReadMessageId
      lastReadAt
      createdAt
      updatedAt
    }
  }
`;

const LIST_CHAT_MESSAGES_BY_CONVERSATION_QUERY = `
  query ListChatMessagesByConversation($conversationId: UUID!, $limit: Int!) {
    chatMessages(
      where: {
        conversationId: { eq: $conversationId }
        deletedAt: { isNull: true }
      }
      orderBy: [{ createdAt: ASC }]
      limit: $limit
    ) {
      id
      conversationId
      senderMembershipId
      senderUserId
      senderIdentityId
      messageKind
      cipherText
      cipherIv
      cipherAlgorithm
      replyToMessageId
      attachmentUrl
      attachmentStoragePath
      attachmentMimeType
      attachmentSizeBytes
      attachmentWidth
      attachmentHeight
      attachmentDurationMs
      createdAt
      updatedAt
    }
  }
`;
const GET_ANY_CHAT_PARTICIPANT_BY_KEY_QUERY = `
  query GetAnyChatParticipantByKey($chatParticipantKey: String!) {
    chatParticipants(
      where: {
        chatParticipantKey: { eq: $chatParticipantKey }
      }
      limit: 1
    ) {
      id
      tenantId
      conversationId
      membershipId
      userId
      lastReadMessageId
      lastReadAt
      createdAt
      updatedAt
      deletedAt
    }
  }
`;
const GET_ANY_CHAT_CONVERSATION_BY_KEY_QUERY = `
  query GetAnyChatConversationByKey($conversationKey: String!) {
    chatConversations(
      where: {
        conversationKey: { eq: $conversationKey }
      }
      limit: 1
    ) {
      id
      tenantId
      conversationKey
      kind
      createdByUserId
      lastMessageId
      lastMessageAt
      createdAt
      updatedAt
      deletedAt
    }
  }
`;

const GET_ANY_CHAT_IDENTITY_BY_USER_QUERY = `
  query GetAnyChatIdentityByUser($tenantId: UUID!, $userId: UUID!) {
    chatIdentities(
      where: {
        tenantId: { eq: $tenantId }
        userId: { eq: $userId }
      }
      orderBy: [{ updatedAt: DESC }]
      limit: 1
    ) {
      id
      tenantId
      userId
      membershipId
      publicKey
      algorithm
      keyVersion
      updatedAt
      deletedAt
    }
  }
`;

const GET_CHAT_MESSAGE_BY_ID_QUERY = `
  query GetChatMessageById($messageId: UUID!) {
    chatMessages(
      where: {
        id: { eq: $messageId }
        deletedAt: { isNull: true }
      }
      limit: 1
    ) {
      id
      tenantId
      conversationId
      senderMembershipId
      senderUserId
      senderIdentityId
      messageKind
      cipherText
      cipherIv
      cipherAlgorithm
      replyToMessageId
      attachmentUrl
      attachmentStoragePath
      attachmentMimeType
      attachmentSizeBytes
      attachmentWidth
      attachmentHeight
      attachmentDurationMs
      createdAt
      updatedAt
    }
  }
`;

const LIST_CHAT_MESSAGE_REACTIONS_BY_CONVERSATION_QUERY = `
  query ListChatMessageReactionsByConversation($conversationId: UUID!, $limit: Int!) {
    chatMessageReactions(
      where: {
        message: { conversationId: { eq: $conversationId } }
        deletedAt: { isNull: true }
      }
      orderBy: [{ createdAt: ASC }]
      limit: $limit
    ) {
      id
      messageId
      membershipId
      emoji
      createdAt
      updatedAt
    }
  }
`;

const GET_CHAT_MESSAGE_REACTION_BY_KEY_QUERY = `
  query GetChatMessageReactionByKey($chatMessageReactionKey: String!) {
    chatMessageReactions(
      where: {
        chatMessageReactionKey: { eq: $chatMessageReactionKey }
        deletedAt: { isNull: true }
      }
      limit: 1
    ) {
      id
      messageId
      membershipId
      emoji
      createdAt
      updatedAt
    }
  }
`;

const CREATE_CHAT_IDENTITY_MUTATION = `
  mutation CreateChatIdentity(
    $id: UUID!
    $chatIdentityKey: String!
    $tenantId: UUID!
    $userId: UUID!
    $membershipId: UUID!
    $publicKey: String!
    $algorithm: String!
    $keyVersion: Int!
  ) {
    chatIdentity_insert(
      data: {
        id: $id
        chatIdentityKey: $chatIdentityKey
        tenantId: $tenantId
        userId: $userId
        membershipId: $membershipId
        publicKey: $publicKey
        algorithm: $algorithm
        keyVersion: $keyVersion
      }
    ) {
      id
    }
  }
`;

const UPDATE_CHAT_IDENTITY_MUTATION = `
  mutation UpdateChatIdentity(
    $id: UUID!
    $membershipId: UUID!
    $publicKey: String!
    $algorithm: String!
    $keyVersion: Int!
  ) {
    chatIdentity_update(
      key: { id: $id }
      data: {
        membershipId: $membershipId
        publicKey: $publicKey
        algorithm: $algorithm
        keyVersion: $keyVersion
        deletedAt: null
        lastPublishedAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const CREATE_CHAT_CONVERSATION_MUTATION = `
  mutation CreateChatConversation(
    $id: UUID!
    $conversationKey: String!
    $tenantId: UUID!
    $createdByUserId: UUID!
  ) {
    chatConversation_insert(
      data: {
        id: $id
        conversationKey: $conversationKey
        tenantId: $tenantId
        createdByUserId: $createdByUserId
      }
    ) {
      id
    }
  }
`;

const CREATE_CHAT_PARTICIPANT_MUTATION = `
  mutation CreateChatParticipant(
    $id: UUID!
    $chatParticipantKey: String!
    $tenantId: UUID!
    $conversationId: UUID!
    $membershipId: UUID!
    $userId: UUID!
  ) {
    chatParticipant_insert(
      data: {
        id: $id
        chatParticipantKey: $chatParticipantKey
        tenantId: $tenantId
        conversationId: $conversationId
        membershipId: $membershipId
        userId: $userId
      }
    ) {
      id
    }
  }
`;
const RESTORE_CHAT_CONVERSATION_MUTATION = `
  mutation RestoreChatConversation($id: UUID!) {
    chatConversation_update(
      key: { id: $id }
      data: {
        deletedAt: null
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const RESTORE_CHAT_PARTICIPANT_MUTATION = `
  mutation RestoreChatParticipant($id: UUID!, $membershipId: UUID!) {
    chatParticipant_update(
      key: { id: $id }
      data: {
        membershipId: $membershipId
        deletedAt: null
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const CREATE_CHAT_MESSAGE_MUTATION = `
  mutation CreateChatMessage(
    $id: UUID!
    $tenantId: UUID!
    $conversationId: UUID!
    $senderMembershipId: UUID!
    $senderUserId: UUID!
    $senderIdentityId: UUID!
    $messageKind: String!
    $cipherText: String!
    $cipherIv: String!
    $cipherAlgorithm: String!
    $replyToMessageId: UUID
    $attachmentUrl: String
    $attachmentStoragePath: String
    $attachmentMimeType: String
    $attachmentSizeBytes: Int64
    $attachmentWidth: Int
    $attachmentHeight: Int
    $attachmentDurationMs: Int
  ) {
    chatMessage_insert(
      data: {
        id: $id
        tenantId: $tenantId
        conversationId: $conversationId
        senderMembershipId: $senderMembershipId
        senderUserId: $senderUserId
        senderIdentityId: $senderIdentityId
        messageKind: $messageKind
        cipherText: $cipherText
        cipherIv: $cipherIv
        cipherAlgorithm: $cipherAlgorithm
        replyToMessageId: $replyToMessageId
        attachmentUrl: $attachmentUrl
        attachmentStoragePath: $attachmentStoragePath
        attachmentMimeType: $attachmentMimeType
        attachmentSizeBytes: $attachmentSizeBytes
        attachmentWidth: $attachmentWidth
        attachmentHeight: $attachmentHeight
        attachmentDurationMs: $attachmentDurationMs
      }
    )
  }
`;

const LIST_EXPIRED_CHAT_MESSAGES_QUERY = `
  query ListExpiredChatMessages($now: Timestamp!, $limit: Int!) {
    chatMessages(
      where: {
        deletedAt: { isNull: true }
        expiresAt: { le: $now }
      }
      orderBy: [{ expiresAt: ASC }]
      limit: $limit
    ) {
      id
      tenantId
      conversationId
      senderUserId
      attachmentStoragePath
    }
  }
`;

const LIST_ACTIVE_CHAT_REACTIONS_BY_TENANT_QUERY = `
  query ListActiveChatReactionsByTenant($tenantId: UUID!, $limit: Int!) {
    chatMessageReactions(
      where: {
        tenantId: { eq: $tenantId }
        deletedAt: { isNull: true }
      }
      orderBy: [{ createdAt: ASC }]
      limit: $limit
    ) {
      id
    }
  }
`;

const LIST_ACTIVE_CHAT_MESSAGES_BY_TENANT_QUERY = `
  query ListActiveChatMessagesByTenant($tenantId: UUID!, $limit: Int!) {
    chatMessages(
      where: {
        tenantId: { eq: $tenantId }
        deletedAt: { isNull: true }
      }
      orderBy: [{ createdAt: ASC }]
      limit: $limit
    ) {
      id
      attachmentStoragePath
    }
  }
`;

const LIST_ACTIVE_CHAT_PARTICIPANTS_BY_TENANT_QUERY = `
  query ListActiveChatParticipantsByTenant($tenantId: UUID!, $limit: Int!) {
    chatParticipants(
      where: {
        tenantId: { eq: $tenantId }
        deletedAt: { isNull: true }
      }
      orderBy: [{ createdAt: ASC }]
      limit: $limit
    ) {
      id
    }
  }
`;

const LIST_ACTIVE_CHAT_CONVERSATIONS_BY_TENANT_QUERY = `
  query ListActiveChatConversationsByTenant($tenantId: UUID!, $limit: Int!) {
    chatConversations(
      where: {
        tenantId: { eq: $tenantId }
        deletedAt: { isNull: true }
      }
      orderBy: [{ createdAt: ASC }]
      limit: $limit
    ) {
      id
    }
  }
`;

const LIST_ACTIVE_CHAT_IDENTITIES_BY_TENANT_QUERY = `
  query ListActiveChatIdentitiesByTenant($tenantId: UUID!, $limit: Int!) {
    chatIdentities(
      where: {
        tenantId: { eq: $tenantId }
        deletedAt: { isNull: true }
      }
      orderBy: [{ createdAt: ASC }]
      limit: $limit
    ) {
      id
      userId
    }
  }
`;

const UPDATE_CHAT_CONVERSATION_LAST_MESSAGE_MUTATION = `
  mutation UpdateChatConversationLastMessage($id: UUID!, $lastMessageId: UUID!) {
    chatConversation_update(
      key: { id: $id }
      data: {
        lastMessageId: $lastMessageId
        lastMessageAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const UPDATE_CHAT_MESSAGE_ENCRYPTION_MUTATION = `
  mutation UpdateChatMessageEncryption(
    $id: UUID!
    $cipherText: String!
    $cipherIv: String!
    $cipherAlgorithm: String!
  ) {
    chatMessage_update(
      key: { id: $id }
      data: {
        cipherText: $cipherText
        cipherIv: $cipherIv
        cipherAlgorithm: $cipherAlgorithm
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const MARK_CHAT_MESSAGE_DELETED_FOR_EVERYONE_MUTATION = `
  mutation MarkChatMessageDeletedForEveryone(
    $id: UUID!
    $messageKind: String!
    $cipherText: String!
    $cipherAlgorithm: String!
  ) {
    chatMessage_update(
      key: { id: $id }
      data: {
        messageKind: $messageKind
        cipherText: $cipherText
        cipherIv: ""
        cipherAlgorithm: $cipherAlgorithm
        replyToMessageId: null
        attachmentUrl: null
        attachmentStoragePath: null
        attachmentMimeType: null
        attachmentSizeBytes: null
        attachmentWidth: null
        attachmentHeight: null
        attachmentDurationMs: null
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const SOFT_DELETE_CHAT_MESSAGE_MUTATION = `
  mutation SoftDeleteChatMessage($id: UUID!) {
    chatMessage_update(
      key: { id: $id }
      data: {
        deletedAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const UPDATE_CHAT_MESSAGE_LIFECYCLE_MUTATION = `
  mutation UpdateChatMessageLifecycle(
    $id: UUID!
    $expiresAt: Timestamp
    $isStarred: Boolean!
    $isSaved: Boolean!
  ) {
    chatMessage_update(
      key: { id: $id }
      data: {
        expiresAt: $expiresAt
        isStarred: $isStarred
        isSaved: $isSaved
        updatedAt_expr: "request.time"
      }
    )
  }
`;

const UPDATE_CHAT_PARTICIPANT_READ_MUTATION = `
  mutation UpdateChatParticipantRead($id: UUID!, $lastReadMessageId: UUID!) {
    chatParticipant_update(
      key: { id: $id }
      data: {
        lastReadMessageId: $lastReadMessageId
        lastReadAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const CREATE_CHAT_MESSAGE_REACTION_MUTATION = `
  mutation CreateChatMessageReaction(
    $id: UUID!
    $chatMessageReactionKey: String!
    $tenantId: UUID!
    $messageId: UUID!
    $membershipId: UUID!
    $emoji: String!
  ) {
    chatMessageReaction_insert(
      data: {
        id: $id
        chatMessageReactionKey: $chatMessageReactionKey
        tenantId: $tenantId
        messageId: $messageId
        membershipId: $membershipId
        emoji: $emoji
      }
    ) {
      id
    }
  }
`;

const UPDATE_CHAT_MESSAGE_REACTION_MUTATION = `
  mutation UpdateChatMessageReaction($id: UUID!, $emoji: String!) {
    chatMessageReaction_update(
      key: { id: $id }
      data: {
        emoji: $emoji
        deletedAt: null
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const SOFT_DELETE_CHAT_MESSAGE_REACTION_MUTATION = `
  mutation SoftDeleteChatMessageReaction($id: UUID!) {
    chatMessageReaction_update(
      key: { id: $id }
      data: {
        deletedAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const UPDATE_CHAT_CONVERSATION_LAST_MESSAGE_CLEAR_MUTATION = `
  mutation ClearChatConversationLastMessage($id: UUID!) {
    chatConversation_update(
      key: { id: $id }
      data: {
        lastMessageId: null
        lastMessageAt: null
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const SOFT_DELETE_CHAT_PARTICIPANT_MUTATION = `
  mutation SoftDeleteChatParticipant($id: UUID!) {
    chatParticipant_update(
      key: { id: $id }
      data: {
        deletedAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const SOFT_DELETE_CHAT_CONVERSATION_MUTATION = `
  mutation SoftDeleteChatConversation($id: UUID!) {
    chatConversation_update(
      key: { id: $id }
      data: {
        lastMessageId: null
        lastMessageAt: null
        deletedAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const SOFT_DELETE_CHAT_IDENTITY_MUTATION = `
  mutation SoftDeleteChatIdentity($id: UUID!) {
    chatIdentity_update(
      key: { id: $id }
      data: {
        deletedAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

function getChatDc() {
  return getFirebaseDataConnect(CHAT_CONNECTOR_CONFIG);
}

function getChatBucket() {
  return getStorage(getFirebaseAdminApp("backend-chat-storage")).bucket();
}

function toIsoString(value) {
  const parsed = new Date(value ?? Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizeTimestamp(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function resolveDurationKey(value, fallbackKey = CHAT_DEFAULT_MESSAGE_TTL_KEY) {
  const durationKey = normalizeString(value) ?? fallbackKey;
  if (!CHAT_MESSAGE_TTL_OPTIONS.has(durationKey)) {
    throw new ChatSecurityError(
      400,
      "INVALID_TTL",
      `Choose a supported expiry timer: ${[...CHAT_MESSAGE_TTL_OPTIONS.keys()].join(", ")}.`
    );
  }

  return durationKey;
}

function assertNoClientExpiryTimestamp(payload) {
  if (Object.prototype.hasOwnProperty.call(payload ?? {}, "expiresAt")) {
    throw new ChatSecurityError(400, "CLIENT_EXPIRY_FORBIDDEN", "Send durationKey instead of a client-side expiresAt timestamp.");
  }
}

function buildExpiryFromDurationKey(durationKey, now = Date.now()) {
  const durationMs = CHAT_MESSAGE_TTL_OPTIONS.get(durationKey);
  return new Date(now + durationMs).toISOString();
}

function resolveMessageExpiry(payload) {
  assertNoClientExpiryTimestamp(payload);
  return buildExpiryFromDurationKey(resolveDurationKey(payload?.durationKey));
}

function resolveLifecycleExpiry(payload, currentMessage) {
  assertNoClientExpiryTimestamp(payload);
  if (!Object.prototype.hasOwnProperty.call(payload ?? {}, "durationKey")) {
    return currentMessage.expiresAt ? toIsoString(currentMessage.expiresAt) : buildExpiryFromDurationKey(CHAT_DEFAULT_MESSAGE_TTL_KEY);
  }

  return buildExpiryFromDurationKey(resolveDurationKey(payload.durationKey, null));
}

function buildChatIdentityKey(tenantId, userId) {
  return `${tenantId}:${userId}`;
}

function buildConversationKey(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join(":");
}

function isDuplicateConversationKeyError(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("chat_conversations_conversationkey_uidx") || message.includes("conversationkey_uidx");
}

function isDuplicateParticipantKeyError(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("chat_participants_chatparticipantkey_uidx") || message.includes("chatparticipantkey_uidx");
}

async function waitForDirectConversation(conversationKey, retries = 6) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const conversation = await getChatConversationByKey(conversationKey);
    if (conversation) {
      return conversation;
    }

    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
    }
  }

  return null;
}

async function waitForConversationAccess(viewer, conversationId, retries = 12) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const access = await resolveConversationAccess(viewer, conversationId);
    if (access) {
      return access;
    }

    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
    }
  }

  return null;
}

async function waitForDirectConversationAccess(viewer, conversationKey, retries = 18) {
  let lastConversation = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const conversation = await getChatConversationByKey(conversationKey);
    if (conversation) {
      lastConversation = conversation;
      const access = await resolveConversationAccess(viewer, conversation.id);
      if (access) {
        return access;
      }
    }

    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
    }
  }

  if (!lastConversation) {
    return null;
  }

  return waitForConversationAccess(viewer, lastConversation.id, 8);
}

function buildChatParticipantKey(conversationId, userId) {
  return `${conversationId}:${userId}`;
}

async function ensureChatParticipantRecord({ tenantId, conversationId, membershipId, userId }) {
  const chatParticipantKey = buildChatParticipantKey(conversationId, userId);

  try {
    await getChatDc().executeGraphql(CREATE_CHAT_PARTICIPANT_MUTATION, {
      operationName: "CreateChatParticipant",
      variables: {
        id: randomUUID(),
        chatParticipantKey,
        tenantId,
        conversationId,
        membershipId,
        userId
      }
    });
  } catch (error) {
    if (!isDuplicateParticipantKeyError(error)) {
      throw error;
    }

    const existing = await getAnyChatParticipantByKey(chatParticipantKey);
    if (!existing?.id) {
      throw error;
    }

    await getChatDc().executeGraphql(RESTORE_CHAT_PARTICIPANT_MUTATION, {
      operationName: "RestoreChatParticipant",
      variables: {
        id: existing.id,
        membershipId
      }
    });
  }
}

async function ensureDirectConversationParticipants(viewer, recipientProfile, conversationId) {
  await Promise.all([
    ensureChatParticipantRecord({
      tenantId: viewer.tenantId,
      conversationId,
      membershipId: viewer.membershipId,
      userId: viewer.userId
    }),
    ensureChatParticipantRecord({
      tenantId: viewer.tenantId,
      conversationId,
      membershipId: recipientProfile.membershipId,
      userId: recipientProfile.userId
    })
  ]);
}

function buildChatMessageReactionKey(messageId, membershipId) {
  return `${messageId}:${membershipId}`;
}

function buildChatKeyBackupStoragePath(tenantId, userId) {
  return `chat/${tenantId}/users/${userId}/e2ee-key-backup.json`;
}

function buildChatHiddenMessageStoragePath(tenantId, userId) {
  return `chat/${tenantId}/users/${userId}/hidden-messages.json`;
}

function buildChatKeyBackupPinAttemptStoragePath(tenantId, userId) {
  return `chat/${tenantId}/users/${userId}/e2ee-pin-attempts.json`;
}

function buildEncryptedAttachmentDownloadUrl(bucketName, storagePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function parseChatAttachmentStoragePath(storagePath) {
  const normalized = normalizeString(storagePath);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(CHAT_ATTACHMENT_STORAGE_PATH_PATTERN);
  if (!match) {
    return null;
  }

  return {
    storagePath: normalized,
    tenantId: match[1],
    userId: match[2],
    assetId: match[3]
  };
}

async function runInBatches(items, batchSize, handler) {
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    await Promise.all(batch.map((item) => handler(item)));
  }
}

function assertVerifiedChatAttachmentPath(storagePath, { tenantId, userId } = {}) {
  const parsed = parseChatAttachmentStoragePath(storagePath);
  if (!parsed) {
    throw new ChatSecurityError(400, "INVALID_ATTACHMENT_PATH", "Chat attachment storage path is not server-issued.");
  }

  if (tenantId && parsed.tenantId !== tenantId) {
    throw new ChatSecurityError(403, "ATTACHMENT_TENANT_MISMATCH", "This attachment does not belong to your campus.");
  }

  if (userId && parsed.userId !== userId) {
    throw new ChatSecurityError(403, "ATTACHMENT_OWNER_MISMATCH", "This attachment does not belong to your account.");
  }

  return parsed;
}

function normalizeDimension(value) {
  return Number.isFinite(Number(value)) ? Math.max(1, Math.round(Number(value))) : null;
}

function normalizeDurationMs(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : null;
}

async function verifyAttachmentOwnership(viewer, attachment, messageKind) {
  if (!attachment) {
    if (messageKind === "image") {
      throw new ChatSecurityError(400, "MEDIA_ATTACHMENT_REQUIRED", "Media chat messages require a verified encrypted attachment.");
    }

    return null;
  }

  if (messageKind !== "image") {
    throw new ChatSecurityError(400, "ATTACHMENT_KIND_MISMATCH", "Only media chat messages can include encrypted attachments.");
  }

  const storagePath = normalizeString(attachment.storagePath);
  const parsed = assertVerifiedChatAttachmentPath(storagePath, {
    tenantId: viewer.tenantId,
    userId: viewer.userId
  });
  const file = getChatBucket().file(parsed.storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new ChatSecurityError(404, "ATTACHMENT_NOT_FOUND", "Upload the encrypted attachment before sending the message.");
  }

  const [metadata] = await file.getMetadata();
  const customMetadata = metadata?.metadata ?? {};
  if (customMetadata.purpose && customMetadata.purpose !== "chat_attachment_v1") {
    throw new ChatSecurityError(403, "ATTACHMENT_PURPOSE_MISMATCH", "This storage object is not a chat attachment.");
  }

  if (customMetadata.ownerTenantId && customMetadata.ownerTenantId !== viewer.tenantId) {
    throw new ChatSecurityError(403, "ATTACHMENT_TENANT_MISMATCH", "This attachment does not belong to your campus.");
  }

  if (customMetadata.ownerUserId && customMetadata.ownerUserId !== viewer.userId) {
    throw new ChatSecurityError(403, "ATTACHMENT_OWNER_MISMATCH", "This attachment does not belong to your account.");
  }

  if (customMetadata.assetId && customMetadata.assetId !== parsed.assetId) {
    throw new ChatSecurityError(403, "ATTACHMENT_ASSET_MISMATCH", "This attachment metadata does not match its storage path.");
  }

  const token = normalizeString(customMetadata.firebaseStorageDownloadTokens)?.split(",")[0]?.trim();
  const mimeType = normalizeString(customMetadata.originalMimeType) ?? normalizeString(attachment.mimeType);
  if (!token || !mimeType || !SUPPORTED_CHAT_ATTACHMENT_MIME_TYPES.has(mimeType)) {
    throw new ChatSecurityError(400, "INVALID_ATTACHMENT_METADATA", "Encrypted attachment metadata is incomplete.");
  }

  const kind = VIDEO_MIME_TYPES.has(mimeType) ? "video" : AUDIO_MIME_TYPES.has(mimeType) ? "audio" : "image";

  return {
    kind,
    url: buildEncryptedAttachmentDownloadUrl(getChatBucket().name, parsed.storagePath, token),
    storagePath: parsed.storagePath,
    mimeType,
    sizeBytes: Number(metadata.size ?? attachment.sizeBytes ?? 0),
    width: normalizeDimension(attachment.width),
    height: normalizeDimension(attachment.height),
    durationMs: normalizeDurationMs(customMetadata.originalDurationMs || attachment.durationMs),
    viewOnce: customMetadata.viewOnce === "true"
  };
}

function canJanitorDeleteAttachment(message) {
  try {
    assertVerifiedChatAttachmentPath(message.attachmentStoragePath, {
      tenantId: message.tenantId,
      userId: message.senderUserId
    });
    return true;
  } catch {
    return false;
  }
}

function normalizeEmoji(value) {
  const emoji = normalizeString(value);
  return emoji && CHAT_ALLOWED_REACTION_EMOJIS.has(emoji) ? emoji : null;
}

function normalizeHiddenMessageState(payload) {
  if (!payload || typeof payload !== "object") {
    return {
      hiddenMessageIds: [],
      updatedAt: new Date().toISOString()
    };
  }

  const hiddenMessageIds = Array.isArray(payload.hiddenMessageIds)
    ? [...new Set(payload.hiddenMessageIds.map((value) => normalizeString(value)).filter(Boolean))].slice(-CHAT_HIDDEN_MESSAGE_LIMIT)
    : [];

  return {
    hiddenMessageIds,
    updatedAt: toIsoString(payload.updatedAt)
  };
}

function normalizeChatKeyBackupPinAttemptState(payload) {
  const now = Date.now();
  const attempts = Number.isFinite(Number(payload?.attempts)) ? Math.max(0, Math.round(Number(payload.attempts))) : 0;
  const lockedUntil = payload?.lockedUntil ? toIsoString(payload.lockedUntil) : null;
  const isLocked = Boolean(lockedUntil && new Date(lockedUntil).getTime() > now);

  return {
    attempts: isLocked ? attempts : 0,
    lockedUntil: isLocked ? lockedUntil : null,
    updatedAt: toIsoString(payload?.updatedAt),
    maxAttempts: CHAT_KEY_BACKUP_PIN_MAX_ATTEMPTS,
    remainingAttempts: isLocked ? 0 : Math.max(0, CHAT_KEY_BACKUP_PIN_MAX_ATTEMPTS - attempts),
    isLocked
  };
}

function normalizeChatKeyBackup(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const version = Number.isInteger(payload.version) && payload.version > 0 ? payload.version : 1;
  const publicKey = normalizeString(payload.publicKey);
  const algorithm = normalizeString(payload.algorithm) ?? "ECDH-P256";
  const keyVersion = Number.isInteger(payload.keyVersion) && payload.keyVersion > 0 ? payload.keyVersion : 1;
  const wrappingAlgorithm = normalizeString(payload.wrappingAlgorithm) ?? CHAT_KEY_BACKUP_WRAPPING_ALGORITHM;
  const wrappedPrivateKey = normalizeString(payload.wrappedPrivateKey);
  const salt = normalizeString(payload.salt);
  const iv = normalizeString(payload.iv);
  const iterations = Number.isFinite(Number(payload.iterations)) ? Math.max(100000, Math.round(Number(payload.iterations))) : 250000;
  const credentialType =
    payload.credentialType === "pin_and_phrase" || payload.credentialType === "legacy_recovery_code"
      ? payload.credentialType
      : payload.version >= 2
        ? "pin_and_phrase"
        : "legacy_recovery_code";

  if (!publicKey || !wrappedPrivateKey || !salt || !iv) {
    return null;
  }

  return {
    version,
    publicKey,
    algorithm,
    keyVersion,
    wrappingAlgorithm,
    wrappedPrivateKey,
    salt,
    iv,
    iterations,
    updatedAt: toIsoString(payload.updatedAt),
    credentialType,
    pinWrappedPrivateKey: normalizeString(payload.pinWrappedPrivateKey),
    pinSalt: normalizeString(payload.pinSalt),
    pinIv: normalizeString(payload.pinIv),
    pinIterations: Number.isFinite(Number(payload.pinIterations)) ? Math.max(100000, Math.round(Number(payload.pinIterations))) : null,
    recoveryWrappedPrivateKey: normalizeString(payload.recoveryWrappedPrivateKey),
    recoverySalt: normalizeString(payload.recoverySalt),
    recoveryIv: normalizeString(payload.recoveryIv),
    recoveryIterations: Number.isFinite(Number(payload.recoveryIterations))
      ? Math.max(100000, Math.round(Number(payload.recoveryIterations)))
      : null,
    pinWrappedRecoveryPhrase: normalizeString(payload.pinWrappedRecoveryPhrase),
    pinRecoveryPhraseIv: normalizeString(payload.pinRecoveryPhraseIv)
  };
}

function mapChatIdentity(item) {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    userId: item.userId,
    membershipId: item.membershipId,
    publicKey: item.publicKey,
    algorithm: item.algorithm,
    keyVersion: Number(item.keyVersion ?? 1),
    updatedAt: toIsoString(item.updatedAt),
    deletedAt: item.deletedAt ? toIsoString(item.deletedAt) : null
  };
}

function mapChatMessage(item, reactionsByMessageId = new Map()) {
  if (!item) {
    return null;
  }

  const isDeletedForEveryone = item.cipherAlgorithm === CHAT_DELETED_MESSAGE_ALGORITHM;
  const createdAt = toIsoString(item.createdAt);
  const fallbackExpiresAt = buildExpiryFromDurationKey(CHAT_DEFAULT_MESSAGE_TTL_KEY, new Date(createdAt).getTime());

  return {
    id: item.id,
    conversationId: item.conversationId,
    senderUserId: item.senderUserId,
    senderMembershipId: item.senderMembershipId,
    senderIdentityId: item.senderIdentityId,
    messageKind:
      item.messageKind === "image" ||
      item.messageKind === "vibe_card" ||
      item.messageKind === "event_card" ||
      item.messageKind === "deal_card" ||
      item.messageKind === "profile_card" ||
      item.messageKind === "game_invite_card" ||
      item.messageKind === "system"
        ? item.messageKind
        : "text",
    cipherText: item.cipherText,
    cipherIv: item.cipherIv,
    cipherAlgorithm: item.cipherAlgorithm,
    replyToMessageId: item.replyToMessageId ?? null,
    attachment:
      !isDeletedForEveryone && item.attachmentUrl && item.attachmentMimeType
        ? {
            kind: item.attachmentMimeType.startsWith("video/")
              ? "video"
              : item.attachmentMimeType.startsWith("audio/")
                ? "audio"
                : "image",
            url: item.attachmentUrl,
            storagePath: item.attachmentStoragePath ?? null,
            mimeType: item.attachmentMimeType,
            sizeBytes: Number(item.attachmentSizeBytes ?? 0),
            width: item.attachmentWidth ?? null,
            height: item.attachmentHeight ?? null,
            durationMs: item.attachmentDurationMs ?? null
          }
        : null,
    createdAt,
    expiresAt: item.expiresAt ? toIsoString(item.expiresAt) : fallbackExpiresAt,
    isStarred: normalizeBoolean(item.isStarred),
    isSaved: normalizeBoolean(item.isSaved),
    reactions: isDeletedForEveryone ? [] : reactionsByMessageId.get(item.id) ?? []
  };
}

async function readStoredAttachmentViewOnceFlag(storagePath) {
  const normalizedPath = normalizeString(storagePath);
  if (!normalizedPath) {
    return false;
  }

  try {
    const [metadata] = await getChatBucket().file(normalizedPath).getMetadata();
    return metadata?.metadata?.viewOnce === "true";
  } catch {
    return false;
  }
}

async function hydrateChatMessage(item, reactionsByMessageId = new Map()) {
  const mapped = mapChatMessage(item, reactionsByMessageId);
  if (!mapped?.attachment) {
    return mapped;
  }

  return {
    ...mapped,
    attachment: {
      ...mapped.attachment,
      viewOnce: await readStoredAttachmentViewOnceFlag(mapped.attachment.storagePath)
    }
  };
}

function buildPeerSummary(profile, identity, presence = null) {
  const presenceSnapshot = presence ?? {};

  if (!profile) {
    return {
      userId: "",
      membershipId: "",
      username: "vyb_user",
      displayName: "Vyb Student",
      course: null,
      stream: null,
      avatarUrl: null,
      publicKey: identity,
      isOnline: Boolean(presenceSnapshot.isOnline),
      lastActiveAt: presenceSnapshot.lastActiveAt ?? null,
      activePath: presenceSnapshot.activePath ?? null
    };
  }

  return {
    userId: profile.userId,
    membershipId: profile.membershipId,
    username: profile.username,
    displayName: profile.fullName,
    course: profile.course ?? null,
    stream: profile.stream ?? null,
    avatarUrl: null,
    publicKey: identity,
    isOnline: Boolean(presenceSnapshot.isOnline),
    lastActiveAt: presenceSnapshot.lastActiveAt ?? null,
    activePath: presenceSnapshot.activePath ?? null
  };
}

function buildViewerSummary(viewer, identity) {
  return {
    userId: viewer.userId,
    membershipId: viewer.membershipId,
    activeIdentity: identity
  };
}

async function getChatIdentityByUser({ tenantId, userId }) {
  const response = await getChatDc().executeGraphqlRead(GET_CHAT_IDENTITY_BY_USER_QUERY, {
    operationName: "GetChatIdentityByUser",
    variables: {
      tenantId,
      userId
    }
  });

  return mapChatIdentity(response.data.chatIdentities?.[0] ?? null);
}

async function getAnyChatIdentityByUser({ tenantId, userId }) {
  const response = await getChatDc().executeGraphqlRead(GET_ANY_CHAT_IDENTITY_BY_USER_QUERY, {
    operationName: "GetAnyChatIdentityByUser",
    variables: {
      tenantId,
      userId
    }
  });

  return mapChatIdentity(response.data.chatIdentities?.[0] ?? null);
}

async function getChatConversationById(conversationId) {
  const response = await getChatDc().executeGraphqlRead(GET_CHAT_CONVERSATION_BY_ID_QUERY, {
    operationName: "GetChatConversationById",
    variables: {
      conversationId
    }
  });

  return response.data.chatConversations?.[0] ?? null;
}

async function getChatConversationByKey(conversationKey) {
  const response = await getChatDc().executeGraphqlRead(GET_CHAT_CONVERSATION_BY_KEY_QUERY, {
    operationName: "GetChatConversationByKey",
    variables: {
      conversationKey
    }
  });

  return response.data.chatConversations?.[0] ?? null;
}

async function getAnyChatConversationByKey(conversationKey) {
  const response = await getChatDc().executeGraphqlRead(GET_ANY_CHAT_CONVERSATION_BY_KEY_QUERY, {
    operationName: "GetAnyChatConversationByKey",
    variables: {
      conversationKey
    }
  });

  return response.data.chatConversations?.[0] ?? null;
}

async function listChatParticipantsByMembership(membershipId) {
  const response = await getChatDc().executeGraphqlRead(LIST_CHAT_PARTICIPANTS_BY_MEMBERSHIP_QUERY, {
    operationName: "ListChatParticipantsByMembership",
    variables: {
      membershipId,
      limit: CHAT_INBOX_LIMIT
    }
  });

  return Array.isArray(response.data.chatParticipants) ? response.data.chatParticipants : [];
}

async function listChatParticipantsByConversation(conversationId) {
  const response = await getChatDc().executeGraphqlRead(LIST_CHAT_PARTICIPANTS_BY_CONVERSATION_QUERY, {
    operationName: "ListChatParticipantsByConversation",
    variables: {
      conversationId,
      limit: 8
    }
  });

  return Array.isArray(response.data.chatParticipants) ? response.data.chatParticipants : [];
}

async function getChatMessageById(messageId) {
  if (!messageId) {
    return null;
  }

  const response = await getChatDc().executeGraphqlRead(GET_CHAT_MESSAGE_BY_ID_QUERY, {
    operationName: "GetChatMessageById",
    variables: {
      messageId
    }
  });

  return response.data.chatMessages?.[0] ?? null;
}

async function listChatMessagesByConversation(conversationId) {
  const response = await getChatDc().executeGraphqlRead(LIST_CHAT_MESSAGES_BY_CONVERSATION_QUERY, {
    operationName: "ListChatMessagesByConversation",
    variables: {
      conversationId,
      limit: CHAT_MESSAGE_LIMIT
    }
  });

  return Array.isArray(response.data.chatMessages) ? response.data.chatMessages : [];
}

async function listChatMessageReactionsByConversation(conversationId) {
  const response = await getChatDc().executeGraphqlRead(LIST_CHAT_MESSAGE_REACTIONS_BY_CONVERSATION_QUERY, {
    operationName: "ListChatMessageReactionsByConversation",
    variables: {
      conversationId,
      limit: CHAT_MESSAGE_LIMIT * 8
    }
  });

  return Array.isArray(response.data.chatMessageReactions) ? response.data.chatMessageReactions : [];
}

async function listExpiredChatMessages(limit = CHAT_MESSAGE_LIMIT * 10) {
  const response = await getChatDc().executeGraphqlRead(LIST_EXPIRED_CHAT_MESSAGES_QUERY, {
    operationName: "ListExpiredChatMessages",
    variables: {
      now: new Date().toISOString(),
      limit
    }
  });

  return Array.isArray(response.data.chatMessages) ? response.data.chatMessages : [];
}

async function listActiveChatReactionsByTenant(tenantId, limit = CHAT_MESSAGE_LIMIT * 10) {
  const response = await getChatDc().executeGraphqlRead(LIST_ACTIVE_CHAT_REACTIONS_BY_TENANT_QUERY, {
    operationName: "ListActiveChatReactionsByTenant",
    variables: {
      tenantId,
      limit
    }
  });

  return Array.isArray(response.data.chatMessageReactions) ? response.data.chatMessageReactions : [];
}

async function listActiveChatMessagesByTenant(tenantId, limit = CHAT_MESSAGE_LIMIT * 10) {
  const response = await getChatDc().executeGraphqlRead(LIST_ACTIVE_CHAT_MESSAGES_BY_TENANT_QUERY, {
    operationName: "ListActiveChatMessagesByTenant",
    variables: {
      tenantId,
      limit
    }
  });

  return Array.isArray(response.data.chatMessages) ? response.data.chatMessages : [];
}

async function listActiveChatParticipantsByTenant(tenantId, limit = CHAT_MESSAGE_LIMIT * 10) {
  const response = await getChatDc().executeGraphqlRead(LIST_ACTIVE_CHAT_PARTICIPANTS_BY_TENANT_QUERY, {
    operationName: "ListActiveChatParticipantsByTenant",
    variables: {
      tenantId,
      limit
    }
  });

  return Array.isArray(response.data.chatParticipants) ? response.data.chatParticipants : [];
}

async function getAnyChatParticipantByKey(chatParticipantKey) {
  const response = await getChatDc().executeGraphqlRead(GET_ANY_CHAT_PARTICIPANT_BY_KEY_QUERY, {
    operationName: "GetAnyChatParticipantByKey",
    variables: {
      chatParticipantKey
    }
  });

  return response.data.chatParticipants?.[0] ?? null;
}

async function listActiveChatConversationsByTenant(tenantId, limit = CHAT_MESSAGE_LIMIT * 10) {
  const response = await getChatDc().executeGraphqlRead(LIST_ACTIVE_CHAT_CONVERSATIONS_BY_TENANT_QUERY, {
    operationName: "ListActiveChatConversationsByTenant",
    variables: {
      tenantId,
      limit
    }
  });

  return Array.isArray(response.data.chatConversations) ? response.data.chatConversations : [];
}

async function listActiveChatIdentitiesByTenant(tenantId, limit = CHAT_MESSAGE_LIMIT * 10) {
  const response = await getChatDc().executeGraphqlRead(LIST_ACTIVE_CHAT_IDENTITIES_BY_TENANT_QUERY, {
    operationName: "ListActiveChatIdentitiesByTenant",
    variables: {
      tenantId,
      limit
    }
  });

  return Array.isArray(response.data.chatIdentities) ? response.data.chatIdentities : [];
}

function buildReactionsMap(items) {
  const reactionsByMessageId = new Map();

  for (const item of items) {
    const current = reactionsByMessageId.get(item.messageId) ?? [];
    current.push({
      membershipId: item.membershipId,
      emoji: item.emoji,
      createdAt: toIsoString(item.createdAt)
    });
    reactionsByMessageId.set(item.messageId, current);
  }

  return reactionsByMessageId;
}

function isChatMessageExpired(message, now = Date.now()) {
  if (!message?.expiresAt) {
    return false;
  }

  return new Date(message.expiresAt).getTime() <= now;
}

async function buildConversationPreview(viewer, conversation, viewerParticipant, peerParticipant, hiddenMessageIds = new Set()) {
  const [peerProfile, peerIdentity, lastMessageRaw, peerPresence] = await Promise.all([
    getProfileByUserId({
      tenantId: viewer.tenantId,
      userId: peerParticipant.userId
    }),
    getChatIdentityByUser({
      tenantId: viewer.tenantId,
      userId: peerParticipant.userId
    }),
    getLastVisibleMessageRaw(conversation.id, hiddenMessageIds),
    Promise.resolve(
      getChatPresenceSnapshot({
        tenantId: viewer.tenantId,
        userId: peerParticipant.userId
      })
    )
  ]);

  const lastMessage = await hydrateChatMessage(lastMessageRaw);
  const lastMessageAt = lastMessage?.createdAt ?? toIsoString(conversation.updatedAt);
  const viewerLastReadAt = viewerParticipant.lastReadAt ? new Date(viewerParticipant.lastReadAt).getTime() : 0;
  const messageTimestamp = lastMessage?.createdAt ? new Date(lastMessage.createdAt).getTime() : 0;
  const unreadCount =
    lastMessage &&
    lastMessage.cipherAlgorithm !== CHAT_DELETED_MESSAGE_ALGORITHM &&
    lastMessage.senderUserId !== viewer.userId &&
    messageTimestamp > viewerLastReadAt
      ? 1
      : 0;

  return {
    id: conversation.id,
    tenantId: conversation.tenantId,
    kind: "direct",
    peer: buildPeerSummary(peerProfile, peerIdentity, peerPresence),
    lastMessage,
    lastActivityAt: lastMessageAt,
    unreadCount
  };
}

async function resolveConversationAccess(viewer, conversationId) {
  const [conversation, participants] = await Promise.all([
    getChatConversationById(conversationId),
    listChatParticipantsByConversation(conversationId)
  ]);

  if (!conversation || conversation.tenantId !== viewer.tenantId) {
    return null;
  }

  const viewerParticipant = participants.find((item) => item.membershipId === viewer.membershipId) ?? null;
  const peerParticipant = participants.find((item) => item.userId !== viewer.userId) ?? null;

  if (!viewerParticipant || !peerParticipant) {
    return null;
  }

  return {
    conversation,
    viewerParticipant,
    peerParticipant,
    participants
  };
}

export async function canAccessChatConversation(viewer, conversationId) {
  return Boolean(await resolveConversationAccess(viewer, conversationId));
}

export async function upsertChatIdentity(viewer, payload) {
  const publicKey = normalizeString(payload.publicKey);
  const algorithm = normalizeString(payload.algorithm) ?? "ECDH-P256";
  const keyVersion = Number.isInteger(payload.keyVersion) && payload.keyVersion > 0 ? payload.keyVersion : 1;

  if (!publicKey) {
    throw new ChatSecurityError(400, "INVALID_PUBLIC_KEY", "A public key is required to set up secure chat.");
  }

  const existing = await getAnyChatIdentityByUser({
    tenantId: viewer.tenantId,
    userId: viewer.userId
  });

  if (existing) {
    if (!existing.deletedAt && existing.publicKey !== publicKey) {
      throw new ChatSecurityError(
        409,
        "CHAT_KEY_ALREADY_EXISTS",
        "This account already has an encrypted chat key. Restore the original private key on this device instead of creating a new one."
      );
    }

    await getChatDc().executeGraphql(UPDATE_CHAT_IDENTITY_MUTATION, {
      operationName: "UpdateChatIdentity",
      variables: {
        id: existing.id,
        membershipId: viewer.membershipId,
        publicKey,
        algorithm,
        keyVersion
      }
    });
  } else {
    await getChatDc().executeGraphql(CREATE_CHAT_IDENTITY_MUTATION, {
      operationName: "CreateChatIdentity",
      variables: {
        id: randomUUID(),
        chatIdentityKey: buildChatIdentityKey(viewer.tenantId, viewer.userId),
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        membershipId: viewer.membershipId,
        publicKey,
        algorithm,
        keyVersion
      }
    });
  }

  return {
    identity: await getChatIdentityByUser({
      tenantId: viewer.tenantId,
      userId: viewer.userId
    })
  };
}

export async function getChatKeyBackup(viewer) {
  const storagePath = buildChatKeyBackupStoragePath(viewer.tenantId, viewer.userId);
  const file = getChatBucket().file(storagePath);
  const [exists] = await file.exists();

  if (!exists) {
    return {
      backup: null
    };
  }

  const [buffer] = await file.download();
  const raw = JSON.parse(buffer.toString("utf8"));
  const backup = normalizeChatKeyBackup(raw);

  return {
    backup
  };
}

export async function upsertChatKeyBackup(viewer, payload) {
  const backup = normalizeChatKeyBackup(payload);
  if (!backup) {
    throw new ChatSecurityError(400, "INVALID_KEY_BACKUP", "Encrypted key backup payload is incomplete.");
  }

  const viewerIdentity = await getChatIdentityByUser({
    tenantId: viewer.tenantId,
    userId: viewer.userId
  });
  if (!viewerIdentity) {
    throw new ChatSecurityError(409, "CHAT_KEY_REQUIRED", "Set up end-to-end encrypted chat before backing up keys.");
  }

  if (backup.publicKey !== viewerIdentity.publicKey) {
    throw new ChatSecurityError(409, "BACKUP_IDENTITY_MISMATCH", "Encrypted key backup does not match your active E2EE identity.");
  }

  const storagePath = buildChatKeyBackupStoragePath(viewer.tenantId, viewer.userId);
  await getChatBucket().file(storagePath).save(Buffer.from(JSON.stringify(backup), "utf8"), {
    resumable: false,
    metadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: "private, max-age=0, no-cache"
    }
  });

  return {
    backup
  };
}

async function getChatKeyBackupPinAttemptStateFile(viewer) {
  const storagePath = buildChatKeyBackupPinAttemptStoragePath(viewer.tenantId, viewer.userId);
  const file = getChatBucket().file(storagePath);
  const [exists] = await file.exists();

  if (!exists) {
    return normalizeChatKeyBackupPinAttemptState(null);
  }

  try {
    const [buffer] = await file.download();
    return normalizeChatKeyBackupPinAttemptState(JSON.parse(buffer.toString("utf8")));
  } catch {
    return normalizeChatKeyBackupPinAttemptState(null);
  }
}

async function saveChatKeyBackupPinAttemptState(viewer, state) {
  const nextState = normalizeChatKeyBackupPinAttemptState(state);
  const storagePath = buildChatKeyBackupPinAttemptStoragePath(viewer.tenantId, viewer.userId);
  await getChatBucket().file(storagePath).save(Buffer.from(JSON.stringify(nextState), "utf8"), {
    resumable: false,
    metadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: "private, max-age=0, no-cache"
    }
  });

  return nextState;
}

export async function getChatKeyBackupPinAttemptState(viewer) {
  return {
    attemptState: await getChatKeyBackupPinAttemptStateFile(viewer)
  };
}

export async function recordFailedChatKeyBackupPinAttempt(viewer) {
  const current = await getChatKeyBackupPinAttemptStateFile(viewer);
  const now = new Date();
  if (current.isLocked && current.lockedUntil) {
    return {
      attemptState: current
    };
  }

  const attempts = current.attempts + 1;
  const lockedUntil = attempts >= CHAT_KEY_BACKUP_PIN_MAX_ATTEMPTS
    ? new Date(now.getTime() + CHAT_KEY_BACKUP_PIN_LOCKOUT_MS).toISOString()
    : null;

  return {
    attemptState: await saveChatKeyBackupPinAttemptState(viewer, {
      attempts,
      lockedUntil,
      updatedAt: now.toISOString()
    })
  };
}

export async function clearChatKeyBackupPinAttemptState(viewer) {
  const storagePath = buildChatKeyBackupPinAttemptStoragePath(viewer.tenantId, viewer.userId);
  await getChatBucket().file(storagePath).delete({ ignoreNotFound: true });
  return {
    attemptState: normalizeChatKeyBackupPinAttemptState(null)
  };
}

async function getHiddenChatMessageState(viewer) {
  const storagePath = buildChatHiddenMessageStoragePath(viewer.tenantId, viewer.userId);
  const file = getChatBucket().file(storagePath);
  const [exists] = await file.exists();

  if (!exists) {
    return normalizeHiddenMessageState(null);
  }

  try {
    const [buffer] = await file.download();
    return normalizeHiddenMessageState(JSON.parse(buffer.toString("utf8")));
  } catch {
    return normalizeHiddenMessageState(null);
  }
}

async function saveHiddenChatMessageState(viewer, state) {
  const nextState = normalizeHiddenMessageState(state);
  const storagePath = buildChatHiddenMessageStoragePath(viewer.tenantId, viewer.userId);
  await getChatBucket().file(storagePath).save(Buffer.from(JSON.stringify(nextState), "utf8"), {
    resumable: false,
    metadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: "private, max-age=0, no-cache"
    }
  });

  return nextState;
}

function applyViewerHiddenMessageFilter(rawMessages, hiddenMessageIds) {
  return rawMessages.filter((message) => !hiddenMessageIds?.has(message.id) && !isChatMessageExpired(message));
}

async function getLastVisibleMessageRaw(conversationId, hiddenMessageIds) {
  const rawMessages = await listChatMessagesByConversation(conversationId);
  const visibleMessages = applyViewerHiddenMessageFilter(rawMessages, hiddenMessageIds);
  return visibleMessages[visibleMessages.length - 1] ?? null;
}

async function syncConversationLastMessage(conversationId) {
  const lastVisibleMessage = await getLastVisibleMessageRaw(conversationId, new Set());

  if (!lastVisibleMessage) {
    await getChatDc().executeGraphql(UPDATE_CHAT_CONVERSATION_LAST_MESSAGE_CLEAR_MUTATION, {
      operationName: "ClearChatConversationLastMessage",
      variables: {
        id: conversationId
      }
    });
    return null;
  }

  await getChatDc().executeGraphql(UPDATE_CHAT_CONVERSATION_LAST_MESSAGE_MUTATION, {
    operationName: "UpdateChatConversationLastMessage",
    variables: {
      id: conversationId,
      lastMessageId: lastVisibleMessage.id
    }
  });

  return lastVisibleMessage;
}

export async function listChatInbox(viewer) {
  const [viewerIdentity, viewerParticipants, hiddenState] = await Promise.all([
    getChatIdentityByUser({
      tenantId: viewer.tenantId,
      userId: viewer.userId
    }),
    listChatParticipantsByMembership(viewer.membershipId),
    getHiddenChatMessageState(viewer)
  ]);
  const hiddenMessageIds = new Set(hiddenState.hiddenMessageIds);

  const previewResults = await Promise.allSettled(
    viewerParticipants.map(async (viewerParticipant) => {
      const access = await resolveConversationAccess(viewer, viewerParticipant.conversationId);
      if (!access) {
        return null;
      }

      return buildConversationPreview(viewer, access.conversation, access.viewerParticipant, access.peerParticipant, hiddenMessageIds);
    })
  );
  const previews = previewResults.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value ? [result.value] : [];
    }

    console.warn("[chat] inbox_preview_skipped", {
      tenantId: viewer.tenantId,
      userId: viewer.userId,
      conversationId: viewerParticipants[index]?.conversationId ?? null,
      message: result.reason instanceof Error ? result.reason.message : "Unknown inbox preview failure"
    });
    return [];
  });

  return {
    viewer: buildViewerSummary(viewer, viewerIdentity),
    items: previews.sort((left, right) => new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime())
  };
}

export async function createOrGetDirectConversation(viewer, input) {
  const recipientUsername = normalizeString(input.recipientUsername)?.replace(/^@+/u, "");
  const recipientProfile =
    normalizeString(input.recipientUserId)
      ? await getProfileByUserId({
          tenantId: viewer.tenantId,
          userId: input.recipientUserId
        })
      : recipientUsername
        ? await getProfileByUsername({
            tenantId: viewer.tenantId,
            username: recipientUsername
          })
        : null;

  if (!recipientProfile) {
    throw new ChatSecurityError(404, "RECIPIENT_NOT_FOUND", "We could not find that campus profile.");
  }

  if (recipientProfile.userId === viewer.userId) {
    throw new ChatSecurityError(400, "SELF_CHAT_NOT_ALLOWED", "You cannot open a direct chat with yourself.");
  }

  const conversationKey = buildConversationKey(viewer.userId, recipientProfile.userId);
  let conversation = await waitForDirectConversation(conversationKey, 2);
  const anyConversation = conversation ?? (await getAnyChatConversationByKey(conversationKey));
  let created = false;

  if (!conversation && anyConversation?.id) {
    await getChatDc().executeGraphql(RESTORE_CHAT_CONVERSATION_MUTATION, {
      operationName: "RestoreChatConversation",
      variables: {
        id: anyConversation.id
      }
    });
    conversation = (await getChatConversationById(anyConversation.id)) ?? anyConversation;
  }

  if (!conversation) {
    const conversationId = randomUUID();
    try {
      await getChatDc().executeGraphql(CREATE_CHAT_CONVERSATION_MUTATION, {
        operationName: "CreateChatConversation",
        variables: {
          id: conversationId,
          conversationKey,
          tenantId: viewer.tenantId,
          createdByUserId: viewer.userId
        }
      });

      await ensureDirectConversationParticipants(viewer, recipientProfile, conversationId);

      conversation = await getChatConversationById(conversationId);
      created = true;
    } catch (error) {
      if (!isDuplicateConversationKeyError(error)) {
        throw error;
      }

      const duplicateConversation =
        (await waitForDirectConversation(conversationKey, 6)) ??
        (await getAnyChatConversationByKey(conversationKey));
      if (!duplicateConversation) {
        throw new ChatSecurityError(
          409,
          "CHAT_CREATE_CONFLICT",
          "This chat was created in another request. Please try opening it again."
        );
      }

      if (duplicateConversation.deletedAt) {
        await getChatDc().executeGraphql(RESTORE_CHAT_CONVERSATION_MUTATION, {
          operationName: "RestoreChatConversation",
          variables: {
            id: duplicateConversation.id
          }
        });
        conversation = (await getChatConversationById(duplicateConversation.id)) ?? duplicateConversation;
      } else {
        conversation = duplicateConversation;
      }
    }
  }

  if (conversation) {
    await ensureDirectConversationParticipants(viewer, recipientProfile, conversation.id);
  }

  const access = conversation ? await waitForConversationAccess(viewer, conversation.id, created ? 8 : 8) : null;
  const [peerIdentity, viewerIdentity] = await Promise.all([
    getChatIdentityByUser({
      tenantId: viewer.tenantId,
      userId: recipientProfile.userId
    }),
    getChatIdentityByUser({
      tenantId: viewer.tenantId,
      userId: viewer.userId
    })
  ]);

  if (!conversation) {
    throw new Error("We could not open this conversation right now.");
  }

  if (!access) {
    return {
      created,
      conversation: {
        id: conversation.id,
        tenantId: conversation.tenantId,
        kind: "direct",
        peer: buildPeerSummary(recipientProfile, peerIdentity),
        messages: [],
        lastReadMessageId: null,
        lastReadAt: null,
        peerLastReadMessageId: null,
        peerLastReadAt: null
      },
      viewerIdentity
    };
  }

  return {
    created,
    conversation: {
      id: access.conversation.id,
      tenantId: access.conversation.tenantId,
      kind: "direct",
      peer: buildPeerSummary(recipientProfile, peerIdentity),
      messages: [],
      lastReadMessageId: access.viewerParticipant.lastReadMessageId ?? null,
      lastReadAt: access.viewerParticipant.lastReadAt ? toIsoString(access.viewerParticipant.lastReadAt) : null,
      peerLastReadMessageId: access.peerParticipant.lastReadMessageId ?? null,
      peerLastReadAt: access.peerParticipant.lastReadAt ? toIsoString(access.peerParticipant.lastReadAt) : null
    },
    viewerIdentity
  };
}

export async function getChatConversation(viewer, conversationId) {
  const access = await resolveConversationAccess(viewer, conversationId);
  if (!access) {
    return null;
  }

  const [viewerIdentity, peerProfile, peerIdentity, rawMessages, rawReactions, hiddenState, peerPresence] = await Promise.all([
    getChatIdentityByUser({
      tenantId: viewer.tenantId,
      userId: viewer.userId
    }),
    getProfileByUserId({
      tenantId: viewer.tenantId,
      userId: access.peerParticipant.userId
    }),
    getChatIdentityByUser({
      tenantId: viewer.tenantId,
      userId: access.peerParticipant.userId
    }),
    listChatMessagesByConversation(conversationId),
    listChatMessageReactionsByConversation(conversationId),
    getHiddenChatMessageState(viewer),
    Promise.resolve(
      getChatPresenceSnapshot({
        tenantId: viewer.tenantId,
        userId: access.peerParticipant.userId
      })
    )
  ]);

  const reactionsByMessageId = buildReactionsMap(rawReactions);
  const hiddenMessageIds = new Set(hiddenState.hiddenMessageIds);
  const visibleMessages = applyViewerHiddenMessageFilter(rawMessages, hiddenMessageIds);
  const hydratedMessages = (await Promise.all(
    visibleMessages.map((item) => hydrateChatMessage(item, reactionsByMessageId))
  )).filter(Boolean);

  return {
    viewer: buildViewerSummary(viewer, viewerIdentity),
    conversation: {
      id: access.conversation.id,
      tenantId: access.conversation.tenantId,
      kind: "direct",
      peer: buildPeerSummary(peerProfile, peerIdentity, peerPresence),
      messages: hydratedMessages,
      lastReadMessageId: access.viewerParticipant.lastReadMessageId ?? null,
      lastReadAt: access.viewerParticipant.lastReadAt ? toIsoString(access.viewerParticipant.lastReadAt) : null,
      peerLastReadMessageId: access.peerParticipant.lastReadMessageId ?? null,
      peerLastReadAt: access.peerParticipant.lastReadAt ? toIsoString(access.peerParticipant.lastReadAt) : null
    }
  };
}

export async function sendChatMessage(viewer, conversationId, payload) {
  const access = await resolveConversationAccess(viewer, conversationId);
  if (!access) {
    throw new Error("We could not find that conversation.");
  }

  const viewerIdentity = await getChatIdentityByUser({
    tenantId: viewer.tenantId,
    userId: viewer.userId
  });

  if (!viewerIdentity) {
    throw new Error("Set up secure chat before sending a message.");
  }

  const messageKind =
    payload.messageKind === "image" ||
    payload.messageKind === "vibe_card" ||
    payload.messageKind === "event_card" ||
    payload.messageKind === "deal_card" ||
    payload.messageKind === "profile_card" ||
    payload.messageKind === "game_invite_card" ||
    payload.messageKind === "system"
      ? payload.messageKind
      : "text";
  const cipherText = normalizeString(payload.cipherText);
  const cipherIv = normalizeString(payload.cipherIv);
  const cipherAlgorithm = normalizeString(payload.cipherAlgorithm) ?? END_TO_END_CHAT_ALGORITHM;
  const replyToMessageId = normalizeString(payload.replyToMessageId) ?? null;

  if (!cipherText || !cipherIv) {
    throw new Error("Message payload is incomplete.");
  }

  if (replyToMessageId) {
    const replyTarget = await getChatMessageById(replyToMessageId);
    if (!replyTarget || replyTarget.conversationId !== conversationId) {
      throw new Error("You can only reply to a message from this chat.");
    }
  }

  const messageId = randomUUID();
  const attachment = await verifyAttachmentOwnership(
    viewer,
    payload.attachment && typeof payload.attachment === "object" ? payload.attachment : null,
    messageKind
  );

  await getChatDc().executeGraphql(CREATE_CHAT_MESSAGE_MUTATION, {
    operationName: "CreateChatMessage",
    variables: {
      id: messageId,
      tenantId: viewer.tenantId,
      conversationId,
      senderMembershipId: viewer.membershipId,
      senderUserId: viewer.userId,
      senderIdentityId: viewerIdentity.id,
      messageKind,
      cipherText,
      cipherIv,
      cipherAlgorithm,
      replyToMessageId,
      attachmentUrl: attachment?.url ?? null,
      attachmentStoragePath: attachment?.storagePath ?? null,
      attachmentMimeType: attachment?.mimeType ?? null,
      attachmentSizeBytes: attachment?.sizeBytes ?? null,
      attachmentWidth: attachment?.width ?? null,
      attachmentHeight: attachment?.height ?? null,
      attachmentDurationMs: attachment?.durationMs ?? null
    }
  });

  await getChatDc().executeGraphql(UPDATE_CHAT_CONVERSATION_LAST_MESSAGE_MUTATION, {
    operationName: "UpdateChatConversationLastMessage",
    variables: {
      id: conversationId,
      lastMessageId: messageId
    }
  });

  const storedMessageRaw = await getChatMessageById(messageId);
  const storedMessage = await hydrateChatMessage(storedMessageRaw);
  const preview = await buildConversationPreview(viewer, await getChatConversationById(conversationId), access.viewerParticipant, access.peerParticipant);

  await trackActivity({
    tenantId: viewer.tenantId,
    membershipId: viewer.membershipId,
    activityType: "chat_message_sent",
    entityType: "chat_message",
    entityId: messageId,
    metadata: {
      conversationId,
      messageKind
    },
    auditAction: "chat_message_sent"
  });

  emitChatRealtimeEvent({
    conversationId,
    type: "chat.message",
    payload: {
      messageId,
      conversationId,
      senderUserId: viewer.userId,
      senderMembershipId: viewer.membershipId,
      createdAt: storedMessage.createdAt,
      item: storedMessage
    }
  });

  return {
    item: storedMessage,
    conversationPreview: preview
  };
}

export async function migrateChatConversationEncryption(viewer, conversationId, payload) {
  const access = await resolveConversationAccess(viewer, conversationId);
  if (!access) {
    throw new Error("We could not find that conversation.");
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length === 0) {
    throw new Error("Choose at least one message to upgrade.");
  }

  const rawMessages = await listChatMessagesByConversation(conversationId);
  const messagesById = new Map(rawMessages.map((message) => [message.id, message]));

  const updates = items.map((item) => {
    const messageId = normalizeString(item?.messageId);
    const cipherText = normalizeString(item?.cipherText);
    const cipherIv = normalizeString(item?.cipherIv);
    const cipherAlgorithm = normalizeString(item?.cipherAlgorithm) ?? END_TO_END_CHAT_ALGORITHM;
    const source = messageId ? messagesById.get(messageId) ?? null : null;

    if (!messageId || !cipherText || !cipherIv || !source) {
      throw new Error("One of the encryption updates is incomplete.");
    }

    return {
      id: messageId,
      cipherText,
      cipherIv,
      cipherAlgorithm
    };
  });

  await Promise.all(
    updates.map((item) =>
      getChatDc().executeGraphql(UPDATE_CHAT_MESSAGE_ENCRYPTION_MUTATION, {
        operationName: "UpdateChatMessageEncryption",
        variables: item
      })
    )
  );

  const [refreshedMessages, refreshedReactions] = await Promise.all([
    listChatMessagesByConversation(conversationId),
    listChatMessageReactionsByConversation(conversationId)
  ]);
  const reactionsByMessageId = buildReactionsMap(refreshedReactions);
  const updatedItems = refreshedMessages
    .filter((message) => updates.some((update) => update.id === message.id))
    .map((message) => mapChatMessage(message, reactionsByMessageId))
    .filter(Boolean);

  emitChatRealtimeEvent({
    conversationId,
    type: "chat.sync",
    payload: {
      conversationId,
      count: updatedItems.length
    }
  });

  return {
    items: updatedItems
  };
}

export async function markChatConversationRead(viewer, conversationId, messageId) {
  const access = await resolveConversationAccess(viewer, conversationId);
  if (!access) {
    throw new Error("We could not find that conversation.");
  }

  const message = await getChatMessageById(messageId);
  if (!message || message.conversationId !== conversationId) {
    throw new Error("We could not mark that message as read.");
  }

  await getChatDc().executeGraphql(UPDATE_CHAT_PARTICIPANT_READ_MUTATION, {
    operationName: "UpdateChatParticipantRead",
    variables: {
      id: access.viewerParticipant.id,
      lastReadMessageId: messageId
    }
  });

  const readAt = new Date().toISOString();

  emitChatRealtimeEvent({
    conversationId,
    type: "chat.read",
    payload: {
      conversationId,
      userId: viewer.userId,
      membershipId: viewer.membershipId,
      messageId,
      readAt
    }
  });

  return {
    conversationId,
    messageId,
    readAt
  };
}

export async function reactToChatMessage(viewer, messageId, emoji) {
  const normalizedEmoji = normalizeEmoji(emoji);
  if (!normalizedEmoji) {
    throw new Error("Choose a supported reaction.");
  }

  const message = await getChatMessageById(messageId);
  if (!message || message.tenantId !== viewer.tenantId) {
    throw new Error("We could not find that message.");
  }

  const access = await resolveConversationAccess(viewer, message.conversationId);
  if (!access) {
    throw new Error("You can only react inside your own conversations.");
  }

  if (message.cipherAlgorithm === CHAT_DELETED_MESSAGE_ALGORITHM) {
    throw new Error("Deleted messages cannot receive reactions.");
  }

  const reactionKey = buildChatMessageReactionKey(messageId, viewer.membershipId);
  const existingResponse = await getChatDc().executeGraphqlRead(GET_CHAT_MESSAGE_REACTION_BY_KEY_QUERY, {
    operationName: "GetChatMessageReactionByKey",
    variables: {
      chatMessageReactionKey: reactionKey
    }
  });
  const existing = existingResponse.data.chatMessageReactions?.[0] ?? null;

  if (!existing) {
    await getChatDc().executeGraphql(CREATE_CHAT_MESSAGE_REACTION_MUTATION, {
      operationName: "CreateChatMessageReaction",
      variables: {
        id: randomUUID(),
        chatMessageReactionKey: reactionKey,
        tenantId: viewer.tenantId,
        messageId,
        membershipId: viewer.membershipId,
        emoji: normalizedEmoji
      }
    });
  } else if (existing.emoji === normalizedEmoji) {
    await getChatDc().executeGraphql(SOFT_DELETE_CHAT_MESSAGE_REACTION_MUTATION, {
      operationName: "SoftDeleteChatMessageReaction",
      variables: {
        id: existing.id
      }
    });
  } else {
    await getChatDc().executeGraphql(UPDATE_CHAT_MESSAGE_REACTION_MUTATION, {
      operationName: "UpdateChatMessageReaction",
      variables: {
        id: existing.id,
        emoji: normalizedEmoji
      }
    });
  }

  const aggregate = buildReactionsMap(await listChatMessageReactionsByConversation(message.conversationId)).get(messageId) ?? [];

  emitChatRealtimeEvent({
    conversationId: message.conversationId,
    type: "chat.sync",
    payload: {
      conversationId: message.conversationId,
      messageId
    }
  });

  return {
    messageId,
    membershipId: viewer.membershipId,
    emoji: aggregate.find((item) => item.membershipId === viewer.membershipId)?.emoji ?? null,
    aggregate
  };
}

export async function deleteChatMessage(viewer, messageId, scope) {
  const message = await getChatMessageById(messageId);
  if (!message || message.tenantId !== viewer.tenantId) {
    throw new Error("We could not find that message.");
  }

  const access = await resolveConversationAccess(viewer, message.conversationId);
  if (!access) {
    throw new Error("You can only delete messages from your own conversations.");
  }

  const deletedAt = new Date().toISOString();
  const isOwner = message.senderMembershipId === viewer.membershipId;
  let updatedMessage = null;

  if (scope === "everyone") {
    if (!isOwner) {
      throw new Error("Only the sender can delete this message for everyone.");
    }

    if (message.cipherAlgorithm === CHAT_DELETED_MESSAGE_ALGORITHM) {
      updatedMessage = mapChatMessage(message);
    } else {
      const messageAgeMs = Date.now() - new Date(message.createdAt).getTime();
      if (messageAgeMs > CHAT_DELETE_FOR_EVERYONE_WINDOW_MS) {
        throw new Error("Delete for everyone is only available for 30 minutes after sending.");
      }

      await getChatDc().executeGraphql(MARK_CHAT_MESSAGE_DELETED_FOR_EVERYONE_MUTATION, {
        operationName: "MarkChatMessageDeletedForEveryone",
        variables: {
          id: messageId,
          messageKind: "text",
          cipherText: CHAT_DELETED_MESSAGE_MARKER,
          cipherAlgorithm: CHAT_DELETED_MESSAGE_ALGORITHM
        }
      });

      updatedMessage = mapChatMessage(await getChatMessageById(messageId));
    }
  } else {
    const hiddenState = await getHiddenChatMessageState(viewer);
    const nextHiddenIds = [...new Set([...hiddenState.hiddenMessageIds, messageId])].slice(-CHAT_HIDDEN_MESSAGE_LIMIT);
    await saveHiddenChatMessageState(viewer, {
      hiddenMessageIds: nextHiddenIds,
      updatedAt: deletedAt
    });
  }

  const hiddenState = await getHiddenChatMessageState(viewer);
  const preview = await buildConversationPreview(
    viewer,
    access.conversation,
    access.viewerParticipant,
    access.peerParticipant,
    new Set(hiddenState.hiddenMessageIds)
  );

  emitChatRealtimeEvent({
    conversationId: message.conversationId,
    type: "chat.sync",
    payload: {
      conversationId: message.conversationId,
      messageId,
      scope
    }
  });

  return {
    conversationId: message.conversationId,
    messageId,
    scope,
    deletedAt,
    item: updatedMessage,
    conversationPreview: preview
  };
}

export async function updateChatMessageLifecycle(viewer, messageId, payload) {
  const message = await getChatMessageById(messageId);
  if (!message || message.tenantId !== viewer.tenantId) {
    throw new Error("We could not find that message.");
  }

  const access = await resolveConversationAccess(viewer, message.conversationId);
  if (!access) {
    throw new Error("You can only update messages inside your own conversations.");
  }

  if (message.cipherAlgorithm === CHAT_DELETED_MESSAGE_ALGORITHM) {
    throw new Error("Deleted messages cannot be starred or rescheduled.");
  }

  if (payload?.consumeViewOnce) {
    const hydratedMessage = await hydrateChatMessage(message);
    if (!hydratedMessage?.attachment?.viewOnce) {
      throw new ChatSecurityError(400, "VIEW_ONCE_NOT_ENABLED", "This message is not marked as view once.");
    }

    if (message.senderMembershipId === viewer.membershipId) {
      const hiddenState = await getHiddenChatMessageState(viewer);
      const preview = await buildConversationPreview(
        viewer,
        access.conversation,
        access.viewerParticipant,
        access.peerParticipant,
        new Set(hiddenState.hiddenMessageIds)
      );

      return {
        item: hydratedMessage,
        conversationPreview: preview
      };
    }

    await getChatDc().executeGraphql(SOFT_DELETE_CHAT_MESSAGE_MUTATION, {
      operationName: "SoftDeleteChatMessage",
      variables: {
        id: messageId
      }
    });
    await syncConversationLastMessage(message.conversationId);

    const hiddenState = await getHiddenChatMessageState(viewer);
    const preview = await buildConversationPreview(
      viewer,
      access.conversation,
      access.viewerParticipant,
      access.peerParticipant,
      new Set(hiddenState.hiddenMessageIds)
    );

    emitChatRealtimeEvent({
      conversationId: message.conversationId,
      type: "chat.sync",
      payload: {
        conversationId: message.conversationId,
        messageId,
        reason: "view_once_consumed"
      }
    });

    return {
      item: null,
      conversationPreview: preview
    };
  }

  if (Object.prototype.hasOwnProperty.call(payload ?? {}, "durationKey") && message.senderMembershipId !== viewer.membershipId) {
    throw new ChatSecurityError(403, "TTL_OWNER_REQUIRED", "Only the sender can change a message expiry timer.");
  }

  const expiresAt = resolveLifecycleExpiry(payload, message);
  const isStarred =
    typeof payload?.isStarred === "boolean" ? payload.isStarred : normalizeBoolean(message.isStarred);
  const isSaved =
    typeof payload?.isSaved === "boolean" ? payload.isSaved : normalizeBoolean(message.isSaved);

  await getChatDc().executeGraphql(UPDATE_CHAT_MESSAGE_LIFECYCLE_MUTATION, {
    operationName: "UpdateChatMessageLifecycle",
    variables: {
      id: messageId,
      expiresAt,
      isStarred,
      isSaved
    }
  });

  const [updatedMessageRaw, rawReactions] = await Promise.all([
    getChatMessageById(messageId),
    listChatMessageReactionsByConversation(message.conversationId)
  ]);
  const reactionsByMessageId = buildReactionsMap(rawReactions);
  const updatedMessage = await hydrateChatMessage(updatedMessageRaw, reactionsByMessageId);
  if (!updatedMessage) {
    throw new Error("We could not reload that message after updating it.");
  }
  const hiddenState = await getHiddenChatMessageState(viewer);
  const preview = await buildConversationPreview(
    viewer,
    access.conversation,
    access.viewerParticipant,
    access.peerParticipant,
    new Set(hiddenState.hiddenMessageIds)
  );

  emitChatRealtimeEvent({
    conversationId: message.conversationId,
    type: "chat.sync",
    payload: {
      conversationId: message.conversationId,
      messageId,
      lifecycle: {
        expiresAt,
        isStarred,
        isSaved
      }
    }
  });

  return {
    item: updatedMessage,
    conversationPreview: preview
  };
}

export async function clearExpiredChatMessages() {
  const expiredMessages = await listExpiredChatMessages();
  if (expiredMessages.length === 0) {
    return {
      deletedCount: 0,
      storageDeletedCount: 0,
      affectedConversationIds: []
    };
  }

  const affectedConversationIds = new Set();
  let storageDeletedCount = 0;

  await Promise.all(
    expiredMessages.map(async (message) => {
      if (message.attachmentStoragePath && canJanitorDeleteAttachment(message)) {
        await getChatBucket()
          .file(message.attachmentStoragePath)
          .delete({ ignoreNotFound: true });
        storageDeletedCount += 1;
      }

      await getChatDc().executeGraphql(SOFT_DELETE_CHAT_MESSAGE_MUTATION, {
        operationName: "SoftDeleteChatMessage",
        variables: {
          id: message.id
        }
      });

      affectedConversationIds.add(message.conversationId);
    })
  );

  await Promise.all([...affectedConversationIds].map((conversationId) => syncConversationLastMessage(conversationId)));

  for (const conversationId of affectedConversationIds) {
    emitChatRealtimeEvent({
      conversationId,
      type: "chat.sync",
      payload: {
        conversationId,
        reason: "expired_messages_deleted",
        deletedCount: expiredMessages.filter((message) => message.conversationId === conversationId).length
      }
    });
  }

  return {
    deletedCount: expiredMessages.length,
    storageDeletedCount,
    affectedConversationIds: [...affectedConversationIds]
  };
}

export async function resetTenantChatData(tenantId) {
  const normalizedTenantId = normalizeString(tenantId);
  if (!normalizedTenantId) {
    throw new Error("A tenant id is required to reset chat data.");
  }

  const [reactions, messages, participants, conversations, identities] = await Promise.all([
    listActiveChatReactionsByTenant(normalizedTenantId),
    listActiveChatMessagesByTenant(normalizedTenantId),
    listActiveChatParticipantsByTenant(normalizedTenantId),
    listActiveChatConversationsByTenant(normalizedTenantId),
    listActiveChatIdentitiesByTenant(normalizedTenantId)
  ]);

  const storagePaths = Array.from(
    new Set(
      [
        ...messages
          .map((message) => normalizeString(message.attachmentStoragePath))
          .filter(Boolean)
          .filter((storagePath) => parseChatAttachmentStoragePath(storagePath)?.tenantId === normalizedTenantId),
        ...identities.flatMap((identity) => {
          const userId = normalizeString(identity.userId);
          if (!userId) {
            return [];
          }

          return [
            buildChatKeyBackupStoragePath(normalizedTenantId, userId),
            buildChatKeyBackupPinAttemptStoragePath(normalizedTenantId, userId),
            buildChatHiddenMessageStoragePath(normalizedTenantId, userId)
          ];
        })
      ]
    )
  );

  await runInBatches(storagePaths, 20, async (storagePath) => {
    await getChatBucket().file(storagePath).delete({ ignoreNotFound: true });
  });

  await runInBatches(reactions, 50, async (reaction) => {
    await getChatDc().executeGraphql(SOFT_DELETE_CHAT_MESSAGE_REACTION_MUTATION, {
      operationName: "SoftDeleteChatMessageReaction",
      variables: {
        id: reaction.id
      }
    });
  });

  await runInBatches(messages, 50, async (message) => {
    await getChatDc().executeGraphql(SOFT_DELETE_CHAT_MESSAGE_MUTATION, {
      operationName: "SoftDeleteChatMessage",
      variables: {
        id: message.id
      }
    });
  });

  await runInBatches(participants, 50, async (participant) => {
    await getChatDc().executeGraphql(SOFT_DELETE_CHAT_PARTICIPANT_MUTATION, {
      operationName: "SoftDeleteChatParticipant",
      variables: {
        id: participant.id
      }
    });
  });

  await runInBatches(conversations, 50, async (conversation) => {
    await getChatDc().executeGraphql(SOFT_DELETE_CHAT_CONVERSATION_MUTATION, {
      operationName: "SoftDeleteChatConversation",
      variables: {
        id: conversation.id
      }
    });
  });

  await runInBatches(identities, 50, async (identity) => {
    await getChatDc().executeGraphql(SOFT_DELETE_CHAT_IDENTITY_MUTATION, {
      operationName: "SoftDeleteChatIdentity",
      variables: {
        id: identity.id
      }
    });
  });

  return {
    tenantId: normalizedTenantId,
    deletedReactionCount: reactions.length,
    deletedMessageCount: messages.length,
    deletedParticipantCount: participants.length,
    deletedConversationCount: conversations.length,
    deletedIdentityCount: identities.length,
    storageDeletedCount: storagePaths.length
  };
}

export async function uploadEncryptedChatAttachment(viewer, payload) {
  const fileName = normalizeString(payload.fileName) ?? "chat-attachment.bin";
  const mimeType = normalizeString(payload.mimeType);
  const width = Number.isFinite(Number(payload.width)) ? Math.max(1, Math.round(Number(payload.width))) : null;
  const height = Number.isFinite(Number(payload.height)) ? Math.max(1, Math.round(Number(payload.height))) : null;
  const durationMs = normalizeDurationMs(payload.durationMs);
  const viewOnce = payload?.viewOnce === true;

  if (!mimeType || !SUPPORTED_CHAT_ATTACHMENT_MIME_TYPES.has(mimeType)) {
    throw new Error("Only image and video attachments are supported right now.");
  }

  if (typeof payload.base64Data !== "string" || !payload.base64Data.trim()) {
    throw new Error("Encrypted attachment bytes are missing.");
  }

  const buffer = Buffer.from(payload.base64Data, "base64");
  const isVideoAttachment = VIDEO_MIME_TYPES.has(mimeType);
  const isAudioAttachment = AUDIO_MIME_TYPES.has(mimeType);
  const byteLimit = isVideoAttachment
    ? MAX_ENCRYPTED_CHAT_VIDEO_BYTES
    : isAudioAttachment
      ? MAX_ENCRYPTED_CHAT_AUDIO_BYTES
      : MAX_ENCRYPTED_CHAT_IMAGE_BYTES;
  if (buffer.byteLength <= 0 || buffer.byteLength > byteLimit) {
    throw new Error(
      isVideoAttachment
        ? "Encrypted video attachment must stay under 32 MB."
        : isAudioAttachment
          ? "Encrypted audio attachment must stay under 16 MB."
          : "Encrypted image attachment must stay under 12 MB."
    );
  }

  const assetId = randomUUID();
  const token = randomUUID();
  const storagePath = `chat/${viewer.tenantId}/users/${viewer.userId}/${assetId}.bin`;

  await getChatBucket().file(storagePath).save(buffer, {
    resumable: false,
    metadata: {
      contentType: "application/octet-stream",
      cacheControl: "private, max-age=31536000, immutable",
      metadata: {
        firebaseStorageDownloadTokens: token,
        purpose: "chat_attachment_v1",
        ownerTenantId: viewer.tenantId,
        ownerUserId: viewer.userId,
        assetId,
        originalMimeType: mimeType,
        originalFileName: fileName,
        ...(viewOnce ? { viewOnce: "true" } : {}),
        ...(durationMs != null ? { originalDurationMs: String(durationMs) } : {})
      }
    }
  });

  return {
    attachment: {
      kind: isVideoAttachment ? "video" : isAudioAttachment ? "audio" : "image",
      url: buildEncryptedAttachmentDownloadUrl(getChatBucket().name, storagePath, token),
      storagePath,
      mimeType,
      sizeBytes: buffer.byteLength,
      width,
      height,
      durationMs,
      viewOnce
    }
  };
}
