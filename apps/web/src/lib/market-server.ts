import "server-only";

import type { ProfileResponse } from "@vyb/contracts";
import { getViewerProfile } from "./backend";
import type { DevSession } from "./dev-session";
import type { MarketViewerIdentity } from "./market-types";

function fallbackUsername(viewer: DevSession) {
  return viewer.email.split("@")[0]?.trim() || viewer.userId;
}

export async function resolveMarketViewerIdentity(
  viewer: DevSession,
  profileResponse?: ProfileResponse | null
): Promise<MarketViewerIdentity> {
  const profile = profileResponse === undefined ? await getViewerProfile(viewer).catch(() => null) : profileResponse;

  return {
    userId: viewer.userId,
    tenantId: viewer.tenantId,
    username: profile?.profile?.username ?? fallbackUsername(viewer),
    displayName: profile?.profile?.fullName ?? viewer.displayName,
    role: viewer.role
  };
}
