import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createViewerSession,
  DEV_SESSION_COOKIE,
  encodeDevSession
} from "../../../../src/lib/dev-session";
import { getFirebaseAdminAuth } from "../../../../src/lib/firebase-admin-server";

function buildFallbackDisplayName(email: string) {
  return email.split("@")[0]?.replace(/[-._]+/g, " ") || "Vyb Explorer";
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | {
        idToken?: string;
        displayName?: string;
      }
    | null;

  const idToken = payload?.idToken?.trim();
  if (!idToken) {
    return NextResponse.json(
      {
        error: {
          code: "MISSING_TOKEN",
          message: "Firebase ID token missing hai."
        }
      },
      { status: 400 }
    );
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken, true);
    const email = decoded.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        {
          error: {
            code: "EMAIL_REQUIRED",
            message: "Firebase user se email nahi mila."
          }
        },
        { status: 400 }
      );
    }

    if (!decoded.email_verified) {
      return NextResponse.json(
        {
          error: {
            code: "EMAIL_NOT_VERIFIED",
            message: "College email verify karo, tabhi Vyb session activate hoga."
          }
        },
        { status: 403 }
      );
    }

    const session = createViewerSession({
      userId: decoded.uid,
      email,
      displayName: payload?.displayName?.trim() || decoded.name || buildFallbackDisplayName(email),
      membershipId: `membership-${decoded.uid}`,
      tenantId: "tenant-bootstrap"
    });

    const cookieStore = await cookies();
    cookieStore.set(DEV_SESSION_COOKIE, encodeDevSession(session), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8
    });

    return NextResponse.json({
      session: {
        displayName: session.displayName,
        email: session.email
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TOKEN",
          message: "Firebase session verify nahi ho paayi.",
          details: error instanceof Error ? error.message : "unknown"
        }
      },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(DEV_SESSION_COOKIE);

  return NextResponse.json({
    cleared: true
  });
}
