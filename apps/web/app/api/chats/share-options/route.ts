import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type {
  CampusEventsDashboardResponse,
  ChatDealCardPayload,
  ChatEventCardPayload,
  ChatVibeCardPayload,
  FeedListResponse,
  MarketDashboardResponse
} from "@vyb/contracts";
import { getCampusVibes } from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";
import { getEventsDashboard } from "../../../../src/lib/events-data";
import { getMarketDashboard } from "../../../../src/lib/market-data";

type ShareMenuTab = "deals" | "events" | "vibes";
type PendingShareCard =
  | { kind: "deal_card"; payload: ChatDealCardPayload }
  | { kind: "event_card"; payload: ChatEventCardPayload }
  | { kind: "vibe_card"; payload: ChatVibeCardPayload };
type ShareMenuCollections = Record<ShareMenuTab, PendingShareCard[]>;

const SHARE_MENU_LIMIT = 12;

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function buildShareMenuCollections(): ShareMenuCollections {
  return {
    deals: [],
    events: [],
    vibes: []
  };
}

function formatCurrencyLabel(amount: number | null | undefined, fallback: string | null | undefined) {
  if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
    return `Rs ${Math.round(amount).toLocaleString("en-IN")}`;
  }

  return fallback?.trim() || "Open offer";
}

async function resolveShareSource<T>(promise: Promise<T>) {
  try {
    return await promise;
  } catch {
    return null;
  }
}

function buildDealCards(marketData: MarketDashboardResponse | null): PendingShareCard[] {
  if (!marketData) {
    return [];
  }

  const listingCards = (marketData.viewerActiveListings ?? []).slice(0, SHARE_MENU_LIMIT).map((listing) => ({
    kind: "deal_card" as const,
    payload: {
      targetType: "listing" as const,
      targetId: listing.id,
      title: listing.title,
      amountLabel: formatCurrencyLabel(listing.priceAmount, null),
      category: listing.category,
      campusSpot: listing.campusSpot ?? listing.location ?? "",
      counterpartUsername: listing.seller.username,
      counterpartDisplayName: listing.seller.displayName,
      imageUrl: listing.media[0]?.url ?? null,
      description: listing.description
    }
  }));

  const requestCards = (marketData.viewerActiveRequests ?? []).slice(0, SHARE_MENU_LIMIT).map((request) => ({
    kind: "deal_card" as const,
    payload: {
      targetType: "request" as const,
      targetId: request.id,
      title: request.title,
      amountLabel: formatCurrencyLabel(request.budgetAmount ?? null, request.budgetLabel ?? null),
      category: request.category,
      campusSpot: request.tag ?? "",
      counterpartUsername: request.requester.username,
      counterpartDisplayName: request.requester.displayName,
      imageUrl: request.media[0]?.url ?? null,
      description: request.detail
    }
  }));

  return [...listingCards, ...requestCards].slice(0, SHARE_MENU_LIMIT);
}

function buildEventCards(eventsData: CampusEventsDashboardResponse | null): PendingShareCard[] {
  if (!eventsData) {
    return [];
  }

  return (eventsData.hostedEvents ?? []).slice(0, SHARE_MENU_LIMIT).map((event) => ({
    kind: "event_card" as const,
    payload: {
      eventId: event.id,
      title: event.title,
      club: event.club,
      location: event.location,
      startsAt: event.startsAt,
      passLabel: event.passLabel,
      responseMode: event.responseMode,
      imageUrl: event.media[0]?.url ?? null,
      description: event.description,
      hostUsername: event.host.username
    }
  }));
}

function buildVibeCards(vibesData: FeedListResponse | null): PendingShareCard[] {
  if (!vibesData) {
    return [];
  }

  return (vibesData.items ?? []).slice(0, SHARE_MENU_LIMIT).map((item) => ({
    kind: "vibe_card" as const,
    payload: {
      postId: item.id,
      title: item.title || "Campus vibe",
      body: item.body,
      mediaUrl: item.media.find((media) => media.kind === "video")?.url ?? item.mediaUrl,
      thumbnailUrl: item.media[0]?.url ?? item.mediaUrl,
      authorUsername: item.author.username,
      authorDisplayName: item.author.displayName
    }
  }));
}

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before opening the share menu.");
  }

  const [marketData, eventsData, vibesData] = await Promise.all([
    resolveShareSource(getMarketDashboard(viewer)),
    resolveShareSource(getEventsDashboard(viewer)),
    resolveShareSource(getCampusVibes(viewer, SHARE_MENU_LIMIT, null, { authorUserId: viewer.userId }))
  ]);

  const collections = buildShareMenuCollections();
  collections.deals = buildDealCards(marketData);
  collections.events = buildEventCards(eventsData);
  collections.vibes = buildVibeCards(vibesData);

  return NextResponse.json(
    {
      collections
    },
    {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate"
      }
    }
  );
}
