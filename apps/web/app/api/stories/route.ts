import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import { createCampusStory, getCampusStories } from "../../../src/lib/backend";

export async function GET() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before viewing stories."
        }
      },
      { status: 401 }
    );
  }

  try {
    return NextResponse.json(await getCampusStories(viewer));
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before adding a story."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        mediaType?: "image" | "video";
        mediaUrl?: string;
        caption?: string | null;
      }
    | null;

  if (!payload?.mediaType || !payload?.mediaUrl) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_STORY",
          message: "Story media is required."
        }
      },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(
      await createCampusStory(viewer, {
        mediaType: payload.mediaType,
        mediaUrl: payload.mediaUrl,
        caption: payload.caption ?? null
      }),
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "The story service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
