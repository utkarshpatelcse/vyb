import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CampusCommunityDetailShell } from "../../../../src/components/campus-community-detail-shell";
import {
  getCampusResources,
  getCampusFeed,
  getCommunityDetail,
  getCommunityMembers,
  getViewerProfile,
  isBackendRequestError
} from "../../../../src/lib/backend";
import { getDisplayCollegeName } from "../../../../src/lib/college-access";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";
import { getEventsDashboard } from "../../../../src/lib/events-data";

export default async function CommunityDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const { slug } = await params;

  const [profile, detail] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getCommunityDetail(viewer, slug).catch((error) => {
      if (isBackendRequestError(error) && error.statusCode === 404) {
        return null;
      }

      throw error;
    })
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  if (!detail) {
    notFound();
  }

  const [membersResult, feedResult, resourcesResult, eventsResult] = await Promise.all([
    getCommunityMembers(viewer, detail.community.slug, 24)
      .then((value) => ({ value, error: null }))
      .catch((error) => ({
        value: {
          community: {
            id: detail.community.id,
            name: detail.community.name,
            slug: detail.community.slug
          },
          items: [],
          nextCursor: null
        },
        error: error instanceof Error ? error.message : "We could not load community members right now."
      })),
    getCampusFeed(viewer, { communityId: detail.community.id, limit: 12 })
      .then((value) => ({ value, error: null }))
      .catch((error) => ({
        value: {
          tenantId: viewer.tenantId,
          communityId: detail.community.id,
          items: [],
          nextCursor: null
        },
        error: error instanceof Error ? error.message : "We could not load community posts right now."
      })),
    getCampusResources(viewer, { communityId: detail.community.id, limit: 4 })
      .then((value) => ({ value, error: null }))
      .catch((error) => ({
        value: {
          tenantId: viewer.tenantId,
          courseId: null,
          communityId: detail.community.id,
          items: [],
          nextCursor: null
        },
        error: error instanceof Error ? error.message : "We could not load campus resources right now."
      })),
    getEventsDashboard(viewer)
      .then((value) => ({ value, error: null }))
      .catch((error) => ({
        value: {
          tenantId: viewer.tenantId,
          viewer: {
            userId: viewer.userId,
            username: viewer.email.split("@")[0],
            savedCount: 0,
            interestedCount: 0,
            hostedCount: 0,
            hostedPendingCount: 0,
            hostedRegistrationCount: 0
          },
          events: [],
          hostedEvents: [],
          categories: []
        },
        error: error instanceof Error ? error.message : "We could not load campus events right now."
      }))
  ]);

  const viewerName = profile.profile?.fullName ?? viewer.displayName;
  const viewerUsername = profile.profile?.username ?? viewer.email.split("@")[0];
  const displayCollegeName = getDisplayCollegeName(profile.collegeName);

  return (
    <CampusCommunityDetailShell
      viewerUserId={viewer.userId}
      viewerName={viewerName}
      viewerUsername={viewerUsername}
      viewerAvatarUrl={profile.profile?.avatarUrl ?? null}
      collegeName={displayCollegeName}
      detail={detail}
      members={membersResult.value.items}
      membersNextCursor={membersResult.value.nextCursor}
      memberLoadError={membersResult.error}
      feedItems={feedResult.value.items}
      feedLoadError={feedResult.error}
      resources={resourcesResult.value.items.filter((item) => item.status === "published")}
      resourcesLoadError={resourcesResult.error}
      events={eventsResult.value.events
        .filter((event) => event.status === "published" && event.communityId === detail.community.id)
        .slice(0, 4)}
      eventsLoadError={eventsResult.error}
    />
  );
}
