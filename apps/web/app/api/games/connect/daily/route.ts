import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { startDailyConnectSession } from "../../../../../src/lib/connect-data";

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

  return message || "We could not load today's Connect puzzle.";
}

function parseLeaderboardOptIn(request: Request) {
  const value = new URL(request.url).searchParams.get("leaderboard")?.trim().toLowerCase();
  return value !== "off" && value !== "false" && value !== "0";
}

export async function GET(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before playing Connect.");
  }

  try {
    return NextResponse.json(await startDailyConnectSession(viewer, parseLeaderboardOptIn(request)));
  } catch (error) {
    return buildError(500, "CONNECT_DAILY_FAILED", getConnectErrorMessage(error));
  }
}
