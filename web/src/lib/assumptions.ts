/**
 * Which displayed metrics rest on an assumption or an estimate (audit D1-001 / contracts §1.3).
 *
 * Two signals are combined so the chip is honest with both the current and the corrected engine:
 *  1. the metric's own `status` ("assumed" / "estimated") — set by the engine when its weakest input is
 *     weaker than "provided" (engine/result.py::metric); after D1-001 this covers F14 → F09/F10;
 *  2. the CalculationResult's `assumptions_used`, mapped to the metrics each assumption feeds
 *     (formula dependencies from contracts §3 / engine), for engines that record the assumption but
 *     still report "provided".
 * No arithmetic happens here. Dependency-free so it can be unit-tested with `node --test`.
 */
import type { CalculationResult, DecisionReport, Metric } from "./contracts";

const LOAN_METRICS = [
  "principal",
  "monthly_payment",
  "total_of_payments",
  "finance_charge",
  "interest",
  "total_paid_through_deal",
  "apr_recomputed",
  "ltv",
  "negative_equity_at_start",
  "payment_to_take_home",
  "dti_total",
  "monthly_left_after",
  "reserve_months_after",
  "equity_timeline",
];

/** F14 feeds F09 (monthly left after) and F10 (reserve months after) — engine/cashflow.py, engine/ratios.py. */
const RUNNING_COST_METRICS = ["incremental_vehicle_costs", "monthly_left_after", "reserve_months_after"];

/** Value-affecting assumptions → metrics whose value depends on them. */
export const ASSUMPTION_AFFECTS: Record<string, readonly string[]> = {
  a_no_running_costs: RUNNING_COST_METRICS,
  a_not_replacing: RUNNING_COST_METRICS,
  // the principal / note rate stand in for an unknown term, so every loan figure inherits it
  a_pfc_zero: LOAN_METRICS,
  a_rate_from_apr: LOAN_METRICS,
};

/** Used only when the report's own assumptions list has no text for an id the engine recorded. */
const FALLBACK_TEXT: Record<string, string> = {
  a_no_running_costs: "New-car running costs (insurance, fuel, maintenance) were not provided, so they are not included.",
  a_not_replacing: "It was not stated whether the new car replaces your current one, so no current-car costs are netted off.",
  a_pfc_zero: "Prepaid finance charges were not stated, so they are assumed to be $0.",
  a_rate_from_apr: "The contract interest rate was not given, so the APR was used as the interest rate.",
};

export interface CaveatAssumption {
  id: string;
  text: string;
}

export interface MetricCaveat {
  kind: "assumption" | "estimate";
  label: string;
  assumptions: CaveatAssumption[];
  estimated: boolean;
}

const WEAK = new Set(["assumed", "estimated"]);

function runFor(report: DecisionReport, key: string): { run: CalculationResult; m: Metric } | null {
  for (const run of [report.with_offer, report.baseline]) {
    const m = run?.metrics?.[key];
    if (run && m) return { run, m };
  }
  return null;
}

function assumptionText(report: DecisionReport, id: string): string {
  return report.assumptions?.find((a) => a.assumption_id === id)?.text ?? FALLBACK_TEXT[id] ?? id;
}

/**
 * The caveat to show next to a metric, or null when the figure rests only on provided data.
 * A missing / unknown metric never gets a caveat (it is shown as "Not known" instead).
 */
export function metricCaveat(report: DecisionReport, key: string): MetricCaveat | null {
  const found = runFor(report, key);
  if (!found) return null;
  const { run, m } = found;
  if (m.status === "missing") return null;
  const hasValue = m.value !== null || m.before != null || m.after != null;
  if (!hasValue) return null;

  const used = run.assumptions_used ?? [];
  let ids = used.filter((a) => ASSUMPTION_AFFECTS[a]?.includes(key));
  const status = m.status ?? null;
  const assumed = status === "assumed";
  const estimated = status === "estimated";
  if (assumed && ids.length === 0) {
    // status says "assumed" but no mapped assumption explains it: show every value-affecting one recorded
    ids = used.filter((a) => a in ASSUMPTION_AFFECTS);
  }
  if (!assumed && !estimated && ids.length === 0) return null;

  const assumptions = ids.map((id) => ({ id, text: assumptionText(report, id) }));
  if (assumed || assumptions.length > 0) {
    return {
      kind: "assumption",
      label: estimated ? "Estimate · includes an assumption" : "Includes an assumption",
      assumptions,
      estimated,
    };
  }
  return { kind: "estimate", label: "Estimate", assumptions, estimated: true };
}

/** True when any part of the with-offer (or baseline) result rests on an assumption or an estimate. */
export function resultHasCaveat(report: DecisionReport): boolean {
  for (const run of [report.with_offer, report.baseline]) {
    if (!run) continue;
    if (WEAK.has(String(run.derived_status))) return true;
    if ((run.assumptions_used ?? []).some((a) => a in ASSUMPTION_AFFECTS)) return true;
  }
  return false;
}
