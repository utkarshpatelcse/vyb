import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../../../../src/lib/dev-session";
import { markMarketListingSold } from "../../../../../../src/lib/market-data";
import { resolveMarketViewerIdentity } from "../../../../../../src/lib/market-server";

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

type RouteContext = {
  params: Promise<{
    listingId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before marking a listing as sold.");
  }

  const { listingId: rawListingId } = await context.params;
  const listingId = rawListingId?.trim();

  if (!listingId) {
    return buildError(400, "INVALID_LISTING", "Choose a valid listing to update.");
  }

  try {
    const identity = await resolveMarketViewerIdentity(viewer);
    return NextResponse.json(await markMarketListingSold(identity, listingId));
  } catch (error) {
    return buildError(400, "MARKET_LISTING_SOLD_FAILED", error instanceof Error ? error.message : "We could not mark the listing as sold.");
  }
}
