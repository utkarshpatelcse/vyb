import { readJson, sendError, sendJson } from "../../lib/http.mjs";
import { getProfileByUserId } from "../identity/profile-repository.mjs";
import { resolveLiveContext } from "../shared/viewer-context.mjs";
import {
  deleteChatMessage,
  canAccessChatConversation,
  createOrGetDirectConversation,
  getChatConversation,
  getChatErrorResponse,
  getChatKeyBackup,
  getChatKeyBackupPinAttemptState,
  listChatInbox,
  markChatConversationRead,
  migrateChatConversationEncryption,
  reactToChatMessage,
  recordFailedChatKeyBackupPinAttempt,
  sendChatMessage,
  updateChatMessageLifecycle,
  uploadEncryptedChatAttachment,
  clearChatKeyBackupPinAttemptState,
  upsertChatKeyBackup,
  upsertChatIdentity
} from "./repository.mjs";

function requireNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function buildChatViewer(resolved, profile) {
  return {
    userId: resolved.live.user.id,
    membershipId: resolved.live.membership.id,
    tenantId: resolved.live.tenant.id,
    username: profile?.username ?? resolved.viewer.primaryEmail.split("@")[0] ?? resolved.live.user.id,
    displayName: profile?.fullName ?? resolved.viewer.displayName
  };
}

function sendChatFailure(response, scope, resolved, error) {
  const failure = getChatErrorResponse(error, `${scope.toUpperCase()}_FAILED`);
  const logger = failure.statusCode >= 500 ? console.error : console.warn;
  logger(`[chat] ${scope}:failed`, {
    tenantId: resolved?.live?.tenant?.id ?? null,
    userId: resolved?.live?.user?.id ?? null,
    message: failure.message
  });

  sendError(
    response,
    failure.statusCode,
    failure.code,
    failure.message
  );
}

export function getChatModuleHealth() {
  return {
    module: "chat",
    status: "ok"
  };
}

export async function canOpenChatRealtimeConnection({ tenantId, userId, membershipId, conversationId }) {
  if (!tenantId || !userId || !membershipId || !conversationId) {
    return false;
  }

  return canAccessChatConversation(
    {
      tenantId,
      userId,
      membershipId
    },
    conversationId
  );
}

export async function handleChatRoute({ request, response, url, context }) {
  if (!context.actor || !url.pathname.startsWith("/v1/chats")) {
    return false;
  }

  const resolved = await resolveLiveContext(context.actor);
  if (!resolved?.live?.tenant || !resolved.live.user || !resolved.live.membership) {
    sendError(response, 401, "UNAUTHENTICATED", "An authenticated membership is required.");
    return true;
  }

  const profile = await getProfileByUserId({
    tenantId: resolved.live.tenant.id,
    userId: resolved.live.user.id
  }).catch(() => null);

  if (!profile?.profileCompleted) {
    sendError(response, 403, "PROFILE_INCOMPLETE", "Complete your profile before opening campus chat.");
    return true;
  }

  const viewer = buildChatViewer(resolved, profile);

  if (request.method === "GET" && url.pathname === "/v1/chats") {
    try {
      sendJson(response, 200, await listChatInbox(viewer));
    } catch (error) {
      sendChatFailure(response, "chat_inbox", resolved, error);
    }
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/chats") {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    if (!requireNonEmptyString(payload.recipientUserId) && !requireNonEmptyString(payload.recipientUsername)) {
      sendError(response, 400, "INVALID_RECIPIENT", "Choose a valid recipient before opening a chat.");
      return true;
    }

    try {
      sendJson(response, 200, await createOrGetDirectConversation(viewer, payload));
    } catch (error) {
      sendChatFailure(response, "chat_create", resolved, error);
    }
    return true;
  }

  if (request.method === "PUT" && url.pathname === "/v1/chats/keys") {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    if (!requireNonEmptyString(payload.publicKey)) {
      sendError(response, 400, "INVALID_PUBLIC_KEY", "A public key is required to set up secure chat.");
      return true;
    }

    try {
      sendJson(response, 200, await upsertChatIdentity(viewer, payload));
    } catch (error) {
      sendChatFailure(response, "chat_key_publish", resolved, error);
    }
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/chats/key-backup") {
    try {
      sendJson(response, 200, await getChatKeyBackup(viewer));
    } catch (error) {
      sendChatFailure(response, "chat_key_backup_fetch", resolved, error);
    }
    return true;
  }

  if (request.method === "PUT" && url.pathname === "/v1/chats/key-backup") {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    try {
      sendJson(response, 200, await upsertChatKeyBackup(viewer, payload));
    } catch (error) {
      sendChatFailure(response, "chat_key_backup_save", resolved, error);
    }
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/chats/key-backup/attempts") {
    try {
      sendJson(response, 200, await getChatKeyBackupPinAttemptState(viewer));
    } catch (error) {
      sendChatFailure(response, "chat_key_backup_attempts_fetch", resolved, error);
    }
    return true;
  }

  if (request.method === "PUT" && url.pathname === "/v1/chats/key-backup/attempts") {
    try {
      sendJson(response, 200, await recordFailedChatKeyBackupPinAttempt(viewer));
    } catch (error) {
      sendChatFailure(response, "chat_key_backup_attempts_record", resolved, error);
    }
    return true;
  }

  if (request.method === "DELETE" && url.pathname === "/v1/chats/key-backup/attempts") {
    try {
      sendJson(response, 200, await clearChatKeyBackupPinAttemptState(viewer));
    } catch (error) {
      sendChatFailure(response, "chat_key_backup_attempts_clear", resolved, error);
    }
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/chats/media/upload") {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    if (!requireNonEmptyString(payload.fileName) || !requireNonEmptyString(payload.mimeType) || !requireNonEmptyString(payload.base64Data)) {
      sendError(response, 400, "INVALID_FILE", "Attachment upload data is incomplete.");
      return true;
    }

    try {
      sendJson(response, 201, await uploadEncryptedChatAttachment(viewer, payload));
    } catch (error) {
      sendChatFailure(response, "chat_media_upload", resolved, error);
    }
    return true;
  }

  const conversationMatch = url.pathname.match(/^\/v1\/chats\/([^/]+)$/);
  if (request.method === "GET" && conversationMatch) {
    try {
      const payload = await getChatConversation(viewer, conversationMatch[1]);
      if (!payload) {
        sendError(response, 404, "CHAT_NOT_FOUND", "We could not find that conversation.");
        return true;
      }

      sendJson(response, 200, payload);
    } catch (error) {
      sendChatFailure(response, "chat_detail", resolved, error);
    }
    return true;
  }

  const sendMatch = url.pathname.match(/^\/v1\/chats\/([^/]+)\/messages$/);
  if (request.method === "POST" && sendMatch) {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    if (!requireNonEmptyString(payload.cipherText) || !requireNonEmptyString(payload.cipherIv)) {
      sendError(response, 400, "INVALID_MESSAGE", "Message data is required.");
      return true;
    }

    try {
      sendJson(response, 201, await sendChatMessage(viewer, sendMatch[1], payload));
    } catch (error) {
      sendChatFailure(response, "chat_send", resolved, error);
    }
    return true;
  }

  const encryptionMatch = url.pathname.match(/^\/v1\/chats\/([^/]+)\/messages\/encryption$/);
  if (request.method === "PUT" && encryptionMatch) {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      sendError(response, 400, "INVALID_ENCRYPTION_UPGRADE", "Choose at least one message to upgrade.");
      return true;
    }

    try {
      sendJson(response, 200, await migrateChatConversationEncryption(viewer, encryptionMatch[1], payload));
    } catch (error) {
      sendChatFailure(response, "chat_encryption_upgrade", resolved, error);
    }
    return true;
  }

  const readMatch = url.pathname.match(/^\/v1\/chats\/([^/]+)\/read$/);
  if (request.method === "PUT" && readMatch) {
    const payload = await readJson(request);
    const messageId = requireNonEmptyString(payload?.messageId) ? payload.messageId.trim() : null;

    if (!messageId) {
      sendError(response, 400, "INVALID_MESSAGE", "Choose a valid message to mark as read.");
      return true;
    }

    try {
      sendJson(response, 200, await markChatConversationRead(viewer, readMatch[1], messageId));
    } catch (error) {
      sendChatFailure(response, "chat_read", resolved, error);
    }
    return true;
  }

  const reactionMatch = url.pathname.match(/^\/v1\/chats\/messages\/([^/]+)\/reactions$/);
  if (request.method === "PUT" && reactionMatch) {
    const payload = await readJson(request);
    const emoji = requireNonEmptyString(payload?.emoji) ? payload.emoji.trim() : null;

    if (!emoji) {
      sendError(response, 400, "INVALID_EMOJI", "Choose a reaction first.");
      return true;
    }

    try {
      sendJson(response, 200, await reactToChatMessage(viewer, reactionMatch[1], emoji));
    } catch (error) {
      sendChatFailure(response, "chat_reaction", resolved, error);
    }
    return true;
  }

  const lifecycleMatch = url.pathname.match(/^\/v1\/chats\/messages\/([^/]+)\/lifecycle$/);
  if (request.method === "PUT" && lifecycleMatch) {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    try {
      sendJson(response, 200, await updateChatMessageLifecycle(viewer, lifecycleMatch[1], payload));
    } catch (error) {
      sendChatFailure(response, "chat_lifecycle", resolved, error);
    }
    return true;
  }

  const deleteMessageMatch = url.pathname.match(/^\/v1\/chats\/messages\/([^/]+)$/);
  if (request.method === "DELETE" && deleteMessageMatch) {
    const payload = await readJson(request);
    const scope = requireNonEmptyString(payload?.scope) ? payload.scope.trim() : null;

    if (scope !== "self" && scope !== "everyone") {
      sendError(response, 400, "INVALID_DELETE_SCOPE", "Choose whether to delete the message just for you or for everyone.");
      return true;
    }

    try {
      sendJson(response, 200, await deleteChatMessage(viewer, deleteMessageMatch[1], scope));
    } catch (error) {
      sendChatFailure(response, "chat_delete", resolved, error);
    }
    return true;
  }

  return false;
}
