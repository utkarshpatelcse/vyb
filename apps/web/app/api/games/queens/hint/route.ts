import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeQueensCoordinates, requestDailyQueensHint } from "../../../../../src/lib/queens-data";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string, details: unknown = null) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

function getQueensError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("google oauth2 access token") ||
    normalizedMessage.includes("default credentials") ||
    normalizedMessage.includes("application default credentials") ||
    normalizedMessage.includes("firebase admin") ||
    normalizedMessage.includes("credential")
  ) {
    return {
      code: "QUEENS_DATACONNECT_CONFIG_FAILED",
      message: "Queens DataConnect storage is not configured for this environment.",
      details: message || null
    };
  }

  return {
    code: "QUEENS_HINT_FAILED",
    message: message || "We could not prepare a Queens hint.",
    details: null
  };
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before using Queens hints.");
  }

  const payload = (await request.json().catch(() => null)) as { sessionId?: unknown; queens?: unknown; marks?: unknown } | null;
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : "";
  const submittedQueens = normalizeQueensCoordinates(payload?.queens);
  const submittedMarks = normalizeQueensCoordinates(payload?.marks) ?? [];

  if (!sessionId || !submittedQueens) {
    return buildError(400, "INVALID_HINT_BODY", "Send a valid Queens session and queen positions before asking for a hint.");
  }

  try {
    return NextResponse.json(await requestDailyQueensHint(viewer, sessionId, submittedQueens, submittedMarks));
  } catch (error) {
    const queensError = getQueensError(error);
    return buildError(400, queensError.code, queensError.message, queensError.details);
  }
}
