import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { proxyBackendMutation } from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

function buildPath(username: string, tenantId: string) {
  const params = new URLSearchParams({
    tenantId
  });

  return `/v1/users/${encodeURIComponent(username)}/follow?${params.toString()}`;
}

export async function PUT(
  _request: Request,
  context: {
    params: Promise<{
      username: string;
    }>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before following someone."
        }
      },
      { status: 401 }
    );
  }

  const { username } = await context.params;

  try {
    return await proxyBackendMutation(buildPath(username, viewer.tenantId), "PUT", {}, viewer);
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "The follow service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      username: string;
    }>;
  }
) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before unfollowing someone."
        }
      },
      { status: 401 }
    );
  }

  const { username } = await context.params;

  try {
    return await proxyBackendMutation(buildPath(username, viewer.tenantId), "DELETE", {}, viewer);
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "The follow service is unavailable right now."
        }
      },
      { status: 502 }
    );
  }
}
