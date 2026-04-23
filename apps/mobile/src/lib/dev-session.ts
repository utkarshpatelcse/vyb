export interface MobileViewerSession {
  userId: string;
  email: string;
  displayName: string;
  membershipId: string;
  tenantId: string;
  role: "student" | "faculty" | "alumni" | "moderator" | "admin";
}

const DEFAULT_TENANT_ID = "tenant-demo";
const SEEDED_USER = {
  userId: "H7R1veGKRIfPHjOLLSIJTAndoQ32",
  email: "ashwani.2226cse1211@kiet.edu",
  displayName: "Ashwani",
  tenantId: "0a115f7c6bd94d58868eb16b1fc87fbb",
  membershipId: "membership-ashwani",
  role: "student" as const
};

function sanitizeSeed(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || "student";
}

export function createMobileViewerSession(): MobileViewerSession {
  const rawEmail = (process.env.EXPO_PUBLIC_VYB_DEV_EMAIL ?? "student@kiet.edu").trim().toLowerCase();
  const rawDisplayName = (process.env.EXPO_PUBLIC_VYB_DEV_NAME ?? "Vyb Explorer").trim() || "Vyb Explorer";
  const rawUserId = process.env.EXPO_PUBLIC_VYB_DEV_USER_ID?.trim() || `dev-${sanitizeSeed(rawEmail.split("@")[0] ?? rawDisplayName)}`;
  const rawMembershipId = process.env.EXPO_PUBLIC_VYB_DEV_MEMBERSHIP_ID?.trim() || `membership-${sanitizeSeed(rawEmail.split("@")[0] ?? rawDisplayName)}`;
  const rawTenantId = process.env.EXPO_PUBLIC_VYB_DEV_TENANT_ID?.trim() || DEFAULT_TENANT_ID;
  const shouldUseSeededViewer =
    rawEmail === "student@kiet.edu" ||
    rawUserId === "dev-student" ||
    rawTenantId === DEFAULT_TENANT_ID;

  const email = shouldUseSeededViewer ? SEEDED_USER.email : rawEmail;
  const displayName = shouldUseSeededViewer ? SEEDED_USER.displayName : rawDisplayName;
  const seed = sanitizeSeed(email.split("@")[0] ?? displayName);
  const role = process.env.EXPO_PUBLIC_VYB_DEV_ROLE;

  return {
    userId: shouldUseSeededViewer ? SEEDED_USER.userId : rawUserId,
    email,
    displayName,
    membershipId: shouldUseSeededViewer ? SEEDED_USER.membershipId : rawMembershipId || `membership-${seed}`,
    tenantId: shouldUseSeededViewer ? SEEDED_USER.tenantId : rawTenantId,
    role:
      role === "faculty" || role === "alumni" || role === "moderator" || role === "admin"
        ? role
        : shouldUseSeededViewer
          ? SEEDED_USER.role
          : "student"
  };
}
