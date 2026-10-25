"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { JourneyIndicator, SetupProgress, isResultsPath } from "@/components/system/journey";
import { Wordmark } from "@/components/shell/twin-mark";
import { HeaderActions } from "@/components/shell/more-menu";

/**
 * Full-width blue band: mark + wordmark on the left, quiet actions on the right ("How it works", menu with
 * Start over and Delete my data). Progress lives in each screen's stage rail, not here.
 */
export function SiteHeader() {
  const { fixtures } = useApp();
  return (
    <header data-site-header data-on-brand="" className="relative z-20 bg-frame lg:bg-transparent">
      <div className="mx-auto flex h-[var(--header-height)] w-full items-center justify-between gap-3 px-4 sm:px-6 lg:w-[var(--app-width)] lg:px-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="DecisionTwin, home" className="rounded-md">
            <Wordmark />
          </Link>
          {fixtures && (
            <span
              title="Showing bundled example data, not a live analysis"
              className="hidden rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white sm:inline"
            >
              Example data
            </span>
          )}
        </div>
        <HeaderActions />
      </div>
    </header>
  );
}

/**
 * Journey navigation for screens that are not on StageLayout yet (results journey or setup steps). It hides
 * itself (CSS, globals) as soon as a page renders a StageLayout, whose rail carries the navigation instead.
 */
export function LegacyJourney() {
  const pathname = usePathname() ?? "/";
  if (pathname === "/") return null;
  const results = isResultsPath(pathname);
  return (
    <div data-legacy-journey="" className="border-b border-line px-4 pb-2 pt-3 sm:px-6 lg:px-[var(--workspace-pad)]">
      {results ? <JourneyIndicator /> : <SetupProgress />}
    </div>
  );
}

/** Former results tabs. Navigation now lives in the stage rail; kept so existing imports keep compiling. */
export function ResultsTabs() {
  return null;
}
