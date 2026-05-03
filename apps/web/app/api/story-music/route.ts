import { NextRequest, NextResponse } from "next/server";

const OPENVERSE_API_BASE_URL = "https://api.openverse.org/v1/audio";
const STORY_MUSIC_FETCH_TIMEOUT_MS = 12000;
const STORY_MUSIC_MAX_REDIRECTS = 3;
const STORY_MUSIC_MAX_STREAM_BYTES = 24 * 1024 * 1024;
const STORY_MUSIC_ALLOWED_CONTENT_TYPES = [
  "audio/",
  "application/ogg",
  "application/octet-stream"
];

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

function isPrivateIpv4Address(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }

  const octets = parts.map((part) => Number(part));
  if (octets.some((octet, index) => !Number.isInteger(octet) || octet < 0 || octet > 255 || String(octet) !== parts[index])) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isPrivateIpv6Address(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function isSafeAudioSourceUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    return false;
  }

  return !isPrivateIpv4Address(hostname) && !isPrivateIpv6Address(hostname);
}

async function fetchWithTimeout(input: string | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STORY_MUSIC_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAudioSource(url: string, redirectsRemaining = STORY_MUSIC_MAX_REDIRECTS): Promise<Response | null> {
  if (!isSafeAudioSourceUrl(url)) {
    return null;
  }

  const response = await fetchWithTimeout(url, {
    cache: "no-store",
    headers: {
      accept: "audio/*,application/ogg,application/octet-stream"
    },
    redirect: "manual"
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location || redirectsRemaining <= 0) {
      return null;
    }
    return fetchAudioSource(new URL(location, url).toString(), redirectsRemaining - 1);
  }

  return response;
}

function hasSafeAudioContentType(response: Response) {
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  return STORY_MUSIC_ALLOWED_CONTENT_TYPES.some((allowed) =>
    allowed.endsWith("/") ? contentType.startsWith(allowed) : contentType === allowed
  );
}

function isSafeAudioContentLength(response: Response) {
  const raw = response.headers.get("content-length");
  if (!raw) {
    return true;
  }
  const size = Number(raw);
  return Number.isFinite(size) && size > 0 && size <= STORY_MUSIC_MAX_STREAM_BYTES;
}

function limitReadableStream(body: ReadableStream<Uint8Array>, maxBytes: number) {
  const reader = body.getReader();
  let receivedBytes = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel("story music stream exceeded byte limit").catch(() => undefined);
        controller.error(new Error("Story music stream exceeded byte limit."));
        return;
      }

      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    }
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("mode");

  if (mode === "stream") {
    const trackId = searchParams.get("trackId");
    if (!trackId) {
      return buildJsonError(400, "A track is required before we can fetch audio.");
    }

    const detailResponse = await fetchWithTimeout(`${OPENVERSE_API_BASE_URL}/${encodeURIComponent(trackId)}/`, {
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

    const audioResponse = await fetchAudioSource(detail.url);
    if (
      !audioResponse?.ok ||
      !audioResponse.body ||
      !hasSafeAudioContentType(audioResponse) ||
      !isSafeAudioContentLength(audioResponse)
    ) {
      return buildJsonError(502, "We could not fetch the selected song.");
    }

    return new Response(limitReadableStream(audioResponse.body, STORY_MUSIC_MAX_STREAM_BYTES), {
      status: 200,
      headers: {
        "cache-control": "private, max-age=3600",
        "content-type": audioResponse.headers.get("content-type") ?? "audio/mpeg"
      }
    });
  }

  const query = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(12, Math.max(4, Number(searchParams.get("limit") || "8")));
  const response = await fetchWithTimeout(getSearchUrl(query, limit), {
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
