import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createChatConversation, getChatConversation, getChatInbox, isBackendRequestError } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function buildChatError(error: unknown, fallbackCode: string, fallbackMessage: string) {
  if (isBackendRequestError(error)) {
    return buildError(error.statusCode, error.code, error.message);
  }

  return buildError(500, fallbackCode, error instanceof Error ? error.message : fallbackMessage);
}

function normalizeRecipientLookup(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { recipientUsername: null, recipientUserId: null };
  }

  const record = payload as Record<string, unknown>;

  const recipientUsername =
    typeof record.recipientUsername === "string" && record.recipientUsername.trim().length > 0
      ? record.recipientUsername.trim().replace(/^@+/u, "").toLowerCase()
      : null;
  const recipientUserId =
    typeof record.recipientUserId === "string" && record.recipientUserId.trim().length > 0
      ? record.recipientUserId.trim()
      : null;

  return { recipientUsername, recipientUserId };
}

async function resolveExistingDirectChat(viewer: NonNullable<ReturnType<typeof readDevSessionFromCookieStore>>, payload: unknown) {
  const { recipientUsername, recipientUserId } = normalizeRecipientLookup(payload);

  if (!recipientUsername && !recipientUserId) {
    return null;
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const inbox = await getChatInbox(viewer);
    const existing = inbox.items.find((item) => {
      if (item.kind !== "direct") {
        return false;
      }

      if (recipientUserId && item.peer.userId === recipientUserId) {
        return true;
      }

      return Boolean(recipientUsername && item.peer.username.toLowerCase() === recipientUsername);
    });

    if (existing) {
      const conversation = await getChatConversation(viewer, existing.id);
      if (conversation?.conversation) {
        return conversation.conversation;
      }

      return {
        id: existing.id,
        tenantId: existing.tenantId,
        kind: existing.kind,
        peer: existing.peer,
        messages: [],
        lastReadMessageId: null,
        lastReadAt: null,
        peerLastReadMessageId: null,
        peerLastReadAt: null
      };
    }

    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 220 * (attempt + 1)));
    }
  }

  return null;
}

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before viewing chats.");
  }

  try {
    return NextResponse.json(await getChatInbox(viewer), {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate"
      }
    });
  } catch (error) {
    return buildChatError(error, "CHAT_INBOX_FAILED", "We could not load chats.");
  }
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before starting a chat.");
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return buildError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    return NextResponse.json(await createChatConversation(viewer, payload));
  } catch (error) {
    if (isBackendRequestError(error) && error.statusCode === 409) {
      const existingConversation = await resolveExistingDirectChat(viewer, payload);
      if (existingConversation) {
        return NextResponse.json({
          created: false,
          conversation: existingConversation
        });
      }
    }

    return buildChatError(error, "CHAT_CREATE_FAILED", "We could not open this chat.");
  }
}
