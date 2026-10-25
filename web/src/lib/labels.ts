import { formatMoney, formatRate, humanizeKey } from "./format";

export const FACT_LABELS: Record<string, string> = {
  "income.take_home_monthly": "Monthly take-home pay",
  "income.variability": "How steady your income is",
  "income.low_month": "Take-home in a slow month",
  "income.gross_monthly": "Gross monthly income",
  "expenses.essential.total": "Essential monthly expenses",
  "expenses.current_vehicle_costs_monthly": "Current car costs (monthly)",
  "expenses.flexible.total": "Flexible monthly spending",
  "debts.count": "Number of other debts",
  "savings.liquid": "Savings you could use",
  "loan.down_payment_source": "Where the down payment comes from",
  "vehicle.replaces_current": "Replaces your current car",
  "vehicle.new_ownership_costs_monthly": "New car running costs (monthly)",
  "vehicle.value_estimates": "Your estimates of the car's value",
  "loan.buy_rate": "Lender's buy rate",
  "offer.minimum_set": "A loan offer (amount, rate and term)",
};

const DEBT_FIELD: Record<string, string> = {
  type: "type",
  monthly_payment: "monthly payment",
  balance: "balance",
  remaining_months: "months remaining",
  paid_off_by_transaction: "paid off by this purchase",
};

export function factLabel(key: string): string {
  if (FACT_LABELS[key]) return FACT_LABELS[key];
  const m = /^debts\[([^\]]+)\]\.([a-z_]+)$/.exec(key);
  if (m) return `Debt ${m[1].replace(/^d/, "")} — ${DEBT_FIELD[m[2]] ?? humanizeKey(m[2])}`;
  if (key.startsWith("debts.*")) return "Monthly payment on each debt";
  return humanizeKey(key);
}

export const CHOICE_LABELS: Record<string, string> = {
  stable: "About the same every month",
  somewhat_variable: "Varies somewhat",
  highly_variable: "Varies a lot",
  variable: "Varies",
  savings: "From my savings",
  other: "From somewhere else (gift, sale, other account)",
  none: "No down payment",
  true: "Yes",
  false: "No",
};

export function choiceLabel(v: string): string {
  return CHOICE_LABELS[v] ?? v;
}

/** Display a stored fact value by its value_type (formatting only). */
export function factValueText(value: string | null, valueType: string, key: string): string {
  if (value === null) return "—";
  if (valueType === "currency" || /(_monthly|\.total|\.liquid|monthly_payment|balance)$/.test(key)) {
    const f = formatMoney(value);
    return f === "Not known" ? value : f;
  }
  if (valueType === "rate") return formatRate(value);
  if (valueType === "boolean" || value === "true" || value === "false") return value === "true" ? "Yes" : "No";
  return choiceLabel(value);
}

export const TERM_LABELS: Record<string, string> = {
  cash_price: "Cash price",
  taxes_title_fees: "Taxes, title and fees",
  cash_down: "Cash down payment",
  trade_in_value: "Trade-in value",
  trade_in_payoff: "Trade-in payoff (owed on old car)",
  principal: "Principal (amount of the note)",
  amount_financed: "Amount financed",
  prepaid_finance_charges: "Prepaid finance charges",
  pfc_paid_in_cash: "Prepaid finance charges paid in cash",
  apr: "APR",
  contract_rate: "Contract (interest) rate",
  term_months: "Term",
  monthly_payment: "Monthly payment",
  finance_charge: "Finance charge",
  total_of_payments: "Total of payments",
  total_sale_price: "Total sale price",
  prepayment_penalty: "Prepayment penalty",
  late_fee: "Late fee",
  variable_rate: "Variable rate",
  balloon_payment: "Balloon payment",
};

export function termValueText(value: string | null, valueType: string): string {
  if (value === null) return "Not known";
  if (valueType === "rate") return formatRate(value);
  if (valueType === "integer") return `${value} months`;
  if (valueType === "boolean") return value === "true" ? "Yes" : "No";
  return formatMoney(value);
}

export const CHECK_LABELS: Record<string, string> = {
  quote_match: "Quote found in the document",
  label_anchor: "Next to the right label",
  independent_reader: "Second reader agrees",
  arithmetic: "Adds up with the other terms",
  itemization: "Matches the itemization",
  apr_recompute: "APR recomputes",
  range: "In a plausible range",
};
