import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  clearChatKeyBackupPinAttempts,
  getChatKeyBackupPinAttempts,
  isBackendRequestError,
  recordChatKeyBackupPinAttempt
} from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before checking secure backup attempts.");
  }

  try {
    return NextResponse.json(await getChatKeyBackupPinAttempts(viewer));
  } catch (error) {
    if (isBackendRequestError(error)) {
      return buildError(error.statusCode, error.code, error.message);
    }

    return buildError(
      500,
      "CHAT_KEY_BACKUP_ATTEMPTS_FETCH_FAILED",
      error instanceof Error ? error.message : "We could not load secure backup attempt status."
    );
  }
}

export async function PUT() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before updating secure backup attempts.");
  }

  try {
    return NextResponse.json(await recordChatKeyBackupPinAttempt(viewer));
  } catch (error) {
    if (isBackendRequestError(error)) {
      return buildError(error.statusCode, error.code, error.message);
    }

    return buildError(
      500,
      "CHAT_KEY_BACKUP_ATTEMPTS_RECORD_FAILED",
      error instanceof Error ? error.message : "We could not update secure backup attempt status."
    );
  }
}

export async function DELETE() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before clearing secure backup attempts.");
  }

  try {
    return NextResponse.json(await clearChatKeyBackupPinAttempts(viewer));
  } catch (error) {
    if (isBackendRequestError(error)) {
      return buildError(error.statusCode, error.code, error.message);
    }

    return buildError(
      500,
      "CHAT_KEY_BACKUP_ATTEMPTS_CLEAR_FAILED",
      error instanceof Error ? error.message : "We could not clear secure backup attempt status."
    );
  }
}
