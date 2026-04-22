import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CampusMessagesShell } from "../../src/components/campus-messages-shell";
import { getChatInbox, getViewerProfile } from "../../src/lib/backend";
import { getDisplayCollegeName } from "../../src/lib/college-access";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export default async function MessagesPage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [profile, inboxResult] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getChatInbox(viewer)
      .then((value) => ({ value, error: null }))
      .catch((error) => ({
        value: {
          viewer: {
            userId: viewer.userId,
            membershipId: viewer.membershipId,
            activeIdentity: null
          },
          items: []
        },
        error: error instanceof Error ? error.message : "We could not load your encrypted inbox right now."
      }))
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const viewerName = profile.profile?.fullName ?? viewer.displayName;
  const viewerUsername = profile.profile?.username ?? viewer.email.split("@")[0];
  const displayCollegeName = getDisplayCollegeName(profile.collegeName);

  return (
    <CampusMessagesShell
      viewerName={viewerName}
      viewerUsername={viewerUsername}
      collegeName={displayCollegeName}
      initialItems={inboxResult.value.items}
      loadError={inboxResult.error}
    />
  );
}
