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
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-ink"
        >
          Skip to content
        </a>
        <AppProvider>
          <SiteHeader />
          {/* Results width (~960 px). Reading screens narrow themselves with <Container width="reading">. */}
          <main id="main" className="mx-auto w-full max-w-[60rem] flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
            {children}
          </main>
          <footer data-site-footer className="border-t border-line">
            <div className="mx-auto flex w-full max-w-[60rem] flex-col gap-3 px-4 py-6 text-xs leading-relaxed text-ink-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="max-w-xl">
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
