/**
 * Read-only lookups over a DecisionReport. No arithmetic: values are returned exactly as sent.
 */
import type {
  Alternative,
  Claim,
  DecisionReport,
  ExplanationEvidence,
  Flag,
  Metric,
  ScenarioResult,
} from "./contracts";

export const FORMULA_NAMES: Record<string, string> = {
  F00: "Principal",
  F01: "Monthly payment",
  F01s: "Payment schedule",
  F02: "Total of payments",
  F03: "Finance charge",
  F03i: "Interest",
  F04: "Total paid through this deal",
  F05: "APR recomputed",
  F06: "Loan-to-value",
  F06d: "Negative equity at start",
  F07: "Payment ÷ take-home",
  F07b: "Debt-to-income",
  F08: "Monthly left before",
  F09: "Monthly left after",
  F10b: "Reserve months before",
  F10: "Reserve months after",
  F11: "Savings months of income",
  F12: "Equity timeline",
  F13: "Savings after purchase",
  F14: "Incremental vehicle costs",
};

export const ANALYSIS_LABELS: Record<string, string> = {
  loan_cost: "What the loan costs",
  cashflow_impact: "Your month",
  reserve_impact: "Your savings",
  stress_test: "Stress tests",
  alternatives: "Alternatives",
  dti: "Debt-to-income",
  equity_timeline: "Equity over time",
};

export const FLAG_TEXT: Record<string, { title: string; body: string }> = {
  TERM_GT_60: {
    title: "Term longer than 60 months",
    body: "Longer terms lower the payment but raise the total interest, and you may owe more than the car is worth for longer.",
  },
  NEGATIVE_EQUITY_AT_START: {
    title: "You'd owe more than the car is worth at the start",
    body: "The loan is larger than the car's value, often because a prior loan balance was rolled in.",
  },
  DEFICIT_BEFORE_LOAN: {
    title: "Spending is above take-home before this loan",
    body: "Your listed expenses are higher than your take-home pay even without the new payment.",
  },
  DEFICIT_AFTER_LOAN: {
    title: "Spending would be above take-home with this loan",
    body: "With the new payment, your listed expenses would be higher than your take-home pay.",
  },
  RESERVE_LT_1_MONTH: {
    title: "Savings would cover less than one month",
    body: "After the down payment, your savings would cover less than one month of expenses with this loan.",
  },
  ADD_ONS_FINANCED: {
    title: "Add-ons are financed",
    body: "Optional products rolled into the loan accrue interest. Many can be declined or cancelled.",
  },
  PREPAYMENT_PENALTY: {
    title: "Prepayment penalty",
    body: "The contract charges a fee if you pay the loan off early.",
  },
  PAYMENT_MISMATCH: {
    title: "The payment on the contract doesn't match the terms",
    body: "The disclosed payment differs from the payment the stated amount, rate and term produce. Financed fees or an irregular first period are common reasons. Ask the lender.",
  },
  PFC_ASSUMED_ZERO: {
    title: "Prepaid finance charges assumed to be $0",
    body: "The contract didn't show prepaid finance charges, so we assumed none. If there are some, the principal is higher.",
  },
};

export const ASSUMPTION_FLAG_TEXT: Record<string, string> = {
  same_rate_assumed: "Same rate assumed — ask the lender",
  term_gt_60: "Term over 60 months",
  pfc_assumed_zero: "Prepaid charges assumed $0",
};

export function withOfferMetric(r: DecisionReport, key: string): Metric | undefined {
  return r.with_offer?.metrics?.[key];
}

export function baselineMetric(r: DecisionReport, key: string): Metric | undefined {
  return r.baseline?.metrics?.[key];
}

/** Prefer the with-offer value, fall back to the no-offer baseline. */
export function metric(r: DecisionReport, key: string): Metric | undefined {
  return withOfferMetric(r, key) ?? baselineMetric(r, key);
}

export function metricValue(r: DecisionReport, key: string): string | null {
  return metric(r, key)?.value ?? null;
}

export function claimMap(r: DecisionReport): Map<string, Claim> {
  return new Map(r.claims.map((c) => [c.claim_id, c]));
}

export function evidenceMap(r: DecisionReport): Map<string, ExplanationEvidence> {
  return new Map(r.evidence.map((e) => [e.evidence_id, e]));
}

/** Evidence supporting a metric: its formula evidence + evidence cited by claims about that metric. */
export function evidenceForMetric(r: DecisionReport, key: string): ExplanationEvidence[] {
  const m = metric(r, key);
  const ev = evidenceMap(r);
  const ids = new Set<string>();
  if (m?.formula_id) ids.add(`ev_calc_${m.formula_id}`);
  for (const c of r.claims) {
    // comparison claims (alternatives) cite their own assumptions; they are not sources of this figure
    if (c.subject_metric === key && c.type !== "comparison") c.evidence_ids.forEach((id) => ids.add(id));
  }
  const out: ExplanationEvidence[] = [];
  ids.forEach((id) => {
    const e = ev.get(id);
    if (e) out.push(e);
  });
  return out;
}

export function evidenceForClaim(r: DecisionReport, claim: Claim): ExplanationEvidence[] {
  const ev = evidenceMap(r);
  return claim.evidence_ids.map((id) => ev.get(id)).filter((e): e is ExplanationEvidence => !!e);
}

export function triggeredFlags(r: DecisionReport): Flag[] {
  const seen = new Set<string>();
  const out: Flag[] = [];
  for (const f of [...(r.with_offer?.flags ?? []), ...(r.baseline?.flags ?? [])]) {
    if (f.triggered && !seen.has(f.flag_id)) {
      seen.add(f.flag_id);
      out.push(f);
    }
  }
  return out;
}

export interface ScenarioPair {
  scenarioId: string;
  name: string;
  without?: ScenarioResult;
  with?: ScenarioResult;
}

export function scenarioPairs(r: DecisionReport): ScenarioPair[] {
  const map = new Map<string, ScenarioPair>();
  for (const s of r.scenarios) {
    const p = map.get(s.scenario_id) ?? { scenarioId: s.scenario_id, name: s.name ?? s.scenario_id };
    if (s.run === "with_offer") p.with = s;
    else p.without = s;
    if (s.name) p.name = s.name;
    map.set(s.scenario_id, p);
  }
  return [...map.values()];
}

export function sectionClaims(r: DecisionReport, sectionId: string): Claim[] {
  const sec = r.explanations.find((s) => s.section_id === sectionId);
  if (!sec) return [];
  const cm = claimMap(r);
  return sec.claims.map((id) => cm.get(id)).filter((c): c is Claim => !!c);
}

export function claimsAbout(r: DecisionReport, metricKey: string): Claim[] {
  return r.claims.filter((c) => c.subject_metric === metricKey);
}

export function alternatives(r: DecisionReport): Alternative[] {
  return r.counterfactual?.alternatives ?? [];
}

export function isAvailable(r: DecisionReport, analysisId: string): boolean {
  const rd = r.readiness.find((x) => x.analysis_id === analysisId);
  return rd ? rd.available : true;
}

export function readinessReason(r: DecisionReport, analysisId: string): string | null {
  return r.readiness.find((x) => x.analysis_id === analysisId)?.reason ?? null;
}
