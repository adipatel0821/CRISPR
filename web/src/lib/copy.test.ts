// Display copy helpers: dash-free normalisation, scenario titles from structured data, id-keyed wording.
// Expected values are written by hand. Run: npm test (node --test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  altFlagNote,
  assumptionText,
  assumptionTitle,
  loanChip,
  copyIssues,
  countWord,
  flagSentence,
  flagTitle,
  metricName,
  oneTimeExpense,
  plain,
  scenarioName,
  scenarioNeedsRunningCosts,
  scenarioQuestion,
  scenarioTitle,
  zeroIncomeMonths,
  changedIncomeMonths,
  moneyText,
} from "./copy.ts";
import type { DecisionReport } from "./contracts.ts";

const FIXTURE: DecisionReport = JSON.parse(readFileSync(new URL("../fixtures/report.json", import.meta.url), "utf8"));
const scenario = (id: string, run = "with_offer") => FIXTURE.scenarios.find((s) => s.scenario_id === id && s.run === run)!;
const DASHES = /[–—]/;

test("plain: numeric ranges read 'to'", () => {
  assert.equal(plain("No income for 2 months (months 2–3)"), "No income for 2 months (months 2 to 3)");
  assert.equal(plain("Take-home pay 25% lower in months 2 – 4"), "Take-home pay 25% lower in months 2 to 4");
  assert.equal(plain("$1,000–$2,000"), "$1,000 to $2,000");
  assert.equal(plain("10%—20%"), "10% to 20%");
});

test("plain: spaced dashes become commas, or a full stop between sentences", () => {
  assert.equal(plain("Same rate assumed — ask the lender"), "Same rate assumed, ask the lender");
  assert.equal(
    plain("Your savings would go from $6,000 to $2,000 after the down payment — about 0.61 months of essential costs."),
    "Your savings would go from $6,000 to $2,000 after the down payment, about 0.61 months of essential costs.",
  );
  assert.equal(plain("It was read from the contract — Check it before signing."), "It was read from the contract. Check it before signing.");
  assert.equal(plain("Dealer offer A – 60 months"), "Dealer offer A, 60 months");
  assert.equal(plain("word—word"), "word, word");
});

test("plain: tidies what a dash leaves behind and never touches minus signs or hyphens", () => {
  assert.equal(plain("Not included —."), "Not included.");
  assert.equal(plain("— leading dash"), "leading dash");
  assert.equal(plain("trailing dash —"), "trailing dash");
  assert.equal(plain("Change −$50.00 on 2026-10-25"), "Change −$50.00 on 2026-10-25");
  assert.equal(plain("Take-home pay, -50.00 and −50"), "Take-home pay, -50.00 and −50");
  assert.equal(plain("two  spaces , then comma"), "two spaces, then comma");
  assert.equal(plain(null), "");
  assert.equal(plain(undefined), "");
  assert.equal(plain("Already plain."), "Already plain.");
});

test("plain removes every dash from the fixture's backend strings", () => {
  const texts = [
    ...FIXTURE.claims.map((c) => c.text ?? ""),
    ...FIXTURE.scenarios.map((s) => s.name ?? ""),
    ...FIXTURE.evidence.map((e) => e.display_label),
    ...(FIXTURE.assumptions ?? []).map((a) => a.text),
  ];
  for (const t of texts) assert.doesNotMatch(plain(t), DASHES, t);
  // and keeps every number
  for (const t of texts) {
    const nums = (s: string) => (s.match(/\d[\d,.]*/g) ?? []).join(" ");
    assert.equal(nums(plain(t)), nums(t), t);
  }
});

test("scenario counts come from the monthly paths (counting and comparing only)", () => {
  assert.equal(zeroIncomeMonths(scenario("sc_job_loss")), 2);
  assert.equal(changedIncomeMonths(scenario("sc_income_cut")), 3);
  assert.deepEqual(oneTimeExpense(scenario("sc_expense_spike")), { amount: "2900.00", month: 2 });
  assert.equal(zeroIncomeMonths({ scenario_id: "x", monthly_paths: [] }), 0);
  assert.equal(countWord(2), "two");
  assert.equal(countWord(13), "13");
  assert.equal(moneyText("2900.00"), "$2,900");
  assert.equal(moneyText("375.14"), "$375.14");
  assert.equal(moneyText("-50.00"), "−$50");
  assert.equal(moneyText(null), "Not known");
});

test("scenarioTitle / scenarioQuestion use backend data only", () => {
  assert.equal(scenarioTitle(scenario("sc_job_loss")), "Income stops for two months");
  assert.equal(scenarioQuestion(scenario("sc_job_loss")), "What if your income stopped for two months?");
  assert.equal(scenarioTitle(scenario("sc_expense_spike")), "Unexpected $2,900 expense");
  assert.equal(scenarioQuestion(scenario("sc_expense_spike")), "What if an unexpected $2,900 expense came up in month 2?");
  assert.equal(scenarioTitle(scenario("sc_income_cut")), "Take-home pay drops 25% for three months");
  assert.equal(scenarioQuestion(scenario("sc_income_cut")), "What if your take-home pay dropped 25% for three months?");
  // live catalog names
  assert.equal(scenarioTitle({ scenario_id: "sc_cost_rise", name: "Illustrative: vehicle cost change 20% higher" }), "Car running costs rise 20%");
  assert.equal(scenarioQuestion({ scenario_id: "sc_cost_rise", name: "Illustrative: vehicle cost change 20% higher" }), "What if running the car cost 20% more?");
  assert.equal(scenarioTitle({ scenario_id: "sc_low_month", name: "Illustrative: every month is a slow month" }), "Every month is a slow month");
  assert.equal(scenarioQuestion({ scenario_id: "sc_low_month" }), "What if every month were a slow month?");
  assert.equal(scenarioNeedsRunningCosts("sc_cost_rise"), true);
  assert.equal(scenarioNeedsRunningCosts("sc_job_loss"), false);
});

test("scenario wording falls back to the cleaned backend name", () => {
  assert.equal(scenarioName({ scenario_id: "sc_x", name: "Illustrative: rent rises — months 2–3" }), "Rent rises, months 2 to 3");
  assert.equal(scenarioTitle({ scenario_id: "sc_new", name: "Illustrative: rent rises" }), "Rent rises");
  assert.equal(scenarioTitle({ scenario_id: "sc_job_loss", name: "No income for 2 months (months 2–3)", monthly_paths: [] }), "No income for 2 months (months 2 to 3)");
  assert.equal(scenarioQuestion({ scenario_id: "sc_unknown_thing" }), "Unknown thing");
  for (const s of FIXTURE.scenarios) {
    assert.doesNotMatch(scenarioTitle(s), DASHES);
    assert.doesNotMatch(scenarioQuestion(s), DASHES);
  }
});

test("metricName, flagTitle, flagSentence, assumptionText, altFlagNote: human wording, no ids, no dashes", () => {
  assert.equal(metricName("monthly_left_after"), "Left each month with the loan");
  assert.equal(metricName("total_paid_through_deal"), "Total paid through the deal");
  assert.equal(metricName("some_new_metric"), "Some new metric");
  assert.equal(metricName("some_new_metric", "Backend — label"), "Backend, label");
  assert.equal(flagTitle("RESERVE_LT_1_MONTH"), "Less than a month of savings left");
  assert.equal(flagSentence({ flag_id: "DEFICIT_AFTER_LOAN", detail: "x" }), "With this loan, your monthly costs would be higher than your take-home pay.");
  assert.equal(flagSentence({ flag_id: "NEW_FLAG", detail: "Something — new" }), "Something, new");
  assert.equal(flagSentence("NEW_FLAG"), "New flag");
  assert.match(assumptionText("a_no_running_costs", "backend"), /running costs/);
  assert.equal(assumptionText("a_unknown", "Illustrative — a thing"), "Illustrative, a thing");
  assert.equal(assumptionText("a_unknown"), "This figure rests on an assumption.");
  assert.equal(altFlagNote("same_rate_assumed"), "Assumes the same rate. Ask the lender.");
  assert.equal(altFlagNote("odd_flag"), "Odd flag");
  for (const id of ["a_no_running_costs", "a_not_replacing", "a_pfc_zero", "a_rate_from_apr", "a_illustrative_scenarios", "a_gap_no_interest"]) {
    const t = assumptionText(id);
    assert.doesNotMatch(t, DASHES);
    assert.doesNotMatch(t, /\ba_[a-z_]+\b|\bF\d{2}\b/);
  }
  for (const id of ["TERM_GT_60", "NEGATIVE_EQUITY_AT_START", "DEFICIT_BEFORE_LOAN", "DEFICIT_AFTER_LOAN", "RESERVE_LT_1_MONTH", "ADD_ONS_FINANCED", "PREPAYMENT_PENALTY", "PAYMENT_MISMATCH", "PFC_ASSUMED_ZERO"]) {
    assert.doesNotMatch(flagTitle(id) + flagSentence(id), /[–—!]|_/);
    assert.deepEqual(copyIssues(flagSentence(id)).banned, []);
  }
});

test("loanChip formats the offer's own terms and never computes", () => {
  assert.deepEqual(loanChip(FIXTURE.offer), {
    text: "$20,000 · 60 mo · 4.75%",
    spoken: "Your loan: $20,000 over 60 months at 4.75% interest",
  });
  // APR stands in only when there is no contract rate, and says so
  assert.deepEqual(
    loanChip({ terms: { amount_financed: { value: "19500.00" }, term_months: { value: "72" }, apr: { value: "0.05796" } } }),
    { text: "$19,500 · 72 mo · 5.796% APR", spoken: "Your loan: $19,500 over 72 months at 5.796% APR" },
  );
  assert.deepEqual(loanChip({ terms: { principal: { value: "20000.50" } } }), { text: "$20,000.50", spoken: "Your loan: $20,000.50" });
  assert.equal(loanChip({ terms: { contract_rate: { value: "0.0475" } } }), null);
  assert.equal(loanChip({ terms: { principal: { value: null }, term_months: { value: "sixty" } } }), null);
  assert.equal(loanChip(null), null);
  assert.equal(loanChip({ terms: null }), null);
});

test("assumptionTitle names an assumption in a few words and never shows the id", () => {
  assert.equal(assumptionTitle("a_no_running_costs"), "Running costs not included");
  assert.equal(assumptionTitle("a_pfc_zero"), "Prepaid finance charges assumed $0");
  assert.equal(assumptionTitle("a_brand_new"), "Assumption");
});

test("copyIssues finds dashes, banned phrases and exclamation marks, and ignores the minus sign", () => {
  const r = copyIssues("Unlock robust insights — now! Change −$50 is fine.");
  assert.equal(r.dashes.length, 1);
  assert.deepEqual(r.banned, ["unlock", "robust"]);
  assert.equal(r.exclamations.length, 1);
  assert.deepEqual(copyIssues("Change −$50.00, 2026-10-25"), { dashes: [], banned: [], exclamations: [] });
  assert.deepEqual(copyIssues("It’s important to note this").banned, ["it's important to note"]);
});
