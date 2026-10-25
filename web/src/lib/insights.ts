/**
 * Pure selectors that pick WHAT to show on the results screens. NO loan math lives here:
 * every sentence is a backend claim's text or a template that only interpolates backend strings
 * (formatted for reading), and every number is a backend field passed through unchanged.
 * Decimal strings are parsed only to COMPARE them (choosing which alternative / scenario to surface).
 * Dependency-light so it can be unit-tested with `node --test`.
 */
import type {
  Alternative,
  CalculationResult,
  Claim,
  CounterfactualResult,
  DecisionReport,
  DeltasVsBase,
  Flag,
  ScenarioResult,
} from "./contracts.ts";
import { formatMoney } from "./format.ts";
import { ASSUMPTION_FLAG_TEXT, FLAG_TEXT } from "./report.ts";

/* ------------------------------------------------------------------------------------------------ */
/* Comparison helpers (parse for comparison only)                                                    */
/* ------------------------------------------------------------------------------------------------ */

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

/** Numeric value of a backend decimal string, for COMPARISON ONLY. null when not a decimal. */
export function comparable(s: unknown): number | null {
  if (typeof s !== "string" || !DECIMAL_RE.test(s)) return null;
  return Number(s);
}

/** True when the decimal string is a real, non-zero amount ("0.00", "0", null → false). */
export function isNonZeroDecimal(s: unknown): boolean {
  const n = comparable(s);
  return n !== null && n !== 0;
}

/* ------------------------------------------------------------------------------------------------ */
/* decisionSummary                                                                                    */
/* ------------------------------------------------------------------------------------------------ */

export type SummaryKind =
  | "cashflow_change"
  | "savings_change"
  | "deficit_after_loan"
  | "deficit_before_loan"
  | "unfunded_gap"
  | "reserve_low"
  | "term_long"
  | "payment_mismatch"
  | "running_costs_missing"
  | "alternative"
  | "stress_scenario";

export type SummaryTone = "neutral" | "attention" | "gap";

export interface SummaryPiece {
  kind: SummaryKind;
  /** Plain sentence: a claim's text or a template filled with backend strings. */
  text: string;
  /** Short label for the piece (e.g. the flag title or scenario name). */
  title: string;
  tone: SummaryTone;
  claimIds: string[];
  /** Evidence ids to resolve with lib/report evidenceMap() for a ProvenanceChip. */
  evidenceIds: string[];
  /** Where to go to see / act on it. */
  href: string;
  /** Backend strings behind the sentence (unformatted), for an optional KeyFigure. */
  figure?: { before?: string | null; after?: string | null; value?: string | null };
  /** Set for kind "alternative". */
  altId?: string;
  /** Set for kind "unfunded_gap" / "stress_scenario". */
  scenarioId?: string;
}

export interface DecisionSummary {
  /** What changes financially? */
  change: SummaryPiece | null;
  /** What is the most important concern? */
  concern: SummaryPiece | null;
  /** What should I explore next? */
  next: SummaryPiece | null;
}

function keyPointFirst(report: DecisionReport, claims: Claim[]): Claim[] {
  const kp = new Set(report.key_points ?? []);
  return [...claims].sort((a, b) => Number(kp.has(b.claim_id)) - Number(kp.has(a.claim_id)));
}

function claimText(c: Claim | undefined): string | null {
  return c?.text && c.text.trim() ? c.text : null;
}

function triggered(run: CalculationResult | null | undefined): Flag[] {
  return (run?.flags ?? []).filter((f) => f.triggered);
}

function findFlag(report: DecisionReport, flagId: string): Flag | undefined {
  for (const run of [report.with_offer, report.baseline]) {
    const f = triggered(run).find((x) => x.flag_id === flagId);
    if (f) return f;
  }
  return undefined;
}

function flagClaim(report: DecisionReport, flagId: string): Claim | undefined {
  return report.claims.find((c) => c.type === "threshold_flag" && c.values?.flag_id === flagId);
}

function changePiece(report: DecisionReport): SummaryPiece | null {
  // 1. The backend's cash-flow change claim (prefer one listed in key_points).
  const cash = keyPointFirst(
    report,
    report.claims.filter((c) => c.type === "change" && c.subject_metric === "monthly_left_after"),
  ).find((c) => claimText(c));
  if (cash) {
    const v = cash.values ?? {};
    return {
      kind: "cashflow_change",
      title: "Your month",
      text: cash.text as string,
      tone: "neutral",
      claimIds: [cash.claim_id],
      evidenceIds: [...cash.evidence_ids],
      href: "/dashboard",
      // live claims carry monthly_left_before/after; fixtures may carry before/after
      figure: { before: strOrNull(v.before ?? v.monthly_left_before), after: strOrNull(v.after ?? v.monthly_left_after) },
    };
  }
  // 2. Template from the metrics (before = monthly_left_before, after = monthly_left_after).
  const before = report.with_offer?.metrics?.monthly_left_before?.value ?? report.baseline?.metrics?.monthly_left_before?.value ?? null;
  const after = report.with_offer?.metrics?.monthly_left_after?.value ?? null;
  if (comparable(before) !== null && comparable(after) !== null) {
    return {
      kind: "cashflow_change",
      title: "Your month",
      text: `In a typical month, what you have left after expenses goes from ${formatMoney(before)} to ${formatMoney(after)}.`,
      tone: "neutral",
      claimIds: [],
      evidenceIds: ["ev_calc_F08", "ev_calc_F09"].filter((id) => report.evidence.some((e) => e.evidence_id === id)),
      href: "/dashboard",
      figure: { before, after },
    };
  }
  // 3. Savings change claim.
  const sav = report.claims.find((c) => c.type === "change" && c.subject_metric === "savings_after_purchase" && claimText(c));
  if (sav) {
    return {
      kind: "savings_change",
      title: "Your savings",
      text: sav.text as string,
      tone: "neutral",
      claimIds: [sav.claim_id],
      evidenceIds: [...sav.evidence_ids],
      href: "/dashboard",
      figure: { before: strOrNull(sav.values?.before), after: strOrNull(sav.values?.after) },
    };
  }
  return null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : null;
}

function flagPiece(
  report: DecisionReport,
  flagId: string,
  kind: SummaryKind,
  tone: SummaryTone,
  href: string,
): SummaryPiece | null {
  const f = findFlag(report, flagId);
  if (!f) return null;
  const c = flagClaim(report, flagId);
  const text = claimText(c) ?? (f.detail && f.detail.trim() ? f.detail : null) ?? FLAG_TEXT[flagId]?.body ?? null;
  if (!text) return null;
  return {
    kind,
    title: FLAG_TEXT[flagId]?.title ?? flagId,
    text,
    tone,
    claimIds: c ? [c.claim_id] : [],
    evidenceIds: c ? [...c.evidence_ids] : [],
    href,
  };
}

/** with_offer scenario with the largest unfunded gap (> 0), or null. Comparison only. */
export function worstGapScenario(report: DecisionReport): ScenarioResult | null {
  let worst: ScenarioResult | null = null;
  for (const s of report.scenarios ?? []) {
    if (s.run !== "with_offer" || !isNonZeroDecimal(s.max_unfunded_gap)) continue;
    if (!worst || (comparable(s.max_unfunded_gap) as number) > (comparable(worst.max_unfunded_gap) as number)) worst = s;
  }
  return worst;
}

/**
 * The backend emits one scenario claim per run (cl_scn_<id>_without_offer / _with_offer). Concerns are about the
 * WITH-loan path, so match the run explicitly (values.run, or the claim-id suffix) — never fall back to the other run.
 */
export function scenarioClaim(
  report: DecisionReport,
  scenarioId: string,
  run: "with_offer" | "without_offer" = "with_offer",
): Claim | undefined {
  const runOf = (c: Claim): string | null =>
    typeof c.values?.run === "string"
      ? (c.values.run as string)
      : c.claim_id.endsWith("_without_offer")
        ? "without_offer"
        : c.claim_id.endsWith("_with_offer")
          ? "with_offer"
          : null;
  const candidates = report.claims.filter(
    (c) => c.type === "scenario_outcome" && c.values?.scenario_id === scenarioId && claimText(c),
  );
  // exact run first; then a combined claim that names no run (it describes both); never the other run's claim
  return candidates.find((c) => runOf(c) === run) ?? candidates.find((c) => runOf(c) === null);
}

function gapPiece(report: DecisionReport): SummaryPiece | null {
  const s = worstGapScenario(report);
  if (!s) return null;
  const c = scenarioClaim(report, s.scenario_id);
  const name = s.name ?? s.scenario_id;
  const text =
    claimText(c) ??
    (s.first_shortfall_month !== null && s.first_shortfall_month !== undefined
      ? `In the illustrative scenario “${name}”, with this loan your savings run out in month ${s.first_shortfall_month} and the unfunded gap reaches ${formatMoney(s.max_unfunded_gap)}.`
      : `In the illustrative scenario “${name}”, with this loan the unfunded gap reaches ${formatMoney(s.max_unfunded_gap)}.`);
  return {
    kind: "unfunded_gap",
    title: name,
    text,
    tone: "gap",
    claimIds: c ? [c.claim_id] : [],
    evidenceIds: c ? [...c.evidence_ids] : [],
    href: "/stress",
    figure: { value: s.max_unfunded_gap },
    scenarioId: s.scenario_id,
  };
}

/** True when new-car running costs were not provided (unknown, shown as $0 by the engine). */
export function runningCostsMissing(report: DecisionReport): boolean {
  const run = report.with_offer;
  if (!run) return false;
  if ((run.assumptions_used ?? []).includes("a_no_running_costs")) return true;
  const ivc = run.metrics?.incremental_vehicle_costs;
  return run.derived_status === "assumed" && ivc?.status === "assumed";
}

export const RUNNING_COSTS_TEXT =
  "New-car running costs (insurance, fuel, maintenance) aren't included. Add them for a fuller picture.";
export const RUNNING_COSTS_HREF = "/intake";

function runningCostsPiece(report: DecisionReport): SummaryPiece | null {
  if (!runningCostsMissing(report)) return null;
  return {
    kind: "running_costs_missing",
    title: "Running costs not included",
    text: RUNNING_COSTS_TEXT,
    tone: "attention",
    claimIds: [],
    evidenceIds: report.evidence.some((e) => e.evidence_id === "ev_calc_F14") ? ["ev_calc_F14"] : [],
    href: RUNNING_COSTS_HREF,
  };
}

function concernPiece(report: DecisionReport): SummaryPiece | null {
  return (
    flagPiece(report, "DEFICIT_AFTER_LOAN", "deficit_after_loan", "gap", "/dashboard") ??
    flagPiece(report, "DEFICIT_BEFORE_LOAN", "deficit_before_loan", "gap", "/dashboard") ??
    gapPiece(report) ??
    flagPiece(report, "RESERVE_LT_1_MONTH", "reserve_low", "attention", "/dashboard") ??
    flagPiece(report, "TERM_GT_60", "term_long", "attention", "/alternatives") ??
    flagPiece(report, "PAYMENT_MISMATCH", "payment_mismatch", "attention", "/offer") ??
    runningCostsPiece(report)
  );
}

function deltaPhrase(name: string, delta: string | null | undefined): string | null {
  const n = comparable(delta);
  if (n === null || n === 0) return null;
  const amount = formatMoney((delta as string).replace(/^-/, ""));
  return `${n < 0 ? "lowers" : "raises"} the ${name} by ${amount}`;
}

/** Template for an alternative built only from its label and deltas_vs_base strings. */
export function alternativeSentence(alt: Alternative): string {
  const parts = [
    deltaPhrase("monthly payment", alt.deltas_vs_base?.monthly_payment),
    deltaPhrase("finance charge", alt.deltas_vs_base?.finance_charge),
  ].filter((p): p is string => !!p);
  const sav = comparable(alt.deltas_vs_base?.savings_after_purchase);
  if (sav !== null && sav !== 0) {
    parts.push(
      `leaves ${formatMoney((alt.deltas_vs_base.savings_after_purchase as string).replace(/^-/, ""))} ${sav < 0 ? "less" : "more"} in savings`,
    );
  }
  const body = parts.length ? parts.join(", ") : "keeps the payment and finance charge the same";
  const same = alt.assumption_flags?.includes("same_rate_assumed") ? " (same rate assumed, so ask the lender)" : "";
  return `“${alt.label}” ${body}${same}.`;
}

function nextPiece(report: DecisionReport, concern: SummaryPiece | null): SummaryPiece | null {
  const cf = report.counterfactual;
  const feasible = (cf?.alternatives ?? []).filter((a) => a.feasible && !a.is_base);
  // 1. The alternative the backend itself chose to describe (a comparison claim naming an alt_id).
  for (const c of report.claims) {
    if (c.type !== "comparison" || typeof c.values?.alt_id !== "string" || !claimText(c)) continue;
    const alt = feasible.find((a) => a.alt_id === c.values.alt_id);
    if (!alt) continue;
    return {
      kind: "alternative",
      title: alt.label,
      text: c.text as string,
      tone: "neutral",
      claimIds: [c.claim_id],
      evidenceIds: [...c.evidence_ids],
      href: "/alternatives",
      altId: alt.alt_id,
    };
  }
  // 2. A highlighted alternative matching the concern (cash-flow concerns → lower payment / keep savings).
  const hl = highlightAlternatives(cf);
  if (hl.length) {
    const cashConcern = concern && ["deficit_after_loan", "deficit_before_loan", "unfunded_gap", "reserve_low"].includes(concern.kind);
    const order: HighlightSlot[] = cashConcern
      ? ["preserveSavings", "lowerPayment", "lowerTotalCost"]
      : ["lowerTotalCost", "lowerPayment", "preserveSavings"];
    const pick = order.map((slot) => hl.find((h) => h.slots.includes(slot))).find(Boolean) ?? hl[0];
    return {
      kind: "alternative",
      title: pick.label,
      text: alternativeSentence(pick.alternative),
      tone: "neutral",
      claimIds: [],
      evidenceIds: [],
      href: "/alternatives",
      altId: pick.altId,
    };
  }
  // 3. No alternatives: the stress scenario with a gap (unless that is already the concern).
  const s = worstGapScenario(report);
  if (s && concern?.kind !== "unfunded_gap") {
    const c = scenarioClaim(report, s.scenario_id);
    return {
      kind: "stress_scenario",
      title: s.name ?? s.scenario_id,
      text: claimText(c) ?? `See how your plan holds up in the illustrative scenario “${s.name ?? s.scenario_id}”.`,
      tone: "neutral",
      claimIds: c ? [c.claim_id] : [],
      evidenceIds: c ? [...c.evidence_ids] : [],
      href: "/stress",
      scenarioId: s.scenario_id,
    };
  }
  return null;
}

/**
 * Three short answers for the top of the results: what changes, the most important concern, and what to
 * explore next. Pieces are null when the data to support them is absent — nothing is invented.
 */
export function decisionSummary(report: DecisionReport): DecisionSummary {
  const change = changePiece(report);
  const concern = concernPiece(report);
  const next = nextPiece(report, concern);
  return { change, concern, next };
}

/* ------------------------------------------------------------------------------------------------ */
/* highlightAlternatives                                                                              */
/* ------------------------------------------------------------------------------------------------ */

export type HighlightSlot = "preserveSavings" | "lowerPayment" | "lowerTotalCost";

export const HIGHLIGHT_LABELS: Record<HighlightSlot, string> = {
  preserveSavings: "Keeps more savings",
  lowerPayment: "Lower monthly payment",
  lowerTotalCost: "Lower finance charge",
};

const SLOT_RULES: { slot: HighlightSlot; metric: string; direction: "max" | "min" }[] = [
  { slot: "preserveSavings", metric: "savings_after_purchase", direction: "max" },
  { slot: "lowerPayment", metric: "monthly_payment", direction: "min" },
  { slot: "lowerTotalCost", metric: "finance_charge", direction: "min" },
];

export interface HighlightedAlternative {
  altId: string;
  label: string;
  /** Slots this alternative won (one alternative can win several; it is listed once). */
  slots: HighlightSlot[];
  slotLabels: string[];
  /** Backend metrics (strings, unchanged). */
  metrics: Alternative["metrics"];
  /** Backend deltas vs your offer (strings, unchanged). */
  deltas: DeltasVsBase;
  assumptionFlags: string[];
  /** Plain-language text for each assumption flag (e.g. "Same rate assumed, ask the lender"). */
  assumptionNotes: string[];
  sameRateAssumed: boolean;
  alternative: Alternative;
}

function better(a: number, b: number, direction: "max" | "min"): boolean {
  return direction === "max" ? a > b : a < b;
}

/**
 * Up to three feasible, non-base alternatives: the one that keeps the most savings, the lowest monthly
 * payment and the lowest finance charge. A slot is skipped when no feasible alternative improves on your
 * offer for that objective. Ties keep the backend's order. Returned in slot order, deduplicated.
 */
export function highlightAlternatives(
  counterfactual: CounterfactualResult | null | undefined,
  baseAltId?: string,
): HighlightedAlternative[] {
  const alts = counterfactual?.alternatives ?? [];
  const base = alts.find((a) => (baseAltId ? a.alt_id === baseAltId : a.is_base));
  const candidates = alts.filter((a) => a.feasible && !a.is_base && a.alt_id !== base?.alt_id);
  const out: HighlightedAlternative[] = [];

  // Savings-neutral options: the alternative does not lower savings after purchase (backend delta ≥ 0).
  const keepsSavings = (a: Alternative): boolean => {
    const d = comparable(a.deltas_vs_base?.savings_after_purchase);
    return d === null || d >= 0;
  };
  const pickBest = (pool: Alternative[], rule: (typeof SLOT_RULES)[number]): Alternative | null => {
    let best: Alternative | null = null;
    let bestVal: number | null = null;
    for (const a of pool) {
      const v = comparable(a.metrics?.[rule.metric]);
      if (v === null) continue;
      if (bestVal === null || better(v, bestVal, rule.direction)) {
        best = a;
        bestVal = v;
      }
    }
    if (!best || bestVal === null) return null;
    // must improve on the base: compare with the base metric, or (base unknown) use the delta's sign
    const baseVal = comparable(base?.metrics?.[rule.metric]);
    const improves =
      baseVal !== null
        ? better(bestVal, baseVal, rule.direction)
        : (() => {
            const d = comparable(best.deltas_vs_base?.[rule.metric]);
            return d !== null && (rule.direction === "max" ? d > 0 : d < 0);
          })();
    return improves ? best : null;
  };

  for (const rule of SLOT_RULES) {
    // Constraint-aware: for payment / cost slots prefer options that improve the objective WITHOUT drawing down
    // savings; only when none exists fall back to options that do (their trade-off text and badges disclose it).
    const best =
      rule.slot === "preserveSavings"
        ? pickBest(candidates, rule)
        : (pickBest(candidates.filter(keepsSavings), rule) ?? pickBest(candidates, rule));
    if (!best) continue;

    const existing = out.find((h) => h.altId === best.alt_id);
    if (existing) {
      existing.slots.push(rule.slot);
      existing.slotLabels.push(HIGHLIGHT_LABELS[rule.slot]);
      continue;
    }
    const flags = [...(best.assumption_flags ?? [])];
    out.push({
      altId: best.alt_id,
      label: best.label,
      slots: [rule.slot],
      slotLabels: [HIGHLIGHT_LABELS[rule.slot]],
      metrics: best.metrics,
      deltas: best.deltas_vs_base ?? {},
      assumptionFlags: flags,
      assumptionNotes: flags.map((f) => ASSUMPTION_FLAG_TEXT[f] ?? f.replace(/_/g, " ")),
      sameRateAssumed: flags.includes("same_rate_assumed"),
      alternative: best,
    });
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------ */
/* limitations                                                                                        */
/* ------------------------------------------------------------------------------------------------ */

export interface Limitation {
  id: string;
  kind: "assumption" | "estimate" | "missing";
  /** Short heading. */
  title: string;
  /** Plain-language sentence. */
  text: string;
  /** Where the user can fill the gap, when there is one. */
  href?: string;
  actionLabel?: string;
}

const KNOWN_ASSUMPTIONS: Record<string, Omit<Limitation, "id" | "kind">> = {
  a_no_running_costs: {
    title: "Running costs not included",
    text: RUNNING_COSTS_TEXT,
    href: RUNNING_COSTS_HREF,
    actionLabel: "Add running costs",
  },
  a_not_replacing: {
    title: "Current car costs not netted off",
    text: "We don't know whether this car replaces your current one, so your current car's costs aren't subtracted.",
    href: "/intake",
    actionLabel: "Answer this question",
  },
  a_pfc_zero: {
    title: "Prepaid finance charges assumed $0",
    text: "The contract didn't show prepaid finance charges, so none are assumed. If there are some, the principal is higher.",
    href: "/offer",
    actionLabel: "Check the loan terms",
  },
  a_rate_from_apr: {
    title: "APR used as the interest rate",
    text: "The contract interest rate wasn't given, so the APR stands in for it.",
    href: "/offer",
    actionLabel: "Add the contract rate",
  },
};

const MISSING_TITLES: Record<string, string> = {
  "loan.buy_rate": "Lender's buy rate",
  "income.gross_monthly": "Gross monthly income",
  "vehicle.value_estimates": "Your estimates of the car's value",
  "vehicle.new_ownership_costs_monthly": "New car running costs",
  "vehicle.replaces_current": "Whether this car replaces your current one",
  "income.low_month": "Take-home in a slow month",
};

function humanize(key: string): string {
  const t = key.replace(/\[[^\]]*\]/g, "").replace(/[._]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Everything the results do NOT know or assume, in plain language: value-affecting assumptions
 * (incl. "running costs not included" — unknown is never presented as a confirmed $0), estimates,
 * and the report's missing-information list. Deduplicated, in that order.
 */
export function limitations(report: DecisionReport): Limitation[] {
  const out: Limitation[] = [];
  const seen = new Set<string>();
  const push = (l: Limitation) => {
    if (seen.has(l.id)) return;
    seen.add(l.id);
    out.push(l);
  };

  for (const run of [report.with_offer, report.baseline]) {
    for (const id of run?.assumptions_used ?? []) {
      const known = KNOWN_ASSUMPTIONS[id];
      if (known) {
        push({ id, kind: "assumption", ...known });
        continue;
      }
      const a = report.assumptions?.find((x) => x.assumption_id === id);
      if (a?.text) push({ id, kind: "assumption", title: "Assumption", text: a.text });
    }
  }
  // Corrected engine: running costs flagged only through derived/metric status.
  if (runningCostsMissing(report)) push({ id: "a_no_running_costs", kind: "assumption", ...KNOWN_ASSUMPTIONS.a_no_running_costs });

  const statuses = [report.with_offer?.derived_status, report.baseline?.derived_status].map((s) => String(s ?? ""));
  if (statuses.includes("estimated")) {
    push({
      id: "derived_estimated",
      kind: "estimate",
      title: "Some figures use estimates",
      text: "Some figures use a value you gave as an estimate, so they are approximate.",
      href: "/intake",
      actionLabel: "Review your answers",
    });
  }
  if (statuses.includes("assumed") && !out.some((l) => l.kind === "assumption")) {
    push({
      id: "derived_assumed",
      kind: "assumption",
      title: "Some figures rest on assumptions",
      text: "Some figures rest on an assumption because an input wasn't provided.",
    });
  }

  for (const m of report.missing_information ?? []) {
    push({
      id: `missing:${m.fact_key}`,
      kind: "missing",
      title: MISSING_TITLES[m.fact_key] ?? humanize(m.fact_key),
      text: m.why_it_matters,
      ...(m.ask_the_lender ? { actionLabel: "Ask the lender" } : {}),
    });
  }
  return out;
}
