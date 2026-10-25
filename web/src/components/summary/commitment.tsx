"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { DecisionReport } from "@/lib/contracts";
import { formatMoney, formatRate, formatRatioPercent } from "@/lib/format";
import { evidenceForMetric, isAvailable, withOfferMetric } from "@/lib/report";
import { Disclosure, KeyFigure, Section } from "@/components/system";
import { ProvenanceChip } from "@/components/provenance-chip";
import { AssumptionChip } from "@/components/assumption-chip";
import { BreakdownBar } from "@/components/charts";
import { UnavailableSection } from "@/components/report-gate";
import { uniqueEvidence } from "./decision-insights";

function Sources({ report, keys, label }: { report: DecisionReport; keys: string[]; label: string }) {
  const evidence = uniqueEvidence(keys.flatMap((k) => evidenceForMetric(report, k)));
  return (
    <>
      <ProvenanceChip evidence={evidence} label={label} />
      {keys.map((k) => (
        <AssumptionChip key={k} report={report} metricKey={k} label={label} />
      ))}
    </>
  );
}

function AprCheck({ report }: { report: DecisionReport }) {
  const m = withOfferMetric(report, "apr_recomputed");
  if (!m) return null;
  const disclosed = m.disclosed ?? report.offer?.terms.apr?.value ?? null;
  const pass = m.check === "pass";
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <p className="flex items-start gap-2 text-ink">
        {pass ? (
          <CheckCircle2 aria-hidden className="mt-1 size-4 shrink-0 text-accent" />
        ) : (
          <AlertTriangle aria-hidden className="mt-1 size-4 shrink-0 text-info" />
        )}
        <span>
          <span className="font-medium">APR check: </span>
          disclosed <span className="figure font-medium">{formatRate(disclosed)}</span>, recomputed from the amount financed
          and the payments <span className="figure font-medium">{formatRate(m.value)}</span> —{" "}
          {pass ? "they agree." : m.check === "warn" ? "they differ by more than 1/8 of a point. Ask the lender." : "not checked."}
        </span>
      </p>
      <span className="shrink-0 pl-6 sm:pl-0">
        <ProvenanceChip evidence={evidenceForMetric(report, "apr_recomputed")} label="APR recomputed" />
      </span>
    </div>
  );
}

/** "See the full cost breakdown": where the total goes, finance charge vs interest, APR check. */
function CostBreakdown({ report }: { report: DecisionReport }) {
  const total = withOfferMetric(report, "total_paid_through_deal");
  const interest = withOfferMetric(report, "interest")?.value ?? null;
  const pfc = report.offer?.terms.prepaid_finance_charges?.value ?? null;
  const share = withOfferMetric(report, "payment_to_take_home")?.value ?? null;
  return (
    <div className="space-y-6 pt-2 text-ink-muted">
      {total?.breakdown && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Where the {formatMoney(total.value)} goes</h3>
          <BreakdownBar breakdown={total.breakdown} total={total.value} />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-ink">Finance charge vs interest</h3>
        <p>
          The finance charge is everything borrowing costs you: interest
          {interest && (
            <>
              {" "}
              <span className="figure font-medium text-ink">{formatMoney(interest)}</span>
            </>
          )}
          {pfc && (
            <>
              {" "}plus prepaid finance charges (loan fees) of <span className="figure font-medium text-ink">{formatMoney(pfc)}</span>
            </>
          )}
          . Interest is only the part charged on the balance over time.{" "}
          <ProvenanceChip evidence={evidenceForMetric(report, "interest")} label="interest" className="align-middle" />
        </p>
      </div>
      {share && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-ink">Payment as a share of take-home</h3>
          <p>
            The monthly payment is <span className="figure font-medium text-ink">{formatRatioPercent(share, 1)}</span> of
            your take-home pay.{" "}
            <ProvenanceChip evidence={evidenceForMetric(report, "payment_to_take_home")} label="payment as a share of take-home" className="align-middle" />
          </p>
        </div>
      )}
      <AprCheck report={report} />
    </div>
  );
}

/** "The commitment": monthly payment, total through the deal, finance charge — max three figures. */
export function Commitment({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "loan_cost")) {
    return (
      <Section id="commitment" title="The commitment">
        <UnavailableSection report={report} analysisId="loan_cost" />
      </Section>
    );
  }
  const v = (k: string) => withOfferMetric(report, k)?.value ?? null;
  const term = report.offer?.terms.term_months?.value ?? null;
  const cashDown = report.offer?.terms.cash_down?.value ?? null;
  const pfc = report.offer?.terms.prepaid_finance_charges?.value ?? null;
  const top = v("total_of_payments");
  const interest = v("interest");
  const aprWarn = withOfferMetric(report, "apr_recomputed")?.check === "warn";

  return (
    <Section id="commitment" title="The commitment" description="What the loan costs and what it asks of you, recalculated from the loan terms.">
      <div className="print-card rounded-card border border-line bg-surface">
        <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <KeyFigure
            className="p-5 sm:p-6"
            label="Monthly payment"
            value={formatMoney(v("monthly_payment"))}
            caption={
              term ? (
                <>
                  {term} payments · <span className="figure">{formatMoney(top)}</span> in all
                </>
              ) : (
                <>
                  <span className="figure">{formatMoney(top)}</span> in payments overall
                </>
              )
            }
            source={<Sources report={report} keys={["monthly_payment", "total_of_payments"]} label="Monthly payment" />}
          />
          <KeyFigure
            className="p-5 sm:p-6"
            label="Total through the deal"
            value={formatMoney(v("total_paid_through_deal"))}
            caption={
              cashDown ? (
                <>
                  Every payment plus your <span className="figure">{formatMoney(cashDown)}</span> down
                </>
              ) : (
                "Every payment plus the cash you put down"
              )
            }
            source={<Sources report={report} keys={["total_paid_through_deal"]} label="Total paid through this deal" />}
          />
          <KeyFigure
            className="p-5 sm:p-6"
            label="Finance charge"
            value={formatMoney(v("finance_charge"))}
            caption={
              interest && pfc ? (
                <>
                  Interest <span className="figure">{formatMoney(interest)}</span> + fees{" "}
                  <span className="figure">{formatMoney(pfc)}</span>: the cost of borrowing
                </>
              ) : (
                "Interest + fees: the cost of borrowing"
              )
            }
            source={<Sources report={report} keys={["finance_charge"]} label="Finance charge" />}
          />
        </div>
        {aprWarn && (
          <p className="flex items-start gap-2 border-t border-line px-5 py-3 text-sm text-info sm:px-6">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            The APR recomputed from the payments differs from the disclosed APR. Ask the lender — details below.
          </p>
        )}
        <div className="border-t border-line px-5 sm:px-6">
          <Disclosure summary="See the full cost breakdown" printOpen className="py-1.5" contentClassName="pb-5">
            <CostBreakdown report={report} />
          </Disclosure>
        </div>
      </div>
    </Section>
  );
}
