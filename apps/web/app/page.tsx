import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VybLogoLockup } from "../src/components/vyb-logo";
import { isSuperAdminEmail } from "../src/lib/admin-access";
import { getClientShellData } from "../src/lib/backend";
import { getDisplayCollegeName } from "../src/lib/college-access";
import { PROFILE_COMPLETION_COOKIE, readDevSessionFromCookieStore } from "../src/lib/dev-session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const viewer = readDevSessionFromCookieStore(cookieStore);
  const profileCompleted = cookieStore.get(PROFILE_COMPLETION_COOKIE)?.value === "1";

  if (viewer) {
    if (isSuperAdminEmail(viewer.email)) {
      redirect("/admin");
    }

    redirect(profileCompleted ? "/home" : "/onboarding");
  }

  const shell = await getClientShellData();
  const displayCollegeName = getDisplayCollegeName(shell.launchCampus.name);

  return (
    <main className="lp-root">
      {/* Ambient background orbs */}
      <div className="lp-orb lp-orb-one" aria-hidden="true" />
      <div className="lp-orb lp-orb-two" aria-hidden="true" />
      <div className="lp-orb lp-orb-three" aria-hidden="true" />
      <div className="lp-grid-overlay" aria-hidden="true" />

      {/* ── NAV ── */}
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <Link href="/" className="lp-nav-brand">
            <VybLogoLockup priority compactOnSmallScreens />
          </Link>
          <nav className="lp-nav-links">
            <a href="#hustle">Hustle</a>
            <a href="#buzz">Buzz</a>
            <a href="#market">Market</a>
            <a href="#launch">Campus</a>
          </nav>
          <Link href="/login" className="lp-nav-cta">
            Get Started →
          </Link>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-badge">
            <span className="lp-badge-dot" />
            {shell.hero.eyebrow}
          </div>

          <h1 className="lp-hero-title">
            {shell.hero.title}
          </h1>

          <p className="lp-hero-sub">
            {shell.hero.summary}
          </p>

          <div className="lp-hero-actions">
            <Link href="/login" className="lp-btn-primary">
              Start for Free
            </Link>
            <a href="#hustle" className="lp-btn-ghost">
              See what&apos;s inside
            </a>
          </div>

          {/* floating stat chips */}
          <div className="lp-hero-stats">
            <div className="lp-stat-chip">
              <span className="lp-stat-num">100%</span>
              <span className="lp-stat-label">Verified Campus</span>
            </div>
            <div className="lp-stat-chip">
              <span className="lp-stat-num">AI</span>
              <span className="lp-stat-label">Roadmaps</span>
            </div>
            <div className="lp-stat-chip">
              <span className="lp-stat-num">∞</span>
              <span className="lp-stat-label">Vibes</span>
            </div>
          </div>
        </div>

        {/* hero illustration card */}
        <div className="lp-hero-mockup" aria-hidden="true">
          <div className="lp-mock-header">
            <span className="lp-mock-dot" />
            <span className="lp-mock-dot lp-mock-dot-y" />
            <span className="lp-mock-dot lp-mock-dot-g" />
            <span className="lp-mock-title">vyb · campus feed</span>
          </div>
          <div className="lp-mock-body">
            <div className="lp-mock-post">
              <div className="lp-mock-avatar lp-mock-av-indigo" />
              <div className="lp-mock-lines">
                <span className="lp-mock-line lp-mock-line-long" />
                <span className="lp-mock-line lp-mock-line-short" />
              </div>
            </div>
            <div className="lp-mock-post">
              <div className="lp-mock-avatar lp-mock-av-teal" />
              <div className="lp-mock-lines">
                <span className="lp-mock-line" />
                <span className="lp-mock-line lp-mock-line-med" />
              </div>
            </div>
            <div className="lp-mock-post">
              <div className="lp-mock-avatar lp-mock-av-purple" />
              <div className="lp-mock-lines">
                <span className="lp-mock-line lp-mock-line-long" />
                <span className="lp-mock-line lp-mock-line-short" />
              </div>
            </div>
            <div className="lp-mock-kpi-row">
              <div className="lp-mock-kpi">
                <strong>DSA</strong><span>Day 14 🔥</span>
              </div>
              <div className="lp-mock-kpi">
                <strong>Market</strong><span>3 items</span>
              </div>
              <div className="lp-mock-kpi">
                <strong>Buzz</strong><span>🤫 12 new</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PILLARS STRIP ── */}
      <section className="lp-pillars">
        <div className="lp-pillars-inner">
          {shell.pillars.map((p) => (
            <div key={p.title} className="lp-pillar-chip">
              <strong>{p.title}</strong>
              <p>{p.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURE: HUSTLE ── */}
      <section id="hustle" className="lp-feature lp-feature-hustle">
        <div className="lp-feature-inner">
          <div className="lp-feature-copy">
            <span className="lp-eyebrow lp-eyebrow-indigo">01 · Career &amp; Hustle</span>
            <h2>Master the <em>Hustle.</em></h2>
            <p>AI roadmaps tailored to your goals — DSA, Dev, Design. Daily targets, streak tracking, and badges that prove your grind is real.</p>
            <ul className="lp-feature-list">
              <li>AI-Powered Skill Roadmaps</li>
              <li>Peer-to-Peer Accountability Rings</li>
              <li>Proof-of-Work Dashboard</li>
              <li>Streak Badges &amp; XP System</li>
            </ul>
            <Link href="/login" className="lp-btn-primary lp-btn-sm">Start Grinding →</Link>
          </div>
          <div className="lp-feature-visual lp-visual-hustle" aria-hidden="true">
            <div className="lp-vis-card">
              <div className="lp-vis-streak-header">
                <span>DSA Roadmap</span>
                <span className="lp-vis-fire">🔥 Day 14</span>
              </div>
              <div className="lp-vis-progress-track">
                <div className="lp-vis-progress-bar" style={{width: "62%"}} />
              </div>
              <div className="lp-vis-steps">
                <div className="lp-vis-step lp-vis-step-done">Arrays &amp; Strings</div>
                <div className="lp-vis-step lp-vis-step-done">Linked Lists</div>
                <div className="lp-vis-step lp-vis-step-active">Trees &amp; Graphs</div>
                <div className="lp-vis-step">Dynamic Programming</div>
              </div>
            </div>
            <div className="lp-vis-badge-strip">
              <span className="lp-vis-badge">🏅 7-Day Streak</span>
              <span className="lp-vis-badge lp-vis-badge-purple">⚡ Top Solver</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE: BUZZ ── */}
      <section id="buzz" className="lp-feature lp-feature-buzz">
        <div className="lp-feature-inner lp-feature-inner-rev">
          <div className="lp-feature-visual lp-visual-buzz" aria-hidden="true">
            <div className="lp-vis-card">
              <div className="lp-vis-buzz-header">
                <span className="lp-vis-anon-tag">🤫 Anonymous</span>
                <span className="lp-vis-buzz-time">2m ago</span>
              </div>
              <p className="lp-vis-buzz-text">&ldquo;Library ka AC phir band ho gaya aaj... yahan se padhai possible hi nahi hai 😭&rdquo;</p>
              <div className="lp-vis-reactions">
                <span>❤️ 48</span>
                <span>😂 12</span>
                <span>💬 6</span>
              </div>
            </div>
            <div className="lp-vis-card lp-vis-card-sm">
              <div className="lp-vis-buzz-header">
                <span className="lp-vis-anon-tag lp-vis-anon-teal">📢 Campus Buzz</span>
              </div>
              <p className="lp-vis-buzz-text">&ldquo;Placement season mein kaun hai? Let&apos;s form a study group 🔥&rdquo;</p>
              <div className="lp-vis-reactions">
                <span>🔥 91</span><span>💬 23</span>
              </div>
            </div>
          </div>
          <div className="lp-feature-copy">
            <span className="lp-eyebrow lp-eyebrow-purple">02 · Social &amp; Vibes</span>
            <h2>Stay in the <em>Loop.</em></h2>
            <p>Campus ki gossip ho ya real issues — anonymous confessions, trending reels, and private chats. Bolo bina kisi darr ke.</p>
            <ul className="lp-feature-list">
              <li>100% Anonymous Confessions</li>
              <li>Reels &amp; Campus Trending Feed</li>
              <li>Private Peer-to-Peer Chat</li>
              <li>Real-time Campus Events</li>
            </ul>
            <Link href="/login" className="lp-btn-primary lp-btn-sm lp-btn-purple">Join the Buzz →</Link>
          </div>
        </div>
      </section>

      {/* ── FEATURE: MARKET ── */}
      <section id="market" className="lp-feature lp-feature-market">
        <div className="lp-feature-inner">
          <div className="lp-feature-copy">
            <span className="lp-eyebrow lp-eyebrow-teal">03 · The Economy</span>
            <h2>Own the <em>Market.</em></h2>
            <p>Hostel chodna hai? Purana cooler bechna hai? VYB Marketplace par sab milta hai. Lend &amp; borrow with Vyb Coins — zero friction.</p>
            <ul className="lp-feature-list">
              <li>Verified Campus Listings</li>
              <li>&lsquo;Ask to Lend&rsquo; (Udhaar) Feature</li>
              <li>Safe Vyb Coin Transactions</li>
              <li>Seller Reputation Scores</li>
            </ul>
            <Link href="/login" className="lp-btn-primary lp-btn-sm lp-btn-teal">Browse Market →</Link>
          </div>
          <div className="lp-feature-visual lp-visual-market" aria-hidden="true">
            <div className="lp-vis-card">
              <div className="lp-vis-listing">
                <div className="lp-vis-listing-img lp-vis-img-a" />
                <div>
                  <strong>Crompton Cooler</strong>
                  <p>₹2,400 · Room 204, Hostel A</p>
                  <span className="lp-vis-tag">✅ Verified</span>
                </div>
              </div>
              <div className="lp-vis-listing">
                <div className="lp-vis-listing-img lp-vis-img-b" />
                <div>
                  <strong>MTech Notes Bundle</strong>
                  <p>₹150 · PDFs • 3rd Sem</p>
                  <span className="lp-vis-tag lp-vis-tag-lend">🔁 Lend Available</span>
                </div>
              </div>
            </div>
            <div className="lp-vis-coin-row">
              <span className="lp-vis-coin">🪙 Vyb Coins: <strong>420</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PHASE ONE STRIP ── */}
      <section id="launch" className="lp-phase">
        <div className="lp-phase-inner">
          <div className="lp-phase-head">
            <span className="lp-eyebrow lp-eyebrow-indigo">Phase One</span>
            <h2>What ships first.</h2>
            <p>We focus on a single trusted campus, verify everyone, and ship tight. No bloat — just the features that matter.</p>
          </div>
          <div className="lp-phase-grid">
            {shell.phaseOne.map((item, i) => (
              <div key={item} className="lp-phase-item">
                <span className="lp-phase-num">0{i + 1}</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CAMPUS CTA ── */}
      <section className="lp-cta">
        <div className="lp-cta-glow" aria-hidden="true" />
        <div className="lp-cta-inner">
          <span className="lp-eyebrow lp-eyebrow-indigo">Launch Campus</span>
          <h2 className="lp-cta-title">
            Ready to be a<br /><em>VYB Legend?</em>
          </h2>
          <p className="lp-cta-sub">{displayCollegeName} — Access is live for verified accounts.</p>
          <div className="lp-cta-actions">
            <Link href="/login" className="lp-btn-primary lp-btn-lg">
              Get Access Now
            </Link>
            <p className="lp-cta-note">Free forever for students · No spam · Verified only</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <VybLogoLockup subtitle="Campus Operating System" />
          <p>Designed for the Bold. Built for the Fast.</p>
          <p className="lp-footer-copy">© 2026 VYB Net · All rights reserved</p>
        </div>
      </footer>
    </main>
  );
}
