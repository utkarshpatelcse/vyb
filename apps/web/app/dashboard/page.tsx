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
              <p>Authenticated Dashboard</p>
            </div>
          </div>

          <div className="vyb-dashboard-actions">
            <span className="vyb-page-badge">Launch Campus Active</span>
            <SignOutButton className="vyb-secondary-button" />
          </div>
        </header>

        <section className="vyb-dashboard-hero">
          <div>
            <span className="vyb-page-badge">Signed In</span>
            <h1>{profile.profile?.fullName ?? viewer.displayName}</h1>
            <p>
              Your authentication, domain access, and profile completion flow are working. This page is the
              temporary dashboard checkpoint before the full feed experience is built.
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
            <h2>Campus profile</h2>
            <ul className="vyb-home-list">
              <li>Course: {profile.profile?.course}</li>
              <li>Stream: {profile.profile?.stream}</li>
              <li>Year: {profile.profile?.year}</li>
              <li>Section: {profile.profile?.section}</li>
              <li>Hostel: {profile.profile?.hostelName ?? "Not provided"}</li>
            </ul>
          </article>

          <article className="vyb-dashboard-card">
            <span className="vyb-page-badge">Session</span>
            <h2>Access status</h2>
            <ul className="vyb-home-list">
              <li>Authenticated through Firebase and backend session bootstrap</li>
              <li>College-scoped access restricted to {shell.launchCampus.domain}</li>
              <li>Profile completion gate passed successfully</li>
            </ul>
          </article>

          <article className="vyb-dashboard-card">
            <span className="vyb-page-badge">Next Milestone</span>
            <h2>Ready for the main product surface</h2>
            <p>
              The next UI milestone can replace this checkpoint with the real feed and dashboard experience
              without reworking the authentication flow.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
