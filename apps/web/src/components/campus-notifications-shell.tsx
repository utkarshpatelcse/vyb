"use client";

import type { ListNotificationsResponse, NotificationRecord, NotificationStateFilter } from "@vyb/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode
} from "react";
import { buildPrimaryCampusNav, CampusDesktopNavigation, CampusMobileNavigation } from "./campus-navigation";
import { VybLogoMark } from "./vyb-logo";
import { getNotificationPushClientState, registerWebPushDevice } from "../lib/notification-push-client";

type CampusNotificationsShellProps = {
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  initialNotifications: ListNotificationsResponse;
  initialNow: string;
};

const ALL_CATEGORIES = "all";

const STATE_FILTERS: Array<{ id: NotificationStateFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
  { id: "archived", label: "Archived" }
];

const PREFERRED_CATEGORY_FILTERS: Array<{ id: string; label: string }> = [
  { id: ALL_CATEGORIES, label: "All types" },
  { id: "community", label: "Communities" },
  { id: "social", label: "Social" },
  { id: "resource", label: "Resources" },
  { id: "chat", label: "Chats" },
  { id: "event", label: "Events" },
  { id: "market", label: "Market" },
  { id: "game", label: "Games" },
  { id: "security", label: "Security" },
  { id: "system", label: "System" }
];

type PushPromptState = "checking" | "available" | "hidden" | "busy";

function layoutStyle() {
  return {
    "--vyb-campus-left-width": "260px",
    "--vyb-campus-right-width": "0px"
  } as CSSProperties;
}

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vyb-campus-icon">
      {children}
    </svg>
  );
}

function BellIcon() {
  return (
    <IconBase>
      <path d="M12 4.5a4 4 0 0 1 4 4V11c0 .9.3 1.8.9 2.5l.7.8c.6.7.1 1.7-.8 1.7H7.2c-.9 0-1.4-1-.8-1.7l.7-.8A3.9 3.9 0 0 0 8 11V8.5a4 4 0 0 1 4-4Zm-1.7 13h3.4a1.7 1.7 0 0 1-3.4 0Z" fill="currentColor" />
    </IconBase>
  );
}

function formatNotificationTime(dateString: string, nowMs: number) {
  const date = new Date(dateString);
  const diffSeconds = Math.floor((nowMs - date.getTime()) / 1000);

  if (!Number.isFinite(diffSeconds)) {
    return "";
  }

  if (diffSeconds < 60) return "Just now";
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

function formatCategoryLabel(category: string) {
  const known = PREFERRED_CATEGORY_FILTERS.find((item) => item.id === category);
  if (known) {
    return known.label;
  }

  return category
    .split(/[\s._-]+/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function toNotificationCategoryClass(category: string) {
  return category.toLowerCase().replace(/[^a-z0-9_-]/gu, "-") || "system";
}

function getEmptyNotificationCopy(stateFilter: NotificationStateFilter, categoryFilter: string) {
  if (stateFilter === "unread") {
    return {
      title: "No unread notifications",
      body: categoryFilter === ALL_CATEGORIES ? "You are caught up across campus." : `No unread ${formatCategoryLabel(categoryFilter).toLowerCase()} updates.`
    };
  }

  if (stateFilter === "read") {
    return {
      title: "No read notifications yet",
      body: "Open updates from your inbox and they will move here."
    };
  }

  if (stateFilter === "archived") {
    return {
      title: "No archived notifications",
      body: "Archived updates will appear here when that flow is available."
    };
  }

  return {
    title: "No notifications here",
    body: categoryFilter === ALL_CATEGORIES ? "You are all caught up." : `No ${formatCategoryLabel(categoryFilter).toLowerCase()} updates yet.`
  };
}

function mergeNotificationItems(items: NotificationRecord[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function shouldLetBrowserHandle(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isExternalHref(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

async function canOpenNotificationHref(href: string) {
  try {
    const response = await fetch(href, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "x-vyb-route-warm": "1" }
    });
    const resolvedUrl = new URL(response.url, window.location.origin);
    const blockedRedirectTargets = new Set(["/login", "/onboarding", "/complete-profile"]);

    return response.ok && resolvedUrl.origin === window.location.origin && !blockedRedirectTargets.has(resolvedUrl.pathname);
  } catch {
    return false;
  }
}

export function CampusNotificationsShell({
  viewerName,
  viewerUsername,
  collegeName,
  initialNotifications,
  initialNow
}: CampusNotificationsShellProps) {
  const router = useRouter();
  const initialNowMs = useMemo(() => {
    const parsed = new Date(initialNow).getTime();
    return Number.isFinite(parsed) ? parsed : Date.now();
  }, [initialNow]);
  const [items, setItems] = useState(initialNotifications.items);
  const [unreadCount, setUnreadCount] = useState(initialNotifications.unreadCount);
  const [nextCursor, setNextCursor] = useState(initialNotifications.nextCursor);
  const [stateFilter, setStateFilter] = useState<NotificationStateFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pushPromptState, setPushPromptState] = useState<PushPromptState>("checking");
  const [relativeNowMs, setRelativeNowMs] = useState(initialNowMs);
  const firstFilterLoad = useRef(true);
  const navItems = useMemo(() => buildPrimaryCampusNav(null), []);

  const visibleItems = items;
  const emptyCopy = useMemo(() => getEmptyNotificationCopy(stateFilter, categoryFilter), [categoryFilter, stateFilter]);
  const categoryFilters = useMemo(() => {
    const byId = new Map(PREFERRED_CATEGORY_FILTERS.map((item) => [item.id, item]));

    for (const item of items) {
      const category = item.category.trim();
      if (category && !byId.has(category)) {
        byId.set(category, { id: category, label: formatCategoryLabel(category) });
      }
    }

    if (categoryFilter !== ALL_CATEGORIES && !byId.has(categoryFilter)) {
      byId.set(categoryFilter, { id: categoryFilter, label: formatCategoryLabel(categoryFilter) });
    }

    return Array.from(byId.values());
  }, [categoryFilter, items]);

  const fetchNotifications = useCallback(
    async ({ cursor = null }: { cursor?: string | null } = {}) => {
      setLoading(true);
      setMessage(null);

      const params = new URLSearchParams({
        state: stateFilter,
        limit: "40"
      });
      if (categoryFilter !== ALL_CATEGORIES) {
        params.set("category", categoryFilter);
      }

      if (cursor) {
        params.set("cursor", cursor);
      }

      try {
        const response = await fetch(`/api/notifications?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin"
        });

        if (!response.ok) {
          throw new Error("Notifications request failed.");
        }

        const payload = (await response.json()) as ListNotificationsResponse;
        setItems((current) => (cursor ? mergeNotificationItems([...current, ...payload.items]) : payload.items));
        setUnreadCount(payload.unreadCount);
        setNextCursor(payload.nextCursor);
      } catch {
        setMessage("Could not load notifications. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    },
    [categoryFilter, stateFilter]
  );

  useEffect(() => {
    if (firstFilterLoad.current) {
      firstFilterLoad.current = false;
      return;
    }

    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    let cancelled = false;

    async function preparePushPrompt() {
      const state = await getNotificationPushClientState().catch(() => ({ status: "unsupported" as const }));
      if (cancelled) {
        return;
      }

      if (state.status === "available") {
        setPushPromptState("available");
        return;
      }

      setPushPromptState("hidden");

      if (state.status === "granted") {
        void registerWebPushDevice({ requestPermission: false });
      }
    }

    void preparePushPrompt();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRelativeNowMs(Date.now());
    const intervalId = window.setInterval(() => setRelativeNowMs(Date.now()), 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  async function markItemRead(item: NotificationRecord) {
    if (item.state.read_at) {
      return true;
    }

    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, {
        method: "PATCH",
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("Notification read request failed.");
      }

      const payload = (await response.json()) as { item: NotificationRecord };
      setItems((current) =>
        stateFilter === "unread"
          ? current.filter((candidate) => candidate.id !== item.id)
          : current.map((candidate) => (candidate.id === item.id ? payload.item : candidate))
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      return true;
    } catch {
      setMessage("Could not update the read state. Opening the notification anyway.");
      return false;
    }
  }

  async function handleMarkAllRead() {
    if (markingAllRead || unreadCount === 0) {
      return;
    }

    setMarkingAllRead(true);
    setMessage(null);

    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          category: categoryFilter === ALL_CATEGORIES ? null : categoryFilter
        })
      });

      if (!response.ok) {
        throw new Error("Notifications read-all request failed.");
      }

      const payload = (await response.json()) as { updatedCount: number; readAt: string };
      if (payload.updatedCount > 0) {
        setUnreadCount((current) => Math.max(0, current - payload.updatedCount));
        setItems((current) => {
          const matchesSelectedCategory = (item: NotificationRecord) => categoryFilter === ALL_CATEGORIES || item.category === categoryFilter;

          if (stateFilter === "unread") {
            return current.filter((item) => !matchesSelectedCategory(item));
          }

          return current.map((item) =>
            matchesSelectedCategory(item) && item.state.read_at === null
              ? {
                  ...item,
                  state: {
                    ...item.state,
                    read_at: payload.readAt,
                    seen_at: item.state.seen_at ?? payload.readAt
                  }
                }
              : item
          );
        });
      }

      setMessage(
        payload.updatedCount > 0
          ? `Marked ${payload.updatedCount} ${payload.updatedCount === 1 ? "notification" : "notifications"} as read.`
          : "No unread notifications matched this filter."
      );
    } catch {
      setMessage("Could not mark notifications as read. Please try again.");
    } finally {
      setMarkingAllRead(false);
    }
  }

  async function handleEnablePushNotifications() {
    if (pushPromptState === "busy") {
      return;
    }

    setPushPromptState("busy");
    setMessage(null);

    const result = await registerWebPushDevice({ requestPermission: true });

    if (result.status === "registered") {
      setPushPromptState("hidden");
      setMessage("Push notifications are enabled on this device.");
      return;
    }

    if (result.status === "permission_needed") {
      setPushPromptState("available");
      setMessage("Choose Enable push when you are ready to allow browser notifications.");
      return;
    }

    setPushPromptState(result.status === "registration_failed" ? "available" : "hidden");
    if (result.status === "permission_denied") {
      setMessage("Push notifications are blocked for this browser. You can change that in browser settings.");
      return;
    }

    if (result.status === "unsupported") {
      setMessage("This browser does not support web push notifications.");
      return;
    }

    if (result.status === "vapid_unavailable") {
      setMessage("Push notifications are not configured for this environment yet.");
      return;
    }

    setMessage("We could not enable push notifications on this device.");
  }

  async function handleNotificationOpen(item: NotificationRecord, event: MouseEvent<HTMLAnchorElement>) {
    if (shouldLetBrowserHandle(event)) {
      return;
    }

    event.preventDefault();
    const href = item.copy.href || "/home";

    if (isExternalHref(href)) {
      window.location.assign(href);
      return;
    }

    const canOpen = await canOpenNotificationHref(href);
    if (!canOpen) {
      setMessage("Could not open that page. The notification is still unread.");
      return;
    }

    await markItemRead(item);
    router.push(href);
  }

  return (
    <main className="vyb-campus-home vyb-notifications-layout" style={layoutStyle()}>
      <CampusDesktopNavigation navItems={navItems} viewerName={viewerName} viewerUsername={viewerUsername} />

      <section className="vyb-campus-main vyb-notifications-main">
        <header className="vyb-campus-topbar">
          <div className="vyb-campus-topbar-copy">
            <strong>Notifications</strong>
            <span>{unreadCount > 0 ? `${unreadCount} unread updates` : `${collegeName} alerts`}</span>
          </div>
        </header>

        <header className="vyb-campus-mobile-header">
          <Link href="/home" className="vyb-campus-branding vyb-campus-branding-mobile">
            <VybLogoMark />
          </Link>
          <div className="vyb-campus-topbar-copy">
            <strong>Notifications</strong>
            <span>{unreadCount > 0 ? `${unreadCount} unread` : collegeName}</span>
          </div>
        </header>

        <div className="vyb-notifications-shell">
          <section className="vyb-notifications-summary" aria-label="Notification inbox summary">
            <div>
              <span>{collegeName}</span>
              <strong>Inbox</strong>
            </div>

            <div className="vyb-notifications-summary-actions">
              <div className="vyb-notifications-summary-stats" aria-label="Notification counts">
                <span>
                  Unread
                  <strong>{unreadCount}</strong>
                </span>
                <span>
                  Showing
                  <strong>{visibleItems.length}</strong>
                </span>
              </div>

              {pushPromptState === "available" || pushPromptState === "busy" ? (
                <button
                  type="button"
                  className="vyb-notifications-action"
                  disabled={pushPromptState === "busy"}
                  onClick={() => void handleEnablePushNotifications()}
                >
                  {pushPromptState === "busy" ? "Enabling..." : "Enable push"}
                </button>
              ) : null}

              <button
                type="button"
                className="vyb-notifications-action is-primary"
                disabled={loading || markingAllRead || unreadCount === 0}
                onClick={() => void handleMarkAllRead()}
              >
                {markingAllRead ? "Updating..." : categoryFilter === ALL_CATEGORIES ? "Mark all read" : "Mark type read"}
              </button>
            </div>
          </section>

          <section className="vyb-notifications-toolbar" aria-label="Notification filters">
            <div className="vyb-notifications-filter-row" role="list" aria-label="Read state">
              {STATE_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`vyb-notifications-filter${stateFilter === filter.id ? " is-active" : ""}`}
                  aria-pressed={stateFilter === filter.id}
                  onClick={() => setStateFilter(filter.id)}
                >
                  <span>{filter.label}</span>
                  {filter.id === "unread" && unreadCount > 0 ? <span className="vyb-notifications-filter-badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
                </button>
              ))}
            </div>

            <div className="vyb-notifications-filter-row is-category" role="list" aria-label="Notification type">
              {categoryFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`vyb-notifications-filter${categoryFilter === filter.id ? " is-active" : ""}`}
                  aria-pressed={categoryFilter === filter.id}
                  onClick={() => setCategoryFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </section>

          {message ? <p className="vyb-notifications-message">{message}</p> : null}

          <section className="vyb-notifications-list" aria-live="polite" aria-busy={loading}>
            {visibleItems.length === 0 ? (
              <div className="vyb-notifications-empty">
                <span className="vyb-notification-icon">
                  <BellIcon />
                </span>
                <strong>{loading ? "Loading notifications..." : emptyCopy.title}</strong>
                <p>{loading ? "Loading the latest updates." : emptyCopy.body}</p>
              </div>
            ) : (
              visibleItems.map((item) => {
                const isUnread = item.state.read_at === null;
                const isSilent = item.delivery_policy.silent || item.priority_score === 1;

                return (
                  <Link
                    key={item.id}
                    href={item.copy.href || "/home"}
                    className={`vyb-notification-card${isUnread ? " is-unread" : ""}${isSilent ? " is-silent" : ""}`}
                    onClick={(event) => void handleNotificationOpen(item, event)}
                  >
                    <span className={`vyb-notification-icon is-${toNotificationCategoryClass(item.category)}`}>
                      <BellIcon />
                    </span>

                    <span className="vyb-notification-copy">
                      <span className="vyb-notification-text">
                        <strong>{item.copy.title}</strong> {item.copy.body} <span className="vyb-notification-time">{formatNotificationTime(item.created_at, relativeNowMs)}</span>
                      </span>
                    </span>

                    {isUnread ? <span className="vyb-notification-dot" aria-label="Unread" /> : null}
                  </Link>
                );
              })
            )}
          </section>

          {nextCursor ? (
            <button
              type="button"
              className="vyb-notifications-load-more"
              disabled={loading}
              onClick={() => void fetchNotifications({ cursor: nextCursor })}
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          ) : null}
        </div>
      </section>

      <CampusMobileNavigation navItems={navItems} />
    </main>
  );
}
