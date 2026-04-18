import { cookies } from "next/headers";
import {
  campusHighlights,
  primaryNavigation
} from "@vyb/app-core";
import { ShellCard, SectionHeader } from "@vyb/ui-web";
import { CreatePostPanel } from "../src/components/create-post-panel";
import { CreateResourcePanel } from "../src/components/create-resource-panel";
import { DevSessionCard } from "../src/components/dev-session-card";
import { LiveShellNote } from "../src/components/live-shell-note";
import { readDevSessionFromCookieStore } from "../src/lib/dev-session";
import { getHomePageData } from "../src/lib/gateway";

export default async function HomePage() {
  const viewer = readDevSessionFromCookieStore(await cookies());
  const { communities, feed, resources, me, mode } = await getHomePageData(viewer ?? undefined);
  const liveCommunities = communities.communities;
  const liveFeed = feed.items;
  const liveResources = resources.items;
  const totalCommunityMembers = liveCommunities.reduce((sum, community) => sum + community.memberCount, 0);
  const communityLookup = new Map(liveCommunities.map((community) => [community.id, community.name]));
  const signedInIdentity = viewer?.displayName ?? me.user.displayName;

  return (
    <main className="cl-page-shell">
      <div className="cl-ambient cl-ambient-one" />
      <div className="cl-ambient cl-ambient-two" />
      <header className="cl-topbar">
        <div className="cl-brand">
          <div className="cl-brand-mark">VY</div>
          <div>
            <p>Vyb</p>
            <span>{mode === "live" ? "Live gateway shell" : "Starter fallback shell"}</span>
          </div>
        </div>
        <nav className="cl-nav">
          {primaryNavigation.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <a className="cl-topbar-cta" href="#install">
          Install PWA
        </a>
      </header>

      <section className="cl-hero">
        <div className="cl-hero-copy">
          <span className="cl-eyebrow">One loop for campus life</span>
          <h1>Mobile par app jaisa feel, desktop par command-center jaisi clarity.</h1>
          <p>
            Vyb students ko verified communities, notes vault, aur social campus energy ek hi
            responsive shell mein deta hai. Phase 1 web par ship karega, but system native apps
            ke liye ready rahega.
          </p>
          <div className="cl-status-pill">
            <span />
            {mode === "live" ? `Gateway connected for ${signedInIdentity}` : "Running on graceful fallback data"}
          </div>
          <LiveShellNote mode={mode} />
          <div className="cl-hero-actions">
            <a className="cl-button-primary" href="#square">
              Explore the shell
            </a>
            <a className="cl-button-secondary" href="#install">
              PWA strategy
            </a>
          </div>
          <ul className="cl-highlight-list">
            {campusHighlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </div>

        <ShellCard className="cl-device-preview">
          <div className="cl-device-header">
            <span />
            <p>Live campus preview</p>
            <strong>09:41</strong>
          </div>
          <div className="cl-device-pane">
            <div className="cl-kpi-grid">
              <div>
                <span>Communities</span>
                <strong>{liveCommunities.length}</strong>
              </div>
              <div>
                <span>Resources</span>
                <strong>{liveResources.length}</strong>
              </div>
              <div>
                <span>Member Reach</span>
                <strong>{totalCommunityMembers}</strong>
              </div>
            </div>
            <div className="cl-mini-feed">
              {liveFeed.map((post) => (
                <article key={post.id}>
                  <strong>{post.title}</strong>
                  <p>{post.body}</p>
                  <span>
                    {post.communityId ? communityLookup.get(post.communityId) ?? "community" : "campus"} · {post.reactions} reacts
                  </span>
                </article>
              ))}
            </div>
          </div>
        </ShellCard>
      </section>

      <section className="cl-grid-two" id="workspace">
        <ShellCard>
          <SectionHeader
            eyebrow="Campus Access"
            title="Real login shell jo college email ko verified web session mein convert kare."
            copy="Firebase Auth client sign-in ko server cookie session ke saath pair kiya gaya hai taaki same viewer state SSR shell, route handlers, aur gateway flows mein use ho sake."
          />
          <DevSessionCard
            viewer={
              viewer
                ? {
                    displayName: viewer.displayName,
                    email: viewer.email
                  }
                : null
            }
          />
        </ShellCard>

        <ShellCard>
          <SectionHeader
            eyebrow="Compose"
            title="Real create flows ab landing shell se test ho sakte hain."
            copy="Post aur resource creation ab live service contracts ke against validate ki ja sakti hai, fallback safety ke saath."
          />
          <div className="cl-control-grid">
            <CreatePostPanel enabled={Boolean(viewer)} communities={liveCommunities} />
            <CreateResourcePanel enabled={Boolean(viewer)} />
          </div>
        </ShellCard>
      </section>

      <section className="cl-grid-two" id="square">
        <ShellCard>
          <SectionHeader
            eyebrow="Campus Square"
            title="Feed jo sirf entertainment nahi, campus coordination bhi handle kare."
            copy={`Initial feed reverse-chronological rahega. Abhi shell ${mode === "live" ? "gateway-backed" : "fallback-backed"} mode mein render ho raha hai.`}
          />
          <div className="cl-list-stack">
            {liveFeed.map((post) => (
              <article key={post.id} className="cl-surface-row">
                <div>
                  <h3>{post.title}</h3>
                  <p>{post.body}</p>
                </div>
                <span>
                  {post.comments} comments · {post.reactions} reacts
                </span>
              </article>
            ))}
          </div>
        </ShellCard>

        <ShellCard id="resources">
          <SectionHeader
            eyebrow="Resource Vault"
            title="Padhai wali utility jo empty social feed problem ko start se solve kare."
            copy={`Notes, PYQs, and quick guides tenant-safe discovery ke saath browse honge. Current tenant: ${communities.tenant.name}.`}
          />
          <div className="cl-resource-grid">
            {liveResources.map((resource) => (
              <article key={resource.id} className="cl-resource-card">
                <span>{resource.type}</span>
                <h3>{resource.title}</h3>
                <p>{resource.courseId ?? "Open resource"}</p>
                <strong>{resource.downloads} downloads</strong>
              </article>
            ))}
          </div>
        </ShellCard>
      </section>

      <section className="cl-grid-two" id="communities">
        <ShellCard>
          <SectionHeader
            eyebrow="Communities"
            title="Batch, hostel, branch, aur campus-wide spaces ek hi membership model ke andar."
            copy={`Community access tenant-safe rahega. Current membership role: ${me.membershipSummary.role}.`}
          />
          <div className="cl-community-list">
            {liveCommunities.map((community) => (
              <article key={community.id} className="cl-surface-row">
                <div>
                  <h3>{community.name}</h3>
                  <p>{community.type}</p>
                </div>
                <strong>{community.memberCount} members</strong>
              </article>
            ))}
          </div>
        </ShellCard>

        <ShellCard id="install">
          <SectionHeader
            eyebrow="PWA-first"
            title="Phase 1 ka mobile experience installable hoga, native app ki wait ke bina."
            copy="Manifest, service worker registration, aur app-shell navigation mobile browsers par install support denge; desktop par same product zyada roomy and control-rich feel dega."
          />
          <div className="cl-install-stack">
            <div className="cl-install-step">
              <span>01</span>
              <div>
                <h3>Install prompt</h3>
                <p>Supported devices par custom install CTA dikhega.</p>
              </div>
            </div>
            <div className="cl-install-step">
              <span>02</span>
              <div>
                <h3>App shell</h3>
                <p>Bottom nav style cues mobile UX ko app-like banayenge.</p>
              </div>
            </div>
            <div className="cl-install-step">
              <span>03</span>
              <div>
                <h3>Desktop integrity</h3>
                <p>Wider layouts, hover clarity, aur keyboard-friendly structure desktop ko strong rakhega.</p>
              </div>
            </div>
          </div>
        </ShellCard>
      </section>
    </main>
  );
}
