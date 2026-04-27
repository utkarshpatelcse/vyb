import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DevSessionCard } from "../../src/components/dev-session-card";
import { isSuperAdminEmail } from "../../src/lib/admin-access";
import { PROFILE_COMPLETION_COOKIE, readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const viewer = readDevSessionFromCookieStore(cookieStore);
  const profileCompleted = cookieStore.get(PROFILE_COMPLETION_COOKIE)?.value === "1";

  if (viewer) {
    if (isSuperAdminEmail(viewer.email)) {
      redirect("/admin");
    }

    redirect(profileCompleted ? "/home" : "/onboarding");
  }

  return (
    <main className="vyb-auth-page">
      <div className="vyb-auth-glow" aria-hidden="true" />
      <div className="vyb-auth-shell">
        <DevSessionCard viewer={null} redirectTo="/home" />
      </div>
    </main>
  );
}
