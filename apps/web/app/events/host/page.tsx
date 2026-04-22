import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewerProfile } from "../../../src/lib/backend";
import { getDisplayCollegeName } from "../../../src/lib/college-access";
import { CampusEventHostShell } from "../../../src/components/campus-event-host-shell";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";
import { getEventForViewer } from "../../../src/lib/events-data";

export default async function EventHostPage({
  searchParams
}: {
  searchParams?: Promise<{ edit?: string | string[] | undefined }>;
}) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const profile = await getViewerProfile(viewer).catch(() => null);

  if (!profile?.profileCompleted || !profile.profile) {
    redirect("/onboarding");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const editId = typeof resolvedSearchParams.edit === "string" ? resolvedSearchParams.edit.trim() : "";
  const initialEvent = editId ? await getEventForViewer(viewer, editId).catch(() => null) : null;

  if (editId && (!initialEvent || !initialEvent.isHostedByViewer)) {
    redirect("/events");
  }

  return (
    <CampusEventHostShell
      viewerName={profile.profile.fullName || viewer.displayName}
      viewerUsername={profile.profile.username}
      collegeName={getDisplayCollegeName(profile.collegeName)}
      role={viewer.role}
      initialEvent={initialEvent}
    />
  );
}
