import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { uploadSocialMediaAsset } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";

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

function isUploadIntent(value: FormDataEntryValue | null): value is "post" | "story" | "vibe" {
  return value === "post" || value === "story" || value === "vibe";
}

function isFileEntry(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before uploading media.");
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return buildError(400, "INVALID_FORM", "Upload request must be valid form data.");
  }

  const intent = formData.get("intent");
  const file = formData.get("file");

  if (!isUploadIntent(intent)) {
    return buildError(400, "INVALID_INTENT", "Upload intent is missing or invalid.");
  }

  if (!isFileEntry(file) || file.size <= 0) {
    return buildError(400, "INVALID_FILE", "Choose an image or video before uploading.");
  }

  try {
    const asset = await uploadSocialMediaAsset(viewer, {
      intent,
      fileName: file.name,
      mimeType: file.type,
      base64Data: Buffer.from(await file.arrayBuffer()).toString("base64")
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    console.error("[web/social-media] upload-failed", {
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
      error instanceof Error ? error.message : "We could not upload this media right now."
    );
  }
}
