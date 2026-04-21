import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { UpdateMarketListingRequest } from "@vyb/contracts";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { deleteMarketListing, updateMarketListing } from "../../../../../src/lib/market-data";
import { persistMarketMediaAssets } from "../../../../../src/lib/market-media-server";

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

type ParsedUpdatePayload = Omit<Partial<UpdateMarketListingRequest>, "priceAmount"> & {
  priceAmount?: string | number | null;
};

type ParsedUpdateBody = {
  payload: ParsedUpdatePayload;
  files: File[];
};

function readOptionalStringFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function isFileEntry(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

async function parseUpdateBody(request: Request): Promise<ParsedUpdateBody | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);

    if (!formData) {
      return null;
    }

    return {
      payload: {
        title: readOptionalStringFromForm(formData, "title") ?? "",
        category: readOptionalStringFromForm(formData, "category") ?? "",
        description: readOptionalStringFromForm(formData, "description") ?? "",
        condition: readOptionalStringFromForm(formData, "condition"),
        priceAmount: readOptionalStringFromForm(formData, "priceAmount"),
        keepMediaIds: formData
          .getAll("keepMediaIds")
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      },
      files: formData.getAll("media").filter(isFileEntry).filter((file) => file.size > 0)
    };
  }

  const payload = (await request.json().catch(() => null)) as ParsedUpdatePayload | null;

  if (!payload) {
    return null;
  }

  return {
    payload,
    files: []
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before editing a listing.");
  }

  const { listingId: rawListingId } = await context.params;
  const listingId = rawListingId?.trim();
  const parsed = await parseUpdateBody(request);
  const payload = parsed?.payload ?? null;
  const files = parsed?.files ?? [];
  const title = payload?.title?.trim();
  const category = payload?.category?.trim();
  const description = payload?.description?.trim();
  const condition = payload?.condition?.trim() ?? null;
  const priceAmount = typeof payload?.priceAmount === "number" ? payload.priceAmount : Number(payload?.priceAmount);

  if (!listingId) {
    return buildError(400, "INVALID_LISTING", "Choose a valid listing to edit.");
  }

  if (!title) {
    return buildError(400, "INVALID_TITLE", "Add a title for the listing.");
  }

  if (!category) {
    return buildError(400, "INVALID_CATEGORY", "Choose a category for the listing.");
  }

  if (!description) {
    return buildError(400, "INVALID_DESCRIPTION", "Add a short description for the listing.");
  }

  if (!Number.isFinite(priceAmount) || priceAmount <= 0) {
    return buildError(400, "INVALID_PRICE", "Add a valid price for the listing.");
  }

  try {
    const media = await persistMarketMediaAssets({
      tenantId: viewer.tenantId,
      userId: viewer.userId,
      postId: listingId,
      tab: "sale",
      files
    });

    return NextResponse.json(
      await updateMarketListing(viewer, {
        listingId,
        title,
        category,
        description,
        condition,
        priceAmount: Math.round(priceAmount),
        keepMediaIds: payload?.keepMediaIds,
        media
      })
    );
  } catch (error) {
    return buildError(400, "MARKET_LISTING_UPDATE_FAILED", error instanceof Error ? error.message : "We could not update the listing.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before deleting a listing.");
  }

  const { listingId: rawListingId } = await context.params;
  const listingId = rawListingId?.trim();

  if (!listingId) {
    return buildError(400, "INVALID_LISTING", "Choose a valid listing to delete.");
  }

  try {
    return NextResponse.json(await deleteMarketListing(viewer, listingId));
  } catch (error) {
    return buildError(400, "MARKET_LISTING_DELETE_FAILED", error instanceof Error ? error.message : "We could not delete the listing.");
  }
}
