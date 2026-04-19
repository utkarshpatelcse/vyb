export const launchCollege = {
  id: "kiet",
  name: "KIET Group of Institutions Delhi-NCR",
  domain: "kiet.edu"
};

const allowedCollegeDomains = [launchCollege.domain];

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function getEmailDomain(email) {
  return normalizeEmail(email).split("@")[1] ?? null;
}

export function isAllowedCollegeEmail(email) {
  const domain = getEmailDomain(email);
  return domain ? allowedCollegeDomains.includes(domain) : false;
}

export function getAllowedCollegeDomains() {
  return [...allowedCollegeDomains];
}

