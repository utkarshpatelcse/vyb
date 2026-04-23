import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import {
  getFirebaseAdminApp,
  getFirebaseDataConnect
} from "../../../../../packages/config/src/index.mjs";
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
  listActiveMarketListingContactsByTenant,
  listActiveMarketListingSavesByTenant,
  listActiveMarketListingSavesByUserAndListing,
  listActiveMarketRequestContactsByTenant,
  listMarketListingMediaByTenant,
  listMarketListingsByTenant,
  listMarketRequestMediaByTenant,
  listMarketRequestsByTenant,
  markMarketListingSold,
  softDeleteMarketListing,
  softDeleteMarketListingMedia,
  softDeleteMarketListingSave,
  updateMarketListingDetails
} from "../../../../../packages/dataconnect/marketplace-admin-sdk/esm/index.esm.js";
import { listProfilesByTenant } from "../identity/profile-repository.mjs";

const TENANT_SCAN_LIMIT = 5000;
const SAVE_LOOKUP_LIMIT = 8;
const LEGACY_MARKET_SEED_USER_ID_PREFIX = "seed-";
const MARKET_DEFAULT_LOCATION = "Campus";
const MARKET_DEFAULT_CAMPUS_SPOT = "Meetup in chat";

function getMarketplaceDc() {
  return getFirebaseDataConnect(marketplaceConnectorConfig);
}

function getMarketplaceStorageBucket() {
  return getStorage(getFirebaseAdminApp("backend-market-storage")).bucket();
}

function normalizeText(value, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function normalizeMarketLocation(value) {
  const trimmed = normalizeText(value);
  return trimmed || MARKET_DEFAULT_LOCATION;
}

function normalizeMarketCampusSpot(value) {
  const trimmed = normalizeText(value);
  return trimmed || MARKET_DEFAULT_CAMPUS_SPOT;
}

function formatAmount(amount) {
  return `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
}

function buildBudgetLabel(tab, budgetAmount, budgetLabel) {
  const customLabel = normalizeText(budgetLabel);

  if (customLabel) {
    return customLabel;
  }

  if (budgetAmount && budgetAmount > 0) {
    return tab === "buying" ? `Budget around ${formatAmount(budgetAmount)}` : `Can pay about ${formatAmount(budgetAmount)}`;
  }

  return tab === "buying" ? "Open to the best fair offer" : "Open to borrow or rent";
}

function buildRequestTag(tab, providedTag) {
  const customTag = normalizeText(providedTag);

  if (customTag) {
    return customTag;
  }

  return tab === "buying" ? "Looking to buy" : "Need to borrow";
}

function buildTone(category, tab) {
  if (tab === "lend") {
    return "cyan";
  }

  const palette = ["violet", "magenta", "cyan"];
  const seed = category
    .trim()
    .toLowerCase()
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return palette[seed % palette.length];
}

function normalizeRole(value) {
  return value === "faculty" || value === "alumni" || value === "moderator" || value === "admin" ? value : "student";
}

function isLegacySeedMarketActorId(value) {
  return typeof value === "string" && value.startsWith(LEGACY_MARKET_SEED_USER_ID_PREFIX);
}

function isActiveRecord(item) {
  if (!item || item.deletedAt) {
    return false;
  }

  return !item.status || item.status === "active";
}

function sortNewest(items) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function buildExternalMediaAsset(url) {
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

function toMediaSizeBytes(value) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPersistedMedia(asset, createdAt) {
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

async function buildProfileByUserIdMap(tenantId, userIds) {
  const normalizedUserIds = Array.from(
    new Set(userIds.filter((value) => typeof value === "string" && value.trim().length > 0))
  );
  if (!tenantId || normalizedUserIds.length === 0) {
    return new Map();
  }

  const userIdSet = new Set(normalizedUserIds);
  const profiles = await listProfilesByTenant(tenantId);
  return new Map(
    profiles
      .filter((profile) => userIdSet.has(profile.userId))
      .map((profile) => [profile.userId, profile])
  );
}

async function readLiveMarketSnapshot(tenantId) {
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

function buildDashboard(snapshot, viewer, profileMap = null) {
  const activeListings = snapshot.listings.filter(
    (item) => isActiveRecord(item) && !isLegacySeedMarketActorId(item.sellerUserId)
  );
  const activeRequests = snapshot.requests.filter(
    (item) => isActiveRecord(item) && !isLegacySeedMarketActorId(item.requesterUserId)
  );
  const activeListingIds = new Set(activeListings.map((item) => item.id));
  const activeRequestIds = new Set(activeRequests.map((item) => item.id));

  const listingMediaMap = new Map();
  for (const item of snapshot.listingMedia.filter((entry) => !entry.deletedAt && activeListingIds.has(entry.listingId))) {
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

  const requestMediaMap = new Map();
  for (const item of snapshot.requestMedia.filter((entry) => !entry.deletedAt && activeRequestIds.has(entry.requestId))) {
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

  const saveCounts = new Map();
  const savedListingIds = new Set();
  for (const item of snapshot.saves.filter((entry) => !entry.deletedAt && activeListingIds.has(entry.listingId))) {
    saveCounts.set(item.listingId, Number(saveCounts.get(item.listingId) ?? 0) + 1);
    if (item.userId === viewer.userId) {
      savedListingIds.add(item.listingId);
    }
  }

  const listingInquiryCounts = new Map();
  for (const item of snapshot.listingContacts.filter((entry) => !entry.deletedAt && activeListingIds.has(entry.listingId))) {
    listingInquiryCounts.set(item.listingId, Number(listingInquiryCounts.get(item.listingId) ?? 0) + 1);
  }

  const requestResponseCounts = new Map();
  for (const item of snapshot.requestContacts.filter((entry) => !entry.deletedAt && activeRequestIds.has(entry.requestId))) {
    requestResponseCounts.set(item.requestId, Number(requestResponseCounts.get(item.requestId) ?? 0) + 1);
  }

  const listings = sortNewest(
    activeListings.map((item) => {
      const profile = profileMap?.get(item.sellerUserId) ?? null;

      return {
        id: item.id,
        tenantId: item.tenantId,
        seller: {
          userId: item.sellerUserId,
          username: profile?.username ?? item.sellerUsername,
          displayName: profile?.fullName ?? item.sellerName,
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
      };
    })
  );

  const requests = sortNewest(
    activeRequests.map((item) => {
      const tab = item.tab === "lend" ? "lend" : "buying";
      const profile = profileMap?.get(item.requesterUserId) ?? null;
      return {
        id: item.id,
        tenantId: item.tenantId,
        tab,
        requester: {
          userId: item.requesterUserId,
          username: profile?.username ?? item.requesterUsername,
          displayName: profile?.fullName ?? item.requesterName,
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
      };
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

async function getLiveListingMediaRecords(tenantId, listingId) {
  const dc = getMarketplaceDc();
  const response = await listMarketListingMediaByTenant(dc, { tenantId, limit: TENANT_SCAN_LIMIT });
  return response.data.marketListingMediaRecords.filter((item) => !item.deletedAt && item.listingId === listingId);
}

async function deleteMarketMediaAssets(assets) {
  const removable = assets.filter((asset) => typeof asset.storagePath === "string" && asset.storagePath.length > 0);

  if (removable.length === 0) {
    return;
  }

  const bucket = getMarketplaceStorageBucket();
  await Promise.allSettled(removable.map((asset) => bucket.file(asset.storagePath).delete({ ignoreNotFound: true })));
}

async function requireOwnedActiveLiveListing(viewer, listingId) {
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

export async function getLiveMarketDashboard(viewer) {
  const snapshot = await readLiveMarketSnapshot(viewer.tenantId);
  const profileMap = await buildProfileByUserIdMap(viewer.tenantId, [
    ...snapshot.listings.map((item) => item.sellerUserId),
    ...snapshot.requests.map((item) => item.requesterUserId)
  ]);

  return buildDashboard(snapshot, viewer, profileMap);
}

export async function createLiveMarketPost(viewer, payload) {
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

export async function updateLiveMarketListing(viewer, payload) {
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

  await Promise.all(removedMedia.map((item) => softDeleteMarketListingMedia(dc, { id: item.id })));

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

export async function markLiveMarketListingSold(viewer, listingId) {
  const { dc, listing } = await requireOwnedActiveLiveListing(viewer, listingId);
  await markMarketListingSold(dc, { id: listing.id });

  return {
    dashboard: await getLiveMarketDashboard(viewer),
    listingId: listing.id,
    action: "sold"
  };
}

export async function deleteLiveMarketListing(viewer, listingId) {
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

export async function toggleLiveMarketSave(viewer, listingId) {
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

export async function createLiveMarketContact(viewer, input) {
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
