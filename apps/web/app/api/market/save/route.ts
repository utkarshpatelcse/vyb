import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ToggleMarketSaveRequest } from "@vyb/contracts";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";
import { toggleMarketSave } from "../../../../src/lib/market-data";

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
    return buildError(401, "UNAUTHENTICATED", "You must sign in before saving a listing.");
  }

  const payload = (await request.json().catch(() => null)) as ToggleMarketSaveRequest | null;
  const listingId = payload?.listingId?.trim();

  if (!listingId) {
    return buildError(400, "INVALID_LISTING", "Choose a valid listing to save.");
  }

  try {
    return NextResponse.json(await toggleMarketSave(viewer, listingId));
  } catch (error) {
    return buildError(400, "MARKET_SAVE_FAILED", error instanceof Error ? error.message : "We could not update your saved listings.");
  }
}
