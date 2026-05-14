import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCampusResources, proxyBackendMutation } from "../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import { notifyCommunityResourceCreated } from "../../../src/lib/notification-events";
import {
  buildResourceFileDownloadUrl,
  deleteResourceFiles,
  persistResourceFiles,
  type PersistedResourceFile
} from "../../../src/lib/resource-files-server";

type ParsedResourcePayload = {
  title?: string;
  description?: string;
  courseId?: string | null;
  communityId?: string | null;
  type?: string;
  files?: Array<{
    storagePath?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
  }>;
};

type ParsedResourceBody = {
  payload: ParsedResourcePayload;
  files: File[];
  isFormData: boolean;
};

type ResourceCreateResponsePayload = {
  item?: {
    id: string;
    communityId: string | null;
    title: string;
    files?: PersistedResourceFile[];
  };
};

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

function isFileEntry(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function readOptionalStringFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function buildParsedResourceBodyFromFormData(formData: FormData): ParsedResourceBody {
  const files = [...formData.getAll("files"), ...formData.getAll("file")].filter(isFileEntry).filter((file) => file.size > 0);

  return {
    payload: {
      title: readOptionalStringFromForm(formData, "title") ?? "",
      description: readOptionalStringFromForm(formData, "description") ?? "",
      courseId: readOptionalStringFromForm(formData, "courseId"),
      communityId: readOptionalStringFromForm(formData, "communityId"),
      type: readOptionalStringFromForm(formData, "type") ?? "notes"
    },
    files,
    isFormData: true
  };
}

async function parseResourceBody(request: Request): Promise<ParsedResourceBody | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const formData = await request.clone().formData().catch(() => null);

    if (formData) {
      return buildParsedResourceBodyFromFormData(formData);
    }
  }

  const payload = (await request.json().catch(() => null)) as ParsedResourcePayload | null;

  if (!payload) {
    return null;
  }

  return {
    payload,
    files: [],
    isFormData: false
  };
}

function attachResourceFileUrls<T extends { item?: { files?: PersistedResourceFile[] } }>(payload: T, uploadedFiles: PersistedResourceFile[]) {
  if (!payload.item) {
    return payload;
  }

  const files = payload.item.files?.length ? payload.item.files : uploadedFiles;

  return {
    ...payload,
    item: {
      ...payload.item,
      files: files.map((file) => ({
        ...file,
        url: file.url ?? (file.storagePath ? buildResourceFileDownloadUrl(file.storagePath) : null)
      }))
    }
  };
}

export async function GET(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before viewing resources."
        }
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");
  const communityId = searchParams.get("communityId");
  const limit = Number(searchParams.get("limit") ?? "20");

  try {
    return NextResponse.json(
      await getCampusResources(viewer, {
        courseId,
        communityId,
        limit: Number.isInteger(limit) && limit > 0 ? limit : 20
      })
    );
  } catch {
    return NextResponse.json({
      tenantId: viewer.tenantId,
      courseId,
      communityId,
      items: [],
      nextCursor: null
    });
  }
}

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return buildError(401, "UNAUTHENTICATED", "You must sign in before creating a resource.");
  }

  const parsedBody = await parseResourceBody(request);

  if (!parsedBody) {
    return buildError(400, "INVALID_BODY", "Request body must be valid JSON or multipart form data.");
  }

  const { payload } = parsedBody;

  if (parsedBody.isFormData && parsedBody.files.length === 0) {
    return buildError(400, "MISSING_RESOURCE_FILE", "Attach at least one file before submitting a resource.");
  }

  let uploadedFiles: PersistedResourceFile[] = [];

  try {
    uploadedFiles = await persistResourceFiles({
      tenantId: viewer.tenantId,
      userId: viewer.userId,
      communityId: payload.communityId ?? null,
      files: parsedBody.files
    });

    const upstream = await proxyBackendMutation(
      "/v1/resources",
      "POST",
      {
        tenantId: viewer.tenantId,
        membershipId: viewer.membershipId,
        courseId: payload.courseId ?? null,
        communityId: payload.communityId ?? null,
        title: payload.title ?? "",
        description: payload.description ?? "",
        type: payload.type ?? "notes",
        files: uploadedFiles.length > 0 ? uploadedFiles : payload.files ?? []
      },
      viewer
    );

    const responseText = await upstream.text();
    const contentType = upstream.headers.get("content-type") ?? "application/json; charset=utf-8";

    if (!upstream.ok) {
      if (uploadedFiles.length > 0) {
        await deleteResourceFiles(uploadedFiles).catch(() => undefined);
      }

      return new Response(responseText, {
        status: upstream.status,
        headers: {
          "content-type": contentType
        }
      });
    }

    let responsePayload: ResourceCreateResponsePayload;
    try {
      responsePayload = JSON.parse(responseText) as ResourceCreateResponsePayload;
    } catch {
      return new Response(responseText, {
        status: upstream.status,
        headers: {
          "content-type": contentType
        }
      });
    }
    const withFileUrls = attachResourceFileUrls(responsePayload, uploadedFiles);

    if (withFileUrls.item) {
      await notifyCommunityResourceCreated(viewer, withFileUrls.item).catch((notificationError) => {
        console.warn("[notifications] resource.created failed", {
          resourceId: withFileUrls.item?.id ?? null,
          communityId: withFileUrls.item?.communityId ?? null,
          message: notificationError instanceof Error ? notificationError.message : "unknown"
        });
      });
    }

    return NextResponse.json(withFileUrls, { status: upstream.status });
  } catch {
    if (uploadedFiles.length > 0) {
      await deleteResourceFiles(uploadedFiles).catch(() => undefined);
    }

    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "The backend is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
