import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { startDailyQueensSession } from "../../../../../src/lib/queens-data";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function getQueensErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("google oauth2 access token") ||
    normalizedMessage.includes("default credentials") ||
    normalizedMessage.includes("application default credentials")
  ) {
    return "Queens storage is not configured for this environment.";
  }

  return message || "We could not load today's Queens puzzle.";
}

function parseLeaderboardOptIn(request: Request) {
  const value = new URL(request.url).searchParams.get("leaderboard")?.trim().toLowerCase();
  return value !== "off" && value !== "false" && value !== "0";
}

export async function GET(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before playing Queens.");
  }

  try {
    return NextResponse.json(await startDailyQueensSession(viewer, parseLeaderboardOptIn(request)));
  } catch (error) {
    return buildError(500, "QUEENS_DAILY_FAILED", getQueensErrorMessage(error));
  }
}
