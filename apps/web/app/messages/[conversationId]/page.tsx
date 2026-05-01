import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CampusMessagesShell } from "../../../src/components/campus-messages-shell";
import { getChatConversation, getChatInbox, getViewerProfile } from "../../../src/lib/backend";
import { getDisplayCollegeName } from "../../../src/lib/college-access";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";

export default async function ConversationPage({
  params
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const { conversationId } = await params;

  const [profile, inboxResult, conversationResult] = await Promise.all([
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
    getChatConversation(viewer, conversationId)
      .then((value) => ({ value, error: null }))
      .catch((error) => ({
        value: null,
        error: error instanceof Error ? error.message : "We could not open that chat right now."
      }))
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const viewerName = profile.profile?.fullName ?? viewer.displayName;
  const viewerUsername = profile.profile?.username ?? viewer.email.split("@")[0];
  const displayCollegeName = getDisplayCollegeName(profile.collegeName);
  const chatViewer = conversationResult.value?.viewer ?? inboxResult.value.viewer;

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
      initialConversationId={conversationId}
      initialConversation={conversationResult.value?.conversation ?? null}
      activeConversationError={conversationResult.error}
      initialViewerIdentity={conversationResult.value?.viewer.activeIdentity ?? inboxResult.value.viewer.activeIdentity}
    />
  );
}
