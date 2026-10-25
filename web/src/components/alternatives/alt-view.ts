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
import { plain } from "../../lib/copy.ts";

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
  const unknown: string[] = [];   // a missing delta is unknown — never described as "no change"
  const d = alt.deltas_vs_base ?? {};
  if (comparable(d.monthly_payment) === null) unknown.push("the monthly payment");
  if (comparable(d.finance_charge) === null) unknown.push("the finance charge");
  if (comparable(d.savings_after_purchase) === null) unknown.push("your savings");

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
  const unknownNote = unknown.length ? ` We can't say how it changes ${list(unknown)}, because that figure isn't known.` : "";
  if (gains.length && costs.length) return `${cap(list(gains))}, but ${list(costs)}.${unknownNote}`;
  if (gains.length) return unknown.length
    ? `${cap(list(gains))}.${unknownNote}`
    : `${cap(list(gains))}, with no change to the other figures shown.`;
  if (costs.length) return `${cap(list(costs))}.${unknownNote}`;
  return unknown.length ? `No known change.${unknownNote}` : "The payment, finance charge and savings stay the same.";
}

/** Plain-language text for each assumption flag (backend flags, plus lever-implied ones if unflagged). */
export const ALT_FLAG_TEXT: Record<string, string> = {
  ...ASSUMPTION_FLAG_TEXT,
  same_rate_assumed: "Same rate assumed, ask the lender",
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
  return flags.map((f) => plain(ALT_FLAG_TEXT[f] ?? f.replace(/_/g, " ")));
}

/* ------------------------------------------------------------------------------------------------ */
/* UX3 option cards: one headline figure per card, the benefit and the trade-off in plain words.      */
/* Every amount is a backend string (metrics / deltas_vs_base), only formatted here.                  */
/* ------------------------------------------------------------------------------------------------ */

export type CompareKey = DeltaItem["key"];

export interface Headline {
  /** The metric the card leads with. */
  key: CompareKey;
  /** What the big number is ("Monthly payment"). */
  label: string;
  /** The alternative's own figure, formatted ("$319.78"). */
  value: string;
  /** Quiet unit after the figure ("a month"). */
  unit: string;
  /** The benefit against your offer, from the backend delta ("$55.36 a month less than your offer"). */
  benefit: string | null;
}

const SLOT_METRIC: Record<HighlightSlot, CompareKey> = {
  preserveSavings: "savings_after_purchase",
  lowerPayment: "monthly_payment",
  lowerTotalCost: "finance_charge",
};

/** The slot a card leads with: the first of its slots in SLOT_ORDER. */
export function leadSlot(slots: HighlightSlot[]): HighlightSlot {
  return SLOT_ORDER.find((s) => slots.includes(s)) ?? slots[0] ?? "lowerPayment";
}

/** Headline figure for an option card, chosen by the slot it won. */
export function headline(alt: Alternative, slot: HighlightSlot): Headline {
  const key = SLOT_METRIC[slot];
  const d = alt.deltas_vs_base?.[key] ?? null;
  const n = comparable(d);
  const amount = n !== null && n !== 0 ? abs(d as string) : null;
  const lower = n !== null && n < 0;
  if (key === "monthly_payment") {
    return {
      key,
      label: "Monthly payment",
      value: formatMoney(alt.metrics?.monthly_payment ?? null),
      unit: "a month",
      benefit: amount ? `${amount} a month ${lower ? "less" : "more"} than your offer` : null,
    };
  }
  if (key === "finance_charge") {
    return {
      key,
      label: "Finance charge",
      value: formatMoney(alt.metrics?.finance_charge ?? null),
      unit: "over the loan",
      benefit: amount ? `${amount} ${lower ? "less" : "more"} in finance charges than your offer` : null,
    };
  }
  return {
    key,
    label: "Savings after the purchase",
    value: formatMoney(alt.metrics?.savings_after_purchase ?? null),
    unit: "left in savings",
    benefit: amount ? `${amount} ${lower ? "less" : "more"} left in savings than with your offer` : null,
  };
}

/**
 * The cost side of an option in one sentence, from deltas_vs_base only ("You pay $516.25 more in finance
 * charges."). Null when nothing we show gets worse. Unknown deltas are named, never called "no change".
 */
export function tradeOffOnly(alt: Alternative): string | null {
  const d = alt.deltas_vs_base ?? {};
  const costs: string[] = [];
  const pay = comparable(d.monthly_payment);
  if (pay !== null && pay > 0) costs.push(`your payment rises by ${abs(d.monthly_payment as string)} a month`);
  const fc = comparable(d.finance_charge);
  if (fc !== null && fc > 0) costs.push(`you pay ${abs(d.finance_charge as string)} more in finance charges`);
  const sav = comparable(d.savings_after_purchase);
  if (sav !== null && sav < 0) costs.push(`${abs(d.savings_after_purchase as string)} more comes out of your savings`);
  const unknown: string[] = [];
  if (pay === null) unknown.push("the monthly payment");
  if (fc === null) unknown.push("the finance charge");
  if (sav === null) unknown.push("your savings");
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const parts: string[] = [];
  if (costs.length) {
    const s = list(costs);
    parts.push(`${s.charAt(0).toUpperCase()}${s.slice(1)}.`);
  }
  if (unknown.length) parts.push(`We can't say how it changes ${list(unknown)}, because that figure isn't known.`);
  return parts.length ? parts.join(" ") : null;
}

export interface CompareRow {
  key: CompareKey;
  label: string;
  /** Formatted backend values. */
  offer: string;
  option: string;
  /** Backend numbers for the bar length only (null when unknown). */
  offerN: number | null;
  optionN: number | null;
  direction: DeltaDirection;
  /** "$55.36 less", "$516.25 more", "No change" or "Not known" (from the backend delta). */
  change: string;
}

const COMPARE_DEFS: { key: CompareKey; label: string }[] = [
  { key: "monthly_payment", label: "Monthly payment" },
  { key: "finance_charge", label: "Finance charge" },
  { key: "savings_after_purchase", label: "Savings after the purchase" },
];

/** Your offer vs the option for the three figures, all from backend metrics and deltas (no arithmetic). */
export function compareRows(alt: Alternative, base?: Alternative): CompareRow[] {
  return COMPARE_DEFS.map(({ key, label }) => {
    const d = alt.deltas_vs_base?.[key] ?? null;
    const n = comparable(d);
    const direction: DeltaDirection = n === null ? "unknown" : n === 0 ? "same" : n < 0 ? "lower" : "higher";
    const offerS = base?.metrics?.[key] ?? null;
    const optionS = alt.metrics?.[key] ?? null;
    return {
      key,
      label,
      offer: formatMoney(offerS),
      option: formatMoney(optionS),
      offerN: comparable(offerS),
      optionN: comparable(optionS),
      direction,
      change:
        direction === "unknown"
          ? "Not known"
          : direction === "same"
            ? "No change"
            : `${abs(d as string)} ${direction === "lower" ? "less" : "more"}`,
    };
  });
}

/** Formula evidence ids behind an alternative's figures (same formulas as your offer). */
export const ALT_FORMULA_EVIDENCE = ["ev_calc_F01", "ev_calc_F03", "ev_calc_F13"];
