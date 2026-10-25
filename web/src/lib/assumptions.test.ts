// D1-001 provenance honesty in the UI: a figure that rests on an assumption or estimate gets a visible caveat,
// with today's engine (assumption recorded, status "provided") and with the corrected one (status "assumed").
import { test } from "node:test";
import assert from "node:assert/strict";
import { metricCaveat, resultHasCaveat, type MetricCaveat } from "./assumptions.ts";
import type { DecisionReport } from "./contracts.ts";

const NO_RUNNING_TEXT =
  "New-car running costs (insurance, fuel, maintenance) were not provided, so they are not included; monthly figures show new-car running costs not included.";

// Shapes copied from a live POST /analysis on the demo path (4200 / 2900 / 0 debts / 6000, savings down payment,
// no refinements): F14 = 0.00 with a_no_running_costs. Values are irrelevant here — only provenance fields matter.
function m(value: string | null, status: string | null = null, extra: Record<string, unknown> = {}) {
  return { value, formula_id: "F", status, missing_inputs: null, basis: null, label: null, disclosed: null, mismatch: null, check: null, breakdown: null, before: null, after: null, ...extra };
}
interface Opts { derived?: string; used?: string[]; statuses?: Record<string, string>; assumptions?: { assumption_id: string; text: string }[] }
function report({ derived = "provided", used = [], statuses = {}, assumptions = [] }: Opts = {}): DecisionReport {
  const keys = ["monthly_payment", "finance_charge", "monthly_left_before", "incremental_vehicle_costs", "monthly_left_after",
    "savings_after_purchase", "reserve_months_before", "reserve_months_after"];
  const metrics = Object.fromEntries(keys.map((k) => [k, m("1.00", statuses[k] ?? null)]));
  metrics.dti_total = m(null, "missing");
  return ({
    with_offer: { derived_status: derived, assumptions_used: used, metrics },
    baseline: { derived_status: "provided", assumptions_used: [], metrics: { monthly_left_before: m("1300.00") } },
    assumptions,
  }) as unknown as DecisionReport;
}
const CAVEATED = (r: DecisionReport) =>
  ["monthly_payment", "finance_charge", "monthly_left_before", "incremental_vehicle_costs", "monthly_left_after",
    "savings_after_purchase", "reserve_months_before", "reserve_months_after", "dti_total"].filter((k) => metricCaveat(r, k));

test("today's engine: a_no_running_costs recorded, status provided -> F14, F09, F10 carry the caveat", () => {
  const r = report({ used: ["a_no_running_costs"], assumptions: [{ assumption_id: "a_no_running_costs", text: NO_RUNNING_TEXT }] });
  assert.deepEqual(CAVEATED(r), ["incremental_vehicle_costs", "monthly_left_after", "reserve_months_after"]);
  const c = metricCaveat(r, "monthly_left_after") as MetricCaveat;
  assert.equal(c.kind, "assumption");
  assert.equal(c.label, "Includes an assumption");
  assert.deepEqual(c.assumptions, [{ id: "a_no_running_costs", text: NO_RUNNING_TEXT }]);
  assert.equal(resultHasCaveat(r), true);
});

test("corrected engine (D1-001): derived_status assumed + metric status assumed -> same three figures", () => {
  const assumed = { incremental_vehicle_costs: "assumed", monthly_left_after: "assumed", reserve_months_after: "assumed" };
  const r = report({ derived: "assumed", used: ["a_no_running_costs"], statuses: assumed });
  assert.deepEqual(CAVEATED(r), ["incremental_vehicle_costs", "monthly_left_after", "reserve_months_after"]);
  // falls back to the built-in text when the report omits it
  assert.match(metricCaveat(r, "incremental_vehicle_costs")!.assumptions[0].text, /running costs/);
});

test("status assumed with no mapped assumption still shows the chip (never silently provided)", () => {
  const r = report({ derived: "assumed", used: [], statuses: { monthly_left_after: "assumed" } });
  const c = metricCaveat(r, "monthly_left_after") as MetricCaveat;
  assert.equal(c.kind, "assumption");
  assert.deepEqual(c.assumptions, []);
});

test("a_pfc_zero / a_rate_from_apr mark the loan figures, not the before-loan figures", () => {
  const r = report({ used: ["a_pfc_zero"] });
  assert.deepEqual(CAVEATED(r), ["monthly_payment", "finance_charge", "monthly_left_after", "reserve_months_after"]);
  const r2 = report({ used: ["a_rate_from_apr", "a_no_running_costs"] });
  assert.deepEqual(metricCaveat(r2, "monthly_left_after")!.assumptions.map((a) => a.id), ["a_rate_from_apr", "a_no_running_costs"]);
});

test("estimated input -> 'Estimate' chip; estimate + assumption -> combined label", () => {
  const r = report({ derived: "estimated", statuses: { monthly_left_before: "estimated", monthly_left_after: "estimated" }, used: ["a_no_running_costs"] });
  assert.equal(metricCaveat(r, "monthly_left_before")!.label, "Estimate");
  assert.equal(metricCaveat(r, "monthly_left_before")!.kind, "estimate");
  assert.equal(metricCaveat(r, "monthly_left_after")!.label, "Estimate · includes an assumption");
});

test("full reference household (no assumptions, all provided) -> no caveats; missing metric never caveated", () => {
  const r = report({ used: ["same_rate_assumed", "a_illustrative_scenarios"] });
  assert.deepEqual(CAVEATED(r), []);
  assert.equal(resultHasCaveat(r), false);
  assert.equal(metricCaveat(report({ used: ["a_pfc_zero"] }), "dti_total"), null);
});
