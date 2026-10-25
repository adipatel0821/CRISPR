/**
 * Display copy helpers (UX2). Pure and dependency-light so they run under `node --test`.
 *
 *  plain()            display normaliser for backend or fixture text: no em or en dashes on screen.
 *  scenarioTitle()    short row title for a stress scenario, from structured data (scenario_id + monthly paths).
 *  scenarioQuestion() the same scenario as a question ("What if your income stopped for two months?").
 *  metricName(), flagTitle(), flagSentence(), assumptionText(), altFlagNote()
 *                     concise human wording keyed by id, falling back to plain(backend text). No ids on screen.
 *  assumptionTitle()  a few words naming an assumption ("Running costs not included").
 *  loanChip()         the app bar's loan summary ("$20,000 · 60 mo · 4.75%") from offer terms (formatting only).
 *  copyIssues()       dashes, banned phrases and exclamation marks in a string (same list as e2e/lib/density.mjs).
 *
 * No arithmetic on money: numbers are read from backend data, counted, compared or formatted, never derived.
 */
import { formatMoney, formatRate } from "./format.ts";

/* ------------------------------------------------------------------------------------------------ */
/* plain(): display normaliser                                                                       */
/* ------------------------------------------------------------------------------------------------ */

const DASH = "\u2013\u2014"; // en dash, em dash (U+2212 minus and "-" are never touched)

function tidy(s: string): string {
  return s
    .replace(/[ \t ]{2,}/g, " ")
    .replace(/^[\s,;]+/, "")
    .replace(/[ \t]+([,.;:!?)])/g, "$1")
    .replace(/,\s*([.;:!?)])/g, "$1")
    .replace(/,{2,}/g, ",")
    .replace(/(?<!\.)\.\.(?!\.)/g, ".")
    .replace(/\(\s+/g, "(")
    .replace(/[\s,;]+$/, "")
    .trim();
}

/**
 * Display normaliser for text that comes from the backend or fixtures (claims, scenario names, assumption
 * texts, evidence labels, question texts, error messages). It changes punctuation only:
 *  - an en or em dash between numbers becomes " to " ("months 2–3" -> "months 2 to 3");
 *  - a spaced dash that starts a new sentence (next word capitalised) becomes a full stop;
 *  - any other dash becomes a comma ("Same rate assumed — ask the lender" -> "Same rate assumed, ask the lender");
 *  - doubled spaces and punctuation left behind are tidied.
 * The minus sign (U+2212) and hyphen-minus are never changed, so "−$50.00" and "2026-10-25" stay as they are.
 */
export function plain(text: string | null | undefined): string {
  if (text === null || text === undefined) return "";
  let s = String(text);
  if (!new RegExp(`[${DASH}]`).test(s)) return tidy(s);
  // 1. numeric ranges: "2–3", "2 – 4", "$1,000–$2,000", "10%–20%"
  s = s.replace(new RegExp(`(\\d[\\d,.]*%?)\\s*[${DASH}]\\s*(?=[$\\u2212]?\\d)`, "g"), "$1 to ");
  // 2. a spaced dash that joins two sentences
  s = s.replace(new RegExp(`\\s+[${DASH}]\\s+(?=[A-Z][a-z])`, "g"), ". ");
  // 3. every other dash, spaced or not
  s = s.replace(new RegExp(`\\s*[${DASH}]+\\s*`, "g"), ", ");
  return tidy(s);
}

/**
 * Money for running text: formatMoney() without a ".00" tail ("2900.00" -> "$2,900", "375.14" -> "$375.14").
 * String formatting only; non-zero cents are always kept, so the value stays exact.
 */
export function moneyText(s: string | null | undefined): string {
  const f = formatMoney(s);
  return f.endsWith(".00") ? f.slice(0, -3) : f;
}

/** First letter upper-case (display only). */
export function sentenceCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/* ------------------------------------------------------------------------------------------------ */
/* Scenarios                                                                                         */
/* ------------------------------------------------------------------------------------------------ */

export interface ScenarioMonthLike {
  month: number;
  income: string;
  one_time?: string | null;
}

export interface ScenarioLike {
  scenario_id: string;
  name?: string | null;
  monthly_paths?: readonly ScenarioMonthLike[] | null;
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** 2 -> "two" (0 to 12), otherwise the digits. Formatting of a count, not arithmetic. */
export function countWord(n: number): string {
  return Number.isInteger(n) && n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n);
}

function months(n: number): string {
  return `${countWord(n)} ${n === 1 ? "month" : "months"}`;
}

/** Decimal string to number for COMPARISON ONLY. */
function cmp(s: unknown): number | null {
  return typeof s === "string" && /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

/** Months with zero income (job loss). */
export function zeroIncomeMonths(r: ScenarioLike): number {
  return (r.monthly_paths ?? []).filter((m) => cmp(m.income) === 0).length;
}

/** Months whose income differs from the first month (income cut). */
export function changedIncomeMonths(r: ScenarioLike): number {
  const paths = r.monthly_paths ?? [];
  const first = cmp(paths[0]?.income);
  if (first === null) return 0;
  return paths.filter((m) => {
    const v = cmp(m.income);
    return v !== null && v !== first;
  }).length;
}

/** The first one-time expense in the paths (expense spike): the backend amount string and its month. */
export function oneTimeExpense(r: ScenarioLike): { amount: string; month: number } | null {
  const m = (r.monthly_paths ?? []).find((p) => (cmp(p.one_time) ?? 0) > 0);
  return m && typeof m.one_time === "string" ? { amount: m.one_time, month: m.month } : null;
}

/** A percentage written in the backend's scenario name ("... 25% lower ..."), or null. */
function percentInName(name: string | null | undefined): string | null {
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(name ?? "");
  return m ? `${m[1]}%` : null;
}

/** Backend scenario name without the "Illustrative:" prefix, normalised for display. */
export function scenarioName(r: ScenarioLike): string {
  const raw = r.name ?? r.scenario_id.replace(/^sc_/, "").replace(/_/g, " ");
  return sentenceCase(plain(raw.replace(/^\s*illustrative\s*[:\-–—]\s*/i, "")));
}

/** Short row title, e.g. "Income stops for two months". Numbers come from the scenario's own data. */
export function scenarioTitle(r: ScenarioLike): string {
  switch (r.scenario_id) {
    case "sc_job_loss": {
      const n = zeroIncomeMonths(r);
      return n > 0 ? `Income stops for ${months(n)}` : scenarioName(r);
    }
    case "sc_expense_spike": {
      const s = oneTimeExpense(r);
      return s ? `Unexpected ${moneyText(s.amount)} expense` : scenarioName(r);
    }
    case "sc_income_cut": {
      const n = changedIncomeMonths(r);
      const pct = percentInName(r.name);
      if (n === 0) return scenarioName(r);
      return pct ? `Take-home pay drops ${pct} for ${months(n)}` : `Take-home pay drops for ${months(n)}`;
    }
    case "sc_cost_rise": {
      const pct = percentInName(r.name);
      return pct ? `Car running costs rise ${pct}` : "Car running costs rise";
    }
    case "sc_low_month":
      return "Every month is a slow month";
    default:
      return scenarioName(r);
  }
}

/** The scenario as a question, e.g. "What if your income stopped for two months?". */
export function scenarioQuestion(r: ScenarioLike): string {
  switch (r.scenario_id) {
    case "sc_job_loss": {
      const n = zeroIncomeMonths(r);
      return n > 0 ? `What if your income stopped for ${months(n)}?` : scenarioName(r);
    }
    case "sc_expense_spike": {
      const s = oneTimeExpense(r);
      return s ? `What if an unexpected ${moneyText(s.amount)} expense came up in month ${s.month}?` : scenarioName(r);
    }
    case "sc_income_cut": {
      const n = changedIncomeMonths(r);
      const pct = percentInName(r.name);
      if (n === 0) return scenarioName(r);
      return pct
        ? `What if your take-home pay dropped ${pct} for ${months(n)}?`
        : `What if your take-home pay dropped for ${months(n)}?`;
    }
    case "sc_cost_rise": {
      const pct = percentInName(r.name);
      return pct ? `What if running the car cost ${pct} more?` : "What if running the car cost more?";
    }
    case "sc_low_month":
      return "What if every month were a slow month?";
    default:
      return scenarioName(r);
  }
}

/** Scenarios whose result only means something when the new car's running costs are known. */
export function scenarioNeedsRunningCosts(scenarioId: string): boolean {
  return scenarioId === "sc_cost_rise";
}

/* ------------------------------------------------------------------------------------------------ */
/* Metrics, flags, assumptions                                                                       */
/* ------------------------------------------------------------------------------------------------ */

const METRIC_NAMES: Record<string, string> = {
  principal: "Principal",
  amount_financed: "Amount financed",
  monthly_payment: "Monthly payment",
  total_of_payments: "Total of payments",
  finance_charge: "Finance charge",
  interest: "Interest",
  total_paid_through_deal: "Total paid through the deal",
  apr_recomputed: "APR from these terms",
  ltv: "Loan compared with the car's value",
  negative_equity_at_start: "Owed beyond the car's value at the start",
  payment_to_take_home: "Payment as a share of take-home pay",
  dti_total: "Debt payments as a share of gross income",
  monthly_left_before: "Left each month now",
  monthly_left_after: "Left each month with the loan",
  incremental_vehicle_costs: "Change in car running costs",
  savings_after_purchase: "Savings after the down payment",
  reserve_months_before: "Months your savings cover now",
  reserve_months_after: "Months your savings cover with the loan",
  savings_months_of_income: "Savings in months of income",
  equity_timeline: "Equity over time",
  savings_balance: "Savings balance",
  max_unfunded_gap: "Largest shortfall",
};

/** Concise human name for a metric key ("monthly_left_after" -> "Left each month with the loan"). */
export function metricName(key: string, fallback?: string | null): string {
  if (METRIC_NAMES[key]) return METRIC_NAMES[key];
  if (fallback) return plain(fallback);
  const t = key.replace(/\[[^\]]*\]/g, "").replace(/[._]+/g, " ").trim();
  return sentenceCase(t);
}

const FLAG_TITLES: Record<string, string> = {
  TERM_GT_60: "Long loan term",
  NEGATIVE_EQUITY_AT_START: "Owing more than the car is worth",
  DEFICIT_BEFORE_LOAN: "Costs already above take-home pay",
  DEFICIT_AFTER_LOAN: "Costs above take-home pay with this loan",
  RESERVE_LT_1_MONTH: "Less than a month of savings left",
  ADD_ONS_FINANCED: "Add-ons are in the loan",
  PREPAYMENT_PENALTY: "Fee for paying off early",
  PAYMENT_MISMATCH: "Payment doesn't match the terms",
  PFC_ASSUMED_ZERO: "Prepaid finance charges assumed to be $0",
};

const FLAG_SENTENCES: Record<string, string> = {
  TERM_GT_60: "This loan runs longer than 60 months. Longer loans usually cost more in interest.",
  NEGATIVE_EQUITY_AT_START: "You would start this loan owing more than the car is worth.",
  DEFICIT_BEFORE_LOAN: "Your monthly costs are already higher than your take-home pay, before this loan.",
  DEFICIT_AFTER_LOAN: "With this loan, your monthly costs would be higher than your take-home pay.",
  RESERVE_LT_1_MONTH: "After the down payment, your savings would cover less than one month of essential costs.",
  ADD_ONS_FINANCED: "Optional add-ons are part of the loan, so you pay interest on them. Many can be declined.",
  PREPAYMENT_PENALTY: "The contract charges a fee if you pay the loan off early.",
  PAYMENT_MISMATCH: "The payment on the offer doesn't match what these terms produce. Ask the lender why.",
  PFC_ASSUMED_ZERO: "The offer doesn't list prepaid finance charges, so we assumed none. If there are some, the loan costs more.",
};

type FlagLike = string | { flag_id: string; detail?: string | null };

function flagId(flag: FlagLike): string {
  return typeof flag === "string" ? flag : flag.flag_id;
}

/** Short title for a flag ("RESERVE_LT_1_MONTH" -> "Less than a month of savings left"). */
export function flagTitle(flag: FlagLike, fallback?: string | null): string {
  const id = flagId(flag);
  if (FLAG_TITLES[id]) return FLAG_TITLES[id];
  if (fallback) return plain(fallback);
  return sentenceCase(id.toLowerCase().replace(/_/g, " "));
}

/** One plain sentence for a flag, falling back to plain(backend text) for unknown ids. */
export function flagSentence(flag: FlagLike, backendText?: string | null): string {
  const id = flagId(flag);
  if (FLAG_SENTENCES[id]) return FLAG_SENTENCES[id];
  const text = backendText ?? (typeof flag === "string" ? null : flag.detail);
  return text ? plain(text) : flagTitle(id);
}

const ASSUMPTION_TEXT: Record<string, string> = {
  a_no_running_costs:
    "New-car running costs (insurance, fuel, maintenance) weren't given, so none are added. If the car replaces your current one, we assume it costs the same to run.",
  a_not_replacing: "We don't know if this car replaces your current one, so your current car costs aren't subtracted.",
  a_pfc_zero: "Prepaid finance charges weren't stated, so we assume $0 and treat the amount financed as the principal.",
  a_rate_from_apr:
    "The contract interest rate wasn't given, so we used the APR. If there are prepaid finance charges, the real rate is a little lower.",
  a_illustrative_scenarios: "These scenarios are examples of how your plan responds. They are not forecasts.",
  a_gap_no_interest: "A shortfall beyond your savings shows as a gap. No interest or fees are added to it.",
  a_same_rate_assumed: "Other loan terms are shown at your offer's interest rate. A lender may price them differently.",
  a_no_job_benefits: "No unemployment benefits, severance or spending cuts are assumed while income stops.",
  a_job_loss_no_benefits: "No unemployment benefits or other income are assumed while income stops.",
  a_scenario_before_discretionary: "Flexible spending wasn't given, so these months are before any discretionary spending.",
  a_extra_down_from_savings: "Any extra down payment in an option comes out of your savings.",
  a_flexible_constant: "Flexible spending stays the same every month in these scenarios.",
};

/** Concise wording for an assumption id, falling back to plain(backend text). Never shows the id. */
export function assumptionText(id: string, backendText?: string | null): string {
  if (ASSUMPTION_TEXT[id]) return ASSUMPTION_TEXT[id];
  if (backendText) return plain(backendText);
  return "This figure rests on an assumption.";
}

const ASSUMPTION_TITLES: Record<string, string> = {
  a_no_running_costs: "Running costs not included",
  a_not_replacing: "Current car costs not subtracted",
  a_pfc_zero: "Prepaid finance charges assumed $0",
  a_rate_from_apr: "APR used as the interest rate",
  a_illustrative_scenarios: "Scenarios are examples",
  a_gap_no_interest: "No interest on a shortfall",
  a_same_rate_assumed: "Same rate assumed",
  a_no_job_benefits: "No benefits while income stops",
  a_job_loss_no_benefits: "No benefits while income stops",
  a_scenario_before_discretionary: "Before flexible spending",
  a_extra_down_from_savings: "Extra down payment from savings",
  a_flexible_constant: "Flexible spending stays the same",
};

/** A few words naming an assumption (for a list or a printed table). Never the id. */
export function assumptionTitle(id: string): string {
  return ASSUMPTION_TITLES[id] ?? "Assumption";
}

const ALT_FLAG_NOTES: Record<string, string> = {
  same_rate_assumed: "Assumes the same rate. Ask the lender.",
  same_lender_assumed: "Assumes the same lender agrees.",
  term_gt_60: "Longer than 60 months",
  pfc_assumed_zero: "Assumes $0 prepaid finance charges",
};

/** Short note for an alternative's assumption flag ("same_rate_assumed" -> "Assumes the same rate. Ask the lender."). */
export function altFlagNote(flag: string, backendText?: string | null): string {
  if (ALT_FLAG_NOTES[flag]) return ALT_FLAG_NOTES[flag];
  if (backendText) return plain(backendText);
  return sentenceCase(flag.replace(/_/g, " "));
}

/* ------------------------------------------------------------------------------------------------ */
/* Loan chip                                                                                         */
/* ------------------------------------------------------------------------------------------------ */

export interface OfferTermsLike {
  terms?: Record<string, { value?: string | null } | null | undefined> | null;
}

export interface LoanChipText {
  /** Compact visible text, e.g. "$20,000 · 60 mo · 4.75%". */
  text: string;
  /** Full sentence for assistive tech, e.g. "Your loan: $20,000 over 60 months at 4.75% interest". */
  spoken: string;
}

const DECIMAL = /^\d+(\.\d+)?$/;

/**
 * The app bar's loan summary, built only from the offer's own terms: principal (or amount financed), term in
 * months and the contract rate (or the APR, labelled as such). Formatting only. Returns null when the offer has
 * neither an amount nor a term.
 */
export function loanChip(offer: OfferTermsLike | null | undefined): LoanChipText | null {
  const t = offer?.terms ?? {};
  const amount = t.principal?.value ?? t.amount_financed?.value ?? null;
  const term = t.term_months?.value ?? null;
  const rate = t.contract_rate?.value ?? null;
  const apr = t.apr?.value ?? null;
  const shown: string[] = [];
  const said: string[] = [];
  if (typeof amount === "string" && DECIMAL.test(amount)) {
    shown.push(moneyText(amount));
    said.push(moneyText(amount));
  }
  if (typeof term === "string" && /^\d+$/.test(term)) {
    shown.push(`${term} mo`);
    said.push(`over ${term} months`);
  }
  if (shown.length === 0) return null;
  if (typeof rate === "string" && DECIMAL.test(rate)) {
    shown.push(formatRate(rate));
    said.push(`at ${formatRate(rate)} interest`);
  } else if (typeof apr === "string" && DECIMAL.test(apr)) {
    shown.push(`${formatRate(apr)} APR`);
    said.push(`at ${formatRate(apr)} APR`);
  }
  return { text: shown.join(" · "), spoken: `Your loan: ${said.join(" ")}` };
}

/* ------------------------------------------------------------------------------------------------ */
/* copyIssues(): editorial checks                                                                     */
/* ------------------------------------------------------------------------------------------------ */

/** Keep in sync with web/e2e/lib/density.mjs (BANNED_PHRASES) and the directive's list. */
export const BANNED_PHRASES: readonly string[] = [
  // copy-lint-disable (the list itself is not copy)
  "delve", "leverage", "unlock", "empower", "seamless", "robust", "cutting-edge", "cutting edge", "revolutionary",
  "transformative", "comprehensive insights", "navigate with confidence", "financial journey", "actionable insights",
  "tailored to your needs", "data-driven", "in today's world", "it's important to note", "it is important to note",
  "at the end of the day", "let's explore", "here's what you need to know", "whether you're", "not just",
  "game-changer", "game changer", "peace of mind", "rest assured", "elevate", "harness", "unleash", "supercharge",
  "intelligent", "ai-powered", "powered by ai", "effortless", "dive into", "deep dive",
  // copy-lint-enable
];

export interface CopyIssues {
  /** Each en or em dash with a little context around it. */
  dashes: string[];
  /** Banned phrases found (lower case). */
  banned: string[];
  /** Each "!" with context. */
  exclamations: string[];
}

function around(s: string, i: number): string {
  return s.slice(Math.max(0, i - 18), i + 19).replace(/\s+/g, " ").trim();
}

/** Dashes, banned phrases and exclamation marks in `text`. The minus sign U+2212 is not a dash. */
export function copyIssues(text: string): CopyIssues {
  const s = String(text ?? "");
  const dashes: string[] = [];
  const exclamations: string[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\u2013" || s[i] === "\u2014") dashes.push(around(s, i));
    else if (s[i] === "!") exclamations.push(around(s, i));
  }
  const lower = s.toLowerCase().replace(/’/g, "'");
  const banned = BANNED_PHRASES.filter((p) => lower.includes(p));
  return { dashes, banned, exclamations };
}
