import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import {
  canDirectUploadSocialMediaFromClient,
  persistSocialMediaAsset,
  planSocialMediaAssetUpload
} from "../../../src/lib/social-media-server";

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

function isUploadIntent(value: unknown): value is "post" | "story" | "vibe" {
  return value === "post" || value === "story" || value === "vibe";
}

function isFileEntry(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readPositiveNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-vyb-debug-task-id") ?? `social-${randomUUID()}`;
  const debugStage = request.headers.get("x-vyb-debug-stage") ?? "upload";
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before uploading media.", requestId);
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await request.json().catch(() => null)) as
      | {
          intent?: unknown;
          fileName?: unknown;
          mimeType?: unknown;
          sizeBytes?: unknown;
        }
      | null;

    if (!payload) {
      return buildError(400, "INVALID_JSON", "Upload request must be valid JSON.", requestId);
    }

    const intent = payload.intent;

    if (!isUploadIntent(intent)) {
      return buildError(400, "INVALID_INTENT", "Upload intent is missing or invalid.", requestId);
    }

    const fileName = readOptionalString(payload.fileName);
    const mimeType = readOptionalString(payload.mimeType);
    const sizeBytes = readPositiveNumber(payload.sizeBytes);

    if (!fileName || !mimeType || !sizeBytes) {
      return buildError(400, "INVALID_FILE", "Upload metadata is missing or invalid.", requestId);
    }

    try {
      const uploadPlan = planSocialMediaAssetUpload({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        intent,
        fileName,
        mimeType,
        sizeBytes
      });
      const directUploadEnabled = canDirectUploadSocialMediaFromClient();

      return NextResponse.json({
        uploadStrategy: directUploadEnabled ? "firebase-client" : "server-proxy",
        directUpload: directUploadEnabled
          ? {
              storagePath: uploadPlan.storagePath,
              mediaType: uploadPlan.mediaType,
              mimeType: uploadPlan.mimeType,
              sizeBytes: uploadPlan.sizeBytes,
              cacheControl: uploadPlan.cacheControl,
              customMetadata: uploadPlan.customMetadata
            }
          : null
      });
    } catch (error) {
      return buildError(
        400,
        "INVALID_FILE",
        error instanceof Error ? error.message : "Upload metadata is invalid.",
        requestId
      );
    }
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
