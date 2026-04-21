import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { ServiceWorkerRegister } from "../src/components/service-worker-register";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-vyb-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"]
});

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
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={plusJakartaSans.variable}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
