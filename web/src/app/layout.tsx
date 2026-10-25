import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/app-context";
import { SiteHeader } from "@/components/site-header";
import { DeleteDataButton } from "@/components/delete-data";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

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
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-ink"
        >
          Skip to content
        </a>
        <AppProvider>
          <SiteHeader />
          {/* One narrow centred column for every screen (about 640 px of content). */}
          <main id="main" className="dt-column flex-1 pb-20 pt-8 sm:pt-14">
            {children}
          </main>
          <footer data-site-footer className="no-print">
            <div className="dt-column flex flex-col gap-2 border-t border-line py-6 text-sm text-ink-subtle sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <p>These are calculations from your figures, not predictions or financial advice.</p>
              <DeleteDataButton />
            </div>
          </footer>
        </AppProvider>
      </body>
    </html>
  );
}
