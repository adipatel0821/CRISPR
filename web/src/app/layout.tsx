import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/app-context";
import { SiteHeader } from "@/components/site-header";
import { DeleteDataButton } from "@/components/delete-data";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "DecisionTwin — see a car loan's real cost",
  description:
    "Understand a car loan's real cost and what it does to your month and your savings. Every number is traceable to its source.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <AppProvider>
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            {children}
          </main>
          <footer data-site-footer className="border-t border-line bg-surface">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="max-w-2xl">
                DecisionTwin does arithmetic on the figures you provide and assumptions you can see. It is not a
                prediction and not financial advice. Consider reviewing a decision like this with someone you trust.
              </p>
              <DeleteDataButton />
            </div>
          </footer>
        </AppProvider>
      </body>
    </html>
  );
}
