import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CampusSearchShell } from "../../src/components/campus-search-shell";
import {
  getCampusFeed,
  getCampusVibes,
  getSuggestedCampusUsers,
  getViewerProfile,
  searchCampusUsers
} from "../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";
import { getMarketDashboard } from "../../src/lib/market-data";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
  }>;
}) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [{ q = "" }, profile] = await Promise.all([searchParams, getViewerProfile(viewer).catch(() => null)]);

  if (!profile?.profileCompleted || !profile.profile?.username) {
    redirect("/onboarding");
  }

  const viewerUsername = profile.profile.username;
  const trimmedQuery = q.trim();
  const [results, feedResponse, vibesResponse, suggestedResponse, marketDashboard] = await Promise.all([
    trimmedQuery
      ? searchCampusUsers(viewer, trimmedQuery).catch(() => ({
          query: trimmedQuery,
          items: []
        }))
      : Promise.resolve({
          query: "",
          items: []
        }),
    getCampusFeed(viewer, { limit: 18 }).catch(() => ({
      tenantId: viewer.tenantId,
      communityId: null,
      items: [],
      nextCursor: null
    })),
    getCampusVibes(viewer, 18).catch(() => ({
      tenantId: viewer.tenantId,
      communityId: null,
      items: [],
      nextCursor: null
    })),
    getSuggestedCampusUsers(viewer, 6).catch(() => ({
      query: "",
      items: []
    })),
    getMarketDashboard(viewer).catch(() => ({
      tenantId: viewer.tenantId,
      viewer: {
        userId: viewer.userId,
        username: viewerUsername,
        savedCount: 0
      },
      listings: [],
      requests: [],
      viewerActiveListings: [],
      viewerActiveRequests: []
    }))
  ]);

  return (
    <CampusSearchShell
      initialQuery={trimmedQuery}
      results={results.items}
      viewerUsername={viewerUsername}
      hasSearched={Boolean(trimmedQuery)}
      initialFeedItems={feedResponse.items}
      initialVibeItems={vibesResponse.items}
      suggestedUsers={suggestedResponse.items}
      marketListings={marketDashboard.listings}
      marketRequests={marketDashboard.requests}
    />
  );
}
