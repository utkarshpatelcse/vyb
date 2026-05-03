export const defaultSuperAdminEmails = [
  "utkarshpatelcse@gmail.com",
  "utkarshp2003@gmail.com",
  "ashwanibaghel803@gmail.com"
] as const;

function normalizeAdminEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function getSuperAdminEmails() {
  const configured = process.env.VYB_SUPER_ADMIN_EMAILS?.split(",")
    .map((item) => normalizeAdminEmail(item))
    .filter(Boolean);

  const fallbackAdmins = process.env.NODE_ENV === "production" ? [] : defaultSuperAdminEmails;
  return Array.from(new Set([...fallbackAdmins, ...(configured ?? [])]));
}

export function isSuperAdminEmail(email: string | null | undefined) {
  const normalized = normalizeAdminEmail(email);
  return Boolean(normalized && getSuperAdminEmails().includes(normalized));
}
