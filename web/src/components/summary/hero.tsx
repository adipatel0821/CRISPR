"use client";

import Link from "next/link";
import { Gauge, PiggyBank, TriangleAlert } from "lucide-react";
import type { DecisionReport, ExplanationEvidence } from "@/lib/contracts";
import { plain } from "@/lib/copy";
import { displayNumber, formatMoney } from "@/lib/format";
import { comparable, runningCostsMissing, RUNNING_COSTS_HREF } from "@/lib/insights";
import { claimsAbout, evidenceForMetric, isAvailable, metric, withOfferMetric } from "@/lib/report";
import { cn } from "@/lib/utils";
import { AssumptionChip } from "@/components/assumption-chip";
import { UnavailableSection } from "@/components/report-gate";
import { Note, PrimaryAction, SourceLink } from "@/components/system";
import { BeforeAfterBars, BigFigure, CaveatChip, IconBadge } from "@/components/visual";
import { figureFit } from "./select";

export function uniqueEvidence(list: ExplanationEvidence[]): ExplanationEvidence[] {
  const seen = new Set<string>();
  return list.filter((e) => (seen.has(e.evidence_id) ? false : (seen.add(e.evidence_id), true)));
}

export function metricEvidence(report: DecisionReport, keys: string[]): ExplanationEvidence[] {
  return uniqueEvidence(keys.flatMap((k) => evidenceForMetric(report, k)));
}

function sentence(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Savings before and after the down payment, from the backend's change claim and metric (no arithmetic). */
export function savingsChange(report: DecisionReport): { before: string | null; after: string | null } {
  const change = claimsAbout(report, "savings_after_purchase").find((c) => c.type === "change");
  const before = typeof change?.values?.before === "string" ? (change.values.before as string) : null;
  const after = withOfferMetric(report, "savings_after_purchase")?.value ?? null;
  return { before, after };
}

function Fig({ children }: { children: React.ReactNode }) {
  return <span className="figure whitespace-nowrap">{children}</span>;
}

/* ------------------------------------------------------------------------------------------------ */
/* The top of the result card: always visible.                                                       */
/* ------------------------------------------------------------------------------------------------ */

function hasSavingsLine(report: DecisionReport): boolean {
  return isAvailable(report, "reserve_impact") && comparable(savingsChange(report).after) !== null;
}

/** One short line: savings before and after the down payment (both backend values, compared only). */
function SavingsLine({ report }: { report: DecisionReport }) {
  if (!hasSavingsLine(report)) return null;
  const { before, after } = savingsChange(report);
  const a = comparable(after);
  const b = comparable(before);
  const evidence = metricEvidence(report, ["savings_after_purchase", "reserve_months_after"]);
  return (
    <div data-savings-line="" className="flex min-w-0 items-start gap-4">
      <IconBadge icon={PiggyBank} tone="neutral" />
      <div className="min-w-0 space-y-1 pt-0.5">
        <p className="text-pretty text-[18px] font-bold leading-snug text-ink sm:text-[19px]">
          {b === null ? (
            <>
              Your savings would be <Fig>{formatMoney(after)}</Fig> after the down payment.
            </>
          ) : b === a ? (
            <>
              Your savings would stay at <Fig>{formatMoney(after)}</Fig> after the down payment.
            </>
          ) : (
            <>
              Your savings would go from <Fig>{formatMoney(before)}</Fig> to <Fig>{formatMoney(after)}</Fig> after the down payment.
            </>
          )}
        </p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <SourceLink evidence={evidence} label="Savings after the down payment" variant="quiet" />
          <AssumptionChip report={report} metricKey="savings_after_purchase" label="savings after the down payment" />
        </p>
      </div>
    </div>
  );
}

/** The big figure (money left each month with the loan) and the before / with-the-loan bars on one scale. */
function MonthResult({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "cashflow_impact")) return <UnavailableSection report={report} analysisId="cashflow_impact" />;
  const before = metric(report, "monthly_left_before");
  const after = withOfferMetric(report, "monthly_left_after");
  // A backend label ("before discretionary spending"), so it goes through the copy cleaner like all backend text.
  const basis = plain(after?.label ?? before?.label ?? null) || null;
  const afterN = displayNumber(after?.value);
  const beforeN = displayNumber(before?.value);
  const beforeKnown = comparable(before?.value) !== null;
  const negative = afterN !== null && afterN < 0;
  const missingRunning = runningCostsMissing(report);
  const evidence = metricEvidence(report, ["monthly_left_before", "monthly_left_after"]);
  const figure = formatMoney(after?.value);

  return (
    <div className="grid gap-x-12 gap-y-9 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start 2xl:gap-x-16">
      {/* The figure keeps its usual size but never outgrows its column: a four-digit amount stays on one line. */}
      <div
        className="@container min-w-0 [&_p.figure]:text-[length:min(var(--text-result),var(--figure-fit))]"
        style={{ "--figure-fit": figureFit(figure) } as React.CSSProperties}
      >
        <BigFigure
          id="month"
          label="Left each month with this loan"
          value={figure}
          tone={negative ? "shortfall" : "brand"}
          className="scroll-mt-28"
          caption={
            <>
              {beforeKnown && (
                <>
                  From <span className="figure font-semibold text-ink">{formatMoney(before?.value)}</span> before the loan.{" "}
                </>
              )}
              {basis ? (beforeKnown ? `Both figures are ${basis}.` : `${sentence(basis)}.`) : null}
            </>
          }
          source={
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <SourceLink evidence={evidence} label="Left each month" />
              <AssumptionChip report={report} metricKey="monthly_left_after" label="left each month with this loan" />
            </span>
          }
        />
      </div>
      <div className="min-w-0 xl:border-l xl:border-line xl:pl-12 2xl:pl-16">
        {afterN !== null && beforeN !== null ? (
          <BeforeAfterBars
            title="Left each month, before and with the loan"
            before={{ label: "Now, before the loan", value: beforeN, display: formatMoney(before?.value) }}
            after={{ label: "With this loan", value: afterN, display: formatMoney(after?.value) }}
            caveat={
              missingRunning ? (
                <CaveatChip icon={TriangleAlert}>
                  <span data-running-costs-note="">
                    New-car running costs (insurance, fuel, maintenance) aren&apos;t included.{" "}
                    <Link href={RUNNING_COSTS_HREF} className="dt-link whitespace-nowrap font-bold">
                      Add them
                    </Link>{" "}
                    <AssumptionChip report={report} metricKey="incremental_vehicle_costs" label="new-car running costs" className="align-middle" />
                  </span>
                </CaveatChip>
              ) : null
            }
          />
        ) : (
          <p className="text-ink-2">The comparison needs both figures, and one of them isn&apos;t known yet.</p>
        )}
      </div>
      {negative && (
        <Note tone="gap" className="xl:col-span-2">
          With this loan, your listed expenses and the payment would be more than your take-home pay.
        </Note>
      )}
    </div>
  );
}

/**
 * The result, always visible at the top of the card: a short headline, the big figure, the bars, the savings
 * line and the one primary action (from 1280 px up, where it fits on the first screen; below that it docks to
 * the bottom of the screen).
 */
export function CardTop({ report }: { report: DecisionReport }) {
  return (
    <div data-summary-hero="" className="px-5 pb-7 pt-6 sm:px-8 sm:pb-8 sm:pt-8 xl:px-10 xl:pt-10">
      <p className="flex items-center gap-2 text-[15px] font-bold text-ink-2">
        <Gauge aria-hidden className="size-[18px] shrink-0" />
        Your decision summary
      </p>
      <h1
        id="summary-title"
        className="mt-3 max-w-[24ch] text-balance text-[length:clamp(1.875rem,3vw,2.75rem)] font-extrabold leading-[1.08] tracking-[-0.025em] text-ink"
      >
        Here&rsquo;s how this loan changes your month.
      </h1>
      <div className="mt-8 sm:mt-10">
        <MonthResult report={report} />
      </div>
      {/* Without a savings line, this row only carries the action, which docks to the bottom below 1280 px. */}
      <div
        className={cn(
          "mt-8 flex flex-col gap-6 border-t border-line pt-7 xl:flex-row xl:items-center xl:justify-between xl:gap-10",
          !hasSavingsLine(report) && "hidden xl:flex",
        )}
      >
        <SavingsLine report={report} />
        <div className="no-print hidden shrink-0 xl:ml-auto xl:block">
          <PrimaryAction href="/stress">See the stress test</PrimaryAction>
        </div>
      </div>
    </div>
  );
}
