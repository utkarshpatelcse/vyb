import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listNotifications } from "../../../src/lib/notifications";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function parseState(value: string | null) {
  return value === "unread" || value === "read" || value === "archived" ? value : "all";
}

export async function GET(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());
  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before viewing notifications.");
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "30");

  try {
    return NextResponse.json(
      await listNotifications(viewer, {
        state: parseState(url.searchParams.get("state")),
        category: url.searchParams.get("category"),
        limit: Number.isInteger(limit) && limit > 0 ? limit : 30,
        cursor: url.searchParams.get("cursor")
      })
    );
  } catch (error) {
    return buildError(
      500,
      "NOTIFICATIONS_LIST_FAILED",
      error instanceof Error ? error.message : "We could not load your notifications."
    );
  }
}
