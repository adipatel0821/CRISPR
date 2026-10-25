"use client";

import * as React from "react";
import {
  BriefcaseBusiness,
  Car,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  Info,
  Receipt,
  ShieldCheck,
  TrendingDown,
  Wallet,
} from "lucide-react";
import type { DecisionReport, ExplanationEvidence, ScenarioResult } from "@/lib/contracts";
import { assumptionText, plain, scenarioNeedsRunningCosts, scenarioQuestion, scenarioTitle } from "@/lib/copy";
import { formatMoney, formatRatioPercent } from "@/lib/format";
import { isNonZeroDecimal, runningCostsMissing, RUNNING_COSTS_HREF } from "@/lib/insights";
import { evidenceForClaim, evidenceMap, isAvailable, scenarioPairs, type ScenarioPair } from "@/lib/report";
import { cn } from "@/lib/utils";
import { UnavailableSection } from "@/components/report-gate";
import { PathTable } from "@/components/charts";
import { Note, SourceLink, TrustLine } from "@/components/system";
import { ScenarioTiles, SpotBudget, scenarioPanelProps, type ScenarioTileItem } from "@/components/visual";
import { horizonMonths, orderByConsequence, runOutcome, tileOutcome } from "./outcome";
import { TrajectoryChart } from "./trajectory-chart";

const ICONS: Record<string, ScenarioTileItem["icon"]> = {
  sc_job_loss: BriefcaseBusiness,
  sc_expense_spike: Receipt,
  sc_income_cut: TrendingDown,
  sc_cost_rise: Car,
  sc_low_month: Wallet,
};

/** A scenario's display name from structured data (copy.ts), never an id. */
function runFor(pair: ScenarioPair): ScenarioResult | undefined {
  return pair.with ?? pair.without;
}

function titleOf(pair: ScenarioPair): string {
  const r = runFor(pair);
  return r ? scenarioTitle(r) : plain(pair.name);
}

function questionOf(pair: ScenarioPair): string {
  const r = runFor(pair);
  return r ? scenarioQuestion(r) : plain(pair.name);
}

function scenarioEvidence(report: DecisionReport, pair: ScenarioPair): ExplanationEvidence[] {
  const claims = report.claims.filter((c) => c.type === "scenario_outcome" && c.values?.scenario_id === pair.scenarioId);
  const fromClaims = claims.flatMap((c) => evidenceForClaim(report, c));
  const seen = new Set<string>();
  const unique = (list: ExplanationEvidence[]) => list.filter((e) => (seen.has(e.evidence_id) ? false : (seen.add(e.evidence_id), true)));
  if (fromClaims.length) return unique(fromClaims);
  const map = evidenceMap(report);
  const ids = (runFor(pair)?.assumptions ?? []).map((a) => `ev_${a.assumption_id}`);
  return unique(ids.map((id) => map.get(id)).filter((e): e is ExplanationEvidence => !!e));
}

/* ------------------------------------------------------------------------------------------------ */
/* The finding for one scenario                                                                      */
/* ------------------------------------------------------------------------------------------------ */

function Finding({ report, pair }: { report: DecisionReport; pair: ScenarioPair }) {
  const w = runOutcome(pair.with);
  const wo = runOutcome(pair.without);
  const run = pair.with;
  const short = w.state === "gap" || w.state === "depleted";
  const gap = run && isNonZeroDecimal(run.max_unfunded_gap);
  const h = horizonMonths(run ?? pair.without) ?? 12;
  const evidence = scenarioEvidence(report, pair);
  return (
    <div data-stress-finding="" className="min-w-0 space-y-6">
      <div>
        <p className="text-lg font-bold text-ink sm:text-xl">With this loan</p>
        <p
          className={cn(
            "mt-2 flex items-start gap-3 text-[length:clamp(1.875rem,2.9vw,3rem)] font-extrabold leading-[1.02] tracking-[-0.025em]",
            short ? "text-shortfall-ink" : w.state === "holds" ? "text-savings-ink" : "text-ink",
          )}
        >
          {short ? (
            <CircleAlert aria-hidden className="mt-[0.12em] size-[0.8em] shrink-0" />
          ) : w.state === "holds" ? (
            <ShieldCheck aria-hidden className="mt-[0.12em] size-[0.8em] shrink-0" />
          ) : null}
          {/* keep "month 2" / "12 months" together so the number never sits alone on a line */}
          <span className="min-w-0 text-balance">{w.headline.replace(/ (\d+)( months)?$/, (_m, n: string, s?: string) => ` ${n}${s ? ` ${s.trim()}` : ""}`)}</span>
        </p>
      </div>
      {gap ? (
        <div>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="figure text-[length:clamp(2rem,3vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em] text-ink">
              {formatMoney(run.max_unfunded_gap)}
            </span>
            <span className="text-lg font-bold text-ink">modelled shortfall</span>
          </p>
          <p className="mt-2 max-w-[var(--measure)] text-[17px] leading-relaxed text-ink-2">
            The most you&apos;d be short beyond your savings
            {run.recovery_month ? `, covered again by month ${run.recovery_month}.` : `, not covered again within ${h} months.`}
          </p>
        </div>
      ) : run?.savings_end && w.state === "holds" ? (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="figure text-[length:clamp(2rem,3vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em] text-ink">
            {formatMoney(run.savings_end)}
          </span>
          <span className="text-lg font-bold text-ink">left at month {h}</span>
        </p>
      ) : null}
      <div className="max-w-[var(--measure)] space-y-1 border-l-4 border-chart-slate-strong pl-4 text-[17px] leading-relaxed text-ink-2">
        <p className="font-bold text-ink">Without the loan</p>
        <p>{`${wo.headline}${wo.detail ? `. ${wo.detail}.` : "."}`.replace(/month (\d+)/g, "month $1")}</p>
      </div>
      <SourceLink evidence={evidence} label={titleOf(pair)} />
    </div>
  );
}

function Limitation() {
  return (
    <div data-stress-finding="" data-limitation="" className="min-w-0 space-y-6">
      <div>
        <p className="text-lg font-bold text-ink sm:text-xl">With this loan</p>
        <p className="mt-2 text-[length:clamp(2rem,3.4vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-ink">
          We can&apos;t show this one yet
        </p>
      </div>
      <Note tone="attention" action={{ href: RUNNING_COSTS_HREF, label: "Add running costs" }}>
        New-car running costs (insurance, fuel, maintenance) aren&apos;t included, so there&apos;s nothing for a rise to apply to.
        Add them and this what-if will show a result.
      </Note>
    </div>
  );
}

function ScenarioDetails({ report, pair }: { report: DecisionReport; pair: ScenarioPair }) {
  const run = runFor(pair);
  const assumptions = run?.assumptions ?? [];
  const claims = report.claims.filter(
    (c) => c.type === "scenario_outcome" && c.values?.scenario_id === pair.scenarioId && typeof c.text === "string" && c.text.trim(),
  );
  return (
    // grid-cols-1 (minmax(0, 1fr)): the month table's min width scrolls inside its region instead of widening the column.
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
      <details className="dt-disclosure group rounded-card border border-line bg-surface">
        <summary className="flex min-h-12 items-center justify-between gap-3 px-5 text-[15px] font-semibold text-ink">
          What this what-if assumes
          <ChevronDown aria-hidden className="dt-chevron size-4 text-ink-2" />
        </summary>
        <div className="space-y-3 px-5 pb-5 text-[15px] leading-relaxed text-ink-2">
          {claims.map((c) => (
            <p key={c.claim_id} className="text-ink">
              {plain(c.text as string)}
            </p>
          ))}
          {assumptions.length > 0 && (
            <ul className="list-disc space-y-1.5 pl-5 marker:text-ink-3">
              {assumptions.map((a) => (
                <li key={a.assumption_id}>{assumptionText(a.assumption_id, a.text)}</li>
              ))}
            </ul>
          )}
        </div>
      </details>
      <details data-month-table="" className="dt-disclosure group rounded-card border border-line bg-surface">
        <summary className="flex min-h-12 items-center justify-between gap-3 px-5 text-[15px] font-semibold text-ink">
          Month by month
          <ChevronDown aria-hidden className="dt-chevron size-4 text-ink-2" />
        </summary>
        <div className="px-5 pb-5">
          <PathTable without={pair.without} withOffer={pair.with} caption={`${titleOf(pair)}: savings and shortfall by month`} />
        </div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Break-even: how big a pay cut savings could absorb                                                */
/* ------------------------------------------------------------------------------------------------ */

function BreakEven({ report }: { report: DecisionReport }) {
  const res = report.resilience;
  if (!res || (!res.break_even_m3 && !res.break_even_m6)) return null;
  const evidence = report.claims
    .filter((c) => c.subject_metric === "break_even_m3" || c.subject_metric === "break_even_m6")
    .flatMap((c) => evidenceForClaim(report, c));
  return (
    <details data-break-even="" className="dt-disclosure group rounded-card border border-line bg-surface">
      <summary className="flex min-h-12 items-center justify-between gap-3 px-5 text-[15px] font-semibold text-ink">
        How big a pay cut your savings could absorb
        <ChevronDown aria-hidden className="dt-chevron size-4 text-ink-2" />
      </summary>
      <div className="space-y-2 px-5 pb-5 text-[15px] leading-relaxed text-ink-2">
        <p>
          With this loan, your savings could cover a drop in take-home pay of about{" "}
          <span className="figure font-bold text-ink">{formatRatioPercent(res.break_even_m3, 0)}</span> for three months, or{" "}
          <span className="figure font-bold text-ink">{formatRatioPercent(res.break_even_m6, 0)}</span> for six months.
          Illustrative.
        </p>
        {res.capped && <p>Capped: savings would cover even a full loss of income over this period.</p>}
        {evidence.length > 0 && <SourceLink evidence={evidence} label="Pay cut your savings could absorb" variant="quiet" />}
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* The stress test workspace                                                                         */
/* ------------------------------------------------------------------------------------------------ */

export function StressView({ report }: { report: DecisionReport }) {
  const missingRunning = runningCostsMissing(report);
  const limited = React.useCallback((p: ScenarioPair) => missingRunning && scenarioNeedsRunningCosts(p.scenarioId), [missingRunning]);
  const pairs = React.useMemo(() => orderByConsequence(scenarioPairs(report), limited), [report, limited]);
  const [selected, setSelected] = React.useState<string>(() => pairs[0]?.scenarioId ?? "");
  const pair = pairs.find((p) => p.scenarioId === selected) ?? pairs[0];

  if (!isAvailable(report, "stress_test")) {
    return (
      <div className="space-y-6">
        <h1 className="text-display font-extrabold tracking-[-0.02em] text-ink">Stress test</h1>
        <UnavailableSection report={report} analysisId="stress_test" />
      </div>
    );
  }
  if (!pair) {
    return (
      <div className="space-y-4">
        <h1 className="text-display font-extrabold tracking-[-0.02em] text-ink">Stress test</h1>
        <p className="text-[17px] text-ink-2">No what-ifs were calculated for this offer.</p>
      </div>
    );
  }

  const items: ScenarioTileItem[] = pairs.map((p) => {
    const o = tileOutcome(p.with, limited(p));
    return { id: p.scenarioId, title: titleOf(p), outcome: o.text, tone: o.tone, icon: ICONS[p.scenarioId] ?? CircleHelp };
  });
  const isLimited = limited(pair);

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center gap-3">
        <p className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3.5 py-1.5 text-sm font-bold text-brand-strong">
          Stress test
        </p>
        <TrustLine icon={Info}>Illustrative scenario, not a prediction</TrustLine>
      </div>

      {report.resilience?.deficit_at_baseline && (
        <Note tone="gap">Your listed expenses already exceed your take-home pay, before any what-if and before this loan.</Note>
      )}

      <section {...scenarioPanelProps("scenario", pair.scenarioId)} className="space-y-10 rounded-sm focus-visible:outline-offset-8">
        <h1 className="max-w-[24ch] text-balance text-hero font-extrabold leading-[1.06] tracking-[-0.025em] text-ink">
          {questionOf(pair)}
        </h1>
        <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] xl:gap-14">
          {isLimited ? <Limitation /> : <Finding report={report} pair={pair} />}
          <div className="min-w-0 rounded-[1.75rem] bg-canvas p-5 sm:p-8">
            {isLimited ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <SpotBudget className="h-auto w-40 sm:w-52" />
                <p className="max-w-[32ch] text-[15px] text-ink-2">Once running costs are in, this shows how a rise would move your savings.</p>
              </div>
            ) : (
              <TrajectoryChart
                without={pair.without}
                withOffer={pair.with}
                title={`Savings over ${horizonMonths(runFor(pair)) ?? 12} months, with and without the loan`}
              />
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="whatifs-title" className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="whatifs-title" className="text-title font-extrabold tracking-[-0.015em] text-ink">
            Try another what-if
          </h2>
          <p className="text-[15px] text-ink-2">Each one runs twice: with the loan and without it.</p>
        </div>
        <ScenarioTiles label="What-ifs" items={items} value={pair.scenarioId} onChange={setSelected} className="xl:grid-cols-4" />
      </section>

      <div className="space-y-3">
        {!isLimited && <ScenarioDetails report={report} pair={pair} />}
        <BreakEven report={report} />
      </div>
    </div>
  );
}
