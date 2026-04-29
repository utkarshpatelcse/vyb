import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getChatPrivacySettings,
  isBackendRequestError,
  upsertChatPrivacySettings
} from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before viewing chat privacy settings.");
  }

  try {
    return NextResponse.json(await getChatPrivacySettings(viewer));
  } catch (error) {
    if (isBackendRequestError(error)) {
      return buildError(error.statusCode, error.code, error.message);
    }

    return buildError(
      500,
      "CHAT_PRIVACY_SETTINGS_FETCH_FAILED",
      error instanceof Error ? error.message : "We could not load chat privacy settings."
    );
  }
}

export async function PUT(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before updating chat privacy settings.");
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return buildError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    return NextResponse.json(await upsertChatPrivacySettings(viewer, payload));
  } catch (error) {
    if (isBackendRequestError(error)) {
      return buildError(error.statusCode, error.code, error.message);
    }

    return buildError(
      500,
      "CHAT_PRIVACY_SETTINGS_UPDATE_FAILED",
      error instanceof Error ? error.message : "We could not update chat privacy settings."
    );
  }
}
