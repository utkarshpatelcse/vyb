import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";
import { recordNotificationLiveMode } from "../../../../src/lib/notifications";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function normalizeMode(value: unknown) {
  return value === "chat" || value === "game" || value === "event" || value === "live" ? value : null;
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before updating notification activity.");
  }

  const payload = (await request.json().catch(() => null)) as {
    mode?: unknown;
    contextId?: unknown;
    ttlMs?: unknown;
  } | null;
  const mode = normalizeMode(payload?.mode);

  if (!mode) {
    return buildError(400, "INVALID_LIVE_MODE", "Choose a valid notification activity mode.");
  }

  await recordNotificationLiveMode(viewer, {
    mode,
    contextId: typeof payload?.contextId === "string" ? payload.contextId : null,
    ttlMs: typeof payload?.ttlMs === "number" ? payload.ttlMs : undefined
  });

  return NextResponse.json({ active: true });
}
