import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import { proxyGatewayMutation } from "../../../src/lib/gateway";

export async function POST(request: Request) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Dev session required hai. Pehle preview session start karo."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        title?: string;
        body?: string;
        communityId?: string | null;
      }
    | null;

  if (!payload) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body valid JSON hona chahiye."
        }
      },
      { status: 400 }
    );
  }

  try {
    return await proxyGatewayMutation(
      "/v1/posts",
      "POST",
      {
        tenantId: viewer.tenantId,
        membershipId: viewer.membershipId,
        communityId: payload.communityId ?? null,
        kind: "text",
        title: payload.title ?? "",
        body: payload.body ?? ""
      },
      viewer
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "GATEWAY_UNAVAILABLE",
          message: "API gateway abhi reachable nahi hai."
        }
      },
      { status: 502 }
    );
  }
}
