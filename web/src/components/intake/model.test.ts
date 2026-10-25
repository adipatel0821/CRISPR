import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeFacts,
  answersLabel,
  answerStatus,
  intakeProgress,
  runningCostsUnknown,
  splitRefinements,
  RUNNING_COSTS_KEY,
} from "./model.ts";
import type { AnalysisReadiness, FinancialFact, QuestionCandidate } from "../../lib/contracts.ts";

const fact = (key: string, status: string, value: string | null = "1"): FinancialFact =>
  ({ key, status, value, value_type: "currency" }) as unknown as FinancialFact;
const ready = (id: string, available: boolean): AnalysisReadiness =>
  ({ analysis_id: id, available, awaiting_offer: false, required: [], missing: [], declined: [], reason: null }) as unknown as AnalysisReadiness;
const q = (fact_key: string): QuestionCandidate => ({ question_id: `q_${fact_key}`, fact_key }) as unknown as QuestionCandidate;

test("activeFacts drops superseded answers", () => {
  const facts = { a: fact("a", "provided"), b: fact("b", "superseded"), c: fact("c", "declined") };
  assert.deepEqual(activeFacts(facts).map((f) => f.key), ["a", "c"]);
  assert.deepEqual(activeFacts(null), []);
});

test("intakeProgress counts answers and backend readiness flags only", () => {
  const p = intakeProgress(
    { a: fact("a", "provided"), b: fact("b", "estimated"), c: fact("c", "superseded") },
    [ready("loan_cost", true), ready("cashflow_impact", false), ready("reserve_impact", true)],
  );
  assert.equal(p.answered, 2);
  assert.equal(p.ready, 2);
  assert.equal(p.total, 3);
  assert.deepEqual(p.dots, [
    { id: "loan_cost", available: true },
    { id: "cashflow_impact", available: false },
    { id: "reserve_impact", available: true },
  ]);
  assert.deepEqual(intakeProgress(undefined, undefined), { answered: 0, ready: 0, total: 0, dots: [] });
});

test("answersLabel wording", () => {
  assert.equal(answersLabel(0), "No answers yet");
  assert.equal(answersLabel(1), "1 answer");
  assert.equal(answersLabel(4), "4 answers");
});

test("running costs: unknown unless shared or estimated (declined / missing stay unknown, never $0)", () => {
  assert.equal(runningCostsUnknown({}), true);
  assert.equal(runningCostsUnknown({ [RUNNING_COSTS_KEY]: fact(RUNNING_COSTS_KEY, "declined", null) }), true);
  assert.equal(runningCostsUnknown({ [RUNNING_COSTS_KEY]: fact(RUNNING_COSTS_KEY, "assumed", "0") }), true);
  assert.equal(runningCostsUnknown({ [RUNNING_COSTS_KEY]: fact(RUNNING_COSTS_KEY, "provided", "250.00") }), false);
  assert.equal(runningCostsUnknown({ [RUNNING_COSTS_KEY]: fact(RUNNING_COSTS_KEY, "estimated", "200.00") }), false);
});

test("splitRefinements promotes the running-costs refinement only while it is unknown", () => {
  const refs = [q("income.variability"), q(RUNNING_COSTS_KEY), q("expenses.flexible.total")];
  const s = splitRefinements(refs, {});
  assert.equal(s.runningCosts?.fact_key, RUNNING_COSTS_KEY);
  assert.deepEqual(s.rest.map((r) => r.fact_key), ["income.variability", "expenses.flexible.total"]);
  const known = splitRefinements(refs, { [RUNNING_COSTS_KEY]: fact(RUNNING_COSTS_KEY, "provided", "250.00") });
  assert.equal(known.runningCosts, null);
  assert.equal(known.rest.length, 3);
  assert.deepEqual(splitRefinements(null, null), { runningCosts: null, rest: [] });
});

test("answerStatus wording", () => {
  assert.equal(answerStatus("Monthly take-home pay", "saved"), "Saved: Monthly take-home pay.");
  assert.equal(answerStatus("Savings you could use", "declined"), "Noted that you'd rather not share savings you could use.");
  assert.equal(answerStatus("X", "skipped"), "Skipped: X.");
  assert.equal(answerStatus("X", "updated"), "Updated: X.");
});
