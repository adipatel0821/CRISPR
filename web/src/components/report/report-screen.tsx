"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Printer } from "lucide-react";
import type { DecisionReport } from "@/lib/contracts";
import { formatTimestamp } from "@/lib/format";
import { plain } from "@/lib/copy";
import { useApp } from "@/lib/app-context";
import { FixtureNotice } from "@/components/banners";
import { DeleteDataButton } from "@/components/delete-data";
import { decisionTitle } from "@/components/report-parts";
import { PrimaryAction } from "@/components/system";
import { StageLayout } from "@/components/shell";
import { resultsRail } from "@/components/summary/results-rail";
import { AboutReport, BeforeYouSign, ChangesSection, ConcernSection, LoanSection, OptionsSection } from "./report-sections";
import { ReportAppendix } from "./report-appendix";

export function ReportScreen({ report }: { report: DecisionReport }) {
  const { fixtures } = useApp();
  const [withAppendix, setWithAppendix] = React.useState(false);
  const generated = formatTimestamp(report.generated_at);

  return (
    <StageLayout
      {...resultsRail(report, "report")}
      workspaceClassName="print:!p-0"
    >
      <article aria-labelledby="report-title" data-report="" className="mx-auto w-full max-w-[1320px] space-y-16 print:max-w-none print:space-y-5">
        {fixtures && (
          <div className="no-print">
            <FixtureNotice />
          </div>
        )}

        {/* Hero: what this is, and the one action (print). */}
        <header className="grid grid-cols-1 gap-8 border-b border-line pb-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-14 print:block print:pb-3">
          <div className="min-w-0 space-y-4 print:space-y-1">
            <p className="flex flex-wrap items-center gap-x-2 text-[15px] font-semibold text-ink-2 print:text-[8.5pt]">
              <CalendarDays aria-hidden className="size-4 text-ink-3 print:hidden" />
              <span className="hidden print:inline">DecisionTwin · </span>
              Decision report · {generated}
              {fixtures ? " · Fixture data (synthetic reference example)" : ""}
            </p>
            <h1
              id="report-title"
              className="max-w-[22ch] text-balance text-hero font-extrabold leading-[1.05] tracking-[-0.025em] text-ink print:max-w-none print:text-[20pt]"
            >
              {plain(decisionTitle(report))}
            </h1>
            <p className="max-w-[var(--measure)] text-pretty text-lede text-ink-2 print:text-[10pt]">
              What this loan costs, what it changes for you, and what to ask before you sign.
            </p>
          </div>
          <div className="no-print flex flex-col gap-3 sm:items-start lg:items-end">
            <PrimaryAction onClick={() => window.print()} arrow={false} aria-describedby="print-appendix-note">
              <Printer aria-hidden /> Print or save as PDF
            </PrimaryAction>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-semibold text-ink">
              <input
                type="checkbox"
                checked={withAppendix}
                onChange={(e) => setWithAppendix(e.target.checked)}
                className="size-5 shrink-0 cursor-pointer accent-[var(--color-brand)]"
                data-include-appendix=""
              />
              Include the appendix
            </label>
            <p id="print-appendix-note" className="max-w-[20rem] text-sm text-ink-2 lg:text-right">
              {withAppendix ? "Prints the summary, then the appendix on its own pages." : "Prints the summary only, on one or two pages."}
            </p>
          </div>
        </header>

        <LoanSection report={report} />
        <ChangesSection report={report} />
        <ConcernSection report={report} />
        <OptionsSection report={report} />
        <BeforeYouSign report={report} />
        <AboutReport report={report} />

        <p className="print-only text-[8pt] text-ink-2">
          {withAppendix
            ? "Sources for every figure are listed in the appendix."
            : "Sources for every figure are one click away in the app, and in the appendix when it is printed."}
        </p>

        <ReportAppendix report={report} includeInPrint={withAppendix} />

        <footer className="no-print flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/alternatives"
            className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-[15px] font-semibold text-ink-2 transition-colors duration-150 hover:bg-canvas hover:text-ink"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back to options
          </Link>
          <div className="flex flex-col gap-2 sm:items-end">
            <p className="text-sm text-ink-2">Finished? You can remove everything you entered.</p>
            <DeleteDataButton size="md" />
          </div>
        </footer>
      </article>
    </StageLayout>
  );
}
