import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getMyCampusCommunities } from "../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../src/lib/dev-session";
import {
  inferResourceFileContentType,
  parseResourceStoragePath,
  readResourceFileBuffer
} from "../../../../../src/lib/resource-files-server";

export const runtime = "nodejs";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  );
}

function encodeContentDispositionFileName(fileName: string) {
  return encodeURIComponent(fileName)
    .replace(/['()]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A");
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      segments?: string[];
    }>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before opening a resource file.");
  }

  const { segments = [] } = await context.params;
  if (segments.length === 0) {
    return buildError(400, "INVALID_RESOURCE_PATH", "Resource file path is missing.");
  }

  const storagePath = segments.join("/");
  const parsed = parseResourceStoragePath(storagePath);

  if (!parsed || parsed.tenantId !== viewer.tenantId) {
    return buildError(404, "RESOURCE_FILE_NOT_FOUND", "That resource file could not be found.");
  }

  if (parsed.communityId && parsed.uploaderUserId !== viewer.userId) {
    const communities = await getMyCampusCommunities(viewer).catch(() => null);
    const canOpen = communities?.communities.some((community) => community.id === parsed.communityId) ?? false;

    if (!canOpen) {
      return buildError(403, "FORBIDDEN_RESOURCE_FILE", "You can only open files from communities you belong to.");
    }
  }

  try {
    const buffer = await readResourceFileBuffer(storagePath);
    const body = new Uint8Array(buffer);

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": inferResourceFileContentType(storagePath),
        "content-disposition": `inline; filename*=UTF-8''${encodeContentDispositionFileName(parsed.fileName)}`,
        "cache-control": "private, max-age=300"
      }
    });
  } catch {
    return buildError(404, "RESOURCE_FILE_NOT_FOUND", "That resource file could not be found.");
  }
}
