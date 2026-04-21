import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewerMe, getViewerProfile } from "../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";
import { CampusMarketShell } from "../../src/components/campus-market-shell";
import { getDisplayCollegeName } from "../../src/lib/college-access";

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

  return (
    <CampusMarketShell
      viewerName={profile.profile?.fullName ?? viewer.displayName}
      collegeName={displayCollegeName}
      viewerEmail={viewer.email}
      course={profile.profile?.course}
      stream={profile.profile?.stream}
      role={me?.membershipSummary.role ?? viewer.role}
    />
  );
}
