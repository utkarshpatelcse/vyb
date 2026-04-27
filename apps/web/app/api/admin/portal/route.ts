import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isSuperAdminEmail } from "../../../../src/lib/admin-access";
import { getSuperAdminSnapshot, mutateSuperAdminStore } from "../../../../src/lib/super-admin-store";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

async function requireSuperAdmin() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer || !isSuperAdminEmail(viewer.email)) {
    return {
      viewer: null,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Super admin access is required."
          }
        },
        { status: viewer ? 403 : 401 }
      )
    };
  }

  return { viewer, response: null };
}

export async function GET() {
  const { response } = await requireSuperAdmin();
  if (response) {
    return response;
  }

  return NextResponse.json(await getSuperAdminSnapshot());
}

export async function POST(request: NextRequest) {
  const { viewer, response } = await requireSuperAdmin();
  if (response || !viewer) {
    return response;
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON."
        }
      },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await mutateSuperAdminStore(payload, viewer.email));
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "ADMIN_ACTION_FAILED",
          message: error instanceof Error ? error.message : "Admin action failed."
        }
      },
      { status: 400 }
    );
  }
}
