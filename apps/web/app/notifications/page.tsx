import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CampusNotificationsShell } from "../../src/components/campus-notifications-shell";
import { isSuperAdminEmail } from "../../src/lib/admin-access";
import { getViewerProfile } from "../../src/lib/backend";
import { getDisplayCollegeName } from "../../src/lib/college-access";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";
import { listNotifications } from "../../src/lib/notifications";

export default async function NotificationsPage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  if (isSuperAdminEmail(viewer.email)) {
    redirect("/admin");
  }

  const [profile, notifications] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    listNotifications(viewer, { limit: 40 }).catch(() => ({
      tenantId: viewer.tenantId,
      items: [],
      unreadCount: 0,
      nextCursor: null
    }))
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  return (
    <CampusNotificationsShell
      viewerName={profile.profile?.fullName ?? viewer.displayName}
      viewerUsername={profile.profile?.username ?? viewer.email.split("@")[0] ?? "vyb-student"}
      collegeName={getDisplayCollegeName(profile.collegeName)}
      initialNotifications={notifications}
    />
  );
}
