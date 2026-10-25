/**
 * Plain-language outcome of an illustrative scenario run, built only from ScenarioResult fields
 * (first_shortfall_month, months_of_runway, max_unfunded_gap, savings_end, recovery_month).
 * NO loan math: amounts are backend strings formatted for reading; decimals are parsed only to compare
 * against zero. Dependency-light for `node --test`.
 */
import type { ScenarioResult } from "../../lib/contracts.ts";
import { formatMoney } from "../../lib/format.ts";
import { isNonZeroDecimal } from "../../lib/insights.ts";

export type RunState = "gap" | "depleted" | "holds" | "unknown";

export interface RunOutcome {
  state: RunState;
  /** e.g. "Savings run out in month 2" / "Savings last all 12 months". */
  headline: string;
  /** e.g. "Shortfall beyond savings up to $4,975.42" / "$4,798.32 left at month 12". */
  detail: string | null;
}

/** Number of months the backend simulated (the length of its monthly path). */
export function horizonMonths(run: ScenarioResult | undefined | null): number | null {
  const n = run?.monthly_paths?.length ?? 0;
  return n > 0 ? n : null;
}

export function runOutcome(run: ScenarioResult | undefined | null): RunOutcome {
  if (!run) return { state: "unknown", headline: "Not calculated", detail: null };
  const gap = isNonZeroDecimal(run.max_unfunded_gap);
  const h = horizonMonths(run);
  const gapText = gap
    ? `Shortfall beyond savings up to ${formatMoney(run.max_unfunded_gap)}${
        run.recovery_month ? `, covered again by month ${run.recovery_month}` : ""
      }`
    : null;
  if (run.first_shortfall_month !== null && run.first_shortfall_month !== undefined) {
    return { state: gap ? "gap" : "depleted", headline: `Savings run out in month ${run.first_shortfall_month}`, detail: gapText };
  }
  if (gap) return { state: "gap", headline: "Savings fall short", detail: gapText };
  return {
    state: "holds",
    headline: h ? `Savings last all ${h} months` : "Savings don't run out",
    detail: run.savings_end && h ? `${formatMoney(run.savings_end)} left at month ${h}` : null,
  };
}

export type Severity = "gap" | "attention" | "none";

/** How prominently to show a scenario: only consequential runs (savings depleted or a gap) are highlighted. */
export function scenarioSeverity(pair: { with?: ScenarioResult; without?: ScenarioResult }): Severity {
  const states = [runOutcome(pair.with).state, runOutcome(pair.without).state];
  if (states.includes("gap")) return "gap";
  if (states.includes("depleted")) return "attention";
  return "none";
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** One-line consequence comparing the run with the loan against the run without it. */
export function scenarioSummary(pair: { with?: ScenarioResult; without?: ScenarioResult }): string {
  const w = runOutcome(pair.with);
  const wo = runOutcome(pair.without);
  const short = (o: RunOutcome) => o.state === "gap" || o.state === "depleted";
  if (w.state === "unknown" && wo.state === "unknown") return "This scenario wasn't calculated.";
  if (w.state === "unknown") return `Without the loan, ${lower(wo.headline)}.`;
  if (wo.state === "unknown") return `With the loan, ${lower(w.headline)}.`;
  if (!short(w) && !short(wo) && w.headline === wo.headline) return `${w.headline}, with or without the loan.`;
  if (!short(w) && short(wo)) return `Without the loan, ${lower(wo.headline)}; with it, ${lower(w.headline)}.`;
  return `With the loan, ${lower(w.headline)}; without it, ${lower(wo.headline)}.`;
}
