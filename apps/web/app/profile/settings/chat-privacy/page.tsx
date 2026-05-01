import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SecuritySettingsShell } from "../../../../src/components/security-settings-shell";
import { isSuperAdminEmail } from "../../../../src/lib/admin-access";
import { getChatInbox, getChatKeyBackup, getChatTrustedDevices, getViewerProfile } from "../../../../src/lib/backend";
import { getDisplayCollegeName } from "../../../../src/lib/college-access";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

function normalizeIntent(value: string | string[] | undefined) {
  if (value === "create-identity" || value === "create-backup" || value === "restore-device") {
    return value;
  }

  return null;
}

function normalizeReturnTo(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return null;
  }

  return value;
}

function normalizePairingId(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/iu.test(value)) {
    return null;
  }

  return value;
}

export default async function ChatPrivacyPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  if (isSuperAdminEmail(viewer.email)) {
    redirect("/admin");
  }

  const [profile, inboxResult, backupResult, trustedDevicesResult] = await Promise.all([
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
        error: error instanceof Error ? error.message : "We could not load your secure chat identity."
      })),
    getChatKeyBackup(viewer)
      .then((value) => ({ value, error: null }))
      .catch((error) => ({
        value: { backup: null },
        error: error instanceof Error ? error.message : "We could not load your encrypted key backup."
      })),
    getChatTrustedDevices(viewer)
      .then((value) => ({ value, error: null }))
      .catch((error) => ({
        value: { items: [] },
        error: error instanceof Error ? error.message : "We could not load your trusted chat devices."
      }))
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const chatViewer = inboxResult.value.viewer;

  return (
    <SecuritySettingsShell
      viewerUserId={chatViewer.userId || viewer.userId}
      viewerKeyStorageUserIds={[viewer.userId]}
      viewerName={profile.profile?.fullName ?? viewer.displayName}
      viewerUsername={profile.profile?.username ?? viewer.email.split("@")[0]}
      collegeName={getDisplayCollegeName(profile.collegeName)}
      initialViewerIdentity={inboxResult.value.viewer.activeIdentity}
      initialBackup={backupResult.value.backup}
      initialTrustedDevices={trustedDevicesResult.value.items}
      initialIntent={normalizeIntent(resolvedSearchParams.intent)}
      initialPairingId={normalizePairingId(resolvedSearchParams.pair)}
      returnTo={normalizeReturnTo(resolvedSearchParams.returnTo)}
      loadError={inboxResult.error ?? backupResult.error ?? trustedDevicesResult.error}
    />
  );
}
