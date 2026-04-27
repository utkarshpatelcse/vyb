"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type Snapshot = {
  tenantResolution: {
    primary: string;
    fallback: string;
    localDefault: string;
  };
  tenants: {
    id: string;
    name: string;
    domainHint: string;
    users: number;
    posts: number;
    hiddenPosts: number;
    activeUsers: number;
  }[];
  users: {
    userId: string;
    tenantId: string;
    primaryEmail?: string;
    username?: string;
    fullName?: string | null;
    course?: string | null;
    stream?: string | null;
    year?: number;
    createdAt?: string;
    control: {
      status: "active" | "suspended" | "banned";
      role: "student" | "moderator";
      shadowBanned: boolean;
      deviceInfo: string;
      karmaPoints: number;
    };
    postCount: number;
  }[];
  posts: {
    id: string;
    tenantId: string;
    authorUserId: string;
    authorName?: string;
    title?: string;
    body?: string;
    placement?: string;
    kind?: string;
    status?: string;
    reactions?: number;
    comments?: number;
    hidden: boolean;
    hiddenReason: string | null;
  }[];
  reports: {
    id: string;
    targetType: string;
    targetId: string;
    reason: string;
    priority: string;
    status: string;
    createdAt: string;
  }[];
  auditLogs: {
    id: string;
    actor: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
  }[];
  notifications: {
    id: string;
    tenantId: string;
    title: string;
    body: string;
    audience: string;
    createdAt: string;
  }[];
  maintenance: {
    enabled: boolean;
    message: string;
    updatedAt: string | null;
  };
  keywordFirewall: string[];
  arena: {
    dailyLevel: string;
    difficultyMin: number;
    difficultyMax: number;
    cheaterThresholdSeconds: number;
    leaderboardVerification: boolean;
  };
  apiKeys: {
    provider: string;
    status: string;
    lastRotatedAt: string | null;
    note: string;
  }[];
  backups: {
    id: string;
    path: string;
    createdAt: string;
  }[];
  heartbeat: {
    dau: number;
    mau: number;
    posts: number;
    reportsOpen: number;
    apiErrorRate: number;
    databaseLatencyMs: number;
    cpuUsage: number;
    retention: {
      from: string;
      to: string;
      percent: number;
    }[];
  };
};

type Tab = "command" | "users" | "arena" | "content" | "campus" | "settings";

const tabs: { id: Tab; label: string }[] = [
  { id: "command", label: "Command Center" },
  { id: "users", label: "User Vault" },
  { id: "arena", label: "Arena Master" },
  { id: "content", label: "Content Jail" },
  { id: "campus", label: "Campus Hub" },
  { id: "settings", label: "Settings" }
];

function isErrorPayload(value: unknown): value is { error?: { message?: string } } {
  return Boolean(value && typeof value === "object" && "error" in value);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

export function SuperAdminPortal({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [activeTab, setActiveTab] = useState<Tab>("command");
  const [query, setQuery] = useState("");
  const [keyword, setKeyword] = useState("");
  const [killReason, setKillReason] = useState("Manual kill switch");
  const [noticeTitle, setNoticeTitle] = useState("New Daily Connect is LIVE!");
  const [noticeBody, setNoticeBody] = useState("");
  const [maintenanceMessage, setMaintenanceMessage] = useState(initialSnapshot.maintenance.message);
  const [arenaDraft, setArenaDraft] = useState(initialSnapshot.arena);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMaintenanceMessage(snapshot.maintenance.message);
    setArenaDraft(snapshot.arena);
  }, [snapshot.arena, snapshot.maintenance.message]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return snapshot.users;
    }

    return snapshot.users.filter((user) =>
      [user.fullName, user.username, user.primaryEmail, user.userId, user.tenantId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [query, snapshot.users]);

  function runAdminAction(payload: Record<string, unknown>, successMessage: string) {
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/portal", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const nextSnapshot = (await response.json().catch(() => null)) as Snapshot | { error?: { message?: string } } | null;

      if (!response.ok || !nextSnapshot || isErrorPayload(nextSnapshot)) {
        setFeedback(isErrorPayload(nextSnapshot) ? nextSnapshot.error?.message || "Admin action failed." : "Admin action failed.");
        return;
      }

      setSnapshot(nextSnapshot);
      setFeedback(successMessage);
    });
  }

  return (
    <main className="super-admin-shell">
      <section className="admin-hero">
        <div>
          <span className="admin-kicker">VYB Super Admin</span>
          <h1>Product command center</h1>
          <p>Tenant routing, user trust, moderation pressure, arena safety, notifications, and maintenance control in one place.</p>
        </div>
        <div className={`maintenance-pill ${snapshot.maintenance.enabled ? "is-on" : ""}`}>
          <span>{snapshot.maintenance.enabled ? "Maintenance active" : "Platform live"}</span>
          <button
            type="button"
            onClick={() =>
              runAdminAction(
                {
                  action: "maintenance.update",
                  enabled: !snapshot.maintenance.enabled,
                  message: maintenanceMessage
                },
                snapshot.maintenance.enabled ? "Maintenance mode disabled." : "Maintenance mode enabled."
              )
            }
            disabled={isPending}
          >
            {snapshot.maintenance.enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </section>

      <nav className="admin-tabs" aria-label="Admin sections">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? "is-active" : ""} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {feedback ? <p className="admin-feedback">{feedback}</p> : null}

      {activeTab === "command" ? (
        <section className="admin-grid">
          <div className="admin-panel is-wide">
            <div className="panel-title">
              <span>Heartbeat</span>
              <small>Realtime-ish dev snapshot</small>
            </div>
            <div className="metric-grid">
              <article>
                <strong>{snapshot.heartbeat.dau}</strong>
                <span>DAU</span>
              </article>
              <article>
                <strong>{snapshot.heartbeat.mau}</strong>
                <span>MAU</span>
              </article>
              <article>
                <strong>{snapshot.heartbeat.posts}</strong>
                <span>Visible posts</span>
              </article>
              <article>
                <strong>{snapshot.heartbeat.reportsOpen}</strong>
                <span>Open reports</span>
              </article>
            </div>
            <div className="health-row">
              <span>CPU {snapshot.heartbeat.cpuUsage}%</span>
              <span>DB {snapshot.heartbeat.databaseLatencyMs}ms</span>
              <span>API errors {snapshot.heartbeat.apiErrorRate}%</span>
            </div>
          </div>

          <div className="admin-panel">
            <div className="panel-title">
              <span>Tenant Logic</span>
              <small>How campus is decided</small>
            </div>
            <p>{snapshot.tenantResolution.primary}</p>
            <p>{snapshot.tenantResolution.fallback}</p>
            <p>{snapshot.tenantResolution.localDefault}</p>
          </div>

          <div className="admin-panel">
            <div className="panel-title">
              <span>Retention Heatmap</span>
              <small>Flow signals</small>
            </div>
            <div className="retention-list">
              {snapshot.heartbeat.retention.map((item) => (
                <div key={`${item.from}-${item.to}`}>
                  <span>{item.from} {"->"} {item.to}</span>
                  <meter min={0} max={100} value={item.percent} />
                  <strong>{item.percent}%</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-panel is-wide">
            <div className="panel-title">
              <span>Admin Logs</span>
              <small>Latest sensitive actions</small>
            </div>
            <div className="admin-log-list">
              {snapshot.auditLogs.length === 0 ? <p>No admin actions yet.</p> : null}
              {snapshot.auditLogs.slice(0, 8).map((log) => (
                <article key={log.id}>
                  <strong>{log.actor}</strong>
                  <span>{log.action} on {log.entityType} {shortId(log.entityId)}</span>
                  <time>{formatDate(log.createdAt)}</time>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "users" ? (
        <section className="admin-panel">
          <div className="panel-title">
            <span>User Vault</span>
            <small>Search, suspend, ban, shadow ban, and promote moderators</small>
          </div>
          <input className="admin-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by email, username, tenant, or name" />
          <div className="admin-table">
            {filteredUsers.map((user) => (
              <article key={user.userId} className={user.control.shadowBanned ? "is-shadowed" : ""}>
                <div>
                  <strong>{user.fullName || user.username || user.primaryEmail}</strong>
                  <span>{user.primaryEmail} · {shortId(user.tenantId)}</span>
                  <small>{user.postCount} posts · {user.control.karmaPoints} karma · {user.control.deviceInfo}</small>
                </div>
                <div className="admin-actions">
                  <select
                    value={user.control.status}
                    onChange={(event) => runAdminAction({ action: "user.status", userId: user.userId, status: event.target.value }, "User status updated.")}
                    disabled={isPending}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspend</option>
                    <option value="banned">Ban</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      runAdminAction(
                        { action: "user.role", userId: user.userId, role: user.control.role === "moderator" ? "student" : "moderator" },
                        "Role updated."
                      )
                    }
                    disabled={isPending}
                  >
                    {user.control.role === "moderator" ? "Demote" : "Make mod"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runAdminAction(
                        { action: "user.shadowBan", userId: user.userId, shadowBanned: !user.control.shadowBanned },
                        "Shadow ban setting updated."
                      )
                    }
                    disabled={isPending}
                  >
                    {user.control.shadowBanned ? "Unshadow" : "Shadow ban"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "arena" ? (
        <section className="admin-grid">
          <div className="admin-panel">
            <div className="panel-title">
              <span>Arena Master</span>
              <small>Daily level override and cheat thresholds</small>
            </div>
            <label>
              Daily level
              <input value={arenaDraft.dailyLevel} onChange={(event) => setArenaDraft({ ...arenaDraft, dailyLevel: event.target.value })} />
            </label>
            <div className="split-fields">
              <label>
                Min grid
                <input type="number" min={5} max={9} value={arenaDraft.difficultyMin} onChange={(event) => setArenaDraft({ ...arenaDraft, difficultyMin: Number(event.target.value) })} />
              </label>
              <label>
                Max grid
                <input type="number" min={5} max={9} value={arenaDraft.difficultyMax} onChange={(event) => setArenaDraft({ ...arenaDraft, difficultyMax: Number(event.target.value) })} />
              </label>
            </div>
            <label>
              Cheater threshold seconds
              <input
                type="number"
                min={1}
                max={30}
                value={arenaDraft.cheaterThresholdSeconds}
                onChange={(event) => setArenaDraft({ ...arenaDraft, cheaterThresholdSeconds: Number(event.target.value) })}
              />
            </label>
            <label className="toggle-line">
              Verify leaderboard
              <input
                type="checkbox"
                checked={arenaDraft.leaderboardVerification}
                onChange={(event) => setArenaDraft({ ...arenaDraft, leaderboardVerification: event.target.checked })}
              />
            </label>
            <button type="button" onClick={() => runAdminAction({ action: "arena.update", ...arenaDraft }, "Arena config updated.")} disabled={isPending}>
              Save arena config
            </button>
          </div>
          <div className="admin-panel">
            <div className="panel-title">
              <span>Live Leaderboard Guard</span>
              <small>Rules ready for game integration</small>
            </div>
            <p>Any solve below {snapshot.arena.cheaterThresholdSeconds}s should be auto-flagged.</p>
            <p>Grid range is {snapshot.arena.difficultyMin}x{snapshot.arena.difficultyMin} to {snapshot.arena.difficultyMax}x{snapshot.arena.difficultyMax}.</p>
            <p>Leaderboard verification is {snapshot.arena.leaderboardVerification ? "on" : "off"}.</p>
          </div>
        </section>
      ) : null}

      {activeTab === "content" ? (
        <section className="admin-grid">
          <div className="admin-panel is-wide">
            <div className="panel-title">
              <span>Content Jail</span>
              <small>Reported and trending content controls</small>
            </div>
            <div className="post-jail">
              {snapshot.posts.map((post) => (
                <article key={post.id} className={post.hidden ? "is-hidden" : ""}>
                  <div>
                    <strong>{post.title || post.body || post.id}</strong>
                    <span>{post.authorName || post.authorUserId} · {post.placement || "feed"} · {post.kind || "text"}</span>
                    <small>{post.reactions ?? 0} reactions · {post.comments ?? 0} comments {post.hiddenReason ? `· ${post.hiddenReason}` : ""}</small>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      runAdminAction(
                        post.hidden ? { action: "post.restore", postId: post.id } : { action: "post.kill", postId: post.id, reason: killReason },
                        post.hidden ? "Post restored." : "Post hidden from platform."
                      )
                    }
                    disabled={isPending}
                  >
                    {post.hidden ? "Restore" : "Kill switch"}
                  </button>
                </article>
              ))}
            </div>
          </div>
          <div className="admin-panel">
            <div className="panel-title">
              <span>Report Queue</span>
              <small>Priority first</small>
            </div>
            {snapshot.reports.map((report) => (
              <article key={report.id} className="report-card">
                <strong>{report.priority.toUpperCase()} · {report.reason}</strong>
                <span>{report.targetType} {shortId(report.targetId)}</span>
                <small>{formatDate(report.createdAt)}</small>
              </article>
            ))}
          </div>
          <div className="admin-panel">
            <div className="panel-title">
              <span>Keyword Firewall</span>
              <small>Regex-ready blocklist</small>
            </div>
            <div className="keyword-row">
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Add keyword or regex" />
              <button type="button" onClick={() => runAdminAction({ action: "keyword.add", keyword }, "Keyword added.")} disabled={isPending || !keyword.trim()}>
                Add
              </button>
            </div>
            <div className="keyword-list">
              {snapshot.keywordFirewall.map((item) => (
                <button key={item} type="button" onClick={() => runAdminAction({ action: "keyword.remove", keyword: item }, "Keyword removed.")} disabled={isPending}>
                  {item}
                </button>
              ))}
            </div>
            <label>
              Kill switch reason
              <input value={killReason} onChange={(event) => setKillReason(event.target.value)} />
            </label>
          </div>
        </section>
      ) : null}

      {activeTab === "campus" ? (
        <section className="admin-grid">
          {snapshot.tenants.map((tenant) => (
            <article key={tenant.id} className="admin-panel tenant-card">
              <div className="panel-title">
                <span>{tenant.name}</span>
                <small>{tenant.domainHint}</small>
              </div>
              <strong>{shortId(tenant.id)}</strong>
              <div className="tenant-stats">
                <span>{tenant.users} users</span>
                <span>{tenant.activeUsers} active</span>
                <span>{tenant.posts} posts</span>
                <span>{tenant.hiddenPosts} hidden</span>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {activeTab === "settings" ? (
        <section className="admin-grid">
          <div className="admin-panel">
            <div className="panel-title">
              <span>Global Maintenance Switch</span>
              <small>App-wide safety screen</small>
            </div>
            <label>
              Message
              <textarea value={maintenanceMessage} onChange={(event) => setMaintenanceMessage(event.target.value)} rows={3} />
            </label>
            <button
              type="button"
              onClick={() =>
                runAdminAction(
                  {
                    action: "maintenance.update",
                    enabled: !snapshot.maintenance.enabled,
                    message: maintenanceMessage
                  },
                  "Maintenance setting updated."
                )
              }
              disabled={isPending}
            >
              {snapshot.maintenance.enabled ? "Turn off maintenance" : "Turn on maintenance"}
            </button>
          </div>

          <div className="admin-panel">
            <div className="panel-title">
              <span>Notification Engine</span>
              <small>Broadcast composer</small>
            </div>
            <label>
              Title
              <input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} />
            </label>
            <label>
              Body
              <textarea value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} rows={3} />
            </label>
            <button
              type="button"
              onClick={() =>
                runAdminAction(
                  {
                    action: "notification.broadcast",
                    tenantId: "all",
                    title: noticeTitle,
                    body: noticeBody,
                    audience: "all"
                  },
                  "Notification logged for broadcast."
                )
              }
              disabled={isPending || !noticeBody.trim()}
            >
              Broadcast
            </button>
          </div>

          <div className="admin-panel">
            <div className="panel-title">
              <span>Backup Trigger</span>
              <small>Manual JSON snapshot</small>
            </div>
            <button type="button" onClick={() => runAdminAction({ action: "backup.trigger" }, "Backup snapshot created.")} disabled={isPending}>
              Trigger backup
            </button>
            {snapshot.backups.slice(0, 3).map((backup) => (
              <p key={backup.id}>{backup.id} · {formatDate(backup.createdAt)}</p>
            ))}
          </div>

          <div className="admin-panel">
            <div className="panel-title">
              <span>API Key Management</span>
              <small>Operational notes</small>
            </div>
            {snapshot.apiKeys.map((key) => (
              <article key={key.provider} className="api-key-row">
                <strong>{key.provider}</strong>
                <span>{key.status} · rotated {formatDate(key.lastRotatedAt)}</span>
                <small>{key.note}</small>
              </article>
            ))}
          </div>

          <div className="admin-panel is-wide">
            <div className="panel-title">
              <span>Notification History</span>
              <small>Latest broadcasts</small>
            </div>
            {snapshot.notifications.length === 0 ? <p>No broadcasts yet.</p> : null}
            {snapshot.notifications.slice(0, 6).map((notice) => (
              <article key={notice.id} className="notice-row">
                <strong>{notice.title}</strong>
                <span>{notice.body}</span>
                <small>{notice.audience} · {formatDate(notice.createdAt)}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
