import { randomUUID } from "node:crypto";
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
  const requestId = request.headers.get("x-vyb-debug-task-id") ?? `story-${randomUUID()}`;
  const debugStage = request.headers.get("x-vyb-debug-stage") ?? "publish";
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before adding a story.",
          requestId
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        mediaType?: "image" | "video";
        mediaUrl?: string;
        mediaStoragePath?: string | null;
        mediaMimeType?: string | null;
        mediaSizeBytes?: number | null;
        caption?: string | null;
      }
    | null;

  if (!payload?.mediaType || !payload?.mediaUrl) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_STORY",
          message: "Story media is required.",
          requestId
        }
      },
      { status: 400 }
    );
  }

  console.info("[web/stories] create-start", {
    requestId,
    debugStage,
    tenantId: viewer.tenantId,
    membershipId: viewer.membershipId,
    mediaType: payload.mediaType,
    mediaStoragePath: payload.mediaStoragePath ?? null,
    mediaMimeType: payload.mediaMimeType ?? null,
    mediaSizeBytes: payload.mediaSizeBytes ?? null
  });

  try {
    const item = await createCampusStory(viewer, {
        mediaType: payload.mediaType,
        mediaUrl: payload.mediaUrl,
        mediaStoragePath: payload.mediaStoragePath ?? null,
        mediaMimeType: payload.mediaMimeType ?? null,
        mediaSizeBytes: payload.mediaSizeBytes ?? null,
        caption: payload.caption ?? null
      });

    console.info("[web/stories] create-success", {
      requestId,
      debugStage,
      tenantId: viewer.tenantId,
      membershipId: viewer.membershipId,
      storyId: item.item.id
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("[web/stories] create-failed", {
      requestId,
      debugStage,
      tenantId: viewer.tenantId,
      membershipId: viewer.membershipId,
      message: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "The story service is unavailable right now.",
          requestId
        }
      },
      { status: 502 }
    );
  }
}
