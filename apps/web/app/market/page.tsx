import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewerMe, getViewerProfile } from "../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";
import { CampusMarketShell } from "../../src/components/campus-market-shell";
import { getDisplayCollegeName } from "../../src/lib/college-access";
import { getMarketDashboard } from "../../src/lib/market-data";

export default async function MarketPage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [profile, me] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getViewerMe(viewer).catch(() => null),
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const displayCollegeName = getDisplayCollegeName(profile.collegeName);
  const viewerName = profile.profile?.fullName ?? viewer.displayName;
  const viewerUsername = profile.profile?.username ?? viewer.email.split("@")[0] ?? viewer.userId;
  const initialDashboard = await getMarketDashboard(viewer);

  return (
    <CampusMarketShell
      viewerName={viewerName}
      viewerUsername={viewerUsername}
      collegeName={displayCollegeName}
      viewerEmail={viewer.email}
      course={profile.profile?.course}
      stream={profile.profile?.stream}
      role={me?.membershipSummary.role ?? viewer.role}
      initialDashboard={initialDashboard}
    />
  );
}
