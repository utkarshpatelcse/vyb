import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp, getFirebaseDataConnect } from "../../../../../packages/config/src/index.mjs";
import { getProfileByUserId, getProfileByUsername } from "../identity/profile-repository.mjs";
import { trackActivity } from "../moderation/repository.mjs";
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
const MAX_ENCRYPTED_CHAT_IMAGE_BYTES = 12 * 1024 * 1024;

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
    ) {
      id
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

function buildChatIdentityKey(tenantId, userId) {
  return `${tenantId}:${userId}`;
}

function buildConversationKey(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join(":");
}

function buildChatParticipantKey(conversationId, userId) {
  return `${conversationId}:${userId}`;
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

function buildEncryptedAttachmentDownloadUrl(bucketName, storagePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
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
    updatedAt: toIsoString(payload.updatedAt)
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
    updatedAt: toIsoString(item.updatedAt)
  };
}

function mapChatMessage(item, reactionsByMessageId = new Map()) {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    conversationId: item.conversationId,
    senderUserId: item.senderUserId,
    senderMembershipId: item.senderMembershipId,
    senderIdentityId: item.senderIdentityId,
    messageKind: item.messageKind === "image" || item.messageKind === "vibe_card" || item.messageKind === "deal_card" || item.messageKind === "system" ? item.messageKind : "text",
    cipherText: item.cipherText,
    cipherIv: item.cipherIv,
    cipherAlgorithm: item.cipherAlgorithm,
    replyToMessageId: item.replyToMessageId ?? null,
    attachment:
      item.attachmentUrl && item.attachmentMimeType
        ? {
            kind: "image",
            url: item.attachmentUrl,
            storagePath: item.attachmentStoragePath ?? null,
            mimeType: item.attachmentMimeType,
            sizeBytes: Number(item.attachmentSizeBytes ?? 0),
            width: item.attachmentWidth ?? null,
            height: item.attachmentHeight ?? null
          }
        : null,
    createdAt: toIsoString(item.createdAt),
    reactions: reactionsByMessageId.get(item.id) ?? []
  };
}

function buildPeerSummary(profile, identity) {
  if (!profile) {
    return {
      userId: "",
      membershipId: "",
      username: "vyb_user",
      displayName: "Vyb Student",
      course: null,
      stream: null,
      avatarUrl: null,
      publicKey: identity
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
    publicKey: identity
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

async function buildConversationPreview(viewer, conversation, viewerParticipant, peerParticipant, hiddenMessageIds = new Set()) {
  const [peerProfile, peerIdentity, lastMessageRaw] = await Promise.all([
    getProfileByUserId({
      tenantId: viewer.tenantId,
      userId: peerParticipant.userId
    }),
    getChatIdentityByUser({
      tenantId: viewer.tenantId,
      userId: peerParticipant.userId
    }),
    getLastVisibleMessageRaw(conversation.id, hiddenMessageIds)
  ]);

  const lastMessage = mapChatMessage(lastMessageRaw);
  const lastMessageAt = lastMessage?.createdAt ?? toIsoString(conversation.updatedAt);
  const viewerLastReadAt = viewerParticipant.lastReadAt ? new Date(viewerParticipant.lastReadAt).getTime() : 0;
  const messageTimestamp = lastMessage?.createdAt ? new Date(lastMessage.createdAt).getTime() : 0;
  const unreadCount = lastMessage && lastMessage.senderUserId !== viewer.userId && messageTimestamp > viewerLastReadAt ? 1 : 0;

  return {
    id: conversation.id,
    tenantId: conversation.tenantId,
    kind: "direct",
    peer: buildPeerSummary(peerProfile, peerIdentity),
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
    throw new Error("A public key is required to set up secure chat.");
  }

  const existing = await getChatIdentityByUser({
    tenantId: viewer.tenantId,
    userId: viewer.userId
  });

  if (existing) {
    if (existing.publicKey !== publicKey) {
      throw new Error("This account already has an encrypted chat key. Restore the original private key on this device instead of creating a new one.");
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
    throw new Error("Encrypted key backup payload is incomplete.");
  }

  const viewerIdentity = await getChatIdentityByUser({
    tenantId: viewer.tenantId,
    userId: viewer.userId
  });
  if (!viewerIdentity) {
    throw new Error("Set up end-to-end encrypted chat before backing up keys.");
  }

  if (backup.publicKey !== viewerIdentity.publicKey) {
    throw new Error("Encrypted key backup does not match your active E2EE identity.");
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
  if (!hiddenMessageIds?.size) {
    return rawMessages;
  }

  return rawMessages.filter((message) => !hiddenMessageIds.has(message.id));
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

  const previews = await Promise.all(
    viewerParticipants.map(async (viewerParticipant) => {
      const access = await resolveConversationAccess(viewer, viewerParticipant.conversationId);
      if (!access) {
        return null;
      }

      return buildConversationPreview(viewer, access.conversation, access.viewerParticipant, access.peerParticipant, hiddenMessageIds);
    })
  );

  return {
    viewer: buildViewerSummary(viewer, viewerIdentity),
    items: previews.filter(Boolean).sort((left, right) => new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime())
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
    throw new Error("We could not find that campus profile.");
  }

  if (recipientProfile.userId === viewer.userId) {
    throw new Error("You cannot open a direct chat with yourself.");
  }

  const conversationKey = buildConversationKey(viewer.userId, recipientProfile.userId);
  let conversation = await getChatConversationByKey(conversationKey);
  let created = false;

  if (!conversation) {
    const conversationId = randomUUID();
    await getChatDc().executeGraphql(CREATE_CHAT_CONVERSATION_MUTATION, {
      operationName: "CreateChatConversation",
      variables: {
        id: conversationId,
        conversationKey,
        tenantId: viewer.tenantId,
        createdByUserId: viewer.userId
      }
    });

    await Promise.all([
      getChatDc().executeGraphql(CREATE_CHAT_PARTICIPANT_MUTATION, {
        operationName: "CreateChatParticipant",
        variables: {
          id: randomUUID(),
          chatParticipantKey: buildChatParticipantKey(conversationId, viewer.userId),
          tenantId: viewer.tenantId,
          conversationId,
          membershipId: viewer.membershipId,
          userId: viewer.userId
        }
      }),
      getChatDc().executeGraphql(CREATE_CHAT_PARTICIPANT_MUTATION, {
        operationName: "CreateChatParticipant",
        variables: {
          id: randomUUID(),
          chatParticipantKey: buildChatParticipantKey(conversationId, recipientProfile.userId),
          tenantId: viewer.tenantId,
          conversationId,
          membershipId: recipientProfile.membershipId,
          userId: recipientProfile.userId
        }
      })
    ]);

    conversation = await getChatConversationById(conversationId);
    created = true;
  }

  const access = await resolveConversationAccess(viewer, conversation.id);
  if (!access) {
    throw new Error("We could not open this conversation right now.");
  }

  const [peerProfile, peerIdentity, viewerIdentity] = await Promise.all([
    getProfileByUserId({
      tenantId: viewer.tenantId,
      userId: access.peerParticipant.userId
    }),
    getChatIdentityByUser({
      tenantId: viewer.tenantId,
      userId: access.peerParticipant.userId
    }),
    getChatIdentityByUser({
      tenantId: viewer.tenantId,
      userId: viewer.userId
    })
  ]);

  return {
    created,
    conversation: {
      id: access.conversation.id,
      tenantId: access.conversation.tenantId,
      kind: "direct",
      peer: buildPeerSummary(peerProfile, peerIdentity),
      messages: [],
      lastReadMessageId: access.viewerParticipant.lastReadMessageId ?? null,
      lastReadAt: access.viewerParticipant.lastReadAt ? toIsoString(access.viewerParticipant.lastReadAt) : null
    },
    viewerIdentity
  };
}

export async function getChatConversation(viewer, conversationId) {
  const access = await resolveConversationAccess(viewer, conversationId);
  if (!access) {
    return null;
  }

  const [viewerIdentity, peerProfile, peerIdentity, rawMessages, rawReactions, hiddenState] = await Promise.all([
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
    getHiddenChatMessageState(viewer)
  ]);

  const reactionsByMessageId = buildReactionsMap(rawReactions);
  const hiddenMessageIds = new Set(hiddenState.hiddenMessageIds);
  const visibleMessages = applyViewerHiddenMessageFilter(rawMessages, hiddenMessageIds);

  return {
    viewer: buildViewerSummary(viewer, viewerIdentity),
    conversation: {
      id: access.conversation.id,
      tenantId: access.conversation.tenantId,
      kind: "direct",
      peer: buildPeerSummary(peerProfile, peerIdentity),
      messages: visibleMessages.map((item) => mapChatMessage(item, reactionsByMessageId)).filter(Boolean),
      lastReadMessageId: access.viewerParticipant.lastReadMessageId ?? null,
      lastReadAt: access.viewerParticipant.lastReadAt ? toIsoString(access.viewerParticipant.lastReadAt) : null
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
    payload.messageKind === "image" || payload.messageKind === "vibe_card" || payload.messageKind === "deal_card" || payload.messageKind === "system"
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
  const attachment = payload.attachment && typeof payload.attachment === "object" ? payload.attachment : null;

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
      attachmentDurationMs: null
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
  const storedMessage = mapChatMessage(storedMessageRaw);
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
      createdAt: storedMessage.createdAt
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

  if (scope === "everyone") {
    if (!isOwner) {
      throw new Error("Only the sender can delete this message for everyone.");
    }

    const messageAgeMs = Date.now() - new Date(message.createdAt).getTime();
    if (messageAgeMs > CHAT_DELETE_FOR_EVERYONE_WINDOW_MS) {
      throw new Error("Delete for everyone is only available for 30 minutes after sending.");
    }

    await getChatDc().executeGraphql(SOFT_DELETE_CHAT_MESSAGE_MUTATION, {
      operationName: "SoftDeleteChatMessage",
      variables: {
        id: messageId
      }
    });

    await syncConversationLastMessage(message.conversationId);
  } else {
    const hiddenState = await getHiddenChatMessageState(viewer);
    const nextHiddenIds = [...new Set([...hiddenState.hiddenMessageIds, messageId])].slice(-CHAT_HIDDEN_MESSAGE_LIMIT);
    await saveHiddenChatMessageState(viewer, {
      hiddenMessageIds: nextHiddenIds,
      updatedAt: deletedAt
    });
  }

  const preview = await buildConversationPreview(viewer, access.conversation, access.viewerParticipant, access.peerParticipant, new Set(
    (await getHiddenChatMessageState(viewer)).hiddenMessageIds
  ));

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
    conversationPreview: preview
  };
}

export async function uploadEncryptedChatAttachment(viewer, payload) {
  const fileName = normalizeString(payload.fileName) ?? "chat-attachment.bin";
  const mimeType = normalizeString(payload.mimeType);
  const width = Number.isFinite(Number(payload.width)) ? Math.max(1, Math.round(Number(payload.width))) : null;
  const height = Number.isFinite(Number(payload.height)) ? Math.max(1, Math.round(Number(payload.height))) : null;

  if (!mimeType || !IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("Only image attachments are supported right now.");
  }

  if (typeof payload.base64Data !== "string" || !payload.base64Data.trim()) {
    throw new Error("Encrypted attachment bytes are missing.");
  }

  const buffer = Buffer.from(payload.base64Data, "base64");
  if (buffer.byteLength <= 0 || buffer.byteLength > MAX_ENCRYPTED_CHAT_IMAGE_BYTES) {
    throw new Error("Encrypted image attachment must stay under 12 MB.");
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
        originalMimeType: mimeType,
        originalFileName: fileName
      }
    }
  });

  return {
    attachment: {
      kind: "image",
      url: buildEncryptedAttachmentDownloadUrl(getChatBucket().name, storagePath, token),
      storagePath,
      mimeType,
      sizeBytes: buffer.byteLength,
      width,
      height
    }
  };
}
