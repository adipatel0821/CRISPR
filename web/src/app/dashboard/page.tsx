"use client";

import { FixtureNotice } from "@/components/banners";
import { ReportGate } from "@/components/report-gate";
import { decisionTitle } from "@/components/report-parts";
import { Container, PageIntro, PrimaryAction, SecondaryLink } from "@/components/system";
import { DecisionInsights } from "@/components/summary/decision-insights";
import { Commitment } from "@/components/summary/commitment";
import { MonthAndSavings } from "@/components/summary/month-savings";
import { SummaryDetails } from "@/components/summary/details";

/** Decision summary (journey step "Understand"): three answers, the commitment, your month — details on demand. */
export default function DashboardPage() {
  return (
    <ReportGate>
      {(report) => (
        <Container width="reading" className="space-y-12 sm:space-y-14">
          <div className="space-y-6">
            <FixtureNotice />
            <PageIntro
              eyebrow={report.offer?.label ? `Decision summary · ${report.offer.label}` : "Decision summary"}
              title={decisionTitle(report)}
              lede="What this loan changes, what deserves a closer look, and where to go next."
            />
            <DecisionInsights report={report} />
          </div>

          <Commitment report={report} />
          <MonthAndSavings report={report} />
          <SummaryDetails report={report} />

          <div className="no-print space-y-4 border-t border-line pt-8">
            <p className="text-pretty text-[15px] leading-relaxed text-ink-muted">
              Next, we run a few illustrative what-ifs — a lost paycheck, a surprise bill — with and without this loan.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <PrimaryAction href="/stress">Next: see how it holds up</PrimaryAction>
              <SecondaryLink href="/report" arrow={false} className="self-center sm:self-auto">
                Printable report
              </SecondaryLink>
            </div>
          </div>
        </Container>
      )}
    </ReportGate>
  );
}
