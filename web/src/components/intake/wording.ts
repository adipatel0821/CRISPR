/**
 * Frontend wording for the intake questions, keyed by fact_key. The backend still decides WHICH question comes
 * next (adaptive logic unchanged); this only words the question for the screen. Unknown keys fall back to the
 * backend text through plain(). Dependency-free (type-free strings only) so it runs under `node --test`.
 */

export type QuestionArtKind = "income" | "spending" | "debts" | "savings" | "down" | "car" | "varies" | "other";

export interface QuestionWording {
  /** The question as the screen asks it. */
  headline: string;
  /** One short line of guidance under the question. */
  guidance?: string;
  /** Text after the amount, e.g. "a month". */
  suffix?: string;
  /** Short label for the rail ("Take-home pay"). */
  short: string;
  /** Which picture and icon fit the question. */
  art: QuestionArtKind;
}

const WORDING: Record<string, QuestionWording> = {
  "income.take_home_monthly": {
    headline: "How much do you bring home each month?",
    guidance: "Your pay after taxes in a typical month. A close estimate is fine.",
    suffix: "a month",
    short: "Take-home pay",
    art: "income",
  },
  "income.low_month": {
    headline: "How much do you bring home in a slow month?",
    guidance: "Your take-home pay in a month when work is quiet.",
    suffix: "a month",
    short: "Slow-month pay",
    art: "varies",
  },
  "expenses.essential.total": {
    headline: "What do your essentials cost each month?",
    guidance: "Housing, food, utilities, insurance and getting around.",
    suffix: "a month",
    short: "Essentials",
    art: "spending",
  },
  "debts.count": {
    headline: "How many monthly debt payments do you have?",
    guidance: "Loans, credit cards and buy now, pay later plans. Enter 0 if you have none.",
    short: "Other debts",
    art: "debts",
  },
  "savings.liquid": {
    headline: "How much savings could you use in an emergency?",
    guidance: "Money in checking, savings or cash that you could reach quickly.",
    short: "Savings",
    art: "savings",
  },
  "loan.down_payment_source": {
    headline: "Where will the down payment come from?",
    guidance: "A down payment from savings lowers what you keep in reserve.",
    short: "Down payment",
    art: "down",
  },
  "expenses.flexible.total": {
    headline: "How much do you spend on extras each month?",
    guidance: "Eating out, entertainment and subscriptions. Things you could cut back on.",
    suffix: "a month",
    short: "Flexible spending",
    art: "spending",
  },
  "vehicle.replaces_current": {
    headline: "Will the new car replace one you have now?",
    guidance: "If it does, the costs of your current car can stop.",
    short: "Replaces current car",
    art: "car",
  },
  "expenses.current_vehicle_costs_monthly": {
    headline: "What does your current car cost you each month?",
    guidance: "Insurance, fuel and maintenance that are part of your essentials. Not a loan payment.",
    suffix: "a month",
    short: "Current car costs",
    art: "car",
  },
  "vehicle.new_ownership_costs_monthly": {
    headline: "What will the new car cost to run each month?",
    guidance: "Insurance, fuel and maintenance for the new car.",
    suffix: "a month",
    short: "New car running costs",
    art: "car",
  },
  "income.variability": {
    headline: "Does your take-home pay change from month to month?",
    guidance: "If it varies, the stress test can include a slow month.",
    short: "Income changes",
    art: "varies",
  },
  "income.gross_monthly": {
    headline: "What is your monthly income before taxes?",
    guidance: "Your gross pay, before taxes and deductions.",
    suffix: "a month",
    short: "Gross income",
    art: "income",
  },
};

/** Wording for a fact key, or null when the screen should use the backend's own text. */
export function questionWording(factKey: string): QuestionWording | null {
  return WORDING[factKey] ?? null;
}

/**
 * The headline to show. The backend text is used when it carries details the fixed wording would lose:
 * the slow-month pair, a named debt, or an offer-specific down payment amount.
 */
export function questionHeadline(factKey: string, kind: string, backendText: string, plainText: (s: string) => string): string {
  const w = WORDING[factKey];
  if (!w || kind === "currency_pair") return plainText(backendText);
  if (factKey === "loan.down_payment_source" && /\$\d/.test(backendText)) return plainText(backendText);
  return w.headline;
}

/** Short rail label for a fact ("Take-home pay"); falls back to the given label. */
export function shortFactLabel(factKey: string, fallback: string): string {
  return WORDING[factKey]?.short ?? fallback;
}

/** The value type of a fact the person has not answered yet (for the "add your answer" form). */
export function valueTypeFor(factKey: string): string {
  if (factKey === "debts.count" || /remaining_months$/.test(factKey)) return "integer";
  if (factKey === "vehicle.replaces_current" || /paid_off_by_transaction$/.test(factKey)) return "boolean";
  if (factKey in EDIT_CHOICES || /\.type$/.test(factKey)) return "enum";
  return "currency";
}

/** Choices for facts that can be edited from the rail with tiles instead of a text box (enum keys the API accepts). */
export const EDIT_CHOICES: Record<string, { value: string; label: string }[]> = {
  "loan.down_payment_source": [
    { value: "savings", label: "From my savings" },
    { value: "other", label: "From somewhere else" },
    { value: "none", label: "No down payment" },
  ],
  "income.variability": [
    { value: "stable", label: "About the same every month" },
    { value: "somewhat_variable", label: "It varies somewhat" },
    { value: "highly_variable", label: "It varies a lot" },
  ],
};
