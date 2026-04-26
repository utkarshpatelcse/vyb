import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CampusProfileShell } from "../../../src/components/campus-profile-shell";
import { getCampusUserProfile, getViewerMe, getViewerProfile } from "../../../src/lib/backend";
import { getDisplayCollegeName } from "../../../src/lib/college-access";
import { readDevSessionFromCookieStore } from "../../../src/lib/dev-session";

export default async function PublicProfilePage({
  params
}: {
  params: Promise<{
    username: string;
  }>;
}) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const { username } = await params;
  const [profile, me, publicProfile] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getViewerMe(viewer).catch(() => null),
    getCampusUserProfile(viewer, username).catch(() => null)
  ]);

  if (!profile?.profileCompleted || !profile.profile?.username) {
    redirect("/onboarding");
  }

  if (!publicProfile) {
    notFound();
  }

  if (publicProfile.isViewerProfile) {
    redirect("/dashboard");
  }

  const displayCollegeName = getDisplayCollegeName(publicProfile.profile.collegeName);

  return (
    <CampusProfileShell
      viewerName={publicProfile.profile.displayName}
      username={publicProfile.profile.username}
      collegeName={displayCollegeName}
      viewerEmail={null}
      course={publicProfile.profile.course}
      stream={publicProfile.profile.stream}
      role={me?.membershipSummary.role ?? viewer.role}
      stats={publicProfile.stats}
      posts={publicProfile.posts}
      isOwnProfile={false}
      isFollowing={publicProfile.isFollowing}
      initialAvatarUrl={publicProfile.profile.avatarUrl ?? null}
    />
  );
}
