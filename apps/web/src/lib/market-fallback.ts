import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ContactMarketPostResponse,
  CreateMarketPostRequest,
  CreateMarketPostResponse,
  ManageMarketListingResponse,
  MarketDashboardResponse,
  MarketListing,
  MarketMediaAsset,
  MarketRequest,
  MarketTone,
  MembershipSummary,
  UpdateMarketListingRequest,
  UpdateMarketListingResponse,
  ToggleMarketSaveResponse
} from "@vyb/contracts";
import { deleteMarketMediaAssets } from "./market-media-server";
import { normalizeMarketCampusSpot, normalizeMarketLocation } from "./market-defaults";
import type { MarketViewerIdentity } from "./market-types";

export type { MarketViewerIdentity } from "./market-types";

type StoredListing = Omit<MarketListing, "isSaved" | "savedCount" | "inquiryCount"> & {
  savedByUserIds: string[];
  status: "active" | "sold" | "deleted";
};

type StoredRequest = Omit<MarketRequest, "responseCount"> & {
  status: "active";
};

type StoredContact = {
  id: string;
  tenantId: string;
  targetId: string;
  targetType: "listing" | "request";
  fromUserId: string;
  toUserId: string;
  message: string;
  createdAt: string;
};

type MarketStore = {
  listings: StoredListing[];
  requests: StoredRequest[];
  contacts: StoredContact[];
};

export type FallbackMarketStoreSnapshot = {
  listings: StoredListing[];
  requests: StoredRequest[];
  contacts: StoredContact[];
};

const storePath = path.resolve(process.cwd(), "../../data/market-store.json");
const defaultStore: MarketStore = {
  listings: [],
  requests: [],
  contacts: []
};

const fallbackImages: Record<string, string> = {
  Tech: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80&auto=format&fit=crop",
  Fashion: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=80&auto=format&fit=crop",
  Study: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=900&q=80&auto=format&fit=crop",
  Room: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900&q=80&auto=format&fit=crop",
  Books: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=900&q=80&auto=format&fit=crop",
  Other: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=900&q=80&auto=format&fit=crop"
};

function buildExternalMediaAsset(url: string, fileName: string, kind: "image" | "video" = "image"): MarketMediaAsset {
  return {
    id: `media-${Math.random().toString(36).slice(2, 10)}`,
    kind,
    url,
    fileName,
    mimeType: kind === "video" ? "video/mp4" : "image/jpeg",
    sizeBytes: 0,
    storagePath: null
  };
}

let storeCache: MarketStore | null = null;
let writeQueue = Promise.resolve();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowMinusMinutes(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatAmount(amount: number) {
  return `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
}

function normalizeText(value: string | null | undefined, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function pickFallbackImage(category: string) {
  return fallbackImages[category] ?? fallbackImages.Other;
}

function pickFallbackListingMedia(category: string) {
  return [buildExternalMediaAsset(pickFallbackImage(category), `${category.toLowerCase()}-listing.jpg`)];
}

function normalizeMediaArray(value: unknown, fallbackCategory: string, fallbackUrl?: string | null, fallbackToCategoryImage = true) {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const candidate = item as Partial<MarketMediaAsset>;
        if (typeof candidate.url !== "string") {
          return null;
        }

        return {
          id: typeof candidate.id === "string" ? candidate.id : makeId("media"),
          kind: candidate.kind === "video" ? "video" : "image",
          url: candidate.url,
          fileName: typeof candidate.fileName === "string" ? candidate.fileName : "market-media",
          mimeType:
            typeof candidate.mimeType === "string"
              ? candidate.mimeType
              : candidate.kind === "video"
                ? "video/mp4"
                : "image/jpeg",
          sizeBytes: typeof candidate.sizeBytes === "number" ? candidate.sizeBytes : 0,
          storagePath: typeof candidate.storagePath === "string" ? candidate.storagePath : null
        } satisfies MarketMediaAsset;
      })
      .filter((item): item is MarketMediaAsset => Boolean(item));

    if (normalized.length > 0) {
      return normalized;
    }
  }

  if (fallbackUrl) {
    return [buildExternalMediaAsset(fallbackUrl, `${fallbackCategory.toLowerCase()}-legacy.jpg`)];
  }

  return fallbackToCategoryImage ? pickFallbackListingMedia(fallbackCategory) : [];
}

function normalizeStoredListing(input: StoredListing | (StoredListing & { imageUrl?: string | null })) {
  return {
    ...input,
    media: normalizeMediaArray((input as { media?: unknown }).media, input.category, (input as { imageUrl?: string | null }).imageUrl)
  } satisfies StoredListing;
}

function normalizeStoredRequest(input: StoredRequest | (StoredRequest & { media?: unknown })) {
  return {
    ...input,
    media: normalizeMediaArray((input as { media?: unknown }).media, input.category, null, false)
  } satisfies StoredRequest;
}

function buildTone(category: string, tab: StoredRequest["tab"]): MarketTone {
  if (tab === "lend") {
    return "cyan";
  }

  const palette: MarketTone[] = ["violet", "magenta", "cyan"];
  const seed = category
    .trim()
    .toLowerCase()
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return palette[seed % palette.length];
}

function buildSeedListings(tenantId: string): StoredListing[] {
  const sellerRole: MembershipSummary["role"] = "student";

  return [
    {
      id: `listing-${tenantId}-1`,
      tenantId,
      seller: {
        userId: "seed-music-room",
        username: "music.room",
        displayName: "Music Room",
        role: sellerRole
      },
      title: "Sony Headphones",
      description: "Clean sound, soft ear cushions, and still holding charge well. Great for library sessions and hostel binge nights.",
      category: "Tech",
      condition: "Lightly used",
      priceAmount: 1200,
      location: "Sigra, VNS",
      campusSpot: "Pickup near main gate",
      media: pickFallbackListingMedia("Tech"),
      createdAt: nowMinusMinutes(12),
      savedByUserIds: [],
      status: "active"
    },
    {
      id: `listing-${tenantId}-2`,
      tenantId,
      seller: {
        userId: "seed-aditya-design",
        username: "aditya.design",
        displayName: "Aditya Design",
        role: sellerRole
      },
      title: "Minimal Watch",
      description: "Simple white dial with two straps. Worn only a handful of times and looks fresh out of the box.",
      category: "Fashion",
      condition: "Like new",
      priceAmount: 3500,
      location: "Lanka, VNS",
      campusSpot: "Meet at cafe court",
      media: pickFallbackListingMedia("Fashion"),
      createdAt: nowMinusMinutes(43),
      savedByUserIds: [],
      status: "active"
    },
    {
      id: `listing-${tenantId}-3`,
      tenantId,
      seller: {
        userId: "seed-notes-club",
        username: "notes.club",
        displayName: "Notes Club",
        role: sellerRole
      },
      title: "Notebook Bundle",
      description: "Five ruled notebooks plus loose A4 sheets. Perfect for a new semester or fast revision prep.",
      category: "Study",
      condition: "Fresh set",
      priceAmount: 850,
      location: "Cantt, VNS",
      campusSpot: "Library block",
      media: pickFallbackListingMedia("Study"),
      createdAt: nowMinusMinutes(60),
      savedByUserIds: [],
      status: "active"
    },
    {
      id: `listing-${tenantId}-4`,
      tenantId,
      seller: {
        userId: "seed-hostel-setup",
        username: "hostel.setup",
        displayName: "Hostel Setup",
        role: sellerRole
      },
      title: "Gaming Chair",
      description: "Comfortable back support, reclining armrests, and smooth wheels. Ideal if you study and game from the same desk.",
      category: "Room",
      condition: "Great condition",
      priceAmount: 18000,
      location: "Sigra, VNS",
      campusSpot: "Hostel A lobby",
      media: [buildExternalMediaAsset("https://images.unsplash.com/photo-1598550476439-6847785fce66?w=900&q=80&auto=format&fit=crop", "gaming-chair.jpg")],
      createdAt: nowMinusMinutes(180),
      savedByUserIds: [],
      status: "active"
    },
    {
      id: `listing-${tenantId}-5`,
      tenantId,
      seller: {
        userId: "seed-ece-core",
        username: "ece.core",
        displayName: "ECE Core",
        role: sellerRole
      },
      title: "Scientific Calculator Kit",
      description: "Calculator, spare batteries, and quick-reference formula slips packed together for exam weeks.",
      category: "Study",
      condition: "Exam ready",
      priceAmount: 5400,
      location: "Campus Arcade",
      campusSpot: "Academic block 2",
      media: [buildExternalMediaAsset("https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=900&q=80&auto=format&fit=crop", "calculator-kit.jpg")],
      createdAt: nowMinusMinutes(300),
      savedByUserIds: [],
      status: "active"
    },
    {
      id: `listing-${tenantId}-6`,
      tenantId,
      seller: {
        userId: "seed-room-vibes",
        username: "room.vibes",
        displayName: "Room Vibes",
        role: sellerRole
      },
      title: "Desk Lamp + Organizer",
      description: "Warm light desk lamp with built-in trays for pens and sticky notes. Great little room upgrade.",
      category: "Room",
      condition: "Barely used",
      priceAmount: 2100,
      location: "Girls Hostel",
      campusSpot: "Common room desk",
      media: pickFallbackListingMedia("Room"),
      createdAt: nowMinusMinutes(420),
      savedByUserIds: [],
      status: "active"
    }
  ];
}

function buildSeedRequests(tenantId: string): StoredRequest[] {
  const requesterRole: MembershipSummary["role"] = "student";

  return [
    {
      id: `request-${tenantId}-1`,
      tenantId,
      tab: "buying",
      requester: {
        userId: "seed-pixel-ankit",
        username: "pixel.ankit",
        displayName: "Pixel Ankit",
        role: requesterRole
      },
      tag: "Looking to buy",
      title: "Second-hand DSLR camera",
      detail: "Need one for the media club showcase next weekend. Canon or Sony preferred, but I am open to similar options.",
      category: "Tech",
      campusSpot: "Media lab pickup",
      media: [],
      budgetLabel: "Budget under Rs 15,000",
      budgetAmount: 15000,
      tone: "violet",
      createdAt: nowMinusMinutes(18),
      status: "active"
    },
    {
      id: `request-${tenantId}-2`,
      tenantId,
      tab: "buying",
      requester: {
        userId: "seed-mech-sarthak",
        username: "mech.sarthak",
        displayName: "Sarthak",
        role: requesterRole
      },
      tag: "Need urgently",
      title: "Thermodynamics notes bundle",
      detail: "Prefer clean handwritten notes or printed unit sheets. Need them before internal tests begin.",
      category: "Study",
      campusSpot: "Library steps",
      media: [],
      budgetLabel: "Budget around Rs 400",
      budgetAmount: 400,
      tone: "magenta",
      createdAt: nowMinusMinutes(60),
      status: "active"
    },
    {
      id: `request-${tenantId}-3`,
      tenantId,
      tab: "lend",
      requester: {
        userId: "seed-frame-house",
        username: "frame.house",
        displayName: "Frame House",
        role: requesterRole
      },
      tag: "Borrow for 2 days",
      title: "Tripod or phone gimbal",
      detail: "Need it for a campus fest reel shoot on Friday evening. Happy to pay a small rental amount.",
      category: "Tech",
      campusSpot: "Auditorium foyer",
      media: [],
      budgetLabel: "Can pay a short rental fee",
      budgetAmount: 300,
      tone: "cyan",
      createdAt: nowMinusMinutes(24),
      status: "active"
    },
    {
      id: `request-${tenantId}-4`,
      tenantId,
      tab: "lend",
      requester: {
        userId: "seed-hostel-collective",
        username: "hostel.collective",
        displayName: "Hostel Collective",
        role: requesterRole
      },
      tag: "Lend / rent",
      title: "Portable induction plate",
      detail: "Need it for a hostel cookout this weekend. Happy with a short rental or temporary borrow.",
      category: "Room",
      campusSpot: "Block C reception",
      media: [],
      budgetLabel: "Open to rent or borrow",
      budgetAmount: null,
      tone: "violet",
      createdAt: nowMinusMinutes(120),
      status: "active"
    }
  ];
}

async function ensureStore() {
  if (storeCache) {
    return storeCache;
  }

  await mkdir(path.dirname(storePath), { recursive: true });

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<MarketStore>;
    storeCache = {
      listings: Array.isArray(parsed.listings) ? (parsed.listings as Array<StoredListing & { imageUrl?: string | null }>).map(normalizeStoredListing) : [],
      requests: Array.isArray(parsed.requests) ? (parsed.requests as StoredRequest[]).map(normalizeStoredRequest) : [],
      contacts: Array.isArray(parsed.contacts) ? (parsed.contacts as StoredContact[]) : []
    };
  } catch {
    storeCache = clone(defaultStore);
    await persistStore();
  }

  return storeCache;
}

async function persistStore() {
  if (!storeCache) {
    return;
  }

  const snapshot = JSON.stringify(storeCache, null, 2);
  writeQueue = writeQueue.then(() => writeFile(storePath, snapshot, "utf8"));
  await writeQueue;
}

async function ensureTenantSeed(store: MarketStore, tenantId: string) {
  void store;
  void tenantId;
}

function sortNewest<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function buildListingResponse(listing: StoredListing, viewerUserId: string, contacts: StoredContact[]): MarketListing {
  const inquiryCount = contacts.filter((contact) => contact.targetType === "listing" && contact.targetId === listing.id).length;

  return {
    ...listing,
    savedCount: listing.savedByUserIds.length,
    inquiryCount,
    isSaved: listing.savedByUserIds.includes(viewerUserId)
  };
}

function buildRequestResponse(request: StoredRequest, contacts: StoredContact[]): MarketRequest {
  const responseCount = contacts.filter((contact) => contact.targetType === "request" && contact.targetId === request.id).length;

  return {
    ...request,
    responseCount
  };
}

function buildDashboard(store: MarketStore, viewer: MarketViewerIdentity): MarketDashboardResponse {
  const activeListings = sortNewest(
    store.listings
      .filter((listing) => listing.tenantId === viewer.tenantId && listing.status === "active")
      .map((listing) => buildListingResponse(listing, viewer.userId, store.contacts))
  );
  const activeRequests = sortNewest(
    store.requests
      .filter((request) => request.tenantId === viewer.tenantId && request.status === "active")
      .map((request) => buildRequestResponse(request, store.contacts))
  );

  return {
    tenantId: viewer.tenantId,
    viewer: {
      userId: viewer.userId,
      username: viewer.username,
      savedCount: activeListings.filter((listing) => listing.isSaved).length
    },
    listings: activeListings,
    requests: activeRequests,
    viewerActiveListings: activeListings.filter((listing) => listing.seller.userId === viewer.userId),
    viewerActiveRequests: activeRequests.filter((request) => request.requester.userId === viewer.userId)
  };
}

function buildBudgetLabel(tab: StoredRequest["tab"], budgetAmount: number | null, budgetLabel: string | null | undefined) {
  const customLabel = normalizeText(budgetLabel);

  if (customLabel) {
    return customLabel;
  }

  if (budgetAmount && budgetAmount > 0) {
    return tab === "buying" ? `Budget around ${formatAmount(budgetAmount)}` : `Can pay about ${formatAmount(budgetAmount)}`;
  }

  return tab === "buying" ? "Open to the best fair offer" : "Open to borrow or rent";
}

function buildRequestTag(tab: StoredRequest["tab"], providedTag: string | null | undefined) {
  const customTag = normalizeText(providedTag);

  if (customTag) {
    return customTag;
  }

  return tab === "buying" ? "Looking to buy" : "Need to borrow";
}

export async function getFallbackMarketDashboard(viewer: MarketViewerIdentity) {
  const store = await ensureStore();
  await ensureTenantSeed(store, viewer.tenantId);
  return buildDashboard(store, viewer);
}

export async function getFallbackMarketStoreSnapshot(tenantId: string): Promise<FallbackMarketStoreSnapshot> {
  const store = await ensureStore();
  await ensureTenantSeed(store, tenantId);

  return clone({
    listings: store.listings.filter((listing) => listing.tenantId === tenantId && listing.status === "active"),
    requests: store.requests.filter((request) => request.tenantId === tenantId && request.status === "active"),
    contacts: store.contacts.filter((contact) => contact.tenantId === tenantId)
  });
}

export async function createFallbackMarketPost(
  viewer: MarketViewerIdentity,
  payload: CreateMarketPostRequest
): Promise<CreateMarketPostResponse> {
  const store = await ensureStore();
  await ensureTenantSeed(store, viewer.tenantId);

  const timestamp = new Date().toISOString();
  const category = normalizeText(payload.category, "Other");
  const media =
    Array.isArray(payload.media) && payload.media.length > 0
      ? payload.media
      : normalizeText(payload.imageUrl)
        ? [buildExternalMediaAsset(normalizeText(payload.imageUrl), `${category.toLowerCase()}-external.jpg`)]
        : [];

  if (payload.tab === "sale") {
    const listing: StoredListing = {
      id: makeId("listing"),
      tenantId: viewer.tenantId,
      seller: {
        userId: viewer.userId,
        username: viewer.username,
        displayName: viewer.displayName,
        role: viewer.role
      },
      title: normalizeText(payload.title),
      description: normalizeText(payload.description),
      category,
      condition: normalizeText(payload.condition, "Good condition"),
      priceAmount: Math.round(payload.priceAmount ?? 0),
      location: normalizeMarketLocation(payload.location),
      campusSpot: normalizeMarketCampusSpot(payload.campusSpot),
      media,
      createdAt: timestamp,
      savedByUserIds: [],
      status: "active"
    };

    store.listings.unshift(listing);
    await persistStore();

    return {
      dashboard: buildDashboard(store, viewer),
      itemId: listing.id,
      itemType: "listing"
    };
  }

  const request: StoredRequest = {
    id: makeId("request"),
    tenantId: viewer.tenantId,
    tab: payload.tab,
    requester: {
      userId: viewer.userId,
      username: viewer.username,
      displayName: viewer.displayName,
      role: viewer.role
    },
    tag: buildRequestTag(payload.tab, payload.tag),
    title: normalizeText(payload.title),
    detail: normalizeText(payload.description),
    category,
    campusSpot: normalizeMarketCampusSpot(payload.campusSpot),
    media,
    budgetLabel: buildBudgetLabel(payload.tab, payload.budgetAmount ?? null, payload.budgetLabel),
    budgetAmount: typeof payload.budgetAmount === "number" && Number.isFinite(payload.budgetAmount) ? Math.round(payload.budgetAmount) : null,
    tone: buildTone(category, payload.tab),
    createdAt: timestamp,
    status: "active"
  };

  store.requests.unshift(request);
  await persistStore();

  return {
    dashboard: buildDashboard(store, viewer),
    itemId: request.id,
    itemType: "request"
  };
}

function requireOwnedActiveFallbackListing(store: MarketStore, viewer: MarketViewerIdentity, listingId: string) {
  const listing = store.listings.find((candidate) => candidate.id === listingId && candidate.tenantId === viewer.tenantId);

  if (!listing || listing.status !== "active") {
    throw new Error("That listing is no longer available.");
  }

  if (listing.seller.userId !== viewer.userId) {
    throw new Error("You can only manage your own listing.");
  }

  return listing;
}

export async function updateFallbackMarketListing(
  viewer: MarketViewerIdentity,
  payload: UpdateMarketListingRequest
): Promise<UpdateMarketListingResponse> {
  const store = await ensureStore();
  await ensureTenantSeed(store, viewer.tenantId);

  const listing = requireOwnedActiveFallbackListing(store, viewer, payload.listingId);
  listing.title = normalizeText(payload.title);
  listing.category = normalizeText(payload.category, "Other");
  listing.description = normalizeText(payload.description);
  listing.condition = normalizeText(payload.condition, "Good condition");
  listing.priceAmount = Math.max(1, Math.round(payload.priceAmount));
  const keepMediaIds = new Set(
    Array.isArray(payload.keepMediaIds) ? payload.keepMediaIds : listing.media.map((asset) => asset.id)
  );
  const removedMedia = listing.media.filter((asset) => !keepMediaIds.has(asset.id));
  listing.media = [...listing.media.filter((asset) => keepMediaIds.has(asset.id)), ...(payload.media ?? [])];

  await persistStore();
  await deleteMarketMediaAssets(removedMedia);

  return {
    dashboard: buildDashboard(store, viewer),
    listingId: listing.id
  };
}

export async function markFallbackMarketListingSold(
  viewer: MarketViewerIdentity,
  listingId: string
): Promise<ManageMarketListingResponse> {
  const store = await ensureStore();
  await ensureTenantSeed(store, viewer.tenantId);

  const listing = requireOwnedActiveFallbackListing(store, viewer, listingId);
  listing.status = "sold";

  await persistStore();

  return {
    dashboard: buildDashboard(store, viewer),
    listingId,
    action: "sold"
  };
}

export async function deleteFallbackMarketListing(
  viewer: MarketViewerIdentity,
  listingId: string
): Promise<ManageMarketListingResponse> {
  const store = await ensureStore();
  await ensureTenantSeed(store, viewer.tenantId);

  const listing = requireOwnedActiveFallbackListing(store, viewer, listingId);
  const removedMedia = [...listing.media];
  listing.status = "deleted";

  await persistStore();
  await deleteMarketMediaAssets(removedMedia);

  return {
    dashboard: buildDashboard(store, viewer),
    listingId,
    action: "deleted"
  };
}

export async function toggleFallbackMarketSave(
  viewer: MarketViewerIdentity,
  listingId: string
): Promise<ToggleMarketSaveResponse> {
  const store = await ensureStore();
  await ensureTenantSeed(store, viewer.tenantId);

  const listing = store.listings.find(
    (candidate) => candidate.id === listingId && candidate.tenantId === viewer.tenantId && candidate.status === "active"
  );

  if (!listing) {
    throw new Error("That listing no longer exists.");
  }

  if (listing.seller.userId === viewer.userId) {
    throw new Error("You cannot save your own listing.");
  }

  const nextSavedState = !listing.savedByUserIds.includes(viewer.userId);
  listing.savedByUserIds = nextSavedState
    ? [...listing.savedByUserIds, viewer.userId]
    : listing.savedByUserIds.filter((userId) => userId !== viewer.userId);

  await persistStore();

  return {
    dashboard: buildDashboard(store, viewer),
    listingId,
    isSaved: nextSavedState
  };
}

export async function createFallbackMarketContact(
  viewer: MarketViewerIdentity,
  input: {
    targetId: string;
    targetType: "listing" | "request";
    message: string;
  }
): Promise<ContactMarketPostResponse> {
  const store = await ensureStore();
  await ensureTenantSeed(store, viewer.tenantId);

  const targetOwnerId =
    input.targetType === "listing"
      ? store.listings.find(
          (listing) => listing.id === input.targetId && listing.tenantId === viewer.tenantId && listing.status === "active"
        )?.seller.userId
      : store.requests.find(
          (request) => request.id === input.targetId && request.tenantId === viewer.tenantId && request.status === "active"
        )?.requester.userId;

  if (!targetOwnerId) {
    throw new Error("That market post is no longer available.");
  }

  if (targetOwnerId === viewer.userId) {
    throw new Error("You cannot contact your own market post.");
  }

  store.contacts.unshift({
    id: makeId("contact"),
    tenantId: viewer.tenantId,
    targetId: input.targetId,
    targetType: input.targetType,
    fromUserId: viewer.userId,
    toUserId: targetOwnerId,
    message: normalizeText(input.message),
    createdAt: new Date().toISOString()
  });

  await persistStore();

  return {
    dashboard: buildDashboard(store, viewer),
    targetId: input.targetId,
    targetType: input.targetType
  };
}
