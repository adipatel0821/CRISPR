"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { DecisionReport, ExplanationEvidence, ScenarioResult } from "@/lib/contracts";
import { formatMoney } from "@/lib/format";
import { isNonZeroDecimal } from "@/lib/insights";
import { evidenceForClaim, evidenceMap, type ScenarioPair } from "@/lib/report";
import { cn } from "@/lib/utils";
import { Disclosure } from "@/components/system";
import { ProvenanceChip } from "@/components/provenance-chip";
import { PathTable, SavingsPathChart } from "@/components/charts";
import { horizonMonths, runOutcome, scenarioSeverity, scenarioSummary, type RunOutcome, type Severity } from "./outcome";

const SEVERITY: Record<Severity, { wrap: string; icon: string; Icon: typeof Info; label: string }> = {
  none: { wrap: "border border-line bg-surface", icon: "text-ink-subtle", Icon: CheckCircle2, label: "Holds up" },
  attention: { wrap: "bg-info-soft", icon: "text-info", Icon: Info, label: "Savings run out" },
  gap: { wrap: "bg-deficit-soft", icon: "text-deficit", Icon: AlertCircle, label: "Shortfall beyond savings" },
};

function RunLine({ title, outcome, focus }: { title: string; outcome: RunOutcome; focus?: boolean }) {
  const short = outcome.state === "gap" || outcome.state === "depleted";
  return (
    <div className={cn("min-w-0 rounded-control px-4 py-3", focus ? "bg-surface" : "bg-surface/60")}>
      <dt className="text-[13px] font-medium text-ink-subtle">{title}</dt>
      <dd className={cn("mt-0.5 text-[15px] font-medium", short ? "text-ink" : "text-ink-muted")}>{outcome.headline}</dd>
      {outcome.detail && <dd className="figure text-[13px] text-ink-muted">{outcome.detail}</dd>}
    </div>
  );
}

function scenarioEvidence(report: DecisionReport, pair: ScenarioPair): ExplanationEvidence[] {
  const claims = report.claims.filter((c) => c.type === "scenario_outcome" && c.values?.scenario_id === pair.scenarioId);
  const fromClaims = claims.flatMap((c) => evidenceForClaim(report, c));
  if (fromClaims.length) return fromClaims;
  const map = evidenceMap(report);
  const ids = ((pair.with ?? pair.without)?.assumptions ?? []).map((a) => `ev_${a.assumption_id}`);
  return ids.map((id) => map.get(id)).filter((e): e is ExplanationEvidence => !!e);
}

function GapLine({ run }: { run: ScenarioResult }) {
  if (!isNonZeroDecimal(run.max_unfunded_gap)) return null;
  return (
    <p className="flex items-start gap-2 text-ink">
      <AlertCircle aria-hidden className="mt-1 size-4 shrink-0 text-deficit" />
      <span>
        {run.run === "with_offer" ? "With the loan" : "Without the loan"}, the shortfall beyond savings (unfunded gap) reaches{" "}
        <span className="figure font-medium">{formatMoney(run.max_unfunded_gap)}</span>
        {run.recovery_month
          ? ` and is covered again by month ${run.recovery_month}.`
          : ` and is not covered again within ${horizonMonths(run) ?? 12} months.`}
      </span>
    </p>
  );
}

/** One illustrative scenario: name, one-line consequence with vs without the loan; chart and table on demand. */
export function ScenarioCard({ report, pair, headingLevel = "h2" }: { report: DecisionReport; pair: ScenarioPair; headingLevel?: "h2" | "h3" }) {
  const severity = scenarioSeverity(pair);
  const s = SEVERITY[severity];
  const H = headingLevel;
  const Sub = headingLevel === "h2" ? "h3" : "h4";
  const claims = report.claims.filter(
    (c) => c.type === "scenario_outcome" && c.values?.scenario_id === pair.scenarioId && c.text,
  );
  const assumptions = (pair.with ?? pair.without)?.assumptions ?? [];
  const evidence = scenarioEvidence(report, pair);
  const months = horizonMonths(pair.with ?? pair.without) ?? 12;
  const headingId = `sc-${pair.scenarioId}`;
  // the page already says every what-if is illustrative; drop a repeated "Illustrative:" prefix from the name
  const stripped = pair.name.replace(/^\s*illustrative\s*[:\-–—]\s*/i, "");
  const name = stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : pair.name;

  return (
    <article aria-labelledby={headingId} data-severity={severity} className={cn("print-card rounded-card p-5 sm:p-6", s.wrap)}>
      <div className="flex items-start gap-3">
        <s.Icon aria-hidden className={cn("mt-1 size-5 shrink-0", s.icon)} />
        <div className="min-w-0 space-y-1">
          <H id={headingId} className="text-base font-semibold tracking-tight text-ink">
            {name}
          </H>
          <p className="text-pretty text-[15px] leading-relaxed text-ink">
            <span className="sr-only">{s.label}. </span>
            {scenarioSummary(pair)}
            {evidence.length > 0 && (
              <>
                {" "}
                <ProvenanceChip evidence={evidence} label={name} className="align-middle" />
              </>
            )}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        <RunLine title="Without the loan" outcome={runOutcome(pair.without)} />
        <RunLine title="With the loan" outcome={runOutcome(pair.with)} focus />
      </dl>

      <div className="mt-2">
        <Disclosure summary="Show details" contentClassName="space-y-5 pt-2">
          {claims.map((c) => (
            <p key={c.claim_id} className="text-ink">
              {c.text}
            </p>
          ))}
          <div className="space-y-2">
            <Sub className="text-sm font-semibold text-ink">How savings move over {months} months</Sub>
            <p className="text-xs text-ink-muted">
              Savings never drop below $0 here; any shortfall beyond savings is shown separately as an unfunded gap.
            </p>
            <div className="rounded-control bg-surface p-3">
              <SavingsPathChart without={pair.without} withOffer={pair.with} />
            </div>
            {[pair.without, pair.with].map((run) => (run ? <GapLine key={run.run} run={run} /> : null))}
          </div>
          {assumptions.length > 0 && (
            <div className="space-y-1.5">
              <Sub className="text-sm font-semibold text-ink">What this scenario assumes</Sub>
              <ul className="list-disc space-y-1 pl-5 text-ink-muted marker:text-ink-subtle">
                {assumptions.map((a) => (
                  <li key={a.assumption_id}>{a.text}</li>
                ))}
              </ul>
            </div>
          )}
          <Disclosure summary="Month-by-month table" variant="card" className="bg-surface" printOpen>
            <PathTable without={pair.without} withOffer={pair.with} caption={`${name}: savings and unfunded gap by month`} />
          </Disclosure>
        </Disclosure>
      </div>
    </article>
  );
}
