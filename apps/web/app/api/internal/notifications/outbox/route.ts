import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getInternalApiKey } from "../../../../../src/lib/internal-api-key";
import { runNotificationDeliveryOutbox, runNotificationScheduler } from "../../../../../src/lib/notifications";

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

export async function POST(request: Request) {
  if (!isTrustedInternalRequest(request)) {
    return buildError(401, "UNAUTHENTICATED", "A trusted internal key is required.");
  }

  const payload = (await request.json().catch(() => null)) as { tenantId?: string | null; limit?: number | null } | null;
  const tenantId = typeof payload?.tenantId === "string" ? payload.tenantId : null;

  const scheduled = await runNotificationScheduler({ tenantId });
  const delivery = await runNotificationDeliveryOutbox({
    tenantId,
    limit: typeof payload?.limit === "number" ? payload.limit : undefined
  });

  return NextResponse.json({
    scheduled,
    delivery
  });
}
