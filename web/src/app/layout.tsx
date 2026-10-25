import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/app-context";
import { SiteHeader } from "@/components/site-header";
import { ToastProvider } from "@/components/system/toast";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

export const metadata: Metadata = {
  title: "DecisionTwin: car loan check",
  description: "See what a car loan costs and what it leaves you each month. Every figure shows where it came from.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf9f7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-ink"
        >
          Skip to content
        </a>
        <AppProvider>
          <ToastProvider>
            <SiteHeader />
            {/* One narrow centred column for every screen. Bottom room on phones for the docked primary action. */}
            <main id="main" className="dt-column flex-1 pb-28 pt-8 sm:pb-20 sm:pt-14">
              {children}
            </main>
          </ToastProvider>
        </AppProvider>
      </body>
    </html>
  );
}
