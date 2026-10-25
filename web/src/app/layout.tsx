import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/app-context";
import { LegacyJourney, SiteHeader } from "@/components/site-header";

/* One family for the whole product. Variable font (200 to 800); tabular figures via font-variant-numeric. */
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: "DecisionTwin: see what a car loan does to your month",
  description:
    "See a car loan's real cost and what it leaves you each month and in savings. Every number links to its source.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111111",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-cta focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-cta-ink"
        >
          Skip to content
        </a>
        <AppProvider>
          {/* The blue band runs behind the header and the top of the application surface. */}
          <div data-brand-band aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-frame" />
          <SiteHeader />
          <div
            data-app-surface
            className="relative z-10 mx-auto flex w-full flex-1 flex-col bg-surface shadow-surface lg:w-[var(--app-width)] lg:rounded-t-[var(--radius-surface)]"
          >
            <LegacyJourney />
            <main id="main" className="flex w-full min-w-0 flex-1 flex-col">
              {children}
            </main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
