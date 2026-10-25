// Scenario outcomes: plain sentences over ScenarioResult fields only (no money math).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { DecisionReport, ScenarioResult } from "../../lib/contracts.ts";
import { horizonMonths, orderByConsequence, runOutcome, scenarioSeverity, scenarioSummary, tileOutcome } from "./outcome.ts";

const FIXTURE: DecisionReport = JSON.parse(readFileSync(new URL("../../fixtures/report.json", import.meta.url), "utf8"));

function pair(id: string) {
  const runs = FIXTURE.scenarios.filter((s) => s.scenario_id === id);
  return { with: runs.find((s) => s.run === "with_offer"), without: runs.find((s) => s.run === "without_offer") };
}

test("job loss: savings run out with the loan, unfunded gap shown; consequential (gap)", () => {
  const p = pair("sc_job_loss");
  assert.deepEqual(runOutcome(p.with), {
    state: "gap",
    headline: "Savings run out in month 2",
    detail: "Shortfall beyond savings up to $4,975.42",
  });
  assert.equal(runOutcome(p.without).state, "holds");
  assert.equal(runOutcome(p.without).headline, "Savings last all 12 months");
  assert.equal(runOutcome(p.without).detail, "$8,400.00 left at month 12");
  assert.equal(scenarioSeverity(p), "gap");
  assert.equal(scenarioSummary(p), "With the loan, savings run out in month 2; without it, savings last all 12 months.");
});

test("expense spike: holds either way; not highlighted", () => {
  const p = pair("sc_expense_spike");
  assert.equal(scenarioSeverity(p), "none");
  assert.equal(scenarioSummary(p), "Savings last all 12 months, with or without the loan.");
  assert.equal(horizonMonths(p.with), 12);
});

test("savings depleted without a gap is attention; recovery month is mentioned", () => {
  const base = pair("sc_job_loss").with as ScenarioResult;
  const depleted = { ...base, max_unfunded_gap: "0.00" };
  assert.equal(runOutcome(depleted).state, "depleted");
  assert.equal(runOutcome(depleted).detail, null);
  assert.equal(scenarioSeverity({ with: depleted }), "attention");
  const recovered = { ...base, recovery_month: 6 };
  assert.equal(runOutcome(recovered).detail, "Shortfall beyond savings up to $4,975.42, covered again by month 6");
});

test("missing runs are 'Not calculated', never zero", () => {
  assert.deepEqual(runOutcome(undefined), { state: "unknown", headline: "Not calculated", detail: null });
  const p = pair("sc_job_loss");
  assert.equal(scenarioSummary({ with: p.with }), "With the loan, savings run out in month 2.");
  assert.equal(scenarioSummary({}), "This scenario wasn't calculated.");
  const noEnd = { ...(p.without as ScenarioResult), savings_end: null };
  assert.equal(runOutcome(noEnd).detail, null);
});

test("UX3: most consequential scenario first (largest shortfall with the loan); limited scenarios last", () => {
  const ids = [...new Set(FIXTURE.scenarios.map((s) => s.scenario_id))];
  const pairs = ids.map((id) => ({ scenarioId: id, ...pair(id) }));
  const ordered = orderByConsequence(pairs);
  assert.equal(ordered[0].scenarioId, "sc_job_loss");
  assert.equal(ordered.length, pairs.length);
  const limited = orderByConsequence(pairs, (x) => x.scenarioId === "sc_job_loss");
  assert.equal(limited[limited.length - 1].scenarioId, "sc_job_loss");
});

test("UX3: tile outcomes are short and paired with a tone", () => {
  const p = pair("sc_job_loss");
  assert.deepEqual(tileOutcome(p.with, false), { text: "Runs out in month 2", tone: "shortfall" });
  assert.deepEqual(tileOutcome(p.without, false), { text: "Lasts all 12 months", tone: "savings" });
  assert.deepEqual(tileOutcome(p.with, true), { text: "Needs running costs", tone: "caution" });
  assert.deepEqual(tileOutcome(undefined, false), { text: "Not calculated", tone: "neutral" });
});
