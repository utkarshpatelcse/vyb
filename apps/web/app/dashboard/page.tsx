import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getClientShellData, getViewerMe, getViewerProfile } from "../../src/lib/backend";
import { SignOutButton } from "../../src/components/sign-out-button";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export default async function DashboardPage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [profile, me, shell] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getViewerMe(viewer).catch(() => null),
    getClientShellData()
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  return (
    <main className="vyb-dashboard">
      <div className="vyb-home-glow vyb-home-glow-one" aria-hidden="true" />
      <div className="vyb-home-glow vyb-home-glow-two" aria-hidden="true" />

      <div className="vyb-dashboard-shell">
        <header className="vyb-dashboard-header">
          <div className="vyb-home-brand">
            <span>V</span>
            <div>
              <strong>VYB</strong>
              <p>Profile</p>
            </div>
          </div>

          <div className="vyb-dashboard-actions">
            <span className="vyb-page-badge">Launch Campus Active</span>
            <SignOutButton className="vyb-secondary-button" />
          </div>
        </header>

        <section className="vyb-dashboard-hero">
          <div>
            <span className="vyb-page-badge">Profile</span>
            <h1>{profile.profile?.fullName ?? viewer.displayName}</h1>
            <p>
              This is your verified campus profile. Your main app landing now opens on the home feed so posts,
              reels, and stories become the first experience after sign-in.
            </p>
          </div>

          <div className="vyb-dashboard-status">
            <strong>{profile.collegeName}</strong>
            <span>{viewer.email}</span>
            <span>Role: {me?.membershipSummary.role ?? viewer.role}</span>
          </div>
        </section>

        <section className="vyb-dashboard-grid">
          <article className="vyb-dashboard-card">
            <span className="vyb-page-badge">Profile</span>
            <h2>Campus details</h2>
            <ul className="vyb-home-list">
              <li>Course: {profile.profile?.course}</li>
              <li>Stream: {profile.profile?.stream}</li>
              <li>Year: {profile.profile?.year}</li>
              <li>Section: {profile.profile?.section}</li>
              <li>Hostel: {profile.profile?.hostelName ?? "Not provided"}</li>
            </ul>
          </article>

          <article className="vyb-dashboard-card">
            <span className="vyb-page-badge">Access</span>
            <h2>Verified session</h2>
            <ul className="vyb-home-list">
              <li>Authenticated through Firebase and backend session bootstrap</li>
              <li>College-scoped access restricted to {shell.launchCampus.domain}</li>
              <li>Profile completion gate passed successfully</li>
            </ul>
          </article>

          <article className="vyb-dashboard-card">
            <span className="vyb-page-badge">Home Feed</span>
            <h2>Main surface is now separate</h2>
            <p>
              Your main in-app landing is the home feed. This page can now evolve into a fuller profile surface
              without affecting the authentication or onboarding flow.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
