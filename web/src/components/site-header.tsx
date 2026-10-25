"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { JourneyIndicator, SetupProgress, isResultsPath } from "@/components/system/journey";

/** Wordmark: the name only. */
function Wordmark() {
  return (
    <Link href="/" className="rounded-sm text-[15px] font-semibold tracking-tight text-ink">
      DecisionTwin
    </Link>
  );
}

/**
 * Quiet shell header: wordmark, a plain-text step indicator on the setup screens, and the four results
 * sections as text links on the results screens. Not sticky, so it never covers a focused control.
 */
export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const { fixtures } = useApp();
  const results = isResultsPath(pathname);

  return (
    <header data-site-header>
      <div className="dt-column flex min-h-16 flex-wrap items-center gap-x-6 gap-y-1 pt-3 sm:pt-0">
        <div className="flex min-w-0 items-center gap-3">
          <Wordmark />
          {fixtures && (
            <span className="text-sm text-info" title="Bundled example data, not a live analysis">
              Example data
            </span>
          )}
        </div>
        {results ? (
          <JourneyIndicator className="basis-full pb-2 sm:ml-auto sm:basis-auto sm:pb-0" />
        ) : (
          <SetupProgress className="ml-auto" />
        )}
      </div>
    </header>
  );
}

/** Former results tabs. The header now carries this navigation; kept so existing imports compile. */
export function ResultsTabs() {
  return null;
}
