import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CompleteProfileForm } from "../../src/components/complete-profile-form";
import { SignOutButton } from "../../src/components/sign-out-button";
import { getViewerProfile } from "../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export default async function OnboardingPage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const profile = await getViewerProfile(viewer).catch(() => null);

  if (profile?.profileCompleted) {
    redirect("/dashboard");
  }

  return (
    <main className="vyb-auth-page">
      <div className="vyb-auth-glow" aria-hidden="true" />
      <div className="vyb-auth-shell">
        <div className="vyb-profile-page">
          <div className="vyb-profile-topbar">
            <div className="vyb-home-brand">
              <span>V</span>
              <div>
                <strong>VYB</strong>
                <p>Verified Campus Platform</p>
              </div>
            </div>
            <SignOutButton className="vyb-secondary-button" />
          </div>

          <CompleteProfileForm
            viewer={{
              displayName: viewer.displayName,
              email: viewer.email
            }}
            initialProfile={profile?.profile ?? null}
            collegeName={profile?.collegeName ?? "KIET Group of Institutions Delhi-NCR"}
          />
        </div>
      </div>
    </main>
  );
}
