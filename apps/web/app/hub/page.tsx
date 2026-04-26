import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getViewerMe, getViewerProfile } from "../../src/lib/backend";
import { CampusHubShell } from "../../src/components/campus-hub-shell";
import { getDisplayCollegeName } from "../../src/lib/college-access";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export const metadata: Metadata = {
  title: "Hub · Vyb",
  description: "Campus gaming lobby and social calendar — play mini-games with your campus and stay on top of events."
};

export default async function HubPage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [profile, me] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getViewerMe(viewer).catch(() => null)
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const viewerName = profile.profile?.fullName ?? viewer.displayName;
  const displayCollegeName = getDisplayCollegeName(profile.collegeName);

  return (
    <CampusHubShell
      viewerName={viewerName}
      viewerUsername={profile.profile?.username ?? viewer.email.split("@")[0] ?? "vyb-student"}
      collegeName={displayCollegeName}
      viewerEmail={viewer.email}
    />
  );
}
