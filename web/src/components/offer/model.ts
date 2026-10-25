/**
 * Pure selectors for the loan-offer screen: which terms to show first and how far the review has got.
 * They select and count backend values — they never compute money values. Type imports only (node --test).
 */
import type { LoanOffer, VerifiedFinancialTerm } from "../../lib/contracts";

/** Manual entry: the fields most people can read straight off a contract, shown first. */
export const ESSENTIAL_TERM_KEYS = ["cash_price", "cash_down", "apr", "term_months", "monthly_payment"] as const;

/** Manual entry: everything else, behind "More details". */
export const DETAIL_TERM_KEYS = [
  "principal",
  "amount_financed",
  "prepaid_finance_charges",
  "contract_rate",
  "taxes_title_fees",
  "trade_in_value",
  "trade_in_payoff",
] as const;

/** Saved offer: the headline terms, in reading order. */
export const KEY_TERM_KEYS = ["monthly_payment", "apr", "term_months", "amount_financed"] as const;

/** The headline terms that the offer actually has (value present), in KEY_TERM_KEYS order. */
export function keyTerms(offer: Pick<LoanOffer, "terms">): VerifiedFinancialTerm[] {
  const out: VerifiedFinancialTerm[] = [];
  for (const k of KEY_TERM_KEYS) {
    const t = offer.terms[k];
    if (t && t.value !== null && t.value !== undefined) out.push(t);
  }
  // Fall back to the principal when the amount financed is unknown.
  if (!out.some((t) => t.term_key === "amount_financed")) {
    const p = offer.terms.principal;
    if (p && p.value !== null && p.value !== undefined) out.push(p);
  }
  return out;
}

export type ReviewAction = { action: "confirm" | "correct" | "reject"; value?: string; display?: string };

export interface ReviewState {
  total: number;
  reviewed: number;
  /** Terms where two readings disagree and the person has not chosen a value yet. */
  conflicts: string[];
  /** Terms with no action yet. */
  unreviewed: string[];
}

export function reviewState(terms: VerifiedFinancialTerm[], actions: Record<string, ReviewAction>): ReviewState {
  const conflicts = terms
    .filter((t) => t.status === "conflicting" && actions[t.term_key]?.action !== "correct")
    .map((t) => t.term_key);
  const unreviewed = terms.filter((t) => !actions[t.term_key]).map((t) => t.term_key);
  return { total: terms.length, reviewed: terms.length - unreviewed.length, conflicts, unreviewed };
}

/** Polite one-line status under the review list. */
export function reviewStatusText(s: ReviewState): string {
  if (s.conflicts.length > 0)
    return `Choose a value for ${s.conflicts.length} disagreeing term${s.conflicts.length > 1 ? "s" : ""} first.`;
  if (s.unreviewed.length > 0)
    return `${s.reviewed} of ${s.total} checked · ${s.unreviewed.length} value${s.unreviewed.length > 1 ? "s" : ""} not reviewed yet.`;
  return "All values reviewed.";
}

/** Confirm every term that has no action yet and is not in conflict (existing actions are kept). */
export function confirmRemaining(
  terms: VerifiedFinancialTerm[],
  actions: Record<string, ReviewAction>,
): Record<string, ReviewAction> {
  const n = { ...actions };
  for (const t of terms) if (!n[t.term_key] && t.status !== "conflicting") n[t.term_key] = { action: "confirm" };
  return n;
}
