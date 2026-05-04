import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CampusProfileShell } from "../../src/components/campus-profile-shell";
import { getCampusCourses, getCampusResources, getCampusStories, getCampusUserProfile, getViewerActivity, getViewerMe, getViewerProfile } from "../../src/lib/backend";
import { getDisplayCollegeName } from "../../src/lib/college-access";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

function normalizeProfilePanel(value: string | string[] | undefined) {
  return value === "settings" || value === "edit" ? value : null;
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [profile, me, resources, courses, activity, stories] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getViewerMe(viewer).catch(() => null),
    getCampusResources(viewer, { limit: 4 }).catch(() => ({ tenantId: viewer.tenantId, courseId: null, items: [], nextCursor: null })),
    getCampusCourses(viewer, 8).catch(() => ({ tenantId: viewer.tenantId, items: [] })),
    getViewerActivity(viewer, 8).catch(() => ({ tenantId: viewer.tenantId, items: [] })),
    getCampusStories(viewer).catch(() => ({ items: [] }))
  ]);

  if (!profile?.profileCompleted || !profile.profile?.username) {
    redirect("/onboarding");
  }

  const publicProfile = await getCampusUserProfile(viewer, profile.profile.username).catch(() => null);
  const displayCollegeName = getDisplayCollegeName(profile.collegeName);

  return (
    <CampusProfileShell
      viewerName={publicProfile?.profile.displayName ?? profile.profile.fullName ?? viewer.displayName}
      username={publicProfile?.profile.username ?? profile.profile.username}
      collegeName={displayCollegeName}
      viewerEmail={viewer.email}
      course={profile.profile.course}
      stream={profile.profile.stream}
      role={me?.membershipSummary.role ?? viewer.role}
      stats={{
        posts: publicProfile?.stats.posts ?? 0,
        followers: publicProfile?.stats.followers ?? 0,
        following: publicProfile?.stats.following ?? 0
      }}
      posts={publicProfile?.posts ?? []}
      isOwnProfile={true}
      isFollowing={false}
      recentResources={resources.items}
      recentCourses={courses.items}
      recentActivity={activity.items}
      initialProfile={profile.profile}
      initialAvatarUrl={publicProfile?.profile.avatarUrl ?? profile.profile.avatarUrl ?? null}
      profileSocialLinks={publicProfile?.profile.socialLinks ?? profile.profile.socialLinks ?? null}
      initialPanel={normalizeProfilePanel(resolvedSearchParams.profile)}
      stories={stories.items}
    />
  );
}
