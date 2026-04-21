export const MARKET_DEFAULT_LOCATION = "Campus";
export const MARKET_DEFAULT_CAMPUS_SPOT = "Meetup in chat";

export function normalizeMarketLocation(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || MARKET_DEFAULT_LOCATION;
}

export function normalizeMarketCampusSpot(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || MARKET_DEFAULT_CAMPUS_SPOT;
}

export function hasExplicitMarketLocation(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return Boolean(trimmed) && trimmed !== MARKET_DEFAULT_LOCATION;
}

export function hasExplicitMarketCampusSpot(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return Boolean(trimmed) && trimmed !== MARKET_DEFAULT_CAMPUS_SPOT;
}
