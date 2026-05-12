import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { cancelMarketReplyReminder } from "../../../../../src/lib/notification-events";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before updating market reminders.");
  }

  const payload = (await request.json().catch(() => null)) as {
    targetType?: unknown;
    targetId?: unknown;
    requesterUserId?: unknown;
  } | null;
  const targetType = payload?.targetType === "listing" || payload?.targetType === "request" ? payload.targetType : null;
  const targetId = typeof payload?.targetId === "string" ? payload.targetId.trim() : "";
  const requesterUserId = typeof payload?.requesterUserId === "string" ? payload.requesterUserId.trim() : "";

  if (!targetType || !targetId || !requesterUserId) {
    return buildError(400, "INVALID_MARKET_REMINDER", "Choose a valid market reminder to cancel.");
  }

  const cancelledCount = await cancelMarketReplyReminder({
    targetType,
    targetId,
    requesterUserId,
    recipientUserId: viewer.userId
  });

  return NextResponse.json({ cancelledCount });
}
