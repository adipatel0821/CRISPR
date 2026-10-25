"use client";

import { Printer } from "lucide-react";
import type { DecisionReport } from "@/lib/contracts";
import { formatTimestamp } from "@/lib/format";
import { useApp } from "@/lib/app-context";
import { FixtureNotice } from "@/components/banners";
import { DeleteDataButton } from "@/components/delete-data";
import { ReportGate } from "@/components/report-gate";
import { decisionTitle } from "@/components/report-parts";
import { Container, PrimaryAction } from "@/components/system";
import {
  AboutReport,
  ExecutiveSummary,
  FinancialImpact,
  NextActions,
  PrincipalConcerns,
  RelevantAlternatives,
} from "@/components/report/report-sections";
import { ReportAppendix } from "@/components/report/report-appendix";

function Report({ report }: { report: DecisionReport }) {
  const { fixtures } = useApp();
  return (
    <Container width="reading" className="max-w-[48rem]">
      <article className="space-y-12 print:space-y-8" aria-labelledby="report-title">
        <div className="no-print space-y-4">
          <FixtureNotice />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <PrimaryAction onClick={() => window.print()} arrow={false} size="md">
              <Printer aria-hidden /> Print / Save as PDF
            </PrimaryAction>
            <DeleteDataButton size="md" />
          </div>
        </div>

        <header className="space-y-3 border-b border-line pb-8">
          <p className="text-[13px] font-medium text-ink-subtle">
            Decision report · {formatTimestamp(report.generated_at)}
            {fixtures ? " · Fixture data (synthetic reference example)" : ""}
          </p>
          <h1 id="report-title" className="text-balance text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-display">
            {decisionTitle(report)}
          </h1>
          <p className="max-w-[40rem] text-pretty text-lede text-ink-muted">
            What this loan costs, what it does to your month and your savings, what to watch, and what to ask before you sign.
          </p>
        </header>

        <ExecutiveSummary report={report} />
        <FinancialImpact report={report} />
        <PrincipalConcerns report={report} />
        <RelevantAlternatives report={report} />
        <NextActions report={report} />
        <AboutReport report={report} />
        <ReportAppendix report={report} />
      </article>
    </Container>
  );
}

export default function ReportPage() {
  return <ReportGate>{(report) => <Report report={report} />}</ReportGate>;
}
