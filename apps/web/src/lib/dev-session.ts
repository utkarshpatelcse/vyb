export interface DevSession {
  userId: string;
  email: string;
  displayName: string;
  membershipId: string;
  tenantId: string;
  role: "student";
}

export const DEV_SESSION_COOKIE = "vyb-dev-session";
const DEFAULT_TENANT_ID = "tenant-demo";

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
    role: "student"
  };
}

export function createDevSession(input: { email: string; displayName: string }): DevSession {
  return createViewerSession(input);
}

export function encodeDevSession(session: DevSession) {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

export function decodeDevSession(value: string | null | undefined): DevSession | null {
  if (!value) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<DevSession>;

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
      role: decoded.role === "student" ? "student" : "student"
    };
  } catch {
    return null;
  }
}

export function readDevSessionFromCookieStore(cookieStore: {
  get(name: string): { value: string } | undefined;
}) {
  return decodeDevSession(cookieStore.get(DEV_SESSION_COOKIE)?.value);
}
