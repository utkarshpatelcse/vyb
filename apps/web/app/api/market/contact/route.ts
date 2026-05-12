import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ContactMarketPostRequest } from "@vyb/contracts";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";
import { createMarketContact } from "../../../../src/lib/market-data";
import { notifyMarketContactCreated } from "../../../../src/lib/notification-events";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  );
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before contacting someone in the market.");
  }

  const payload = (await request.json().catch(() => null)) as ContactMarketPostRequest | null;
  const targetId = payload?.targetId?.trim();
  const message = payload?.message?.trim();

  if (!targetId || (payload?.targetType !== "listing" && payload?.targetType !== "request")) {
    return buildError(400, "INVALID_TARGET", "Choose a valid listing or request first.");
  }

  if (!message) {
    return buildError(400, "INVALID_MESSAGE", "Write a short message before sending it.");
  }

  try {
    const result = await createMarketContact(viewer, {
        targetId,
        targetType: payload.targetType,
        message
      });
    const target =
      payload.targetType === "listing"
        ? result.dashboard.listings.find((listing) => listing.id === targetId)
        : result.dashboard.requests.find((requestItem) => requestItem.id === targetId);
    if (target) {
      await notifyMarketContactCreated(viewer, target, payload.targetType).catch((notificationError) => {
        console.warn("[notifications] market.contact.created failed", {
          targetId,
          targetType: payload.targetType,
          message: notificationError instanceof Error ? notificationError.message : "unknown"
        });
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    return buildError(400, "MARKET_CONTACT_FAILED", error instanceof Error ? error.message : "We could not send your market message.");
  }
}
