import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { upsertChatIdentity } from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PUT(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before enabling encrypted chat.");
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return buildError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    return NextResponse.json(await upsertChatIdentity(viewer, payload));
  } catch (error) {
    return buildError(500, "CHAT_KEY_FAILED", error instanceof Error ? error.message : "We could not publish your chat key.");
  }
}
