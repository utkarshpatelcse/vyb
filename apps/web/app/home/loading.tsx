import type { CSSProperties } from "react";
import { VybLoadingMark } from "../../src/components/vyb-loading-mark";
import { VybLogoLockup } from "../../src/components/vyb-logo";

const navItems = ["Home", "Hub", "Chats", "Vibes", "Market", "Profile"];

export default function HomeLoading() {
  return (
    <main
      className="vyb-campus-home vyb-campus-home-loading"
      style={{ "--vyb-campus-left-width": "260px", "--vyb-campus-right-width": "320px" } as CSSProperties}
    >
      <aside className="vyb-campus-sidebar vyb-campus-rail" aria-hidden="true">
        <div className="vyb-campus-branding">
          <VybLogoLockup priority />
        </div>
        <nav className="vyb-campus-nav" aria-label="Campus navigation loading">
          {navItems.map((item) => (
            <span key={item} className={`vyb-campus-nav-item${item === "Home" ? " is-active" : ""}`}>
              <span className="vyb-campus-loading-nav-dot" />
              <span>{item}</span>
            </span>
          ))}
        </nav>
      </aside>

      <section className="vyb-campus-main" aria-busy="true" aria-live="polite">
        <header className="vyb-campus-topbar">
          <div className="vyb-campus-topbar-copy">
            <strong>Campus feed</strong>
            <span>Loading campus updates</span>
          </div>
        </header>

        <div className="vyb-campus-loading-center" aria-label="Loading home feed">
          <VybLoadingMark />
        </div>
      </section>

      <aside className="vyb-campus-right-panel vyb-campus-rail" aria-hidden="true" />
    </main>
  );
}
