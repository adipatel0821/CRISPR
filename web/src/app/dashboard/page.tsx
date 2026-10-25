"use client";

import { FixtureNotice } from "@/components/banners";
import { ReportGate } from "@/components/report-gate";
import { ActionRow, StageLayout } from "@/components/shell";
import { PrimaryAction } from "@/components/system";
import { FullBreakdown } from "@/components/summary/details";
import { SecondaryColumns, SummaryHero } from "@/components/summary/hero";
import { resultsRail } from "@/components/summary/results-rail";

/**
 * Decision summary. Eye path: the money left each month (big figure) first, the before/after comparison
 * second, the savings line and the main concern third. Everything else sits behind "See the full breakdown".
 * The yellow action sits beside the savings line from 1024 px up and docks to the bottom of the screen below
 * that; exactly one of the two is rendered (display) at any width.
 */
export default function DashboardPage() {
  return (
    <ReportGate>
      {(report) => (
        <StageLayout
          {...resultsRail(report, "summary")}
          actions={
            <ActionRow className="lg:hidden">
              <PrimaryAction href="/stress">See the stress test</PrimaryAction>
            </ActionRow>
          }
        >
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
