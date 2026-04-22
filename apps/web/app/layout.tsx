import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./feed-enhancements.css";
import { ServiceWorkerRegister } from "../src/components/service-worker-register";


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
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}