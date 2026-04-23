import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { MarketTab, UpdateMarketRequestRequest } from "@vyb/contracts";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { deleteMarketRequest, updateMarketRequest } from "../../../../../src/lib/market-data";
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
    requestId: string;
  }>;
};

type ParsedUpdatePayload = Omit<Partial<UpdateMarketRequestRequest>, "budgetAmount"> & {
  tab?: MarketTab | null;
  budgetAmount?: string | number | null;
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

async function parseUpdateBody(request: Request): Promise<ParsedUpdateBody | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);

    if (!formData) {
      return null;
    }

    return {
      payload: {
        tab: parseTab(readOptionalStringFromForm(formData, "tab")),
        title: readOptionalStringFromForm(formData, "title") ?? "",
        category: readOptionalStringFromForm(formData, "category") ?? "",
        description: readOptionalStringFromForm(formData, "description") ?? "",
        budgetAmount: readOptionalStringFromForm(formData, "budgetAmount"),
        budgetLabel: readOptionalStringFromForm(formData, "budgetLabel"),
        tag: readOptionalStringFromForm(formData, "tag"),
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
    return buildError(401, "UNAUTHENTICATED", "You must sign in before editing a request.");
  }

  const { requestId: rawRequestId } = await context.params;
  const requestId = rawRequestId?.trim();
  const parsed = await parseUpdateBody(request);
  const payload = parsed?.payload ?? null;
  const files = parsed?.files ?? [];
  const tab = parseTab(payload?.tab);
  const title = payload?.title?.trim();
  const category = payload?.category?.trim();
  const description = payload?.description?.trim();
  const budgetAmount = parseAmount(payload?.budgetAmount);
  const budgetLabel = payload?.budgetLabel?.trim() ?? null;
  const tag = payload?.tag?.trim() ?? null;

  if (!requestId) {
    return buildError(400, "INVALID_REQUEST", "Choose a valid request to edit.");
  }

  if (tab !== "buying" && tab !== "lend") {
    return buildError(400, "INVALID_TAB", "Choose a valid request type before saving.");
  }

  if (!title) {
    return buildError(400, "INVALID_TITLE", "Add a title for the request.");
  }

  if (!category) {
    return buildError(400, "INVALID_CATEGORY", "Choose a category for the request.");
  }

  if (!description) {
    return buildError(400, "INVALID_DESCRIPTION", "Add a short description for the request.");
  }

  if (budgetAmount !== null && (!Number.isFinite(budgetAmount) || budgetAmount < 0)) {
    return buildError(400, "INVALID_BUDGET", "Budget must be a positive amount.");
  }

  try {
    const media = await persistMarketMediaAssets({
      tenantId: viewer.tenantId,
      userId: viewer.userId,
      postId: requestId,
      tab,
      files
    });

    return NextResponse.json(
      await updateMarketRequest(viewer, {
        requestId,
        title,
        category,
        description,
        keepMediaIds: payload?.keepMediaIds,
        media,
        budgetAmount,
        budgetLabel,
        tag
      })
    );
  } catch (error) {
    return buildError(400, "MARKET_REQUEST_UPDATE_FAILED", error instanceof Error ? error.message : "We could not update the request.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before deleting a request.");
  }

  const { requestId: rawRequestId } = await context.params;
  const requestId = rawRequestId?.trim();

  if (!requestId) {
    return buildError(400, "INVALID_REQUEST", "Choose a valid request to delete.");
  }

  try {
    return NextResponse.json(await deleteMarketRequest(viewer, requestId));
  } catch (error) {
    return buildError(400, "MARKET_REQUEST_DELETE_FAILED", error instanceof Error ? error.message : "We could not delete the request.");
  }
}
