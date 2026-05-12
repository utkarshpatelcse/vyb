import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { DevSession } from "../../../../../src/lib/dev-session";
import { getInternalApiKey } from "../../../../../src/lib/internal-api-key";
import { notifyGameSquadActive, notifyGameTurnLive } from "../../../../../src/lib/notification-events";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isTrustedInternalRequest(request: Request) {
  const expected = getInternalApiKey();
  const provided = request.headers.get("x-vyb-internal-key")?.trim();
  if (!provided) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function normalizeRecipients(value: unknown) {
  return Array.isArray(value) ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean) : [];
}

function normalizeViewer(value: unknown): DevSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const input = value as Partial<DevSession>;
  if (
    typeof input.tenantId !== "string" ||
    typeof input.userId !== "string" ||
    typeof input.membershipId !== "string" ||
    typeof input.displayName !== "string"
  ) {
    return null;
  }

  return {
    tenantId: input.tenantId,
    userId: input.userId,
    membershipId: input.membershipId,
    displayName: input.displayName,
    email: typeof input.email === "string" ? input.email : `${input.userId}@internal.vyb`,
    role:
      input.role === "faculty" || input.role === "alumni" || input.role === "moderator" || input.role === "admin"
        ? input.role
        : "student"
  };
}

export async function POST(request: Request) {
  if (!isTrustedInternalRequest(request)) {
    return buildError(401, "UNAUTHENTICATED", "A trusted internal key is required.");
  }

  const payload = (await request.json().catch(() => null)) as {
    eventKey?: unknown;
    actor?: unknown;
    roomId?: unknown;
    gameSlug?: unknown;
    recipientUserIds?: unknown;
    activeCount?: unknown;
    drawerName?: unknown;
  } | null;
  const actor = normalizeViewer(payload?.actor);
  const roomId = typeof payload?.roomId === "string" ? payload.roomId.trim() : "";
  const gameSlug = typeof payload?.gameSlug === "string" ? payload.gameSlug.trim() : "scribble";
  const recipientUserIds = normalizeRecipients(payload?.recipientUserIds);

  if (!actor || !roomId || recipientUserIds.length === 0) {
    return buildError(400, "INVALID_GAME_NOTIFICATION", "Game notification payload is incomplete.");
  }

  if (payload?.eventKey === "game.squad_active") {
    await notifyGameSquadActive(actor, {
      roomId,
      gameSlug,
      recipientUserIds,
      activeCount: typeof payload.activeCount === "number" ? payload.activeCount : recipientUserIds.length
    });
    return NextResponse.json({ emitted: true });
  }

  if (payload?.eventKey === "game.turn_live") {
    await notifyGameTurnLive(actor, {
      roomId,
      gameSlug,
      recipientUserIds,
      drawerName: typeof payload.drawerName === "string" && payload.drawerName.trim() ? payload.drawerName : actor.displayName
    });
    return NextResponse.json({ emitted: true });
  }

  return buildError(400, "UNKNOWN_GAME_NOTIFICATION", "Unsupported game notification event.");
}
