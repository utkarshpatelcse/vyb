import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEV_SESSION_COOKIE = "vyb-session";
const PROFILE_COMPLETION_COOKIE = "vyb-profile-complete";
const PROTECTED_PREFIXES = ["/home", "/dashboard", "/onboarding", "/complete-profile"];

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
  const profileCompleted = request.cookies.get(PROFILE_COMPLETION_COOKIE)?.value === "1";
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!hasSession) {
    if (isProtected) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
  }

  if (pathname === "/login") {
    return NextResponse.redirect(new URL(profileCompleted ? "/home" : "/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"]
};
