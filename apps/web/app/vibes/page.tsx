import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CampusReelsShell } from "../../src/components/campus-reels-shell";
import { getCampusVibes, getViewerMe, getViewerProfile } from "../../src/lib/backend";
import { getDisplayCollegeName } from "../../src/lib/college-access";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export default async function VibesPage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [profile, me, vibes] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getViewerMe(viewer).catch(() => null),
    getCampusVibes(viewer).catch(() => ({ tenantId: viewer.tenantId, communityId: null, items: [], nextCursor: null }))
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const viewerName = profile.profile?.fullName ?? viewer.displayName;
  const displayCollegeName = getDisplayCollegeName(profile.collegeName);

  return (
    <CampusReelsShell
      viewerName={viewerName}
      viewerUsername={profile.profile?.username ?? viewer.email.split("@")[0]}
      collegeName={displayCollegeName}
      viewerEmail={viewer.email}
      course={profile.profile?.course}
      stream={profile.profile?.stream}
      role={me?.membershipSummary.role ?? viewer.role}
      initialVibes={vibes.items}
    />
  );
}
