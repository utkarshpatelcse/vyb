import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./feed-enhancements.css";
import { AppMaintenanceGate } from "../src/components/app-maintenance-gate";
import { BackgroundPublishManager } from "../src/components/background-publish-manager";
import { ChatPresenceHeartbeat } from "../src/components/chat-presence-heartbeat";
import { ServiceWorkerRegister } from "../src/components/service-worker-register";

const themeBootScript = `
  try {
    var savedTheme = window.localStorage.getItem("vyb-theme");
    document.documentElement.dataset.theme = savedTheme === "light" ? "light" : "dark";
  } catch (error) {
    document.documentElement.dataset.theme = "dark";
  }
`;

export const metadata: Metadata = {
  title: "Vyb",
  description: "PWA-first campus operating system for social energy, academic utility, and trusted communities.",
  applicationName: "Vyb",
  icons: {
    icon: "/icons/icon.png",
    shortcut: "/icons/icon.png",
    apple: "/icons/apple-touch-icon.png"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vyb"
  }
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ServiceWorkerRegister />
        <ChatPresenceHeartbeat />
        <BackgroundPublishManager />
        <AppMaintenanceGate />
        {children}
      </body>
    </html>
  );
}
