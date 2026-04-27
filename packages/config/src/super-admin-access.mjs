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

  return Array.from(new Set([...defaultSuperAdminEmails, ...(configured ?? [])]));
}

export function isSuperAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized && getSuperAdminEmails().includes(normalized));
}
