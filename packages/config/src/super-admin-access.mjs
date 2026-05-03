export const defaultSuperAdminEmails = [
  "utkarshpatelcse@gmail.com",
  "utkarshp2003@gmail.com",
  "ashwanibaghel803@gmail.com"
];

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function getSuperAdminEmails() {
  const configured = process.env.VYB_SUPER_ADMIN_EMAILS?.split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);

  const fallbackAdmins = process.env.NODE_ENV === "production" ? [] : defaultSuperAdminEmails;
  return Array.from(new Set([...fallbackAdmins, ...(configured ?? [])]));
}

export function isSuperAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized && getSuperAdminEmails().includes(normalized));
}
