"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";
import { JourneyIndicator, SetupProgress, isResultsPath, isSetupPath } from "@/components/system/journey";
import { TwinMark } from "./twin-mark";
import { LoanChip, useHasLoanChip } from "./loan-chip";
import { MoreMenu } from "./more-menu";

/**
 * The app frame's top bar: mark and name, the setup steps or the results tabs, the loan chip once an offer
 * exists, and the More menu. One row on wide screens; on narrower ones the navigation takes a second row.
 * Not sticky, so it never covers a focused control. Hidden in print.
 */
export function AppBar() {
  const pathname = usePathname() ?? "/";
  const { fixtures } = useApp();
  const hasChip = useHasLoanChip();
  const results = isResultsPath(pathname);
  const setup = isSetupPath(pathname);
  const navClass = "col-span-3 row-start-2 -mt-1 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:mt-0 lg:justify-self-center";

  return (
    <header data-site-header className="no-print border-b border-line">
      <div className="dt-bar grid grid-cols-[minmax(0,auto)_1fr_auto] items-center gap-x-4">
        <div className="col-start-1 row-start-1 flex h-14 min-w-0 items-center gap-3">
          <Link href="/" aria-label="DecisionTwin, start page" className="flex min-w-0 items-center gap-2 rounded-sm">
            <TwinMark />
            {/* phones with a loan chip show the mark only, so the loan fits on one row */}
            <span className={cn("text-[15px] font-semibold tracking-[-0.01em] text-ink", hasChip && "hidden sm:inline")}>
              DecisionTwin
            </span>
          </Link>
          {fixtures && (
            <span
              className={cn("whitespace-nowrap rounded-control bg-info-soft px-2 py-0.5 text-sm text-info", hasChip && "hidden sm:inline")}
              title="Bundled example data, not a live analysis"
            >
              Example data
            </span>
          )}
        </div>

        <div className="col-start-3 row-start-1 flex h-14 items-center justify-end gap-2">
          <LoanChip />
          <MoreMenu />
        </div>

        {results ? (
          <JourneyIndicator className={navClass} />
        ) : setup ? (
          <SetupProgress className={navClass} />
        ) : null}
      </div>
    </header>
  );
}
