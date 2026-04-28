import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewerMe, getViewerProfile } from "../../../src/lib/backend";
import { CampusEventsShell } from "../../../src/components/campus-events-shell";
import { getDisplayCollegeName } from "../../../src/lib/college-access";
import { getDailyConnectHubSnapshot } from "../../../src/lib/connect-data";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import { getEventsDashboard } from "../../../src/lib/events-data";

type GamesHubPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GamesHubPage({ searchParams }: GamesHubPageProps) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const initialGame = getSearchParamValue(resolvedSearchParams.game)?.trim().toLowerCase();
  const roomCode = getSearchParamValue(resolvedSearchParams.code)
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/gu, "");

  if (initialGame === "scribble") {
    redirect(roomCode ? `/hub/gameshub/scribble?code=${encodeURIComponent(roomCode)}` : "/hub/gameshub/scribble");
  }

  if (initialGame === "connect") {
    redirect("/hub/gameshub/connect");
  }

  const [profile, me, dashboard, connectSummary] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getViewerMe(viewer).catch(() => null),
    getEventsDashboard(viewer).catch(() => null),
    getDailyConnectHubSnapshot(viewer).catch(() => null)
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
      connectSummary={connectSummary}
      initialTab="games"
    />
  );
}
