import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewerMe, getViewerProfile } from "../../src/lib/backend";
import { CampusEventsShell } from "../../src/components/campus-events-shell";
import { getDisplayCollegeName } from "../../src/lib/college-access";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";
import { getEventsDashboard } from "../../src/lib/events-data";

export default async function EventsPage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [profile, me, dashboard] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getViewerMe(viewer).catch(() => null),
    getEventsDashboard(viewer).catch(() => null)
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const viewerName = profile.profile?.fullName ?? viewer.displayName;
  const displayCollegeName = getDisplayCollegeName(profile.collegeName);

  return (
    <CampusEventsShell
      viewerName={viewerName}
      viewerUsername={profile.profile?.username ?? viewer.email.split("@")[0] ?? "vyb-student"}
      collegeName={displayCollegeName}
      viewerEmail={viewer.email}
      course={profile.profile?.course}
      stream={profile.profile?.stream}
      role={me?.membershipSummary.role ?? viewer.role}
      initialDashboard={dashboard}
    />
  );
}
