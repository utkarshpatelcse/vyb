import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getClientShellData } from "../src/lib/backend";
import { getDisplayCollegeName } from "../src/lib/college-access";
import { PROFILE_COMPLETION_COOKIE, readDevSessionFromCookieStore } from "../src/lib/dev-session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const viewer = readDevSessionFromCookieStore(cookieStore);
  const profileCompleted = cookieStore.get(PROFILE_COMPLETION_COOKIE)?.value === "1";

  if (viewer) {
    redirect(profileCompleted ? "/home" : "/onboarding");
  }

  const shell = await getClientShellData();
  const displayCollegeName = getDisplayCollegeName(shell.launchCampus.name);

  return (
    <main className="vyb-home">
      <div className="vyb-home-glow vyb-home-glow-one" aria-hidden="true" />
      <div className="vyb-home-glow vyb-home-glow-two" aria-hidden="true" />

      <div className="vyb-home-shell">
        <header className="vyb-home-header">
          <Link href="/" className="vyb-home-brand">
            <span>V</span>
            <div>
              <strong>VYB</strong>
              <p>Verified Campus Platform</p>
            </div>
          </Link>

          <nav className="vyb-home-nav">
            <a href="#why">Why Vyb</a>
            <a href="#phase-one">Phase One</a>
            <a href="#launch">Launch Campus</a>
          </nav>

          <Link href="/login" className="vyb-primary-button">
            Get Started
          </Link>
        </header>

        <section className="vyb-home-hero">
          <div className="vyb-home-copy">
            <span className="vyb-page-badge">{shell.hero.eyebrow}</span>
            <h1>{shell.hero.title}</h1>
            <p>{shell.hero.summary}</p>

            <div className="vyb-home-hero-actions">
              <Link href="/login" className="vyb-primary-button">
                Get Started
              </Link>
              <a href="#phase-one" className="vyb-secondary-button">
                View Phase One
              </a>
            </div>
          </div>

          <div className="vyb-home-card">
            <span className="vyb-page-badge">Current Direction</span>
            <h2>Built for one trusted campus at a time.</h2>
            <ul className="vyb-home-list">
              {shell.trustPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        </section>

        <section id="why" className="vyb-home-section">
          <div className="vyb-section-head">
            <span className="vyb-page-badge">Why Vyb</span>
            <h2>The product is designed to replace fragmented campus coordination.</h2>
            <p>
              Identity, community, and utility should live in one product that students can trust every day.
            </p>
          </div>

          <div className="vyb-home-grid">
            {shell.pillars.map((pillar) => (
              <article key={pillar.title} className="vyb-home-feature">
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="phase-one" className="vyb-home-section">
          <div className="vyb-section-head">
            <span className="vyb-page-badge">Phase One</span>
            <h2>What we are shipping first.</h2>
            <p>
              The launch scope focuses on verified access, community routing, the campus feed, and the academic
              resource layer.
            </p>
          </div>

          <div className="vyb-phase-list">
            {shell.phaseOne.map((item) => (
              <article key={item} className="vyb-phase-item">
                <strong>{item}</strong>
              </article>
            ))}
          </div>
        </section>

        <section id="launch" className="vyb-home-section vyb-launch-panel">
          <div className="vyb-section-head">
            <span className="vyb-page-badge">Launch Campus</span>
            <h2>{displayCollegeName}</h2>
            <p>Access is currently limited to verified college accounts for the current rollout.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
