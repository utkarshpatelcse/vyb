import "server-only";

import { randomUUID } from "node:crypto";
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
  UpdateMarketListingRequest,
  UpdateMarketListingResponse,
  ToggleMarketSaveResponse
} from "@vyb/contracts";
import { getFirebaseDataConnect } from "@vyb/config";
import {
  connectorConfig as marketplaceConnectorConfig,
  createMarketListing,
  createMarketListingContact,
  createMarketListingMedia,
  createMarketListingSave,
  createMarketRequest,
  createMarketRequestContact,
  createMarketRequestMedia,
  getMarketListingById,
  getMarketRequestById,
  markMarketListingSold,
  listActiveMarketListingContactsByTenant,
  listActiveMarketListingSavesByTenant,
  listActiveMarketListingSavesByUserAndListing,
  listActiveMarketRequestContactsByTenant,
  listMarketListingMediaByTenant,
  listMarketListingsByTenant,
  listMarketRequestMediaByTenant,
  listMarketRequestsByTenant,
  softDeleteMarketListing,
  softDeleteMarketListingMedia,
  softDeleteMarketListingSave,
  updateMarketListingDetails
} from "@vyb/dataconnect-marketplace-admin";
import type { MarketViewerIdentity } from "./market-fallback";
import { getFallbackMarketStoreSnapshot } from "./market-fallback";
import { normalizeMarketCampusSpot, normalizeMarketLocation } from "./market-defaults";
import { deleteMarketMediaAssets } from "./market-media-server";

const TENANT_SCAN_LIMIT = 5000;
const SAVE_LOOKUP_LIMIT = 8;
const liveSeededTenants = new Set<string>();

function getMarketplaceDc() {
  return getFirebaseDataConnect(marketplaceConnectorConfig);
}

function normalizeText(value: string | null | undefined, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function formatAmount(amount: number) {
  return `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
}

function buildBudgetLabel(tab: "buying" | "lend", budgetAmount: number | null, budgetLabel: string | null | undefined) {
  const customLabel = normalizeText(budgetLabel);

  if (customLabel) {
    return customLabel;
  }

  if (budgetAmount && budgetAmount > 0) {
    return tab === "buying" ? `Budget around ${formatAmount(budgetAmount)}` : `Can pay about ${formatAmount(budgetAmount)}`;
  }

  return tab === "buying" ? "Open to the best fair offer" : "Open to borrow or rent";
}

function buildRequestTag(tab: "buying" | "lend", providedTag: string | null | undefined) {
  const customTag = normalizeText(providedTag);

  if (customTag) {
    return customTag;
  }

  return tab === "buying" ? "Looking to buy" : "Need to borrow";
}

function buildTone(category: string, tab: "buying" | "lend"): MarketTone {
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

function normalizeRole(value: string): MarketViewerIdentity["role"] {
  return value === "faculty" || value === "alumni" || value === "moderator" || value === "admin" ? value : "student";
}

function sortNewest<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function buildExternalMediaAsset(url: string): MarketMediaAsset {
  return {
    id: `media-${randomUUID()}`,
    kind: "image",
    url,
    fileName: "market-image.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 0,
    storagePath: null
  };
}

function toMediaSizeBytes(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPersistedMedia(asset: MarketMediaAsset, createdAt: string) {
  return {
    id: asset.id || `media-${randomUUID()}`,
    kind: asset.kind,
    url: asset.url,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    sizeBytes: String(Math.max(0, Math.round(asset.sizeBytes ?? 0))),
    storagePath: asset.storagePath ?? null,
    createdAt
  };
}

async function readLiveMarketSnapshot(tenantId: string) {
  const dc = getMarketplaceDc();
  const [
    listingsResponse,
    listingMediaResponse,
    requestsResponse,
    requestMediaResponse,
    savesResponse,
    listingContactsResponse,
    requestContactsResponse
  ] = await Promise.all([
    listMarketListingsByTenant(dc, { tenantId, limit: TENANT_SCAN_LIMIT }),
    listMarketListingMediaByTenant(dc, { tenantId, limit: TENANT_SCAN_LIMIT }),
    listMarketRequestsByTenant(dc, { tenantId, limit: TENANT_SCAN_LIMIT }),
    listMarketRequestMediaByTenant(dc, { tenantId, limit: TENANT_SCAN_LIMIT }),
    listActiveMarketListingSavesByTenant(dc, { tenantId, limit: TENANT_SCAN_LIMIT }),
    listActiveMarketListingContactsByTenant(dc, { tenantId, limit: TENANT_SCAN_LIMIT }),
    listActiveMarketRequestContactsByTenant(dc, { tenantId, limit: TENANT_SCAN_LIMIT })
  ]);

  return {
    listings: listingsResponse.data.marketListings,
    listingMedia: listingMediaResponse.data.marketListingMediaRecords,
    requests: requestsResponse.data.marketRequests,
    requestMedia: requestMediaResponse.data.marketRequestMediaRecords,
    saves: savesResponse.data.marketListingSaves,
    listingContacts: listingContactsResponse.data.marketListingContacts,
    requestContacts: requestContactsResponse.data.marketRequestContacts
  };
}

async function seedLiveMarketFromFallback(viewer: MarketViewerIdentity) {
  if (liveSeededTenants.has(viewer.tenantId)) {
    return;
  }

  const snapshot = await readLiveMarketSnapshot(viewer.tenantId);
  if (snapshot.listings.length > 0 || snapshot.requests.length > 0) {
    liveSeededTenants.add(viewer.tenantId);
    return;
  }

  const fallback = await getFallbackMarketStoreSnapshot(viewer.tenantId);
  if (fallback.listings.length === 0 && fallback.requests.length === 0) {
    liveSeededTenants.add(viewer.tenantId);
    return;
  }

  const dc = getMarketplaceDc();
  const listingIds = new Set(fallback.listings.map((listing) => listing.id));
  const requestIds = new Set(fallback.requests.map((request) => request.id));

  for (const listing of fallback.listings) {
    await createMarketListing(dc, {
      id: listing.id,
      tenantId: listing.tenantId,
      sellerUserId: listing.seller.userId,
      sellerUsername: listing.seller.username,
      sellerName: listing.seller.displayName,
      sellerRole: listing.seller.role,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      condition: listing.condition,
      priceAmount: listing.priceAmount,
      location: listing.location,
      campusSpot: listing.campusSpot,
      createdAt: listing.createdAt
    });

    for (const asset of listing.media) {
      const media = buildPersistedMedia(asset, listing.createdAt);
      await createMarketListingMedia(dc, {
        id: media.id,
        tenantId: listing.tenantId,
        listingId: listing.id,
        kind: media.kind,
        url: media.url,
        fileName: media.fileName,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        storagePath: media.storagePath,
        createdAt: media.createdAt
      });
    }

    for (const savedUserId of listing.savedByUserIds) {
      await createMarketListingSave(dc, {
        id: `save-${listing.id}-${savedUserId}`,
        tenantId: listing.tenantId,
        listingId: listing.id,
        userId: savedUserId,
        createdAt: listing.createdAt
      });
    }
  }

  for (const request of fallback.requests) {
    await createMarketRequest(dc, {
      id: request.id,
      tenantId: request.tenantId,
      requesterUserId: request.requester.userId,
      requesterUsername: request.requester.username,
      requesterName: request.requester.displayName,
      requesterRole: request.requester.role,
      tab: request.tab,
      tag: request.tag,
      title: request.title,
      detail: request.detail,
      category: request.category,
      campusSpot: request.campusSpot,
      budgetLabel: request.budgetLabel,
      budgetAmount: request.budgetAmount,
      tone: request.tone,
      createdAt: request.createdAt
    });

    for (const asset of request.media) {
      const media = buildPersistedMedia(asset, request.createdAt);
      await createMarketRequestMedia(dc, {
        id: media.id,
        tenantId: request.tenantId,
        requestId: request.id,
        kind: media.kind,
        url: media.url,
        fileName: media.fileName,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        storagePath: media.storagePath,
        createdAt: media.createdAt
      });
    }
  }

  for (const contact of fallback.contacts) {
    if (contact.targetType === "listing" && listingIds.has(contact.targetId)) {
      await createMarketListingContact(dc, {
        id: contact.id,
        tenantId: contact.tenantId,
        listingId: contact.targetId,
        fromUserId: contact.fromUserId,
        toUserId: contact.toUserId,
        message: contact.message,
        createdAt: contact.createdAt
      });
      continue;
    }

    if (contact.targetType === "request" && requestIds.has(contact.targetId)) {
      await createMarketRequestContact(dc, {
        id: contact.id,
        tenantId: contact.tenantId,
        requestId: contact.targetId,
        fromUserId: contact.fromUserId,
        toUserId: contact.toUserId,
        message: contact.message,
        createdAt: contact.createdAt
      });
    }
  }

  liveSeededTenants.add(viewer.tenantId);
}

function buildDashboard(
  snapshot: Awaited<ReturnType<typeof readLiveMarketSnapshot>>,
  viewer: MarketViewerIdentity
): MarketDashboardResponse {
  const listingMediaMap = new Map<string, MarketMediaAsset[]>();
  for (const item of snapshot.listingMedia) {
    const current = listingMediaMap.get(item.listingId) ?? [];
    current.push({
      id: item.id,
      kind: item.kind === "video" ? "video" : "image",
      url: item.url,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: toMediaSizeBytes(item.sizeBytes),
      storagePath: item.storagePath ?? null
    });
    listingMediaMap.set(item.listingId, current);
  }

  const requestMediaMap = new Map<string, MarketMediaAsset[]>();
  for (const item of snapshot.requestMedia) {
    const current = requestMediaMap.get(item.requestId) ?? [];
    current.push({
      id: item.id,
      kind: item.kind === "video" ? "video" : "image",
      url: item.url,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: toMediaSizeBytes(item.sizeBytes),
      storagePath: item.storagePath ?? null
    });
    requestMediaMap.set(item.requestId, current);
  }

  const saveCounts = new Map<string, number>();
  const savedListingIds = new Set<string>();
  for (const item of snapshot.saves) {
    saveCounts.set(item.listingId, Number(saveCounts.get(item.listingId) ?? 0) + 1);
    if (item.userId === viewer.userId) {
      savedListingIds.add(item.listingId);
    }
  }

  const listingInquiryCounts = new Map<string, number>();
  for (const item of snapshot.listingContacts) {
    listingInquiryCounts.set(item.listingId, Number(listingInquiryCounts.get(item.listingId) ?? 0) + 1);
  }

  const requestResponseCounts = new Map<string, number>();
  for (const item of snapshot.requestContacts) {
    requestResponseCounts.set(item.requestId, Number(requestResponseCounts.get(item.requestId) ?? 0) + 1);
  }

  const listings = sortNewest(
    snapshot.listings.map((item) => ({
      id: item.id,
      tenantId: item.tenantId,
      seller: {
        userId: item.sellerUserId,
        username: item.sellerUsername,
        displayName: item.sellerName,
        role: normalizeRole(item.sellerRole)
      },
      title: item.title,
      description: item.description,
      category: item.category,
      condition: item.condition,
      priceAmount: item.priceAmount,
      location: item.location,
      campusSpot: item.campusSpot,
      media: listingMediaMap.get(item.id) ?? [],
      createdAt: item.createdAt,
      savedCount: Number(saveCounts.get(item.id) ?? 0),
      inquiryCount: Number(listingInquiryCounts.get(item.id) ?? 0),
      isSaved: savedListingIds.has(item.id)
    } satisfies MarketListing))
  );

  const requests = sortNewest(
    snapshot.requests.map((item) => {
      const tab = item.tab === "lend" ? "lend" : "buying";
      return {
        id: item.id,
        tenantId: item.tenantId,
        tab,
        requester: {
          userId: item.requesterUserId,
          username: item.requesterUsername,
          displayName: item.requesterName,
          role: normalizeRole(item.requesterRole)
        },
        tag: buildRequestTag(tab, item.tag),
        title: item.title,
        detail: item.detail,
        category: item.category,
        campusSpot: item.campusSpot,
        media: requestMediaMap.get(item.id) ?? [],
        budgetLabel: buildBudgetLabel(tab, item.budgetAmount ?? null, item.budgetLabel),
        budgetAmount: item.budgetAmount ?? null,
        tone: item.tone === "magenta" || item.tone === "cyan" ? item.tone : buildTone(item.category, tab),
        createdAt: item.createdAt,
        responseCount: Number(requestResponseCounts.get(item.id) ?? 0)
      } satisfies MarketRequest;
    })
  );

  return {
    tenantId: viewer.tenantId,
    viewer: {
      userId: viewer.userId,
      username: viewer.username,
      savedCount: listings.filter((listing) => listing.isSaved).length
    },
    listings,
    requests,
    viewerActiveListings: listings.filter((listing) => listing.seller.userId === viewer.userId),
    viewerActiveRequests: requests.filter((request) => request.requester.userId === viewer.userId)
  };
}

export async function getLiveMarketDashboard(viewer: MarketViewerIdentity) {
  await seedLiveMarketFromFallback(viewer);
  return buildDashboard(await readLiveMarketSnapshot(viewer.tenantId), viewer);
}

async function requireOwnedActiveLiveListing(viewer: MarketViewerIdentity, listingId: string) {
  const dc = getMarketplaceDc();
  const listing = (await getMarketListingById(dc, { listingId })).data.marketListing;

  if (!listing || listing.tenantId !== viewer.tenantId || listing.deletedAt || listing.status !== "active") {
    throw new Error("That listing is no longer available.");
  }

  if (listing.sellerUserId !== viewer.userId) {
    throw new Error("You can only manage your own listing.");
  }

  return { dc, listing };
}

async function getLiveListingMediaRecords(tenantId: string, listingId: string) {
  const dc = getMarketplaceDc();
  const response = await listMarketListingMediaByTenant(dc, { tenantId, limit: TENANT_SCAN_LIMIT });
  return response.data.marketListingMediaRecords.filter((item) => item.listingId === listingId);
}

export async function createLiveMarketPost(
  viewer: MarketViewerIdentity,
  payload: CreateMarketPostRequest
): Promise<CreateMarketPostResponse> {
  const dc = getMarketplaceDc();
  const createdAt = new Date().toISOString();
  const category = normalizeText(payload.category, "Other");
  const media =
    Array.isArray(payload.media) && payload.media.length > 0
      ? payload.media
      : normalizeText(payload.imageUrl)
        ? [buildExternalMediaAsset(normalizeText(payload.imageUrl))]
        : [];

  if (payload.tab === "sale") {
    const listingId = `listing-${randomUUID()}`;
    await createMarketListing(dc, {
      id: listingId,
      tenantId: viewer.tenantId,
      sellerUserId: viewer.userId,
      sellerUsername: viewer.username,
      sellerName: viewer.displayName,
      sellerRole: viewer.role,
      title: normalizeText(payload.title),
      description: normalizeText(payload.description),
      category,
      condition: normalizeText(payload.condition, "Good condition"),
      priceAmount: Math.max(1, Math.round(payload.priceAmount ?? 0)),
      location: normalizeMarketLocation(payload.location),
      campusSpot: normalizeMarketCampusSpot(payload.campusSpot),
      createdAt
    });

    await Promise.all(
      media.map((asset) => {
        const persisted = buildPersistedMedia(asset, createdAt);
        return createMarketListingMedia(dc, {
          id: persisted.id,
          tenantId: viewer.tenantId,
          listingId,
          kind: persisted.kind,
          url: persisted.url,
          fileName: persisted.fileName,
          mimeType: persisted.mimeType,
          sizeBytes: persisted.sizeBytes,
          storagePath: persisted.storagePath,
          createdAt: persisted.createdAt
        });
      })
    );

    return {
      dashboard: await getLiveMarketDashboard(viewer),
      itemId: listingId,
      itemType: "listing"
    };
  }

  const requestId = `request-${randomUUID()}`;
  const tab = payload.tab === "lend" ? "lend" : "buying";
  await createMarketRequest(dc, {
    id: requestId,
    tenantId: viewer.tenantId,
    requesterUserId: viewer.userId,
    requesterUsername: viewer.username,
    requesterName: viewer.displayName,
    requesterRole: viewer.role,
    tab,
    tag: buildRequestTag(tab, payload.tag),
    title: normalizeText(payload.title),
    detail: normalizeText(payload.description),
    category,
    campusSpot: normalizeMarketCampusSpot(payload.campusSpot),
    budgetLabel: buildBudgetLabel(tab, payload.budgetAmount ?? null, payload.budgetLabel),
    budgetAmount: typeof payload.budgetAmount === "number" && Number.isFinite(payload.budgetAmount) ? Math.round(payload.budgetAmount) : null,
    tone: buildTone(category, tab),
    createdAt
  });

  await Promise.all(
    media.map((asset) => {
      const persisted = buildPersistedMedia(asset, createdAt);
      return createMarketRequestMedia(dc, {
        id: persisted.id,
        tenantId: viewer.tenantId,
        requestId,
        kind: persisted.kind,
        url: persisted.url,
        fileName: persisted.fileName,
        mimeType: persisted.mimeType,
        sizeBytes: persisted.sizeBytes,
        storagePath: persisted.storagePath,
        createdAt: persisted.createdAt
      });
    })
  );

  return {
    dashboard: await getLiveMarketDashboard(viewer),
    itemId: requestId,
    itemType: "request"
  };
}

export async function updateLiveMarketListing(
  viewer: MarketViewerIdentity,
  payload: UpdateMarketListingRequest
): Promise<UpdateMarketListingResponse> {
  const { dc, listing } = await requireOwnedActiveLiveListing(viewer, payload.listingId);
  const existingMedia = await getLiveListingMediaRecords(viewer.tenantId, listing.id);

  await updateMarketListingDetails(dc, {
    id: listing.id,
    title: normalizeText(payload.title),
    description: normalizeText(payload.description),
    category: normalizeText(payload.category, "Other"),
    condition: normalizeText(payload.condition, "Good condition"),
    priceAmount: Math.max(1, Math.round(payload.priceAmount)),
    location: listing.location,
    campusSpot: listing.campusSpot
  });

  const keepMediaIds = new Set(
    Array.isArray(payload.keepMediaIds) ? payload.keepMediaIds : existingMedia.map((item) => item.id)
  );
  const removedMedia = existingMedia.filter((item) => !keepMediaIds.has(item.id));

  await Promise.all(
    removedMedia.map((item) =>
      softDeleteMarketListingMedia(dc, {
        id: item.id
      })
    )
  );

  const createdAt = new Date().toISOString();
  await Promise.all(
    (payload.media ?? []).map((asset) => {
      const persisted = buildPersistedMedia(asset, createdAt);
      return createMarketListingMedia(dc, {
        id: persisted.id,
        tenantId: viewer.tenantId,
        listingId: listing.id,
        kind: persisted.kind,
        url: persisted.url,
        fileName: persisted.fileName,
        mimeType: persisted.mimeType,
        sizeBytes: persisted.sizeBytes,
        storagePath: persisted.storagePath,
        createdAt: persisted.createdAt
      });
    })
  );

  await deleteMarketMediaAssets(
    removedMedia.map((item) => ({
      id: item.id,
      kind: item.kind === "video" ? "video" : "image",
      url: item.url,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: toMediaSizeBytes(item.sizeBytes),
      storagePath: item.storagePath ?? null
    }))
  );

  return {
    dashboard: await getLiveMarketDashboard(viewer),
    listingId: listing.id
  };
}

export async function markLiveMarketListingSold(
  viewer: MarketViewerIdentity,
  listingId: string
): Promise<ManageMarketListingResponse> {
  const { dc, listing } = await requireOwnedActiveLiveListing(viewer, listingId);
  await markMarketListingSold(dc, { id: listing.id });

  return {
    dashboard: await getLiveMarketDashboard(viewer),
    listingId: listing.id,
    action: "sold"
  };
}

export async function deleteLiveMarketListing(
  viewer: MarketViewerIdentity,
  listingId: string
): Promise<ManageMarketListingResponse> {
  const { dc, listing } = await requireOwnedActiveLiveListing(viewer, listingId);
  const existingMedia = await getLiveListingMediaRecords(viewer.tenantId, listing.id);
  await softDeleteMarketListing(dc, { id: listing.id });
  await Promise.all(existingMedia.map((item) => softDeleteMarketListingMedia(dc, { id: item.id })));
  await deleteMarketMediaAssets(
    existingMedia.map((item) => ({
      id: item.id,
      kind: item.kind === "video" ? "video" : "image",
      url: item.url,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: toMediaSizeBytes(item.sizeBytes),
      storagePath: item.storagePath ?? null
    }))
  );

  return {
    dashboard: await getLiveMarketDashboard(viewer),
    listingId: listing.id,
    action: "deleted"
  };
}

export async function toggleLiveMarketSave(
  viewer: MarketViewerIdentity,
  listingId: string
): Promise<ToggleMarketSaveResponse> {
  const dc = getMarketplaceDc();
  const listing = (await getMarketListingById(dc, { listingId })).data.marketListing;

  if (!listing || listing.tenantId !== viewer.tenantId || listing.deletedAt || listing.status !== "active") {
    throw new Error("That listing no longer exists.");
  }

  if (listing.sellerUserId === viewer.userId) {
    throw new Error("You cannot save your own listing.");
  }

  const existing = await listActiveMarketListingSavesByUserAndListing(dc, {
    tenantId: viewer.tenantId,
    listingId,
    userId: viewer.userId,
    limit: SAVE_LOOKUP_LIMIT
  });

  const current = existing.data.marketListingSaves[0] ?? null;
  let isSaved = false;

  if (current) {
    await softDeleteMarketListingSave(dc, { id: current.id });
  } else {
    await createMarketListingSave(dc, {
      id: `save-${randomUUID()}`,
      tenantId: viewer.tenantId,
      listingId,
      userId: viewer.userId,
      createdAt: new Date().toISOString()
    });
    isSaved = true;
  }

  return {
    dashboard: await getLiveMarketDashboard(viewer),
    listingId,
    isSaved
  };
}

export async function createLiveMarketContact(
  viewer: MarketViewerIdentity,
  input: {
    targetId: string;
    targetType: "listing" | "request";
    message: string;
  }
): Promise<ContactMarketPostResponse> {
  const dc = getMarketplaceDc();
  const createdAt = new Date().toISOString();

  if (input.targetType === "listing") {
    const listing = (await getMarketListingById(dc, { listingId: input.targetId })).data.marketListing;

    if (!listing || listing.tenantId !== viewer.tenantId || listing.deletedAt || listing.status !== "active") {
      throw new Error("That market post is no longer available.");
    }

    if (listing.sellerUserId === viewer.userId) {
      throw new Error("You cannot contact your own market post.");
    }

    await createMarketListingContact(dc, {
      id: `contact-${randomUUID()}`,
      tenantId: viewer.tenantId,
      listingId: input.targetId,
      fromUserId: viewer.userId,
      toUserId: listing.sellerUserId,
      message: normalizeText(input.message),
      createdAt
    });
  } else {
    const request = (await getMarketRequestById(dc, { requestId: input.targetId })).data.marketRequest;

    if (!request || request.tenantId !== viewer.tenantId || request.deletedAt || request.status !== "active") {
      throw new Error("That market post is no longer available.");
    }

    if (request.requesterUserId === viewer.userId) {
      throw new Error("You cannot contact your own market post.");
    }

    await createMarketRequestContact(dc, {
      id: `contact-${randomUUID()}`,
      tenantId: viewer.tenantId,
      requestId: input.targetId,
      fromUserId: viewer.userId,
      toUserId: request.requesterUserId,
      message: normalizeText(input.message),
      createdAt
    });
  }

  return {
    dashboard: await getLiveMarketDashboard(viewer),
    targetId: input.targetId,
    targetType: input.targetType
  };
}
