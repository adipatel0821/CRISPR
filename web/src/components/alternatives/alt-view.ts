/**
 * Pure view helpers for the Alternatives screen and the report's "Relevant alternatives" section.
 * NO loan math: every amount is a backend string (lever_values / metrics / deltas_vs_base) passed to a
 * formatter. Decimal strings are parsed only to COMPARE (choose a word such as "drops" / "rises").
 * Dependency-light so it can be unit-tested with `node --test`.
 */
import type { Alternative, CounterfactualResult } from "../../lib/contracts.ts";
import { formatMoney, formatSignedMoney } from "../../lib/format.ts";
import { comparable, type HighlightedAlternative, type HighlightSlot } from "../../lib/insights.ts";
import { ASSUMPTION_FLAG_TEXT } from "../../lib/report.ts";

export const SLOT_ORDER: readonly HighlightSlot[] = ["preserveSavings", "lowerPayment", "lowerTotalCost"];

/** Card headings for the three comparisons. */
export const SLOT_TITLES: Record<HighlightSlot, string> = {
  preserveSavings: "Keep more savings",
  lowerPayment: "Lower monthly payment",
  lowerTotalCost: "Lower total borrowing cost",
};

/** Quiet note when the data has no option for a slot. */
export const SLOT_SKIPPED_TEXT: Record<HighlightSlot, string> = {
  preserveSavings: "None of the options leaves more in savings than your offer as written.",
  lowerPayment: "None of the options has a lower monthly payment than your offer as written.",
  lowerTotalCost: "None of the options has a lower finance charge than your offer as written.",
};

export interface SlotCard {
  highlight: HighlightedAlternative;
  slots: HighlightSlot[];
}

export interface SlotPlan {
  cards: SlotCard[];
  skipped: HighlightSlot[];
}

/** Cards in slot order (one per distinct alternative) plus the slots the data doesn't support. */
export function slotPlan(highlights: HighlightedAlternative[]): SlotPlan {
  const cards: SlotCard[] = [];
  const skipped: HighlightSlot[] = [];
  for (const slot of SLOT_ORDER) {
    const h = highlights.find((x) => x.slots.includes(slot));
    if (!h) {
      skipped.push(slot);
      continue;
    }
    if (!cards.some((c) => c.highlight.altId === h.altId)) cards.push({ highlight: h, slots: [...h.slots] });
  }
  return { cards, skipped };
}

/** The offer as written (base alternative), if present. */
export function baseAlternative(cf: CounterfactualResult | null | undefined): Alternative | undefined {
  return (cf?.alternatives ?? []).find((a) => a.is_base);
}

function wholeMoney(s: string): string {
  return formatMoney(s).replace(/\.00$/, "");
}

function leverStr(v: unknown): string | null {
  if (typeof v === "string" && v) return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/**
 * The change in plain words, from lever_values compared with the base's ("A 72-month term instead of 60",
 * "Put $1,000 more down"). Falls back to the backend label.
 */
export function changeInWords(alt: Alternative, base?: Alternative): string {
  const lv = alt.lever_values ?? {};
  const bv = base?.lever_values ?? {};
  const parts: string[] = [];

  const term = leverStr(lv.term_months);
  const baseTerm = leverStr(bv.term_months);
  if (term && term !== baseTerm) parts.push(baseTerm ? `a ${term}-month term instead of ${baseTerm}` : `a ${term}-month term`);

  const down = leverStr(lv.cash_down_delta);
  const downN = comparable(down);
  if (down && downN !== null && downN > 0) parts.push(`${wholeMoney(down)} more down`);

  if (lv.remove_optional_add_ons === true && bv.remove_optional_add_ons !== true) parts.push("optional add-ons removed");

  const offer = leverStr(lv.offer_id);
  const baseOffer = leverStr(bv.offer_id);
  if (offer && baseOffer && offer !== baseOffer) parts.push("a different offer");

  if (!parts.length) return alt.label;
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type DeltaDirection = "lower" | "higher" | "same" | "unknown";

export interface DeltaItem {
  key: "monthly_payment" | "finance_charge" | "savings_after_purchase";
  label: string;
  /** Signed, formatted backend delta ("−$55.36", "+$516.25") or "No change". */
  text: string;
  /** The alternative's own value, formatted ("$319.78"). */
  value: string;
  direction: DeltaDirection;
}

const DELTA_DEFS: { key: DeltaItem["key"]; label: string }[] = [
  { key: "monthly_payment", label: "Monthly payment" },
  { key: "finance_charge", label: "Finance charge" },
  { key: "savings_after_purchase", label: "Savings after purchase" },
];

/** The three deltas that matter, straight from deltas_vs_base (formatted, signed). */
export function deltaItems(alt: Alternative): DeltaItem[] {
  return DELTA_DEFS.map(({ key, label }) => {
    const d = alt.deltas_vs_base?.[key] ?? null;
    const n = comparable(d);
    const direction: DeltaDirection = n === null ? "unknown" : n === 0 ? "same" : n < 0 ? "lower" : "higher";
    return {
      key,
      label,
      text: direction === "same" ? "No change" : formatSignedMoney(d),
      value: formatMoney(alt.metrics?.[key] ?? null),
      direction,
    };
  });
}

/** Compact one-liner of the non-zero deltas: "Payment −$37.52 · Finance charge −$250.76 · Savings −$2,000.00". */
export function deltaSummaryLine(alt: Alternative): string {
  const short: Record<DeltaItem["key"], string> = {
    monthly_payment: "Payment",
    finance_charge: "Finance charge",
    savings_after_purchase: "Savings",
  };
  const parts = deltaItems(alt)
    .filter((d) => d.direction === "lower" || d.direction === "higher")
    .map((d) => `${short[d.key]} ${d.text}`);
  return parts.length ? parts.join(" · ") : "Same payment, finance charge and savings";
}

function abs(s: string): string {
  return formatMoney(s.replace(/^-/, ""));
}

/**
 * The trade-off in one sentence, built only from deltas_vs_base: what improves, then what it costs.
 * e.g. "Your payment drops by $55.36 a month, but the finance charge rises by $516.25."
 */
export function tradeOffSentence(alt: Alternative): string {
  const gains: string[] = [];
  const costs: string[] = [];
  const d = alt.deltas_vs_base ?? {};

  const pay = comparable(d.monthly_payment);
  if (pay !== null && pay !== 0) {
    (pay < 0 ? gains : costs).push(`your payment ${pay < 0 ? "drops" : "rises"} by ${abs(d.monthly_payment as string)} a month`);
  }
  const fc = comparable(d.finance_charge);
  if (fc !== null && fc !== 0) {
    (fc < 0 ? gains : costs).push(`the finance charge ${fc < 0 ? "drops" : "rises"} by ${abs(d.finance_charge as string)}`);
  }
  const sav = comparable(d.savings_after_purchase);
  if (sav !== null && sav !== 0) {
    if (sav > 0) gains.push(`you keep ${abs(d.savings_after_purchase as string)} more in savings`);
    else costs.push(`${abs(d.savings_after_purchase as string)} more comes out of your savings`);
  }

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  if (gains.length && costs.length) return `${cap(list(gains))}, but ${list(costs)}.`;
  if (gains.length) return `${cap(list(gains))}, with no change to the other figures shown.`;
  if (costs.length) return `${cap(list(costs))}.`;
  return "The payment, finance charge and savings stay the same.";
}

/** Plain-language text for each assumption flag (backend flags, plus lever-implied ones if unflagged). */
export const ALT_FLAG_TEXT: Record<string, string> = {
  ...ASSUMPTION_FLAG_TEXT,
  same_rate_assumed: "Same rate assumed — ask the lender",
  extra_down_from_savings: "Extra down payment comes from savings",
  optional_add_ons_removed: "Optional add-ons removed",
  term_gt_60: "Term over 60 months",
};

export function assumptionBadges(alt: Alternative): string[] {
  const flags = [...(alt.assumption_flags ?? [])];
  const lv = alt.lever_values ?? {};
  const downN = comparable(leverStr(lv.cash_down_delta));
  if (downN !== null && downN > 0 && !flags.includes("extra_down_from_savings")) flags.push("extra_down_from_savings");
  if (lv.remove_optional_add_ons === true && !flags.includes("optional_add_ons_removed")) flags.push("optional_add_ons_removed");
  return flags.map((f) => ALT_FLAG_TEXT[f] ?? f.replace(/_/g, " "));
}

/** Formula evidence ids behind an alternative's figures (same formulas as your offer). */
export const ALT_FORMULA_EVIDENCE = ["ev_calc_F01", "ev_calc_F03", "ev_calc_F13"];
