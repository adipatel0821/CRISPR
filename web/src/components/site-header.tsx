"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { Badge } from "@/components/ui/badge";
import { JourneyIndicator, SetupProgress, isResultsPath } from "@/components/system/journey";

/** Quiet wordmark: two overlapping rings (the "twin") + name. */
function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md text-[15px] font-semibold tracking-tight text-ink">
      <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" strokeWidth="2">
        <circle cx="9" cy="12" r="6" className="stroke-ink" />
        <circle cx="15" cy="12" r="6" className="stroke-accent" />
      </svg>
      DecisionTwin
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const { fixtures } = useApp();
  const results = isResultsPath(pathname);

  return (
    <header
      data-site-header
      className="sticky top-0 z-40 border-b border-line bg-page/90 backdrop-blur supports-[backdrop-filter]:bg-page/75"
    >
      <div className="mx-auto w-full max-w-[60rem] px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Wordmark />
            {fixtures && (
              <Badge tone="info" title="Showing bundled example data, not a live analysis">
                Example data
              </Badge>
            )}
          </div>
          {!results && <SetupProgress />}
        </div>
        {results && <JourneyIndicator className="-mt-1 pb-2" />}
      </div>
    </header>
  );
}

/**
 * Former results tabs. The journey indicator in the header now carries this navigation, so this renders
 * nothing; it is kept so existing imports keep compiling.
 */
export function ResultsTabs() {
  return null;
}
