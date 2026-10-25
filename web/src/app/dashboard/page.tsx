"use client";

import { FixtureNotice } from "@/components/banners";
import { ReportGate } from "@/components/report-gate";
import { StageLayout } from "@/components/shell";
import { FullBreakdown } from "@/components/summary/details";
import { SecondaryColumns, SummaryHero } from "@/components/summary/hero";
import { resultsRail } from "@/components/summary/results-rail";

/**
 * Decision summary. Eye path: the money left each month (big figure) first, the before/after comparison
 * second, the savings line and the main concern third. Everything else sits behind "See the full breakdown".
 */
export default function DashboardPage() {
  return (
    <ReportGate>
      {(report) => (
        <StageLayout {...resultsRail(report, "summary")}>
          <div className="mx-auto w-full max-w-[1240px] space-y-14 sm:space-y-16">
            <FixtureNotice />
            <SummaryHero report={report} />
            <SecondaryColumns report={report} />
            <FullBreakdown report={report} />
          </div>
        </StageLayout>
      )}
    </ReportGate>
  );
}
