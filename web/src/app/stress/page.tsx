"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { DecisionReport, ScenarioResult } from "@/lib/contracts";
import { formatMoney, formatRatioPercent } from "@/lib/format";
import { isAvailable, scenarioPairs, type ScenarioPair } from "@/lib/report";
import { FixtureNotice } from "@/components/banners";
import { PathTable, SavingsPathChart } from "@/components/charts";
import { ClaimLine, decisionTitle } from "@/components/report-parts";
import { ReportGate, UnavailableSection } from "@/components/report-gate";
import { ResultsTabs } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function RunColumn({ title, run, focus }: { title: string; run?: ScenarioResult; focus?: boolean }) {
  if (!run) {
    return (
      <div className="rounded-md border border-dashed border-line p-4 text-sm text-ink-muted">
        {title}: not calculated.
      </div>
    );
  }
  const short = run.first_shortfall_month !== null;
  return (
    <div className={cn("space-y-3 rounded-md border p-4", focus ? "border-accent-line" : "border-line")}>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className={cn("flex items-center gap-1.5 text-sm", short ? "text-deficit" : "text-accent-strong")}>
        {short ? <AlertTriangle aria-hidden className="size-4" /> : <CheckCircle2 aria-hidden className="size-4" />}
        {short ? `Savings run out in month ${run.first_shortfall_month}` : "Savings last all 12 months"}
      </p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-ink-muted">Starting savings</dt>
          <dd className="figure font-medium text-ink">{formatMoney(run.start_balance)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Months of runway</dt>
          <dd className="figure font-medium text-ink">
            {run.months_of_runway === null ? "Not known" : `${run.months_of_runway} of 12`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Largest unfunded gap</dt>
          <dd className={cn("figure font-medium", run.max_unfunded_gap !== "0.00" ? "text-deficit" : "text-ink")}>
            {formatMoney(run.max_unfunded_gap)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Savings at month 12</dt>
          <dd className="figure font-medium text-ink">{formatMoney(run.savings_end)}</dd>
        </div>
      </dl>
    </div>
  );
}

function PairCard({ report, pair }: { report: DecisionReport; pair: ScenarioPair }) {
  const claims = report.claims.filter(
    (c) => c.type === "scenario_outcome" && (c.values as Record<string, unknown>).scenario_id === pair.scenarioId,
  );
  const assumptions = (pair.with ?? pair.without)?.assumptions ?? [];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">Illustrative scenario — not a forecast</Badge>
        </div>
        <CardTitle className="mt-1">{pair.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <RunColumn title="Without the loan" run={pair.without} />
          <RunColumn title="With the loan" run={pair.with} focus />
        </div>
        {claims.map((c) => (
          <p key={c.claim_id} className="text-sm text-ink">
            <ClaimLine report={report} claim={c} />
          </p>
        ))}
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-ink">How would your savings move over 12 months?</h3>
          <p className="text-xs text-ink-muted">
            Savings never drop below $0 here; any shortfall beyond savings is shown separately as an unfunded gap (in the table
            and tooltip).
          </p>
          <SavingsPathChart without={pair.without} withOffer={pair.with} />
          {[pair.without, pair.with].map((run) =>
            run && run.max_unfunded_gap !== "0.00" ? (
              <p key={run.run} className="flex items-center gap-1.5 text-sm text-deficit">
                <AlertTriangle aria-hidden className="size-4" />
                {run.run === "with_offer" ? "With the loan" : "Without the loan"}, the shortfall beyond savings (unfunded gap)
                reaches {formatMoney(run.max_unfunded_gap)}
                {run.recovery_month ? ` and is covered again by month ${run.recovery_month}` : " and is not covered again within 12 months"}.
              </p>
            ) : null,
          )}
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-accent">Month-by-month table (savings and unfunded gap)</summary>
          <div className="mt-3">
            <PathTable without={pair.without} withOffer={pair.with} caption={`${pair.name}: savings and unfunded gap by month`} />
          </div>
        </details>
        {assumptions.length > 0 && (
          <ul className="space-y-1 border-t border-line pt-3 text-xs text-ink-muted">
            {assumptions.map((a) => (
              <li key={a.assumption_id}>• {a.text}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Stress({ report }: { report: DecisionReport }) {
  const pairs = scenarioPairs(report);
  const res = report.resilience;
  const be = report.claims.find((c) => c.subject_metric === "break_even_m3");
  return (
    <div className="space-y-6">
      <ResultsTabs />
      <FixtureNotice />
      <div>
        <p className="text-sm font-medium text-accent">{decisionTitle(report)}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Stress tests</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Each card runs the same illustrative event twice — without the loan and with it — so you can see how much of the
          strain comes from the loan itself. These are not predictions of what will happen.
        </p>
      </div>

      {!isAvailable(report, "stress_test") ? (
        <UnavailableSection report={report} analysisId="stress_test" />
      ) : (
        <>
          {res && (
            <Card>
              <CardContent className="space-y-2 p-5 sm:p-6">
                <h2 className="text-base font-semibold text-ink">How big an income drop could your savings absorb?</h2>
                {be?.text ? (
                  <p className="text-sm text-ink">
                    <ClaimLine report={report} claim={be} />
                  </p>
                ) : (
                  <p className="text-sm text-ink">
                    With this loan, savings could absorb a take-home drop of up to{" "}
                    <span className="figure font-semibold">{formatRatioPercent(res.break_even_m3, 0)}</span> for 3 months or{" "}
                    <span className="figure font-semibold">{formatRatioPercent(res.break_even_m6, 0)}</span> for 6 months
                    (illustrative).
                  </p>
                )}
                {res.deficit_at_baseline && (
                  <p className="text-sm text-deficit">Your listed expenses already exceed take-home pay before any shock.</p>
                )}
                {res.capped && <p className="text-xs text-ink-muted">Capped: savings would cover even a full loss of income over this period.</p>}
              </CardContent>
            </Card>
          )}
          {pairs.length === 0 ? (
            <p className="text-sm text-ink-muted">No scenarios were calculated.</p>
          ) : (
            pairs.map((p) => <PairCard key={p.scenarioId} report={report} pair={p} />)
          )}
        </>
      )}
    </div>
  );
}

export default function StressPage() {
  return <ReportGate>{(report) => <Stress report={report} />}</ReportGate>;
}
