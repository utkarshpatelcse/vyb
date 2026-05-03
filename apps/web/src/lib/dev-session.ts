import { createHmac, timingSafeEqual } from "node:crypto";

export interface DevSession {
  userId: string;
  email: string;
  displayName: string;
  membershipId: string;
  tenantId: string;
  role: "student" | "faculty" | "alumni" | "moderator" | "admin";
  firebaseSessionCookie?: string;
}

export const DEV_SESSION_COOKIE = "vyb-session";
export const FIREBASE_SESSION_COOKIE = "vyb-firebase-session";
export const PROFILE_COMPLETION_COOKIE = "vyb-profile-complete";
export const SESSION_CSRF_COOKIE = "vyb-session-csrf";
const DEFAULT_TENANT_ID = "tenant-demo";
const LOCAL_SESSION_SECRET = "local-vyb-session-secret";

function getSessionSecret() {
  const configured = process.env.VYB_SESSION_SECRET?.trim();

  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV !== "production") {
    return process.env.VYB_INTERNAL_API_KEY?.trim() || LOCAL_SESSION_SECRET;
  }

  throw new Error("VYB_SESSION_SECRET is required to read or write Vyb sessions in production.");
}

function sanitizeSeed(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || "student";
}

export function createViewerSession(input: {
  email: string;
  displayName: string;
  userId?: string;
  membershipId?: string;
  tenantId?: string;
  role?: DevSession["role"];
}): DevSession {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim() || "Vyb Explorer";
  const seed = sanitizeSeed(email.split("@")[0] ?? displayName);

  return {
    userId: input.userId?.trim() || `dev-${seed}`,
    email,
    displayName,
    membershipId: input.membershipId?.trim() || `membership-${seed}`,
    tenantId: input.tenantId?.trim() || DEFAULT_TENANT_ID,
    role: input.role ?? "student"
  };
}

export function createDevSession(input: { email: string; displayName: string }): DevSession {
  return createViewerSession(input);
}

export function encodeDevSession(session: DevSession) {
  const payload = {
    userId: session.userId,
    email: session.email,
    displayName: session.displayName,
    membershipId: session.membershipId,
    tenantId: session.tenantId,
    role: session.role
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function decodeDevSession(value: string | null | undefined): DevSession | null {
  if (!value) {
    return null;
  }

  try {
    const [encodedPayload, providedSignature] = value.split(".");
    if (!encodedPayload || !providedSignature || value.split(".").length !== 2) {
      return null;
    }

    const expectedSignature = createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
    const providedBuffer = Buffer.from(providedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<DevSession>;

    if (
      typeof decoded.userId !== "string" ||
      typeof decoded.email !== "string" ||
      typeof decoded.displayName !== "string" ||
      typeof decoded.membershipId !== "string" ||
      typeof decoded.tenantId !== "string"
    ) {
      return null;
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      displayName: decoded.displayName,
      membershipId: decoded.membershipId,
      tenantId: decoded.tenantId,
      role:
        decoded.role === "faculty" ||
        decoded.role === "alumni" ||
        decoded.role === "moderator" ||
        decoded.role === "admin"
          ? decoded.role
          : "student"
    };
  } catch {
    return null;
  }
}

export function readDevSessionFromCookieStore(cookieStore: {
  get(name: string): { value: string } | undefined;
}) {
  const session = decodeDevSession(cookieStore.get(DEV_SESSION_COOKIE)?.value);
  if (!session) {
    return null;
  }

  const firebaseSessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
  return {
    ...session,
    firebaseSessionCookie
  };
}
