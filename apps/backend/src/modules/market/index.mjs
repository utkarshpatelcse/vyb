import { readJson, sendError, sendJson } from "../../lib/http.mjs";
import { getProfileByUserId } from "../identity/profile-repository.mjs";
import { resolveLiveContext } from "../shared/viewer-context.mjs";
import {
  createLiveMarketContact,
  createLiveMarketPost,
  deleteLiveMarketListing,
  getLiveMarketDashboard,
  markLiveMarketListingSold,
  toggleLiveMarketSave,
  updateLiveMarketListing
} from "./repository.mjs";

function requireNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseAmount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : Number.NaN;
}

function buildFallbackUsername(email, userId) {
  return String(email ?? "")
    .split("@")[0]
    ?.trim() || userId;
}

function buildMarketViewer(resolved, profile) {
  return {
    userId: resolved.live.user.id,
    tenantId: resolved.live.tenant.id,
    username: profile?.username ?? buildFallbackUsername(resolved.viewer.primaryEmail, resolved.live.user.id),
    displayName: profile?.fullName ?? resolved.viewer.displayName,
    role:
      resolved.live.membership?.role === "faculty" ||
      resolved.live.membership?.role === "alumni" ||
      resolved.live.membership?.role === "moderator" ||
      resolved.live.membership?.role === "admin"
        ? resolved.live.membership.role
        : "student"
  };
}

function sendMarketFailure(response, scope, resolved, error) {
  console.error(`[market] ${scope}:failed`, {
    tenantId: resolved?.live?.tenant?.id ?? null,
    userId: resolved?.live?.user?.id ?? null,
    message: error instanceof Error ? error.message : "unknown"
  });

  sendError(
    response,
    502,
    `${scope.toUpperCase()}_FAILED`,
    error instanceof Error ? error.message : "Market service is unavailable right now."
  );
}

export function getMarketModuleHealth() {
  return {
    module: "market",
    status: "ok"
  };
}

export async function handleMarketRoute({ request, response, url, context }) {
  if (!context.actor) {
    return false;
  }

  if (!url.pathname.startsWith("/v1/market")) {
    return false;
  }

  const resolved = await resolveLiveContext(context.actor);
  if (!resolved?.live?.tenant || !resolved.live.user) {
    sendError(response, 401, "UNAUTHENTICATED", "An authenticated membership is required.");
    return true;
  }

  const profile = await getProfileByUserId({
    tenantId: resolved.live.tenant.id,
    userId: resolved.live.user.id
  }).catch(() => null);
  const viewer = buildMarketViewer(resolved, profile);

  if (request.method === "GET" && url.pathname === "/v1/market") {
    try {
      sendJson(response, 200, await getLiveMarketDashboard(viewer));
    } catch (error) {
      sendMarketFailure(response, "market_dashboard", resolved, error);
    }
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/market") {
    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const tab = payload.tab === "sale" || payload.tab === "buying" || payload.tab === "lend" ? payload.tab : null;
    const title = requireNonEmptyString(payload.title) ? payload.title.trim() : "";
    const category = requireNonEmptyString(payload.category) ? payload.category.trim() : "";
    const description = requireNonEmptyString(payload.description) ? payload.description.trim() : "";
    const priceAmount = parseAmount(payload.priceAmount);
    const budgetAmount = parseAmount(payload.budgetAmount);

    if (!profile?.profileCompleted) {
      sendError(response, 403, "PROFILE_INCOMPLETE", "Complete your profile before publishing in the campus market.");
      return true;
    }

    if (!tab) {
      sendError(response, 400, "INVALID_TAB", "Choose whether this post is a listing, request, or lend post.");
      return true;
    }

    if (!title) {
      sendError(response, 400, "INVALID_TITLE", "Add a title for your market post.");
      return true;
    }

    if (!category) {
      sendError(response, 400, "INVALID_CATEGORY", "Choose a category so people can discover your post.");
      return true;
    }

    if (!description) {
      sendError(response, 400, "INVALID_DESCRIPTION", "Add a short description so others understand the post.");
      return true;
    }

    if (tab === "sale" && (!Number.isFinite(priceAmount) || priceAmount === null || priceAmount <= 0)) {
      sendError(response, 400, "INVALID_PRICE", "Add a valid price for the listing.");
      return true;
    }

    if (budgetAmount !== null && (!Number.isFinite(budgetAmount) || budgetAmount < 0)) {
      sendError(response, 400, "INVALID_BUDGET", "Budget must be a positive amount.");
      return true;
    }

    try {
      const created = await createLiveMarketPost(viewer, {
        tab,
        title,
        category,
        description,
        location: requireNonEmptyString(payload.location) ? payload.location.trim() : null,
        campusSpot: requireNonEmptyString(payload.campusSpot) ? payload.campusSpot.trim() : null,
        imageUrl: requireNonEmptyString(payload.imageUrl) ? payload.imageUrl.trim() : null,
        media: Array.isArray(payload.media) ? payload.media : [],
        condition: requireNonEmptyString(payload.condition) ? payload.condition.trim() : null,
        priceAmount,
        budgetAmount,
        budgetLabel: requireNonEmptyString(payload.budgetLabel) ? payload.budgetLabel.trim() : null,
        tag: requireNonEmptyString(payload.tag) ? payload.tag.trim() : null
      });

      sendJson(response, 201, created);
    } catch (error) {
      sendMarketFailure(response, "market_create", resolved, error);
    }
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/market/save") {
    const payload = await readJson(request);
    const listingId = requireNonEmptyString(payload?.listingId) ? payload.listingId.trim() : null;

    if (!listingId) {
      sendError(response, 400, "INVALID_LISTING", "Choose a valid listing to save.");
      return true;
    }

    try {
      sendJson(response, 200, await toggleLiveMarketSave(viewer, listingId));
    } catch (error) {
      sendMarketFailure(response, "market_save", resolved, error);
    }
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/market/contact") {
    const payload = await readJson(request);
    const targetId = requireNonEmptyString(payload?.targetId) ? payload.targetId.trim() : null;
    const targetType = payload?.targetType === "listing" || payload?.targetType === "request" ? payload.targetType : null;
    const message = requireNonEmptyString(payload?.message) ? payload.message.trim() : "";

    if (!targetId || !targetType) {
      sendError(response, 400, "INVALID_TARGET", "Choose a valid listing or request first.");
      return true;
    }

    if (!message) {
      sendError(response, 400, "INVALID_MESSAGE", "Write a short message before sending it.");
      return true;
    }

    try {
      sendJson(
        response,
        200,
        await createLiveMarketContact(viewer, {
          targetId,
          targetType,
          message
        })
      );
    } catch (error) {
      sendMarketFailure(response, "market_contact", resolved, error);
    }
    return true;
  }

  const soldMatch = request.method === "POST" ? url.pathname.match(/^\/v1\/market\/listings\/([^/]+)\/sold$/) : null;
  if (soldMatch) {
    try {
      sendJson(response, 200, await markLiveMarketListingSold(viewer, soldMatch[1]));
    } catch (error) {
      sendMarketFailure(response, "market_sold", resolved, error);
    }
    return true;
  }

  const listingMatch =
    request.method === "PATCH" || request.method === "DELETE"
      ? url.pathname.match(/^\/v1\/market\/listings\/([^/]+)$/)
      : null;
  if (listingMatch) {
    const listingId = listingMatch[1];

    if (request.method === "DELETE") {
      try {
        sendJson(response, 200, await deleteLiveMarketListing(viewer, listingId));
      } catch (error) {
        sendMarketFailure(response, "market_delete", resolved, error);
      }
      return true;
    }

    const payload = await readJson(request);
    if (!payload || typeof payload !== "object") {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const title = requireNonEmptyString(payload.title) ? payload.title.trim() : "";
    const category = requireNonEmptyString(payload.category) ? payload.category.trim() : "";
    const description = requireNonEmptyString(payload.description) ? payload.description.trim() : "";
    const priceAmount = parseAmount(payload.priceAmount);

    if (!title) {
      sendError(response, 400, "INVALID_TITLE", "Add a title for the listing.");
      return true;
    }

    if (!category) {
      sendError(response, 400, "INVALID_CATEGORY", "Choose a category for the listing.");
      return true;
    }

    if (!description) {
      sendError(response, 400, "INVALID_DESCRIPTION", "Add a short description for the listing.");
      return true;
    }

    if (!Number.isFinite(priceAmount) || priceAmount <= 0) {
      sendError(response, 400, "INVALID_PRICE", "Add a valid price for the listing.");
      return true;
    }

    try {
      sendJson(
        response,
        200,
        await updateLiveMarketListing(viewer, {
          listingId,
          title,
          category,
          description,
          condition: requireNonEmptyString(payload.condition) ? payload.condition.trim() : null,
          priceAmount: Math.round(priceAmount),
          keepMediaIds: Array.isArray(payload.keepMediaIds) ? payload.keepMediaIds.filter(requireNonEmptyString) : [],
          media: Array.isArray(payload.media) ? payload.media : []
        })
      );
    } catch (error) {
      sendMarketFailure(response, "market_update", resolved, error);
    }
    return true;
  }

  return false;
}
