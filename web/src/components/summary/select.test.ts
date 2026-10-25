// Decision summary figure / link choices: pure selection over backend strings (no money math).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decisionSummary } from "../../lib/insights.ts";
import type { DecisionReport } from "../../lib/contracts.ts";
import { alternativeFigure, pieceAlternative, pieceFigure, pieceLink } from "./select.ts";

const FIXTURE: DecisionReport = JSON.parse(readFileSync(new URL("../../fixtures/report.json", import.meta.url), "utf8"));
const clone = (): DecisionReport => JSON.parse(JSON.stringify(FIXTURE));

function onlyBackendNumbers(text: string, report: DecisionReport) {
  const corpus = JSON.stringify(report);
  for (const n of text.match(/\d[\d,]*(\.\d+)?/g) ?? []) {
    assert.ok(corpus.includes(n.replace(/,/g, "")), `number ${n} in "${text}" is not a backend value`);
  }
}

test("fixture: change figure is monthly left after, captioned with the before value", () => {
  const s = decisionSummary(FIXTURE);
  const f = pieceFigure(FIXTURE, s.change);
  assert.deepEqual(f, { value: "$474.86", caption: "left each month, from $900.00" });
});

test("fixture: concern figure is the largest unfunded gap", () => {
  const s = decisionSummary(FIXTURE);
  assert.equal(s.concern?.kind, "unfunded_gap");
  assert.deepEqual(pieceFigure(FIXTURE, s.concern), { value: "$4,975.42", caption: "largest shortfall beyond savings" });
  assert.deepEqual(pieceLink(s.concern), { href: "/stress", label: "See the stress test" });
});

test("fixture: next figure is the alternative's helpful delta (finance charge for 48 months)", () => {
  const s = decisionSummary(FIXTURE);
  const alt = pieceAlternative(FIXTURE, s.next);
  assert.equal(alt?.alt_id, "alt_t48");
  // cash concern order: savings (0.00, skipped) → payment (+83.18, not helpful) → finance charge (−508.69)
  assert.deepEqual(pieceFigure(FIXTURE, s.next, s.concern), { value: "−$508.69", caption: "finance charge, vs your offer" });
});

test("alternativeFigure prefers savings for cash concerns and cost otherwise", () => {
  const d1000 = FIXTURE.counterfactual!.alternatives.find((a) => a.alt_id === "alt_d1000")!;
  const cash = { kind: "reserve_low" } as never;
  const other = { kind: "term_long" } as never;
  // savings delta is negative (less savings) → not helpful; payment −18.76 is
  assert.deepEqual(alternativeFigure(d1000, cash), { value: "−$18.76", caption: "monthly payment, vs your offer" });
  assert.deepEqual(alternativeFigure(d1000, other), { value: "−$125.36", caption: "finance charge, vs your offer" });
  const none = { ...d1000, deltas_vs_base: { monthly_payment: "0.00", finance_charge: "10.00" } };
  assert.equal(alternativeFigure(none, other), null);
});

test("flag-based pieces show the related backend metric; running costs has no figure", () => {
  const r = clone();
  const reserve = { kind: "reserve_low", text: "", title: "", tone: "attention", claimIds: [], evidenceIds: [], href: "/dashboard" } as const;
  assert.deepEqual(pieceFigure(r, { ...reserve }), { value: "0.60 months", caption: "of expenses your savings would cover" });
  assert.deepEqual(pieceFigure(r, { ...reserve, kind: "term_long" }), { value: "60 months", caption: "loan term" });
  assert.deepEqual(pieceFigure(r, { ...reserve, kind: "payment_mismatch" }), { value: "$375.14", caption: "payment on the contract" });
  assert.equal(pieceFigure(r, { ...reserve, kind: "running_costs_missing" }), null);
  assert.deepEqual(pieceLink({ ...reserve, kind: "running_costs_missing", href: "/intake" }), { href: "/intake", label: "Add running costs" });
  assert.equal(pieceFigure(r, null), null);
  assert.equal(pieceLink(null), null);
});

test("unknown values never become a figure", () => {
  const r = clone();
  r.with_offer!.metrics.reserve_months_after.value = null;
  const piece = { kind: "reserve_low", text: "", title: "", tone: "attention", claimIds: [], evidenceIds: [], href: "/dashboard" } as const;
  assert.equal(pieceFigure(r, { ...piece }), null);
  assert.equal(pieceFigure(r, { ...piece, kind: "cashflow_change", figure: { before: "900.00", after: null } }), null);
});

test("every figure text uses only backend numbers", () => {
  const s = decisionSummary(FIXTURE);
  for (const p of [s.change, s.concern, s.next]) {
    const f = pieceFigure(FIXTURE, p, s.concern);
    if (f) onlyBackendNumbers(`${f.value} ${f.caption}`, FIXTURE);
  }
});
