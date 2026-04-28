import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import { startDailyConnectSession } from "../../../../../src/lib/connect-data";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before playing Connect.");
  }

  try {
    return NextResponse.json(await startDailyConnectSession(viewer));
  } catch (error) {
    return buildError(500, "CONNECT_DAILY_FAILED", error instanceof Error ? error.message : "We could not load today's Connect puzzle.");
  }
}
