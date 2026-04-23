import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import {
  inferSocialMediaContentType,
  resolveLocalSocialMediaFilePath
} from "../../../../../src/lib/social-media-server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      segments?: string[];
    }>;
  }
) {
  const { segments = [] } = await context.params;

  if (segments.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_MEDIA_PATH",
          message: "Media file path is missing."
        }
      },
      { status: 400 }
    );
  }

  const storagePath = segments.join("/");

  try {
    const filePath = resolveLocalSocialMediaFilePath(storagePath);
    const buffer = await readFile(filePath);

    return new Response(buffer, {
      status: 200,
      headers: {
        "content-type": inferSocialMediaContentType(storagePath),
        "cache-control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "MEDIA_NOT_FOUND",
          message: "That uploaded media file could not be found."
        }
      },
      { status: 404 }
    );
  }
}
