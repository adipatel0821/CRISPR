// Alternatives view helpers: they pick words and format backend strings, never compute money values.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assumptionBadges,
  baseAlternative,
  changeInWords,
  deltaItems,
  deltaSummaryLine,
  slotPlan,
  tradeOffSentence,
} from "./alt-view.ts";
import { highlightAlternatives } from "../../lib/insights.ts";
import type { Alternative, DecisionReport } from "../../lib/contracts.ts";

const FIXTURE: DecisionReport = JSON.parse(readFileSync(new URL("../../fixtures/report.json", import.meta.url), "utf8"));
const cf = FIXTURE.counterfactual!;
const byId = (id: string) => cf.alternatives.find((a) => a.alt_id === id) as Alternative;
const base = baseAlternative(cf);

function onlyBackendNumbers(text: string) {
  const corpus = JSON.stringify(FIXTURE);
  for (const n of text.match(/\d[\d,]*(\.\d+)?/g) ?? []) {
    assert.ok(corpus.includes(n.replace(/,/g, "")), `number ${n} in "${text}" is not a backend value`);
  }
}

test("slotPlan: fixture shows lower payment and lower total cost, and skips keep-more-savings", () => {
  const plan = slotPlan(highlightAlternatives(cf));
  assert.deepEqual(
    plan.cards.map((c) => [c.highlight.altId, c.slots]),
    [
      ["alt_t72", ["lowerPayment"]],
      ["alt_t36", ["lowerTotalCost"]],
    ],
  );
  assert.deepEqual(plan.skipped, ["preserveSavings"]);
});

test("slotPlan: one alternative winning two slots is shown once with both slots", () => {
  const h = highlightAlternatives(cf).map((x) => ({ ...x, slots: [...x.slots] }));
  h[0].slots.push("preserveSavings");
  const plan = slotPlan(h);
  assert.equal(plan.cards.length, 2);
  assert.deepEqual(plan.cards[0].slots, ["lowerPayment", "preserveSavings"]);
  assert.deepEqual(plan.skipped, []);
});

test("changeInWords: from lever values compared with the base", () => {
  assert.equal(base?.alt_id, "alt_base");
  assert.equal(changeInWords(byId("alt_t72"), base), "A 72-month term instead of 60");
  assert.equal(changeInWords(byId("alt_d2000"), base), "$2,000 more down");
  assert.equal(changeInWords(byId("alt_t48_d1000"), base), "A 48-month term instead of 60, $1,000 more down");
  assert.equal(changeInWords({ ...byId("alt_t36"), lever_values: {} }, base), "36 months");
});

test("deltaItems: signed backend deltas and the alternative's own values", () => {
  const items = deltaItems(byId("alt_t72"));
  assert.deepEqual(
    items.map((i) => [i.key, i.text, i.value, i.direction]),
    [
      ["monthly_payment", "−$55.36", "$319.78", "lower"],
      ["finance_charge", "+$516.25", "$3,524.54", "higher"],
      ["savings_after_purchase", "No change", "$2,000.00", "same"],
    ],
  );
  // infeasible: unknown, never $0
  const inf = deltaItems(byId("alt_d3000"));
  assert.ok(inf.every((i) => i.direction === "unknown" && i.text === "Not known" && i.value === "Not known"));
});

test("deltaSummaryLine: only non-zero deltas", () => {
  assert.equal(deltaSummaryLine(byId("alt_d2000")), "Payment −$37.52 · Finance charge −$250.76 · Savings −$2,000.00");
  assert.equal(deltaSummaryLine(byId("alt_t36")), "Payment +$222.04 · Finance charge −$1,009.97");
  assert.equal(deltaSummaryLine(byId("alt_base")), "Same payment, finance charge and savings");
});

test("tradeOffSentence: gains then costs, numbers only from the backend", () => {
  const t72 = tradeOffSentence(byId("alt_t72"));
  assert.equal(t72, "Your payment drops by $55.36 a month, but the finance charge rises by $516.25.");
  const d2000 = tradeOffSentence(byId("alt_d2000"));
  assert.equal(
    d2000,
    "Your payment drops by $37.52 a month and the finance charge drops by $250.76, but $2,000.00 more comes out of your savings.",
  );
  for (const a of cf.alternatives) onlyBackendNumbers(tradeOffSentence(a));
  assert.equal(tradeOffSentence(byId("alt_base")), "The payment, finance charge and savings stay the same.");
  for (const a of cf.alternatives) {
    const s = tradeOffSentence(a).toLowerCase();
    for (const banned of ["afford", "safe", "recommend", "best", "should", "verified"]) assert.ok(!s.includes(banned), s);
  }
});

test("assumptionBadges: backend flags in plain words, plus lever-implied ones", () => {
  assert.deepEqual(assumptionBadges(byId("alt_t72")), ["Same rate assumed — ask the lender", "Term over 60 months"]);
  assert.deepEqual(assumptionBadges(byId("alt_d1000")), ["Extra down payment comes from savings"]);
  assert.deepEqual(
    assumptionBadges({ ...byId("alt_d1000"), assumption_flags: ["extra_down_from_savings"] }),
    ["Extra down payment comes from savings"],
  );
  assert.deepEqual(
    assumptionBadges({ ...byId("alt_base"), lever_values: { remove_optional_add_ons: true } }),
    ["Optional add-ons removed"],
  );
});
