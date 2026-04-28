import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ConnectDailyGame } from "../../../../src/components/connect-daily-game";
import { getViewerProfile } from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

export default async function ConnectGamePage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const profile = await getViewerProfile(viewer).catch(() => null);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  return <ConnectDailyGame backHref="/hub/gameshub" />;
}
