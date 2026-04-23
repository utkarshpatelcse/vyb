import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import { persistSocialMediaAsset } from "../../../src/lib/social-media-server";

export const runtime = "nodejs";

function buildError(status: number, code: string, message: string, requestId: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId
      }
    },
    { status }
  );
}

function isUploadIntent(value: FormDataEntryValue | null): value is "post" | "story" | "vibe" {
  return value === "post" || value === "story" || value === "vibe";
}

function isFileEntry(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-vyb-debug-task-id") ?? `social-${randomUUID()}`;
  const debugStage = request.headers.get("x-vyb-debug-stage") ?? "upload";
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before uploading media.", requestId);
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return buildError(400, "INVALID_FORM", "Upload request must be valid form data.", requestId);
  }

  const intent = formData.get("intent");
  const file = formData.get("file");

  if (!isUploadIntent(intent)) {
    return buildError(400, "INVALID_INTENT", "Upload intent is missing or invalid.", requestId);
  }

  if (!isFileEntry(file) || file.size <= 0) {
    return buildError(400, "INVALID_FILE", "Choose an image or video before uploading.", requestId);
  }

  console.info("[web/social-media] upload-start", {
    requestId,
    debugStage,
    intent,
    tenantId: viewer.tenantId,
    userId: viewer.userId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type
  });

  try {
    const asset = await persistSocialMediaAsset({
      tenantId: viewer.tenantId,
      userId: viewer.userId,
      intent,
      file
    });

    console.info("[web/social-media] upload-success", {
      requestId,
      debugStage,
      intent,
      tenantId: viewer.tenantId,
      userId: viewer.userId,
      storagePath: asset.storagePath,
      sizeBytes: asset.sizeBytes,
      mediaType: asset.mediaType
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    console.error("[web/social-media] upload-failed", {
      requestId,
      debugStage,
      intent,
      tenantId: viewer.tenantId,
      userId: viewer.userId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      message: error instanceof Error ? error.message : "unknown"
    });

    return buildError(
      500,
      "SOCIAL_MEDIA_UPLOAD_FAILED",
      error instanceof Error ? error.message : "We could not upload this media right now.",
      requestId
    );
  }
}
