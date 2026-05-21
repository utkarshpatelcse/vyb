import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isBackendRequestError, redeemCommunityInvite } from "../../../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../../../src/lib/dev-session";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must sign in before redeeming an invite."
        }
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as { inviteCode?: string } | null;
  const inviteCode = payload?.inviteCode?.trim();

  if (!inviteCode) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INVITE_CODE",
          message: "Invite code is required."
        }
      },
      { status: 400 }
    );
  }

  const { slug } = await context.params;

  try {
    return NextResponse.json(await redeemCommunityInvite(viewer, slug, inviteCode));
  } catch (error) {
    if (isBackendRequestError(error)) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message
          }
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "COMMUNITY_INVITE_REDEMPTION_UNAVAILABLE",
          message: "We could not redeem this invite right now."
        }
      },
      { status: 502 }
    );
  }
}
