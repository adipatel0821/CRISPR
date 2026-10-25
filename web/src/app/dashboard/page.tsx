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
 * yellow action (the shared PrimaryAction pill, as on every screen); "Show all details" expands the same card in
 * place with everything else. The yellow action sits in the card from 1280 px up and docks to the bottom of the screen below that (also from 1024 to 1279 px,
 * where the stacked result pushes the card's own action below the first screen); exactly one is shown.
 */
export default function DashboardPage() {
  return (
    <ReportGate>
      {(report) => (
        <StageLayout
          {...resultsRail(report, "summary")}
          actions={
            <ActionRow className="lg:sticky lg:bg-surface/95 lg:py-3 lg:!shadow-dock xl:hidden">
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
