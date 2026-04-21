import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { CreateMarketPostRequest, MarketMediaAsset, MarketTab } from "@vyb/contracts";
import { getViewerProfile } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import { createMarketPost, getMarketDashboard } from "../../../src/lib/market-data";
import { deleteMarketMediaAssets, persistMarketMediaAssets } from "../../../src/lib/market-media-server";
import { resolveMarketViewerIdentity } from "../../../src/lib/market-server";

type ParsedMarketCreatePayload = Omit<Partial<CreateMarketPostRequest>, "priceAmount" | "budgetAmount"> & {
  priceAmount?: string | number | null;
  budgetAmount?: string | number | null;
};

type ParsedMarketCreateBody = {
  payload: ParsedMarketCreatePayload;
  files: File[];
};

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

function parseTab(value: unknown): MarketTab | null {
  return value === "sale" || value === "buying" || value === "lend" ? value : null;
}

function parseAmount(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : Number.NaN;
}

function readOptionalStringFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function isFileEntry(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function buildParsedCreateBodyFromFormData(formData: FormData): ParsedMarketCreateBody {
  return {
    payload: {
      tab: readOptionalStringFromForm(formData, "tab") as CreateMarketPostRequest["tab"],
      title: readOptionalStringFromForm(formData, "title") ?? "",
      category: readOptionalStringFromForm(formData, "category") ?? "",
      description: readOptionalStringFromForm(formData, "description") ?? "",
      location: readOptionalStringFromForm(formData, "location"),
      campusSpot: readOptionalStringFromForm(formData, "campusSpot") ?? "",
      imageUrl: readOptionalStringFromForm(formData, "imageUrl"),
      condition: readOptionalStringFromForm(formData, "condition"),
      priceAmount: readOptionalStringFromForm(formData, "priceAmount"),
      budgetAmount: readOptionalStringFromForm(formData, "budgetAmount"),
      budgetLabel: readOptionalStringFromForm(formData, "budgetLabel"),
      tag: readOptionalStringFromForm(formData, "tag")
    },
    files: formData.getAll("media").filter(isFileEntry).filter((file) => file.size > 0)
  };
}

async function parseCreateBody(request: Request): Promise<ParsedMarketCreateBody | null> {
  const contentType = request.headers.get("content-type") ?? "";
  const formRequest = request.clone();
  const jsonRequest = request.clone();

  if (!contentType.includes("application/json")) {
    const formData = await formRequest.formData().catch(() => null);

    if (formData) {
      return buildParsedCreateBodyFromFormData(formData);
    }
  }

  const payload = (await jsonRequest.json().catch(() => null)) as ParsedMarketCreatePayload | null;

  if (!payload) {
    return null;
  }

  return {
    payload,
    files: []
  };
}

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before opening the market.");
  }

  const identity = await resolveMarketViewerIdentity(viewer);
  return NextResponse.json(await getMarketDashboard(identity));
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before creating a market post.");
  }

  const parsedBody = await parseCreateBody(request);

  if (!parsedBody) {
    return buildError(400, "INVALID_BODY", "Request body must be valid JSON or multipart form data.");
  }

  const { payload, files } = parsedBody;
  const tab = parseTab(payload.tab);
  const title = payload.title?.trim() ?? "";
  const category = payload.category?.trim() ?? "";
  const description = payload.description?.trim() ?? "";
  const campusSpot = payload.campusSpot?.trim() ?? "";
  const location = payload.location?.trim() ?? "";
  const priceAmount = parseAmount(payload.priceAmount);
  const budgetAmount = parseAmount(payload.budgetAmount);

  if (!tab) {
    return buildError(400, "INVALID_TAB", "Choose whether this post is a listing, request, or lend post.");
  }

  if (!title) {
    return buildError(400, "INVALID_TITLE", "Add a title for your market post.");
  }

  if (!category) {
    return buildError(400, "INVALID_CATEGORY", "Choose a category so people can discover your post.");
  }

  if (!description) {
    return buildError(400, "INVALID_DESCRIPTION", "Add a short description so others understand the post.");
  }

  if (tab === "sale") {
    if (!Number.isFinite(priceAmount) || priceAmount === null || priceAmount <= 0) {
      return buildError(400, "INVALID_PRICE", "Add a valid price for the listing.");
    }
  }

  if (budgetAmount !== null && (!Number.isFinite(budgetAmount) || budgetAmount < 0)) {
    return buildError(400, "INVALID_BUDGET", "Budget must be a positive amount.");
  }

  const profile = await getViewerProfile(viewer).catch((error) => {
    console.error("[web/market] profile-check-failed", {
      userId: viewer.userId,
      tenantId: viewer.tenantId,
      message: error instanceof Error ? error.message : "unknown"
    });
    return null;
  });

  if (!profile) {
    return buildError(503, "PROFILE_CHECK_FAILED", "We could not verify your campus profile right now.");
  }

  if (!profile.profileCompleted) {
    return buildError(403, "PROFILE_INCOMPLETE", "Complete your profile before publishing in the campus market.");
  }

  const identity = await resolveMarketViewerIdentity(viewer, profile);
  let uploadedMedia: MarketMediaAsset[] = [];

  try {
    uploadedMedia = await persistMarketMediaAssets({
      tenantId: viewer.tenantId,
      userId: viewer.userId,
      postId: randomUUID(),
      tab,
      files
    });

    const response = await createMarketPost(identity, {
      tab,
      title,
      category,
      description,
      location: location || null,
      campusSpot,
      imageUrl: payload.imageUrl?.trim() || null,
      media: uploadedMedia,
      condition: payload.condition?.trim() || null,
      priceAmount,
      budgetAmount,
      budgetLabel: payload.budgetLabel?.trim() || null,
      tag: payload.tag?.trim() || null
    });

    console.info("[web/market] create-succeeded", {
      userId: viewer.userId,
      tenantId: viewer.tenantId,
      tab,
      itemId: response.itemId,
      itemType: response.itemType,
      mediaCount: uploadedMedia.length
    });

    return NextResponse.json(response);
  } catch (error) {
    if (uploadedMedia.length > 0) {
      await deleteMarketMediaAssets(uploadedMedia).catch((cleanupError) => {
        console.error("[web/market] cleanup-failed", {
          userId: viewer.userId,
          tenantId: viewer.tenantId,
          uploadedMediaCount: uploadedMedia.length,
          message: cleanupError instanceof Error ? cleanupError.message : "unknown"
        });
      });
    }

    console.error("[web/market] create-failed", {
      userId: viewer.userId,
      tenantId: viewer.tenantId,
      tab,
      title,
      category,
      fileCount: files.length,
      uploadedMediaCount: uploadedMedia.length,
      message: error instanceof Error ? error.message : "unknown"
    });

    return buildError(500, "MARKET_CREATE_FAILED", error instanceof Error ? error.message : "We could not publish the market post.");
  }
}
