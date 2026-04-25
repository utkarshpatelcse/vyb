import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { uploadEncryptedChatAttachment } from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

function buildError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isFileEntry(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before uploading encrypted chat media.");
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return buildError(400, "INVALID_FORM", "Upload request must be valid form data.");
  }

  const file = formData.get("file");
  const mimeType = formData.get("mimeType");
  const width = formData.get("width");
  const height = formData.get("height");
  const durationMs = formData.get("durationMs");
  const viewOnce = formData.get("viewOnce");

  if (!isFileEntry(file) || file.size <= 0) {
    return buildError(400, "INVALID_FILE", "Choose encrypted media before uploading.");
  }

  try {
    const payload = await uploadEncryptedChatAttachment(viewer, {
      fileName: file.name,
      mimeType: typeof mimeType === "string" ? mimeType : file.type,
      base64Data: Buffer.from(await file.arrayBuffer()).toString("base64"),
      width: typeof width === "string" ? Number(width) : null,
      height: typeof height === "string" ? Number(height) : null,
      durationMs: typeof durationMs === "string" ? Number(durationMs) : null,
      viewOnce: viewOnce === "true"
    });

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return buildError(500, "CHAT_MEDIA_UPLOAD_FAILED", error instanceof Error ? error.message : "We could not upload that encrypted media.");
  }
}
