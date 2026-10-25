"use client";

import type { DecisionReport } from "@/lib/contracts";
import { formatMoney, formatMonths, formatSignedMoney } from "@/lib/format";
import { comparable, runningCostsMissing, RUNNING_COSTS_HREF } from "@/lib/insights";
import { claimsAbout, evidenceForMetric, isAvailable, metric, withOfferMetric } from "@/lib/report";
import { KeyFigure, Section, SecondaryLink } from "@/components/system";
import { ProvenanceChip } from "@/components/provenance-chip";
import { AssumptionChip } from "@/components/assumption-chip";
import { UnavailableSection } from "@/components/report-gate";
import { uniqueEvidence } from "./decision-insights";

function sentence(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="print-card min-w-0 rounded-card bg-canvas p-5 sm:p-6">{children}</div>;
}

function YourMonth({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "cashflow_impact")) return <UnavailableSection report={report} analysisId="cashflow_impact" />;
  const before = metric(report, "monthly_left_before");
  const after = withOfferMetric(report, "monthly_left_after");
  const inc = withOfferMetric(report, "incremental_vehicle_costs");
  const basis = before?.label ?? after?.label ?? null;
  const missingRunning = runningCostsMissing(report);
  const evidence = uniqueEvidence([
    ...evidenceForMetric(report, "monthly_left_before"),
    ...evidenceForMetric(report, "monthly_left_after"),
  ]);
  return (
    <Panel>
      <KeyFigure
        label="Left over each month"
        before={formatMoney(before?.value)}
        after={formatMoney(after?.value)}
        caption={
          <>
            {basis ? `${sentence(basis)}. ` : ""}Now, then with this loan.
          </>
        }
        source={
          <>
            <ProvenanceChip evidence={evidence} label="left over each month" />
            <AssumptionChip report={report} metricKey="monthly_left_before" label="left over each month now" />
            <AssumptionChip report={report} metricKey="monthly_left_after" label="left over each month with this loan" />
          </>
        }
      />
      <div className="mt-4 border-t border-line pt-4 text-[13px] leading-relaxed text-ink-muted">
        {missingRunning ? (
          <div className="space-y-1.5">
            <p>
              New-car running costs aren&apos;t included, so this isn&apos;t the full picture.{" "}
              <AssumptionChip report={report} metricKey="incremental_vehicle_costs" label="new-car running costs" className="align-middle" />
            </p>
            <SecondaryLink href={RUNNING_COSTS_HREF}>Add running costs</SecondaryLink>
          </div>
        ) : comparable(inc?.value) !== null ? (
          <p>
            Includes <span className="figure font-medium text-ink">{formatSignedMoney(inc?.value)}</span> a month in car running
            costs{inc?.label ? ` (${inc.label})` : ""}.{" "}
            <span className="inline-flex flex-wrap gap-1.5 align-middle">
              <ProvenanceChip evidence={evidenceForMetric(report, "incremental_vehicle_costs")} label="change in car running costs" />
              <AssumptionChip report={report} metricKey="incremental_vehicle_costs" label="change in car running costs" />
            </span>
          </p>
        ) : (
          <p>Car running costs: not known.</p>
        )}
      </div>
    </Panel>
  );
}

function YourSavings({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "reserve_impact")) return <UnavailableSection report={report} analysisId="reserve_impact" />;
  const change = claimsAbout(report, "savings_after_purchase").find((c) => c.type === "change");
  const before = typeof change?.values?.before === "string" ? (change.values.before as string) : null;
  const after = withOfferMetric(report, "savings_after_purchase")?.value ?? null;
  const rBefore = metric(report, "reserve_months_before")?.value ?? null;
  const rAfter = withOfferMetric(report, "reserve_months_after")?.value ?? null;
  const evidence = uniqueEvidence([
    ...evidenceForMetric(report, "savings_after_purchase"),
    ...evidenceForMetric(report, "reserve_months_before"),
    ...evidenceForMetric(report, "reserve_months_after"),
  ]);
  return (
    <Panel>
      {before ? (
        <KeyFigure label="Your savings" before={formatMoney(before)} after={formatMoney(after)} caption="Now, then after the down payment." source={null} />
      ) : (
        <KeyFigure label="Your savings after the purchase" value={formatMoney(after)} />
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ProvenanceChip evidence={evidence} label="savings" />
        <AssumptionChip report={report} metricKey="savings_after_purchase" label="savings after purchase" />
        <AssumptionChip report={report} metricKey="reserve_months_after" label="months covered with this loan" />
      </div>
      {(comparable(rBefore) !== null || comparable(rAfter) !== null) && (
        <p className="mt-4 border-t border-line pt-4 text-[13px] leading-relaxed text-ink-muted">
          Covers <span className="figure font-medium text-ink">{formatMonths(rBefore)}</span> of expenses now, and{" "}
          <span className="figure font-medium text-ink">{formatMonths(rAfter)}</span> with this loan.
        </p>
      )}
    </Panel>
  );
}

/** "Your month" and "Your savings": two calm before → after lines. */
export function MonthAndSavings({ report }: { report: DecisionReport }) {
  return (
    <Section id="month" title="Your month and savings" description="Before this loan, and with it.">
      <div className="grid gap-3 sm:grid-cols-2">
        <YourMonth report={report} />
        <YourSavings report={report} />
      </div>
    </Section>
  );
}
