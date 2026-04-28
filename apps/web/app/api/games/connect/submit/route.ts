import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeConnectPath, submitDailyConnectPath } from "../../../../../src/lib/connect-data";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before submitting Connect.");
  }

  const payload = (await request.json().catch(() => null)) as { sessionId?: unknown; path?: unknown } | null;
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : "";
  const submittedPath = normalizeConnectPath(payload?.path);

  if (!sessionId || !submittedPath) {
    return buildError(400, "INVALID_SUBMIT_BODY", "Send a valid Connect session and path before submitting.");
  }

  try {
    return NextResponse.json(await submitDailyConnectPath(viewer, sessionId, submittedPath));
  } catch (error) {
    return buildError(400, "CONNECT_SUBMIT_FAILED", error instanceof Error ? error.message : "We could not submit this Connect route.");
  }
}
