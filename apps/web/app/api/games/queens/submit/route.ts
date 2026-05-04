import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeQueensCoordinates, submitDailyQueensSolve } from "../../../../../src/lib/queens-data";
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
    code: "QUEENS_SUBMIT_FAILED",
    message: message || "We could not submit this Queens board.",
    details: null
  };
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before submitting Queens.");
  }

  const payload = (await request.json().catch(() => null)) as { sessionId?: unknown; queens?: unknown; clientElapsedSeconds?: unknown } | null;
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : "";
  const submittedQueens = normalizeQueensCoordinates(payload?.queens);
  const clientElapsedSeconds = typeof payload?.clientElapsedSeconds === "number" && Number.isFinite(payload.clientElapsedSeconds) ? payload.clientElapsedSeconds : null;

  if (!sessionId || !submittedQueens) {
    return buildError(400, "INVALID_SUBMIT_BODY", "Send a valid Queens session and queen positions before submitting.");
  }

  try {
    return NextResponse.json(await submitDailyQueensSolve(viewer, sessionId, submittedQueens, clientElapsedSeconds));
  } catch (error) {
    const queensError = getQueensError(error);
    return buildError(400, queensError.code, queensError.message, queensError.details);
  }
}
