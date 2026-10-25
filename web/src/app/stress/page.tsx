"use client";

import { FixtureNotice } from "@/components/banners";
import { ReportGate } from "@/components/report-gate";
import { ActionRow, StageLayout } from "@/components/shell";
import { PrimaryAction } from "@/components/system";
import { StressView } from "@/components/stress/stress-view";
import { resultsRail } from "@/components/summary/results-rail";

/**
 * Stress test. The most consequential what-if first (largest shortfall with the loan), one savings chart,
 * tiles to switch what-ifs; assumptions and the monthly table on demand. Illustrative, not a prediction.
 */
export default function StressPage() {
  return (
    <ReportGate>
      {(report) => (
        <StageLayout
          {...resultsRail(report, "stress")}
          actions={
            <ActionRow back={{ href: "/dashboard", label: "Summary" }}>
              <PrimaryAction href="/alternatives">Compare your options</PrimaryAction>
            </ActionRow>
          }
        >
          <div className="mx-auto w-full max-w-[1240px] space-y-8">
            <FixtureNotice />
            <StressView report={report} />
          </div>
        </StageLayout>
      )}
    </ReportGate>
  );
}
