import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CampusMessagesShell } from "../../src/components/campus-messages-shell";
import { getChatInbox, getChatKeyBackup, getMyCampusCommunities, getViewerProfile } from "../../src/lib/backend";
import { getDisplayCollegeName } from "../../src/lib/college-access";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export default async function MessagesPage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [profile, inboxResult, backupResult, communitiesResult] = await Promise.all([
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
        error: error instanceof Error ? error.message : "We could not load your chat inbox right now."
      })),
    getChatKeyBackup(viewer)
      .then((value) => ({ value, error: null }))
      .catch((error) => ({
        value: { backup: null },
        error: error instanceof Error ? error.message : "We could not load your encrypted key backup."
      })),
    getMyCampusCommunities(viewer)
      .then((value) => ({ value, error: null }))
      .catch((error) => ({
        value: { tenant: { id: viewer.tenantId, name: "", slug: "" }, communities: [] },
        error: error instanceof Error ? error.message : "We could not load your campus communities right now."
      }))
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const viewerName = profile.profile?.fullName ?? viewer.displayName;
  const viewerUsername = profile.profile?.username ?? viewer.email.split("@")[0];
  const displayCollegeName = getDisplayCollegeName(profile.collegeName);
  const chatViewer = inboxResult.value.viewer;

  return (
    <CampusMessagesShell
      viewerUserId={chatViewer.userId || viewer.userId}
      viewerMembershipId={chatViewer.membershipId || viewer.membershipId}
      viewerKeyStorageUserIds={[viewer.userId]}
      viewerName={viewerName}
      viewerUsername={viewerUsername}
      collegeName={displayCollegeName}
      initialItems={inboxResult.value.items}
      loadError={inboxResult.error}
      initialCommunities={communitiesResult.value.communities}
      communityLoadError={communitiesResult.error}
      initialViewerIdentity={inboxResult.value.viewer.activeIdentity}
      initialRemoteKeyBackup={backupResult.value.backup}
    />
  );
}
