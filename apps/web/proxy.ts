import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEV_SESSION_COOKIE = "vyb-session";
const PROFILE_COMPLETION_COOKIE = "vyb-profile-complete";
const PROTECTED_PREFIXES = ["/home", "/dashboard", "/onboarding", "/complete-profile"];
const DEFAULT_SUPER_ADMIN_EMAILS = [
  "utkarshpatelcse@gmail.com",
  "utkarshp2003@gmail.com",
  "ashwanibaghel803@gmail.com"
];

function getSuperAdminEmails() {
  const configured = process.env.VYB_SUPER_ADMIN_EMAILS?.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return new Set([...DEFAULT_SUPER_ADMIN_EMAILS, ...(configured ?? [])]);
}

function decodeSessionEmail(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(base64)) as { email?: unknown };
    return typeof decoded.email === "string" ? decoded.email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(DEV_SESSION_COOKIE)?.value);
  const sessionEmail = decodeSessionEmail(request.cookies.get(DEV_SESSION_COOKIE)?.value);
  const isSuperAdminSession = sessionEmail ? getSuperAdminEmails().has(sessionEmail) : false;
  const profileCompleted = request.cookies.get(PROFILE_COMPLETION_COOKIE)?.value === "1";
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!hasSession) {
    if (isProtected) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
  }

  if (isSuperAdminSession && !pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (pathname === "/login") {
    return NextResponse.redirect(new URL(profileCompleted ? "/home" : "/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"]
};
