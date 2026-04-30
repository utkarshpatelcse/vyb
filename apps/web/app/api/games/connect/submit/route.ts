import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeConnectPath, submitDailyConnectPath } from "../../../../../src/lib/connect-data";
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

  return message || "We could not submit this Connect route.";
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before submitting Connect.");
  }

  const payload = (await request.json().catch(() => null)) as { sessionId?: unknown; path?: unknown; clientElapsedSeconds?: unknown } | null;
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : "";
  const submittedPath = normalizeConnectPath(payload?.path);
  const clientElapsedSeconds = typeof payload?.clientElapsedSeconds === "number" && Number.isFinite(payload.clientElapsedSeconds) ? payload.clientElapsedSeconds : null;

  if (!sessionId || !submittedPath) {
    return buildError(400, "INVALID_SUBMIT_BODY", "Send a valid Connect session and path before submitting.");
  }

  try {
    return NextResponse.json(await submitDailyConnectPath(viewer, sessionId, submittedPath, clientElapsedSeconds));
  } catch (error) {
    return buildError(400, "CONNECT_SUBMIT_FAILED", getConnectErrorMessage(error));
  }
}
