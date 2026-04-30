import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeConnectPath, requestDailyConnectHint } from "../../../../../src/lib/connect-data";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function getConnectErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("google oauth2 access token") ||
    normalizedMessage.includes("default credentials") ||
    normalizedMessage.includes("application default credentials")
  ) {
    return "Connect storage is not configured for this environment.";
  }

  return message || "We could not prepare a Connect hint.";
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before using Connect hints.");
  }

  const payload = (await request.json().catch(() => null)) as { sessionId?: unknown; path?: unknown } | null;
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : "";
  const submittedPath = normalizeConnectPath(payload?.path);

  if (!sessionId || !submittedPath) {
    return buildError(400, "INVALID_HINT_BODY", "Send a valid Connect session and path before asking for a hint.");
  }

  try {
    return NextResponse.json(await requestDailyConnectHint(viewer, sessionId, submittedPath));
  } catch (error) {
    return buildError(400, "CONNECT_HINT_FAILED", getConnectErrorMessage(error));
  }
}
