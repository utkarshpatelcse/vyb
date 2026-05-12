"use client";

import type { ListNotificationsResponse, NotificationRecord } from "@vyb/contracts";
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

type CampusNotificationsShellProps = {
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  initialNotifications: ListNotificationsResponse;
};

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

function formatNotificationTime(dateString: string) {
  const date = new Date(dateString);
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

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

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
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
  initialNotifications
}: CampusNotificationsShellProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialNotifications.items);
  const [unreadCount, setUnreadCount] = useState(initialNotifications.unreadCount);
  const [nextCursor, setNextCursor] = useState(initialNotifications.nextCursor);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const firstFilterLoad = useRef(true);
  const navItems = useMemo(() => buildPrimaryCampusNav(null), []);

  const visibleItems = items;

  const fetchNotifications = useCallback(
    async ({ cursor = null }: { cursor?: string | null } = {}) => {
      setLoading(true);
      setMessage(null);

      const params = new URLSearchParams({
        state: "all",
        limit: "40"
      });

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
    []
  );

  useEffect(() => {
    if (firstFilterLoad.current) {
      firstFilterLoad.current = false;
      return;
    }

    void fetchNotifications();
  }, [fetchNotifications]);

  async function markItemRead(item: NotificationRecord) {
    if (item.state.read_at) {
      return;
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
      setItems((current) => current.map((candidate) => (candidate.id === item.id ? payload.item : candidate)));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      setMessage("Could not update the read state. Opening the notification anyway.");
    }
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
          {message ? <p className="vyb-notifications-message">{message}</p> : null}

          <section className="vyb-notifications-list" aria-live="polite" aria-busy={loading}>
            {visibleItems.length === 0 ? (
              <div className="vyb-notifications-empty">
                <span className="vyb-notification-icon">
                  <BellIcon />
                </span>
                <strong>{loading ? "Loading notifications..." : "No notifications here"}</strong>
                <p>{loading ? "Loading the latest updates." : "You are all caught up."}</p>
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
                    <span className={`vyb-notification-icon is-${item.category}`}>
                      <BellIcon />
                    </span>

                    <span className="vyb-notification-copy">
                      <span className="vyb-notification-text">
                        <strong>{item.copy.title}</strong> {item.copy.body} <span className="vyb-notification-time">{formatNotificationTime(item.created_at)}</span>
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
