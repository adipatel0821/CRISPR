/**
 * Pure choices for the Decision summary: which backend figure sits beside each insight, and where its link
 * goes. NO loan math: every value returned is a backend string formatted for reading; decimal strings are
 * parsed only to COMPARE them (to pick which delta to show). Dependency-light for `node --test`.
 */
import type { Alternative, Claim, DecisionReport } from "../../lib/contracts.ts";
import { formatMonths, formatMoney, formatSignedMoney } from "../../lib/format.ts";
import { comparable, type SummaryPiece } from "../../lib/insights.ts";

export interface PieceFigure {
  /** Formatted backend value, e.g. "$474.86". */
  value: string;
  /** One quiet line under it, e.g. "left each month, from $900.00". */
  caption: string;
}

const CASH_CONCERNS = new Set(["deficit_after_loan", "deficit_before_loan", "unfunded_gap", "reserve_low"]);

function withOffer(report: DecisionReport, key: string): string | null {
  return report.with_offer?.metrics?.[key]?.value ?? null;
}

function baseline(report: DecisionReport, key: string): string | null {
  return report.with_offer?.metrics?.[key]?.value ?? report.baseline?.metrics?.[key]?.value ?? null;
}

/** The alternative a summary piece names, if any. */
export function pieceAlternative(report: DecisionReport, piece: SummaryPiece | null): Alternative | null {
  if (!piece?.altId) return null;
  return report.counterfactual?.alternatives?.find((a) => a.alt_id === piece.altId) ?? null;
}

const DELTA_RULES: Record<string, { key: string; better: "up" | "down"; caption: string }> = {
  savings_after_purchase: { key: "savings_after_purchase", better: "up", caption: "savings after purchase, vs your offer" },
  monthly_payment: { key: "monthly_payment", better: "down", caption: "monthly payment, vs your offer" },
  finance_charge: { key: "finance_charge", better: "down", caption: "finance charge, vs your offer" },
};

/**
 * The single delta to show beside an alternative: the first one (in an order that matches the concern) that
 * moves in the helpful direction. The delta string is the backend's deltas_vs_base value, unchanged.
 */
export function alternativeFigure(alt: Alternative, concern: SummaryPiece | null): PieceFigure | null {
  const order = concern && CASH_CONCERNS.has(concern.kind)
    ? ["savings_after_purchase", "monthly_payment", "finance_charge"]
    : ["finance_charge", "monthly_payment", "savings_after_purchase"];
  for (const k of order) {
    const rule = DELTA_RULES[k];
    const d = alt.deltas_vs_base?.[rule.key];
    const n = comparable(d);
    if (n === null || n === 0) continue;
    if ((rule.better === "down" && n < 0) || (rule.better === "up" && n > 0)) {
      return { value: formatSignedMoney(d), caption: rule.caption };
    }
  }
  return null;
}

/** The key figure for one summary piece, or null when the piece has no single number worth showing. */
export function pieceFigure(report: DecisionReport, piece: SummaryPiece | null, concern: SummaryPiece | null = null): PieceFigure | null {
  if (!piece) return null;
  const f = piece.figure ?? {};
  switch (piece.kind) {
    case "cashflow_change": {
      // the claim may carry before/after under its own keys; fall back to the metrics themselves
      const after = comparable(f.after) !== null ? f.after : withOffer(report, "monthly_left_after");
      const before = comparable(f.before) !== null ? f.before : baseline(report, "monthly_left_before");
      if (comparable(after) === null) return null;
      return {
        value: formatMoney(after),
        caption: comparable(before) !== null ? `left each month, from ${formatMoney(before)}` : "left each month",
      };
    }
    case "savings_change":
      if (comparable(f.after) === null) return null;
      return {
        value: formatMoney(f.after),
        caption: comparable(f.before) !== null ? `in savings, from ${formatMoney(f.before)}` : "in savings after the purchase",
      };
    case "unfunded_gap":
      if (comparable(f.value) === null) return null;
      return { value: formatMoney(f.value), caption: "largest shortfall beyond savings" };
    case "deficit_after_loan": {
      const v = withOffer(report, "monthly_left_after");
      return comparable(v) === null ? null : { value: formatMoney(v), caption: "left each month with this loan" };
    }
    case "deficit_before_loan": {
      const v = baseline(report, "monthly_left_before");
      return comparable(v) === null ? null : { value: formatMoney(v), caption: "left each month before this loan" };
    }
    case "reserve_low": {
      const v = withOffer(report, "reserve_months_after");
      return comparable(v) === null ? null : { value: formatMonths(v), caption: "of expenses your savings would cover" };
    }
    case "term_long": {
      const t = report.offer?.terms?.term_months?.value ?? null;
      return comparable(t) === null ? null : { value: `${t} months`, caption: "loan term" };
    }
    case "payment_mismatch": {
      const d = report.with_offer?.metrics?.monthly_payment?.disclosed ?? null;
      return comparable(d) === null ? null : { value: formatMoney(d), caption: "payment on the contract" };
    }
    case "alternative": {
      const alt = pieceAlternative(report, piece);
      return alt ? alternativeFigure(alt, concern) : null;
    }
    default:
      return null;
  }
}

export interface PieceLink {
  href: string;
  label: string;
}

/** Where each insight's quiet link goes. Pieces about this page point at the section below. */
export function pieceLink(piece: SummaryPiece | null): PieceLink | null {
  if (!piece) return null;
  switch (piece.kind) {
    case "cashflow_change":
    case "savings_change":
      return { href: "#month", label: "See your month and savings" };
    case "deficit_after_loan":
    case "deficit_before_loan":
      return { href: "#month", label: "See your month" };
    case "reserve_low":
      return { href: "#month", label: "See your savings" };
    case "unfunded_gap":
    case "stress_scenario":
      return { href: "/stress", label: "See the stress test" };
    case "term_long":
      return { href: "/alternatives", label: "Compare other terms" };
    case "payment_mismatch":
      return { href: "/offer", label: "Check the loan terms" };
    case "running_costs_missing":
      return { href: piece.href, label: "Add running costs" };
    case "alternative":
      return { href: "/alternatives", label: "Compare alternatives" };
    default:
      return { href: piece.href, label: "Learn more" };
  }
}

/**
 * The scenario_outcome claim for a scenario's run WITH the loan. The backend may emit one claim per run
 * (values.run); a claim without a run field is accepted as describing the scenario as a whole.
 */
export function withLoanScenarioClaim(report: DecisionReport, scenarioId: string): Claim | null {
  const claims = report.claims.filter(
    (c) => c.type === "scenario_outcome" && c.values?.scenario_id === scenarioId && typeof c.text === "string" && c.text.trim(),
  );
  return claims.find((c) => c.values?.run === "with_offer") ?? claims.find((c) => c.values?.run === undefined) ?? null;
}

/** For scenario-based pieces, make sure the sentence describes the run with the loan (not the run without it). */
export function resolvePiece(report: DecisionReport, piece: SummaryPiece | null): SummaryPiece | null {
  if (!piece || !piece.scenarioId || (piece.kind !== "unfunded_gap" && piece.kind !== "stress_scenario")) return piece;
  const c = withLoanScenarioClaim(report, piece.scenarioId);
  if (!c || piece.claimIds.includes(c.claim_id)) return piece;
  return { ...piece, text: c.text as string, claimIds: [c.claim_id], evidenceIds: [...c.evidence_ids] };
}
