import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CampusHomeShell } from "../../src/components/campus-home-shell";
import {
  getCampusFeed,
  getCampusStories,
  getSuggestedCampusUsers,
  getViewerMe,
  getViewerProfile
} from "../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export default async function AuthenticatedHomePage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [profile, me, storyResponse, feedResponse, suggestedResponse] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getViewerMe(viewer).catch(() => null),
    getCampusStories(viewer).catch(() => ({ items: [] })),
    getCampusFeed(viewer).catch(() => ({ tenantId: viewer.tenantId, communityId: null, items: [], nextCursor: null })),
    getSuggestedCampusUsers(viewer, 5).catch(() => ({ query: "", items: [] }))
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const viewerName = profile.profile?.fullName ?? viewer.displayName;

  return (
    <CampusHomeShell
      viewerName={viewerName}
      viewerUsername={profile.profile?.username ?? viewer.email.split("@")[0]}
      collegeName={profile.collegeName}
      viewerEmail={viewer.email}
      course={profile.profile?.course}
      stream={profile.profile?.stream}
      role={me?.membershipSummary.role ?? viewer.role}
      stories={storyResponse.items}
      initialPosts={feedResponse.items}
      suggestedUsers={suggestedResponse.items}
    />
  );
}
