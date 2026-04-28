"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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

function EventsIcon() {
  return (
    <IconBase>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

export function buildPrimaryCampusNav(
  activeSection: CampusSection,
  options?: { unreadCount?: number; profileHref?: string }
): CampusNavItem[] {
  const profileHref = options?.profileHref ?? "/dashboard";

  return [
    { label: "Home", href: "/home", icon: <HomeIcon />, active: activeSection === "home" },
    { label: "Hub", href: "/hub", icon: <EventsIcon />, active: activeSection === "events" },
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
  return (
    <aside className="vyb-campus-sidebar vyb-campus-rail">
      <Link href="/home" className="vyb-campus-branding">
        <VybLogoLockup priority />
      </Link>

      <nav className="vyb-campus-nav" aria-label="Campus navigation">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`vyb-campus-nav-item${item.active ? " is-active" : ""}`}
            aria-current={item.active ? "page" : undefined}
          >
            <span className="vyb-campus-nav-item-icon-wrap">
              {item.icon}
              {item.badge ? <span className="vyb-campus-nav-badge">{item.badge > 9 ? "9+" : item.badge}</span> : null}
            </span>
            <span>{item.label}</span>
          </Link>
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
  const visibleNavItems = navItems.filter((item) => item.href !== "/messages");

  return (
    <nav className="vyb-campus-bottom-nav" aria-label="Campus navigation">
      {visibleNavItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`vyb-campus-bottom-item${item.active ? " is-active" : ""}`}
          aria-current={item.active ? "page" : undefined}
        >
          <span className="vyb-campus-nav-item-icon-wrap">
            {item.icon}
            {item.badge ? <span className="vyb-campus-nav-badge">{item.badge > 9 ? "9+" : item.badge}</span> : null}
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
