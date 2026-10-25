"use client";

import Link from "next/link";
import { CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import type { DecisionReport } from "@/lib/contracts";
import { formatMoney, formatMonths, formatRate, formatRatioPercent, formatSignedMoney } from "@/lib/format";
import { claimsAbout, evidenceForMetric, isAvailable, metric, withOfferMetric } from "@/lib/report";
import { evidenceChip } from "@/lib/provenance";
import { ResultsTabs } from "@/components/site-header";
import { FixtureNotice } from "@/components/banners";
import { BreakdownBar } from "@/components/charts";
import { BeforeAfter, Figure } from "@/components/figure";
import { Chip, ProvenanceChip } from "@/components/provenance-chip";
import { ReportGate, UnavailableSection } from "@/components/report-gate";
import {
  AssumptionsPanel,
  ClaimLine,
  decisionTitle,
  FlagsList,
  KeyPoints,
  MissingInfoPanel,
  ReportMeta,
} from "@/components/report-parts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function AprCheck({ report }: { report: DecisionReport }) {
  const m = withOfferMetric(report, "apr_recomputed");
  if (!m) return null;
  const disclosed = m.disclosed ?? report.offer?.terms.apr?.value ?? null;
  const pass = m.check === "pass";
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-canvas p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        {pass ? (
          <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
        ) : (
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
        )}
        <p className="text-ink">
          <span className="font-medium">APR check: </span>
          disclosed <span className="figure font-medium">{formatRate(disclosed)}</span>, recomputed from the amount financed and the
          payments <span className="figure font-medium">{formatRate(m.value)}</span> —{" "}
          {pass ? "they agree." : m.check === "warn" ? "they differ by more than 1/8 of a point. Ask the lender." : "not checked."}
        </p>
      </div>
      <ProvenanceChip evidence={evidenceForMetric(report, "apr_recomputed")} label="APR recomputed" />
    </div>
  );
}

function LoanCost({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "loan_cost")) return <UnavailableSection report={report} analysisId="loan_cost" />;
  const total = withOfferMetric(report, "total_paid_through_deal");
  const pfc = report.offer?.terms.prepaid_finance_charges?.value ?? null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>What the loan costs</CardTitle>
        <CardDescription>The figures from the loan terms, recalculated so you can see they add up.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Figure report={report} metricKey="monthly_payment" label="Monthly payment" format={formatMoney} />
          <Figure report={report} metricKey="total_of_payments" label="Total of payments" format={formatMoney} />
          <Figure report={report} metricKey="finance_charge" label="Finance charge" format={formatMoney} />
          <Figure report={report} metricKey="total_paid_through_deal" label="Total paid through this deal" format={formatMoney} />
        </div>
        <div className="grid gap-4 rounded-lg bg-canvas p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium text-ink">Finance charge vs interest</p>
            <p className="mt-1 text-ink-muted">
              The <strong className="font-medium text-ink">finance charge</strong> is everything borrowing costs you: interest{" "}
              <span className="figure font-medium text-ink">{formatMoney(withOfferMetric(report, "interest")?.value)}</span>
              {pfc ? (
                <>
                  {" "}plus prepaid finance charges (loan fees) of <span className="figure font-medium text-ink">{formatMoney(pfc)}</span>
                </>
              ) : null}
              . <strong className="font-medium text-ink">Interest</strong> is only the part charged on the balance over time.
            </p>
          </div>
          <div>
            <p className="font-medium text-ink">Total paid through this deal</p>
            <p className="mt-1 text-ink-muted">
              All payments plus the cash you put down — everything this purchase takes out of your pocket.
            </p>
          </div>
        </div>
        {total?.breakdown && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Where does the {formatMoney(total.value)} go?</h3>
            <BreakdownBar breakdown={total.breakdown} total={total.value} />
          </div>
        )}
        <AprCheck report={report} />
      </CardContent>
    </Card>
  );
}

function YourMonth({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "cashflow_impact")) return <UnavailableSection report={report} analysisId="cashflow_impact" />;
  const before = metric(report, "monthly_left_before");
  const after = withOfferMetric(report, "monthly_left_after");
  const change = claimsAbout(report, "monthly_left_after").find((c) => c.type === "change");
  const inc = withOfferMetric(report, "incremental_vehicle_costs");
  const pay = withOfferMetric(report, "monthly_payment");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your month</CardTitle>
        <CardDescription>
          Money left in a typical month {before?.label ? `(${before.label})` : "after your listed expenses"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <BeforeAfter
          label="Left over each month"
          before={before?.value}
          after={after?.value}
          format={formatMoney}
          direction={change?.direction ?? null}
          chip={<ProvenanceChip evidence={[...evidenceForMetric(report, "monthly_left_before"), ...evidenceForMetric(report, "monthly_left_after")]} label="left over each month" />}
        />
        <dl className="grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-muted">New loan payment</dt>
            <dd className="figure font-medium text-ink">{formatMoney(pay?.value)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Change in car running costs</dt>
            <dd className="figure font-medium text-ink">{formatSignedMoney(inc?.value)}</dd>
            <dd className="mt-1">
              <ProvenanceChip evidence={evidenceForMetric(report, "incremental_vehicle_costs")} label="change in car running costs" />
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Payment as a share of take-home</dt>
            <dd className="figure font-medium text-ink">{formatRatioPercent(withOfferMetric(report, "payment_to_take_home")?.value, 1)}</dd>
          </div>
        </dl>
        {change?.text && (
          <p className="text-sm text-ink-muted">
            <ClaimLine report={report} claim={change} />
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Savings({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "reserve_impact")) return <UnavailableSection report={report} analysisId="reserve_impact" />;
  const change = claimsAbout(report, "savings_after_purchase").find((c) => c.type === "change");
  const before = (change?.values?.before as string | undefined) ?? null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your savings</CardTitle>
        <CardDescription>What&apos;s left after the down payment, and how many months of expenses it would cover.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 sm:grid-cols-2">
        <BeforeAfter
          label="Savings"
          beforeLabel="Now"
          afterLabel="After the purchase"
          before={before}
          after={withOfferMetric(report, "savings_after_purchase")?.value}
          format={formatMoney}
          chip={<ProvenanceChip evidence={evidenceForMetric(report, "savings_after_purchase")} label="savings after purchase" />}
        />
        <BeforeAfter
          label="Months of expenses your savings cover"
          before={metric(report, "reserve_months_before")?.value}
          after={withOfferMetric(report, "reserve_months_after")?.value}
          format={formatMonths}
          chip={<ProvenanceChip evidence={[...evidenceForMetric(report, "reserve_months_before"), ...evidenceForMetric(report, "reserve_months_after")]} label="reserve months" />}
        />
      </CardContent>
    </Card>
  );
}

function SourcesList({ report }: { report: DecisionReport }) {
  const groups: Record<string, typeof report.evidence> = {};
  report.evidence.forEach((e) => {
    (groups[e.kind] ??= []).push(e);
  });
  const titles: Record<string, string> = {
    user_input: "From your answers",
    document: "From your contract",
    calculation: "Calculations",
    assumption: "Assumptions",
  };
  return (
    <details className="rounded-lg border border-line bg-surface p-5">
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        <FileText aria-hidden className="mr-1 inline size-4 text-ink-subtle" /> Every source behind these numbers ({report.evidence.length})
      </summary>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {Object.entries(groups).map(([kind, list]) => (
          <div key={kind}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{titles[kind] ?? kind}</h3>
            <ul className="space-y-1.5">
              {list.map((e) => (
                <li key={e.evidence_id} className="flex flex-wrap items-center gap-2 text-sm">
                  <Chip spec={evidenceChip(e)} kind={e.kind} />
                  <span className="text-ink-muted">{e.display_label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function DashboardPage() {
  return (
    <ReportGate>
      {(report) => (
        <div className="space-y-8">
          <div className="space-y-4">
            <ResultsTabs />
            <FixtureNotice />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-accent">{report.offer?.label ?? "Your decision"}</p>
                <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{decisionTitle(report)}</h1>
                <ReportMeta report={report} />
              </div>
              <Button asChild variant="secondary" className="no-print">
                <Link href="/report">Printable report</Link>
              </Button>
            </div>
          </div>

          <KeyPoints report={report} />
          <LoanCost report={report} />
          <div className="grid gap-6 lg:grid-cols-2">
            <YourMonth report={report} />
            <Savings report={report} />
          </div>

          <section aria-labelledby="flags" className="space-y-3">
            <h2 id="flags" className="text-lg font-semibold text-ink">
              Things to notice
            </h2>
            <FlagsList report={report} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <AssumptionsPanel report={report} />
            <MissingInfoPanel report={report} />
          </div>

          <SourcesList report={report} />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/stress">See stress tests</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/alternatives">Compare alternatives</Link>
            </Button>
          </div>
        </div>
      )}
    </ReportGate>
  );
}
