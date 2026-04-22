import { NextRequest, NextResponse } from "next/server";

const OPENVERSE_API_BASE_URL = "https://api.openverse.org/v1/audio";

type OpenverseTrack = {
  id?: string;
  title?: string;
  creator?: string;
  duration?: number;
  thumbnail?: string | null;
  category?: string | null;
};

type OpenverseTrackDetail = OpenverseTrack & {
  url?: string;
};

function buildJsonError(status: number, message: string) {
  return NextResponse.json(
    {
      error: {
        message
      }
    },
    { status }
  );
}

function getSearchUrl(query: string, limit: number) {
  const url = new URL(`${OPENVERSE_API_BASE_URL}/`);
  url.searchParams.set("page_size", String(limit));
  url.searchParams.set("license_type", "commercial");
  url.searchParams.set("q", query || "ambient");
  return url;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("mode");

  if (mode === "stream") {
    const trackId = searchParams.get("trackId");
    if (!trackId) {
      return buildJsonError(400, "A track is required before we can fetch audio.");
    }

    const detailResponse = await fetch(`${OPENVERSE_API_BASE_URL}/${encodeURIComponent(trackId)}/`, {
      cache: "no-store",
      headers: {
        accept: "application/json"
      }
    });

    if (!detailResponse.ok) {
      return buildJsonError(502, "We could not look up the selected song.");
    }

    const detail = (await detailResponse.json().catch(() => null)) as OpenverseTrackDetail | null;
    if (!detail?.url) {
      return buildJsonError(404, "This song is no longer available.");
    }

    const audioResponse = await fetch(detail.url, {
      cache: "no-store",
      headers: {
        accept: "audio/mpeg,*/*"
      }
    });

    if (!audioResponse.ok || !audioResponse.body) {
      return buildJsonError(502, "We could not fetch the selected song.");
    }

    return new Response(audioResponse.body, {
      status: 200,
      headers: {
        "cache-control": "private, max-age=3600",
        "content-type": audioResponse.headers.get("content-type") ?? "audio/mpeg"
      }
    });
  }

  const query = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(12, Math.max(4, Number(searchParams.get("limit") || "8")));
  const response = await fetch(getSearchUrl(query, limit), {
    cache: "no-store",
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    return buildJsonError(502, "We could not load the music library right now.");
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        results?: OpenverseTrack[];
      }
    | null;

  const items =
    payload?.results
      ?.filter((track): track is OpenverseTrack & { id: string; title: string; creator: string; duration: number } => {
        return Boolean(track.id && track.title && track.creator && track.duration);
      })
      .filter((track) => track.category === "music")
      .map((track) => ({
        id: track.id,
        title: track.title,
        artistName: track.creator,
        durationSeconds: Math.max(1, Math.round(track.duration / 1000)),
        artworkUrl: track.thumbnail ?? null,
        streamUrl: `/api/story-music?mode=stream&trackId=${encodeURIComponent(track.id)}`
      })) ?? [];

  return NextResponse.json({ items });
}
