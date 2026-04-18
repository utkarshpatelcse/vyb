import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { PwaInstallPrompt } from "../src/components/pwa-install-prompt";
import { ServiceWorkerRegister } from "../src/components/service-worker-register";

export const metadata: Metadata = {
  title: "Vyb",
  description: "PWA-first campus operating system for social energy, academic utility, and trusted communities.",
  applicationName: "Vyb",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vyb"
  }
};

export const viewport: Viewport = {
  themeColor: "#08101b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <PwaInstallPrompt />
        {children}
      </body>
    </html>
  );
}
