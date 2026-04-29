import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ChatInboxResponse } from "@vyb/contracts";
import { CampusHomeShell } from "../../src/components/campus-home-shell";
import {
  getCampusFeed,
  getCampusVibes,
  getCampusStories,
  getChatInbox,
  getSuggestedCampusUsers,
  getViewerMe,
  getViewerProfile
} from "../../src/lib/backend";
import { isSuperAdminEmail } from "../../src/lib/admin-access";
import { getDisplayCollegeName } from "../../src/lib/college-access";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export default async function AuthenticatedHomePage({
  searchParams
}: {
  searchParams: Promise<{
    post?: string;
    story?: string;
  }>;
}) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  if (isSuperAdminEmail(viewer.email)) {
    redirect("/admin");
  }

  const [profile, me, storyResponse, feedResponse, vibesResponse, suggestedResponse, chatInbox] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getViewerMe(viewer).catch(() => null),
    getCampusStories(viewer).catch(() => ({ items: [] })),
    getCampusFeed(viewer).catch(() => ({ tenantId: viewer.tenantId, communityId: null, items: [], nextCursor: null })),
    getCampusVibes(viewer, 10).catch(() => ({ tenantId: viewer.tenantId, communityId: null, items: [], nextCursor: null })),
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
    )
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const viewerName = profile.profile?.fullName ?? viewer.displayName;
  const displayCollegeName = getDisplayCollegeName(profile.collegeName);
  const unreadChatCount = chatInbox.items.reduce((sum, item) => sum + item.unreadCount, 0);

  const { post: initialFocusedPostId, story: initialFocusedStoryUsername } = await searchParams;

  return (
    <CampusHomeShell
      viewerName={viewerName}
      viewerUsername={profile.profile?.username ?? viewer.email.split("@")[0]}
      collegeName={displayCollegeName}
      viewerEmail={viewer.email}
      course={profile.profile?.course}
      stream={profile.profile?.stream}
      role={me?.membershipSummary.role ?? viewer.role}
      stories={storyResponse.items}
      initialPosts={feedResponse.items}
      trendingVibes={vibesResponse.items}
      suggestedUsers={suggestedResponse.items}
      recentChats={chatInbox.items}
      unreadChatCount={unreadChatCount}
      viewerUserId={viewer.userId}
      initialViewerIdentity={chatInbox.viewer?.activeIdentity ?? null}
      initialFocusedPostId={initialFocusedPostId?.trim() || null}
      initialFocusedStoryUsername={initialFocusedStoryUsername?.trim() || null}
    />
  );
}
