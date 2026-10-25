"use client";

import { FixtureNotice } from "@/components/banners";
import { ReportGate } from "@/components/report-gate";
import { ActionRow, StageLayout } from "@/components/shell";
import { PrimaryAction } from "@/components/system";
import { ResultCard } from "@/components/summary/card";
import { resultsRail } from "@/components/summary/results-rail";

/**
 * Decision summary: one result card across the workspace. The top of the card is the result (headline, the
 * money left each month, the before / with-the-loan bars, the savings line, the running-costs caveat) and the
 * blue action; "Show all details" expands the same card in place with everything else. The blue action sits
 * in the card from 1024 px up and docks to the bottom of the screen below that; exactly one is shown.
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
          <div className="w-full space-y-6">
            <FixtureNotice />
            <ResultCard report={report} />
          </div>
        </StageLayout>
      )}
    </ReportGate>
  );
}
