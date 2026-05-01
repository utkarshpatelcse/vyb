import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeQueensCoordinates, requestDailyQueensHint } from "../../../../../src/lib/queens-data";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function getQueensErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "We could not prepare a Queens hint.";
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
    return buildError(400, "QUEENS_HINT_FAILED", getQueensErrorMessage(error));
  }
}
