"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";
import { VybLogoLockup } from "./vyb-logo";

export type CampusSection = "home" | "events" | "messages" | "vibes" | "market" | "profile";

export type CampusNavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  active?: boolean;
  badge?: number;
};

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vyb-campus-icon">
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <IconBase>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 22V12h6v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function HubIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function MessagesIcon() {
  return (
    <IconBase>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function VibesIcon() {
  return (
    <IconBase>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function MarketIcon() {
  return (
    <IconBase>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6h18M16 10a4 4 0 0 1-8 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ProfileIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function normalizeHref(href: string) {
  return href.split("?")[0]?.replace(/\/+$/u, "") || "/";
}

const warmedDevRouteDocuments = new Set<string>();

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function useCampusNavPrefetch(navItems: CampusNavItem[]) {
  const router = useRouter();
  const hrefs = useMemo(() => Array.from(new Set(["/home", ...navItems.map((item) => item.href)])), [navItems]);

  useEffect(() => {
    for (const href of hrefs) {
      router.prefetch(href);
    }

    if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
      return;
    }

    const controller = new AbortController();
    const idleWindow = window as IdleWindow;
    let cancelled = false;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    async function warmRouteDocuments() {
      for (const href of hrefs) {
        if (cancelled || warmedDevRouteDocuments.has(href)) {
          continue;
        }

        warmedDevRouteDocuments.add(href);

        try {
          await fetch(href, {
            cache: "force-cache",
            credentials: "same-origin",
            headers: { "x-vyb-route-warm": "1" },
            signal: controller.signal
          });
        } catch {
          if (!controller.signal.aborted) {
            warmedDevRouteDocuments.delete(href);
          }
        }
      }
    }

    timeoutId = window.setTimeout(() => {
      if (idleWindow.requestIdleCallback) {
        idleId = idleWindow.requestIdleCallback(() => {
          void warmRouteDocuments();
        }, { timeout: 2000 });
        return;
      }

      void warmRouteDocuments();
    }, 500);

    return () => {
      cancelled = true;
      controller.abort();

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      if (idleId !== null) {
        idleWindow.cancelIdleCallback?.(idleId);
      }
    };
  }, [hrefs, router]);

  return router;
}

function CampusNavigationLink({
  item,
  className,
  pendingHref,
  setPendingHref,
  router
}: {
  item: CampusNavItem;
  className: string;
  pendingHref: string | null;
  setPendingHref: (href: string | null) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const pathname = usePathname();
  const inFlightRef = useRef(false);
  const normalizedHref = normalizeHref(item.href);
  const isCurrentRoute = normalizeHref(pathname) === normalizedHref;
  const isOptimisticActive = item.active || pendingHref === item.href || isCurrentRoute;
  const composedClassName = `${className}${isOptimisticActive ? " is-active" : ""}${pendingHref === item.href && !isCurrentRoute ? " is-routing" : ""}`;

  useEffect(() => {
    if (pendingHref && normalizeHref(pathname) === normalizeHref(pendingHref)) {
      inFlightRef.current = false;
      setPendingHref(null);
    }
  }, [pathname, pendingHref, setPendingHref]);

  function warmRoute() {
    router.prefetch(item.href);
  }

  function goToRoute() {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    warmRoute();
    setPendingHref(item.href);
    startTransition(() => {
      router.push(item.href);
    });
  }

  function shouldLetBrowserHandle(event: MouseEvent<HTMLAnchorElement> | PointerEvent<HTMLAnchorElement>) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || ("button" in event && event.button !== 0);
  }

  function handlePointerDown(event: PointerEvent<HTMLAnchorElement>) {
    if (shouldLetBrowserHandle(event) || isCurrentRoute) {
      return;
    }

    event.preventDefault();
    goToRoute();
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (shouldLetBrowserHandle(event) || isCurrentRoute) {
      return;
    }

    event.preventDefault();
    goToRoute();
  }

  return (
    <Link
      href={item.href}
      prefetch
      className={composedClassName}
      aria-current={isOptimisticActive ? "page" : undefined}
      onPointerDown={handlePointerDown}
      onMouseEnter={warmRoute}
      onFocus={warmRoute}
      onClick={handleClick}
    >
      <span className="vyb-campus-nav-item-icon-wrap">
        {item.icon}
        {item.badge ? <span className="vyb-campus-nav-badge">{item.badge > 9 ? "9+" : item.badge}</span> : null}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

export function buildPrimaryCampusNav(
  activeSection: CampusSection,
  options?: { unreadCount?: number; profileHref?: string }
): CampusNavItem[] {
  const profileHref = options?.profileHref ?? "/dashboard";

  return [
    { label: "Home", href: "/home", icon: <HomeIcon />, active: activeSection === "home" },
    { label: "Hub", href: "/hub", icon: <HubIcon />, active: activeSection === "events" },
    {
      label: "Chats",
      href: "/messages",
      icon: <MessagesIcon />,
      active: activeSection === "messages",
      badge: options?.unreadCount && options.unreadCount > 0 ? options.unreadCount : undefined
    },
    { label: "Vibes", href: "/vibes", icon: <VibesIcon />, active: activeSection === "vibes" },
    { label: "Market", href: "/market", icon: <MarketIcon />, active: activeSection === "market" },
    { label: "Profile", href: profileHref, icon: <ProfileIcon />, active: activeSection === "profile" }
  ];
}

export function CampusDesktopNavigation({
  navItems,
  viewerName,
  viewerUsername
}: {
  navItems: CampusNavItem[];
  viewerName: string;
  viewerUsername: string;
}) {
  const router = useCampusNavPrefetch(navItems);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  return (
    <aside className="vyb-campus-sidebar vyb-campus-rail">
      <Link href="/home" className="vyb-campus-branding">
        <VybLogoLockup priority />
      </Link>

      <nav className="vyb-campus-nav" aria-label="Campus navigation">
        {navItems.map((item) => (
          <CampusNavigationLink
            key={item.label}
            item={item}
            className="vyb-campus-nav-item"
            pendingHref={pendingHref}
            setPendingHref={setPendingHref}
            router={router}
          />
        ))}
      </nav>

      <div className="vyb-campus-sidebar-footer">
        <div className="vyb-campus-sidebar-user">
          <strong>{viewerName}</strong>
          <span>@{viewerUsername}</span>
        </div>
        <SignOutButton className="vyb-campus-signout" />
      </div>
    </aside>
  );
}

export function CampusMobileNavigation({ navItems }: { navItems: CampusNavItem[] }) {
  const router = useCampusNavPrefetch(navItems);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const visibleNavItems = navItems.filter((item) => item.href !== "/messages");

  return (
    <nav className="vyb-campus-bottom-nav" aria-label="Campus navigation">
      {visibleNavItems.map((item) => (
        <CampusNavigationLink
          key={item.label}
          item={item}
          className="vyb-campus-bottom-item"
          pendingHref={pendingHref}
          setPendingHref={setPendingHref}
          router={router}
        />
      ))}
    </nav>
  );
}
