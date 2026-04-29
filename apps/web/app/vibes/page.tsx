import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ChatInboxResponse } from "@vyb/contracts";
import { CampusReelsShell } from "../../src/components/campus-reels-shell";
import { getCampusStories, getCampusVibes, getChatInbox, getSuggestedCampusUsers, getViewerMe, getViewerProfile } from "../../src/lib/backend";
import { getDisplayCollegeName } from "../../src/lib/college-access";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export default async function VibesPage({
  searchParams
}: {
  searchParams: Promise<{
    post?: string;
  }>;
}) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [profile, me, vibes, suggestedResponse, chatInbox, stories] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getViewerMe(viewer).catch(() => null),
    getCampusVibes(viewer).catch(() => ({ tenantId: viewer.tenantId, communityId: null, items: [], nextCursor: null })),
    getSuggestedCampusUsers(viewer, 5).catch(() => ({ query: "", items: [] })),
    getChatInbox(viewer).catch(
      () =>
        ({
          viewer: {
            userId: viewer.userId,
            membershipId: viewer.membershipId,
            activeIdentity: null
          },
          items: []
        }) satisfies ChatInboxResponse
    ),
    getCampusStories(viewer).catch(() => ({ items: [] }))
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const viewerName = profile.profile?.fullName ?? viewer.displayName;
  const displayCollegeName = getDisplayCollegeName(profile.collegeName);

  const { post: initialFocusedPostId } = await searchParams;

  return (
    <CampusReelsShell
      viewerName={viewerName}
      viewerUsername={profile.profile?.username ?? viewer.email.split("@")[0]}
      viewerUserId={viewer.userId}
      collegeName={displayCollegeName}
      viewerEmail={viewer.email}
      course={profile.profile?.course}
      stream={profile.profile?.stream}
      role={me?.membershipSummary.role ?? viewer.role}
      initialVibes={vibes.items}
      initialNextCursor={vibes.nextCursor}
      suggestedUsers={suggestedResponse.items}
      recentChats={chatInbox.items}
      initialViewerIdentity={chatInbox.viewer?.activeIdentity ?? null}
      initialFocusedPostId={initialFocusedPostId?.trim() || null}
      stories={stories.items}
    />
  );
}
