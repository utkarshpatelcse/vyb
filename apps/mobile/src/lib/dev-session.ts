export interface MobileViewerSession {
  userId: string;
  email: string;
  displayName: string;
  membershipId: string;
  tenantId: string;
  role: "student" | "faculty" | "alumni" | "moderator" | "admin";
}

const DEFAULT_TENANT_ID = "tenant-demo";

function sanitizeSeed(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || "student";
}

export function createMobileViewerSession(): MobileViewerSession {
  const email = (process.env.EXPO_PUBLIC_VYB_DEV_EMAIL ?? "student@kiet.edu").trim().toLowerCase();
  const displayName = (process.env.EXPO_PUBLIC_VYB_DEV_NAME ?? "Vyb Explorer").trim() || "Vyb Explorer";
  const seed = sanitizeSeed(email.split("@")[0] ?? displayName);
  const role = process.env.EXPO_PUBLIC_VYB_DEV_ROLE;

  return {
    userId: process.env.EXPO_PUBLIC_VYB_DEV_USER_ID?.trim() || `dev-${seed}`,
    email,
    displayName,
    membershipId: process.env.EXPO_PUBLIC_VYB_DEV_MEMBERSHIP_ID?.trim() || `membership-${seed}`,
    tenantId: process.env.EXPO_PUBLIC_VYB_DEV_TENANT_ID?.trim() || DEFAULT_TENANT_ID,
    role:
      role === "faculty" || role === "alumni" || role === "moderator" || role === "admin" ? role : "student"
  };
}
