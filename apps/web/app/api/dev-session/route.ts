import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createDevSession,
  DEV_SESSION_COOKIE,
  encodeDevSession
} from "../../../src/lib/dev-session";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | {
        displayName?: string;
        email?: string;
      }
    | null;

  const displayName = payload?.displayName?.trim();
  const email = payload?.email?.trim().toLowerCase();

  if (!displayName || displayName.length < 2) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_NAME",
          message: "Display name kam se kam 2 characters ka hona chahiye."
        }
      },
      { status: 400 }
    );
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_EMAIL",
          message: "Valid college email do taaki dev session seed ho sake."
        }
      },
      { status: 400 }
    );
  }

  const session = createDevSession({ displayName, email });
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
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(DEV_SESSION_COOKIE);

  return NextResponse.json({
    cleared: true
  });
}
