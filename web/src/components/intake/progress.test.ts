import { test } from "node:test";
import assert from "node:assert/strict";
import { missingFactKeys, railCount, railCountLabel } from "./progress.ts";
import { questionHeadline, shortFactLabel, valueTypeFor } from "./wording.ts";
import type { AnalysisReadiness, FinancialFact } from "../../lib/contracts.ts";

const fact = (key: string, status = "provided"): FinancialFact => ({ key, status, value: "1", value_type: "currency" }) as unknown as FinancialFact;
const ready = (id: string, missing: string[]): AnalysisReadiness =>
  ({ analysis_id: id, available: false, awaiting_offer: true, required: [], missing, declined: [], reason: null }) as unknown as AnalysisReadiness;

test("railCount counts answers and the distinct missing keys (offer terms and answered keys excluded)", () => {
  const facts = { a: fact("income.take_home_monthly"), b: fact("debts.count", "declined"), c: fact("savings.liquid", "superseded") };
  const readiness = [
    ready("cashflow_impact", ["expenses.essential.total", "offer.minimum_set"]),
    ready("reserve_impact", ["expenses.essential.total", "savings.liquid", "income.take_home_monthly"]),
  ];
  assert.deepEqual(railCount(facts, readiness), { answered: 2, remaining: 2 });
  assert.deepEqual(missingFactKeys(facts, readiness), ["expenses.essential.total", "savings.liquid"]);
});

test("railCountLabel says what is known, in words", () => {
  assert.equal(railCountLabel({ answered: 0, remaining: 0 }), "No answers yet");
  assert.equal(railCountLabel({ answered: 0, remaining: 5 }), "0 of 5 answered");
  assert.equal(railCountLabel({ answered: 3, remaining: 2 }), "3 of 5 answered");
  assert.equal(railCountLabel({ answered: 1, remaining: 0 }), "1 answer given");
  assert.equal(railCountLabel({ answered: 5, remaining: 0 }), "5 answers given");
});

test("questionHeadline uses frontend wording, but keeps backend detail when it matters", () => {
  const id = (s: string) => s;
  assert.equal(questionHeadline("income.take_home_monthly", "currency", "About how much...", id), "How much do you bring home each month?");
  assert.equal(questionHeadline("income.take_home_monthly", "currency_pair", "Typical and slow month?", id), "Typical and slow month?");
  assert.equal(questionHeadline("loan.down_payment_source", "choice", "Where will your down payment come from?", id), "Where will the down payment come from?");
  assert.equal(questionHeadline("loan.down_payment_source", "choice", "Where will the $4,000.00 down payment come from?", id), "Where will the $4,000.00 down payment come from?");
  assert.equal(questionHeadline("debts[d1].monthly_payment", "currency", "What is the monthly payment on debt 1?", id), "What is the monthly payment on debt 1?");
});

test("short labels and value types for skipped answers", () => {
  assert.equal(shortFactLabel("savings.liquid", "Savings you could use"), "Savings");
  assert.equal(shortFactLabel("debts[d1].type", "Debt 1: type"), "Debt 1: type");
  assert.equal(valueTypeFor("debts.count"), "integer");
  assert.equal(valueTypeFor("vehicle.replaces_current"), "boolean");
  assert.equal(valueTypeFor("loan.down_payment_source"), "enum");
  assert.equal(valueTypeFor("income.take_home_monthly"), "currency");
});
