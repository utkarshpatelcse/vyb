import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CampusProfileShell } from "../../src/components/campus-profile-shell";
import { getCampusUserProfile, getViewerMe, getViewerProfile } from "../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export default async function DashboardPage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [profile, me] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getViewerMe(viewer).catch(() => null)
  ]);

  if (!profile?.profileCompleted || !profile.profile?.username) {
    redirect("/onboarding");
  }

  const publicProfile = await getCampusUserProfile(viewer, profile.profile.username).catch(() => null);

  return (
    <CampusProfileShell
      viewerName={publicProfile?.profile.displayName ?? profile.profile.fullName ?? viewer.displayName}
      username={publicProfile?.profile.username ?? profile.profile.username}
      viewerUsername={profile.profile.username}
      collegeName={profile.collegeName}
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
    />
  );
}
