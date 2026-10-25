"use client";

import Link from "next/link";
import { ArrowRight, CircleAlert, Compass, PiggyBank, Receipt, TriangleAlert } from "lucide-react";
import type { DecisionReport } from "@/lib/contracts";
import { plain } from "@/lib/copy";
import { displayNumber, formatMoney } from "@/lib/format";
import { comparable, decisionSummary, runningCostsMissing, RUNNING_COSTS_HREF, type SummaryPiece } from "@/lib/insights";
import { claimsAbout, evidenceForMetric, evidenceMap, isAvailable, metric, withOfferMetric } from "@/lib/report";
import type { ExplanationEvidence } from "@/lib/contracts";
import { AssumptionChip } from "@/components/assumption-chip";
import { UnavailableSection } from "@/components/report-gate";
import { Note, PrimaryAction, SourceLink } from "@/components/system";
import { BeforeAfterBars, BigFigure, CaveatChip, FromTo, IconBadge } from "@/components/visual";
import { pieceFigure, pieceLink, resolvePiece } from "./select";

export function uniqueEvidence(list: ExplanationEvidence[]): ExplanationEvidence[] {
  const seen = new Set<string>();
  return list.filter((e) => (seen.has(e.evidence_id) ? false : (seen.add(e.evidence_id), true)));
}

function metricEvidence(report: DecisionReport, keys: string[]): ExplanationEvidence[] {
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

/* ------------------------------------------------------------------------------------------------ */
/* The hero: one big figure, the before/after comparison, the savings line, the next step.          */
/* ------------------------------------------------------------------------------------------------ */

function SavingsLine({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "reserve_impact")) return null;
  const { before, after } = savingsChange(report);
  if (comparable(after) === null) return null;
  const evidence = metricEvidence(report, ["savings_after_purchase", "reserve_months_after"]);
  return (
    <div data-savings-line="" className="flex min-w-0 items-start gap-4">
      <IconBadge icon={PiggyBank} tone="savings" size="lg" />
      <div className="min-w-0 space-y-1">
        <p className="text-pretty text-[19px] font-bold leading-snug text-ink sm:text-xl">
          Your savings would drop to <span className="figure whitespace-nowrap">{formatMoney(after)}</span> after the down payment.
        </p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-ink-2">
          {comparable(before) !== null && (
            <span>
              Savings <FromTo from={formatMoney(before)} to={formatMoney(after)} className="font-semibold text-ink" />
            </span>
          )}
          <SourceLink evidence={evidence} label="Savings after the down payment" variant="quiet" />
          <AssumptionChip report={report} metricKey="savings_after_purchase" label="savings after the down payment" />
        </p>
      </div>
    </div>
  );
}

function MonthHero({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "cashflow_impact")) return <UnavailableSection report={report} analysisId="cashflow_impact" />;
  const before = metric(report, "monthly_left_before");
  const after = withOfferMetric(report, "monthly_left_after");
  const basis = after?.label ?? before?.label ?? null;
  const afterN = displayNumber(after?.value);
  const beforeN = displayNumber(before?.value);
  const negative = afterN !== null && afterN < 0;
  const missingRunning = runningCostsMissing(report);
  const evidence = metricEvidence(report, ["monthly_left_before", "monthly_left_after"]);

  return (
    <div className="grid items-center gap-10 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] xl:gap-14">
      <BigFigure
        id="month"
        label="Left each month with this loan"
        value={formatMoney(after?.value)}
        tone={negative ? "shortfall" : "brand"}
        caption={
          <>
            {basis ? `${sentence(basis)}. ` : ""}
            {comparable(before?.value) !== null && (
              <>
                Right now it&apos;s <span className="figure font-semibold text-ink">{formatMoney(before?.value)}</span>.
              </>
            )}
          </>
        }
        source={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <SourceLink evidence={evidence} label="Left each month" />
            <AssumptionChip report={report} metricKey="monthly_left_after" label="left each month with this loan" />
          </span>
        }
      />
      <div className="min-w-0 rounded-[1.75rem] bg-canvas p-6 sm:p-8">
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

/** "Here's how this loan changes your month." The moment of the results. */
export function SummaryHero({ report }: { report: DecisionReport }) {
  return (
    <section aria-labelledby="summary-title" data-summary-hero="">
      <p className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3.5 py-1.5 text-sm font-bold text-brand-strong">
        <Compass aria-hidden className="size-4" />
        Your decision summary
      </p>
      <h1 id="summary-title" className="mt-5 max-w-[22ch] text-balance text-hero font-extrabold leading-[1.05] tracking-[-0.025em] text-ink">
        Here&rsquo;s how this loan changes your month.
      </h1>
      <div className="mt-10 sm:mt-12">
        <MonthHero report={report} />
      </div>
      <div className="mt-10 flex flex-col gap-8 border-t border-line pt-8 lg:flex-row lg:items-center lg:justify-between">
        <SavingsLine report={report} />
        <div className="no-print shrink-0">
          <PrimaryAction href="/stress">See the stress test</PrimaryAction>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Two short secondary columns: what the loan costs, what to look at next.                          */
/* ------------------------------------------------------------------------------------------------ */

function CostRow({
  label,
  value,
  caption,
  report,
  keys,
}: {
  label: string;
  value: string;
  caption: React.ReactNode;
  report: DecisionReport;
  keys: string[];
}) {
  return (
    <div className="grid gap-x-6 gap-y-1 py-5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
      <dt className="text-[15px] font-semibold text-ink-2">{label}</dt>
      <dd className="figure text-[28px] font-extrabold leading-none tracking-[-0.02em] text-ink sm:row-span-2 sm:text-right sm:text-[32px]">
        {value}
      </dd>
      <dd className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] leading-relaxed text-ink-2">
        <span>{caption}</span>
        <SourceLink evidence={metricEvidence(report, keys)} label={label} variant="quiet" />
      </dd>
    </div>
  );
}

function LoanCost({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "loan_cost")) return <UnavailableSection report={report} analysisId="loan_cost" />;
  const v = (k: string) => withOfferMetric(report, k)?.value ?? null;
  const term = report.offer?.terms.term_months?.value ?? null;
  const cashDown = report.offer?.terms.cash_down?.value ?? null;
  const pfc = report.offer?.terms.prepaid_finance_charges?.value ?? null;
  const interest = v("interest");
  const aprWarn = withOfferMetric(report, "apr_recomputed")?.check === "warn";
  return (
    <div className="space-y-5">
      <dl className="divide-y divide-line">
        <CostRow
          report={report}
          keys={["monthly_payment", "total_of_payments"]}
          label="Monthly payment"
          value={formatMoney(v("monthly_payment"))}
          caption={
            <>
              {term ? `${term} payments, ` : ""}
              <span className="figure font-semibold text-ink">{formatMoney(v("total_of_payments"))}</span> in all
            </>
          }
        />
        <CostRow
          report={report}
          keys={["total_paid_through_deal"]}
          label="Total through the deal"
          value={formatMoney(v("total_paid_through_deal"))}
          caption={
            cashDown ? (
              <>
                Every payment plus your <span className="figure font-semibold text-ink">{formatMoney(cashDown)}</span> down
              </>
            ) : (
              "Every payment plus the cash you put down"
            )
          }
        />
        <CostRow
          report={report}
          keys={["finance_charge", "interest"]}
          label="Finance charge"
          value={formatMoney(v("finance_charge"))}
          caption={
            interest && pfc ? (
              <>
                Interest <span className="figure font-semibold text-ink">{formatMoney(interest)}</span> plus fees{" "}
                <span className="figure font-semibold text-ink">{formatMoney(pfc)}</span>
              </>
            ) : (
              "Interest plus fees: the cost of borrowing"
            )
          }
        />
      </dl>
      {aprWarn && (
        <Note tone="attention">The APR worked out from the payments differs from the disclosed APR. Ask the lender. Details are in the full breakdown.</Note>
      )}
    </div>
  );
}

function pieceEvidence(report: DecisionReport, piece: SummaryPiece): ExplanationEvidence[] {
  const map = evidenceMap(report);
  const own = piece.evidenceIds.map((id) => map.get(id)).filter((e): e is ExplanationEvidence => !!e);
  if (own.length) return own;
  if (piece.kind === "cashflow_change") return evidenceForMetric(report, "monthly_left_after");
  if (piece.kind === "savings_change") return evidenceForMetric(report, "savings_after_purchase");
  if (piece.kind === "running_costs_missing") return evidenceForMetric(report, "incremental_vehicle_costs");
  return [];
}

function LookNextItem({ report, piece, concern, heading }: { report: DecisionReport; piece: SummaryPiece; concern: SummaryPiece | null; heading: string }) {
  const fig = pieceFigure(report, piece, concern);
  const link = pieceLink(piece);
  const evidence = pieceEvidence(report, piece);
  const Icon = piece.tone === "gap" ? CircleAlert : piece.tone === "attention" ? TriangleAlert : Compass;
  return (
    <li className="space-y-2 py-5 first:pt-0 last:pb-0">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink-2">
        <Icon aria-hidden className={piece.tone === "gap" ? "size-4 text-shortfall-ink" : piece.tone === "attention" ? "size-4 text-caution" : "size-4 text-brand"} />
        {heading}
      </h3>
      {fig && (
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className={`figure text-[28px] font-extrabold leading-none tracking-[-0.02em] sm:text-[32px] ${piece.tone === "gap" ? "text-shortfall-ink" : "text-ink"}`}>
            {fig.value}
          </span>
          <span className="text-[15px] text-ink-2">{fig.caption}</span>
        </p>
      )}
      <p className="max-w-[var(--measure)] text-pretty text-[17px] leading-relaxed text-ink">{plain(piece.text)}</p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {link && (
          <Link href={link.href} className="dt-link inline-flex items-center gap-1 text-[15px] font-semibold">
            {link.label}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
        {evidence.length > 0 && <SourceLink evidence={evidence} label={heading} variant="quiet" />}
      </p>
    </li>
  );
}

function LookNext({ report }: { report: DecisionReport }) {
  const raw = decisionSummary(report);
  const concern = resolvePiece(report, raw.concern);
  const next = resolvePiece(report, raw.next);
  // The running-costs gap already sits beside the big figure; don't repeat it here.
  const items: { piece: SummaryPiece; heading: string }[] = [];
  if (concern && concern.kind !== "running_costs_missing") items.push({ piece: concern, heading: "The main concern" });
  if (next && next.kind !== "running_costs_missing") items.push({ piece: next, heading: "Worth exploring" });
  if (items.length === 0) {
    return <p className="text-[17px] leading-relaxed text-ink-2">None of the checks we run were triggered for this offer. The stress test shows how it holds up when money gets tight.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((it) => (
        <LookNextItem key={it.heading} report={report} piece={it.piece} concern={concern} heading={it.heading} />
      ))}
    </ul>
  );
}

export function SecondaryColumns({ report }: { report: DecisionReport }) {
  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
      <section aria-labelledby="cost-title" className="min-w-0">
        <div className="mb-6 flex items-center gap-3">
          <IconBadge icon={Receipt} tone="brand" />
          <h2 id="cost-title" className="text-title font-extrabold tracking-[-0.015em] text-ink">
            What the loan costs
          </h2>
        </div>
        <LoanCost report={report} />
      </section>
      <section aria-labelledby="next-title" className="min-w-0">
        <div className="mb-6 flex items-center gap-3">
          <IconBadge icon={Compass} tone="caution" />
          <h2 id="next-title" className="text-title font-extrabold tracking-[-0.015em] text-ink">
            What to look at next
          </h2>
        </div>
        <LookNext report={report} />
      </section>
    </div>
  );
}
