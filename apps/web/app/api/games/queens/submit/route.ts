import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeQueensCoordinates, submitDailyQueensSolve } from "../../../../../src/lib/queens-data";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function getQueensErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "We could not submit this Queens board.";
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
    return buildError(400, "QUEENS_SUBMIT_FAILED", getQueensErrorMessage(error));
  }
}
