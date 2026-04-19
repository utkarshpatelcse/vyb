import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CampusUploadShell } from "../../src/components/campus-upload-shell";
import { getViewerProfile } from "../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export default async function CreatePage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const profile = await getViewerProfile(viewer).catch(() => null);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const viewerName = profile.profile?.fullName ?? viewer.displayName;
  const viewerUsername = profile.profile?.username ?? viewer.email.split("@")[0];

  return (
    <CampusUploadShell
      viewerName={viewerName}
      viewerUsername={viewerUsername}
      viewerEmail={viewer.email}
      collegeName={profile.collegeName}
    />
  );
}
