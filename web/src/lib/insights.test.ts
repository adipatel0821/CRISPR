// Pure selectors for the results screens: they choose what to show and never compute money values.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  alternativeSentence,
  comparable,
  decisionSummary,
  highlightAlternatives,
  limitations,
  runningCostsMissing,
  worstGapScenario,
  RUNNING_COSTS_TEXT,
  scenarioClaim,
} from "./insights.ts";
import type { Alternative, CounterfactualResult, DecisionReport } from "./contracts.ts";

const FIXTURE: DecisionReport = JSON.parse(readFileSync(new URL("../fixtures/report.json", import.meta.url), "utf8"));
const clone = (): DecisionReport => JSON.parse(JSON.stringify(FIXTURE));

/** Every digit group in `text` must appear verbatim in one of the backend strings (no new numbers). */
function onlyBackendNumbers(text: string, report: DecisionReport) {
  const corpus = JSON.stringify(report);
  for (const n of text.match(/\d[\d,]*(\.\d+)?/g) ?? []) {
    const plain = n.replace(/,/g, "");
    assert.ok(corpus.includes(plain), `number ${n} in "${text}" is not a backend value`);
  }
}

function alt(id: string, metrics: Record<string, string | null>, deltas: Record<string, string | null>, extra: Partial<Alternative> = {}): Alternative {
  return {
    alt_id: id,
    label: id,
    lever_values: {},
    assumption_flags: [],
    metrics,
    deltas_vs_base: deltas,
    feasible: true,
    infeasible_reasons: [],
    is_base: false,
    ...extra,
  };
}
function cf(alternatives: Alternative[]): CounterfactualResult {
  return { base_offer_id: null, levers: {}, deferred_levers: [], alternatives, pareto_set: [], objectives: [], rate_sensitivity: null, sensitivity_ranking: [], notes: [] };
}

test("comparable parses decimal strings only (comparison helper)", () => {
  assert.equal(comparable("375.14"), 375.14);
  assert.equal(comparable("-50.00"), -50);
  assert.equal(comparable(null), null);
  assert.equal(comparable("abc"), null);
  assert.equal(comparable(12), null);
});

test("fixture: change = backend cash-flow claim with before/after strings", () => {
  const s = decisionSummary(FIXTURE);
  assert.ok(s.change);
  assert.equal(s.change.kind, "cashflow_change");
  assert.equal(s.change.text, "In a typical month, what you have left after expenses goes from $900.00 to $474.86.");
  assert.deepEqual(s.change.claimIds, ["cl_cashflow_change"]);
  assert.ok(s.change.evidenceIds.includes("ev_calc_F09"));
  assert.deepEqual(s.change.figure, { before: "900.00", after: "474.86" });
  assert.equal(s.change.href, "/dashboard");
});

test("fixture: concern = unfunded gap in a with_offer scenario (outranks the reserve flag)", () => {
  const s = decisionSummary(FIXTURE);
  assert.ok(s.concern);
  assert.equal(s.concern.kind, "unfunded_gap");
  assert.equal(s.concern.tone, "gap");
  assert.equal(s.concern.scenarioId, "sc_job_loss");
  assert.deepEqual(s.concern.claimIds, ["cl_stress_job_loss"]);
  assert.equal(s.concern.figure?.value, "4975.42");
  assert.equal(s.concern.href, "/stress");
  assert.equal(worstGapScenario(FIXTURE)?.scenario_id, "sc_job_loss");
});

test("fixture: next = the alternative the backend described (comparison claim), same-rate wording kept", () => {
  const s = decisionSummary(FIXTURE);
  assert.ok(s.next);
  assert.equal(s.next.kind, "alternative");
  assert.equal(s.next.altId, "alt_t48");
  assert.match(s.next.text, /same rate/);
  assert.deepEqual(s.next.claimIds, ["cl_alt_t48"]);
  assert.equal(s.next.href, "/alternatives");
});

test("concern priority: deficit flag > gap > reserve > term > mismatch > running costs", () => {
  const r = clone();
  r.with_offer!.flags.find((f) => f.flag_id === "DEFICIT_AFTER_LOAN")!.triggered = true;
  assert.equal(decisionSummary(r).concern?.kind, "deficit_after_loan");
  assert.equal(decisionSummary(r).concern?.tone, "gap");

  const noGap = clone();
  for (const sc of noGap.scenarios) sc.max_unfunded_gap = "0.00";
  const c = decisionSummary(noGap).concern!;
  assert.equal(c.kind, "reserve_low");
  assert.deepEqual(c.claimIds, ["cl_reserve_flag"]);
  assert.match(c.text, /0\.60 months/);

  const term = clone();
  for (const sc of term.scenarios) sc.max_unfunded_gap = "0.00";
  term.with_offer!.flags.find((f) => f.flag_id === "RESERVE_LT_1_MONTH")!.triggered = false;
  term.with_offer!.flags.find((f) => f.flag_id === "TERM_GT_60")!.triggered = true;
  term.with_offer!.flags.find((f) => f.flag_id === "PAYMENT_MISMATCH")!.triggered = true;
  assert.equal(decisionSummary(term).concern?.kind, "term_long");
  term.with_offer!.flags.find((f) => f.flag_id === "TERM_GT_60")!.triggered = false;
  assert.equal(decisionSummary(term).concern?.kind, "payment_mismatch");
  term.with_offer!.flags.find((f) => f.flag_id === "PAYMENT_MISMATCH")!.triggered = false;
  assert.equal(decisionSummary(term).concern, null, "nothing to say -> null, never invented");

  term.with_offer!.assumptions_used = ["a_no_running_costs"];
  const rc = decisionSummary(term).concern!;
  assert.equal(rc.kind, "running_costs_missing");
  assert.equal(rc.text, RUNNING_COSTS_TEXT);
  assert.equal(rc.href, "/intake");
});

test("change falls back to metrics template, then savings claim; null when absent", () => {
  const r = clone();
  r.claims = r.claims.filter((c) => c.claim_id !== "cl_cashflow_change");
  const ch = decisionSummary(r).change!;
  assert.equal(ch.text, "What you have left each month goes from $900.00 to $474.86.");
  assert.deepEqual(ch.claimIds, []);
  onlyBackendNumbers(ch.text, r);

  r.with_offer!.metrics.monthly_left_after.value = null;
  assert.equal(decisionSummary(r).change?.kind, "savings_change");
  r.claims = r.claims.filter((c) => c.claim_id !== "cl_savings_change");
  assert.equal(decisionSummary(r).change, null);
});

test("empty report -> all three pieces null", () => {
  const r = clone();
  r.claims = [];
  r.with_offer = null;
  r.baseline = null;
  r.scenarios = [];
  r.counterfactual = null;
  assert.deepEqual(decisionSummary(r), { change: null, concern: null, next: null });
  assert.deepEqual(limitations({ ...r, missing_information: [] }), []);
});

test("next without a comparison claim uses highlights (template only from backend deltas)", () => {
  const r = clone();
  r.claims = r.claims.filter((c) => c.type !== "comparison");
  const n = decisionSummary(r).next!;
  assert.equal(n.kind, "alternative");
  // concern is a gap (cash flow) -> prefer keep-savings (none improve) then lower payment = 72 months
  assert.equal(n.altId, "alt_t72");
  assert.equal(n.text, "“72 months” lowers the monthly payment by $55.36 and raises the finance charge by $516.25. It assumes the same rate, so check it with the lender.");
  onlyBackendNumbers(n.text, r);
});

test("next with no alternatives points to the gap scenario only when it is not already the concern", () => {
  const r = clone();
  r.counterfactual = null;
  assert.equal(decisionSummary(r).next, null);
  r.with_offer!.flags.find((f) => f.flag_id === "DEFICIT_AFTER_LOAN")!.triggered = true;
  const n = decisionSummary(r).next!;
  assert.equal(n.kind, "stress_scenario");
  assert.equal(n.scenarioId, "sc_job_loss");
});

test("highlightAlternatives on the fixture: skips savings (none improve), lower payment = 72 mo, lower finance charge = 36 mo", () => {
  const h = highlightAlternatives(FIXTURE.counterfactual);
  assert.deepEqual(h.map((x) => [x.altId, x.slots]), [
    ["alt_t72", ["lowerPayment"]],
    ["alt_t36", ["lowerTotalCost"]],
  ]);
  assert.equal(h[0].deltas.monthly_payment, "-55.36");
  assert.equal(h[0].sameRateAssumed, true);
  assert.deepEqual(h[0].assumptionNotes, ["Assumes the same rate. Ask the lender.", "Longer than 60 months"]);
  assert.equal(h[1].metrics.finance_charge, "1998.32");
  // never the base, never infeasible
  assert.ok(h.every((x) => x.altId !== "alt_base" && x.altId !== "alt_d3000"));
});

test("highlightAlternatives dedupes one alternative winning two slots and keeps both labels", () => {
  const base = alt("base", { monthly_payment: "400.00", finance_charge: "3000.00", savings_after_purchase: "2000.00" }, {}, { is_base: true });
  const a = alt("a", { monthly_payment: "350.00", finance_charge: "2500.00", savings_after_purchase: "1000.00" }, { monthly_payment: "-50.00", finance_charge: "-500.00", savings_after_purchase: "-1000.00" });
  const b = alt("b", { monthly_payment: "380.00", finance_charge: "2900.00", savings_after_purchase: "2500.00" }, { monthly_payment: "-20.00", finance_charge: "-100.00", savings_after_purchase: "500.00" });
  const off = alt("off", { monthly_payment: "1.00", finance_charge: "1.00", savings_after_purchase: "99999.00" }, {}, { feasible: false });
  const h = highlightAlternatives(cf([base, a, b, off]));
  // Policy (constraint-aware highlights): "b" improves payment and cost WITHOUT drawing down savings, so it wins all
  // three slots over "a" (which takes $1,000 from savings) and is shown once with all three labels (dedupe).
  assert.deepEqual(h.map((x) => [x.altId, x.slots, x.slotLabels]), [
    ["b", ["preserveSavings", "lowerPayment", "lowerTotalCost"], ["Keeps more savings", "Lower monthly payment", "Lower finance charge"]],
  ]);
});

test("highlightAlternatives: ties keep backend order; equal-to-base skipped; base unknown uses delta sign; explicit baseAltId", () => {
  const base = alt("base", { monthly_payment: "400.00", finance_charge: "3000.00", savings_after_purchase: "2000.00" }, {}, { is_base: true });
  const same = alt("same", { monthly_payment: "400.00", finance_charge: "3000.00", savings_after_purchase: "2000.00" }, {});
  assert.deepEqual(highlightAlternatives(cf([base, same])), []);

  const t1 = alt("t1", { monthly_payment: "300.00" }, { monthly_payment: "-100.00" });
  const t2 = alt("t2", { monthly_payment: "300.00" }, { monthly_payment: "-100.00" });
  assert.equal(highlightAlternatives(cf([base, t1, t2]))[0].altId, "t1");

  const noBase = highlightAlternatives(cf([t1, alt("worse", { monthly_payment: "500.00" }, { monthly_payment: "100.00" })]));
  assert.deepEqual(noBase.map((x) => x.altId), ["t1"]);

  // explicit base id: "t1" is treated as the base and excluded
  const h = highlightAlternatives(cf([base, t1, t2]), "t1");
  assert.ok(h.every((x) => x.altId !== "t1"));
  assert.deepEqual(highlightAlternatives(null), []);
});

test("alternativeSentence only rephrases backend delta strings", () => {
  const a = FIXTURE.counterfactual!.alternatives.find((x) => x.alt_id === "alt_d1000")!;
  const s = alternativeSentence(a);
  assert.equal(s, "“+$1,000 down” lowers the monthly payment by $18.76, lowers the finance charge by $125.36 and leaves $1,000.00 less in savings.");
  onlyBackendNumbers(s.replace("+$1,000 down", ""), FIXTURE);
});

test("limitations: fixture lists the estimate note and the missing-information items in plain language", () => {
  const l = limitations(FIXTURE);
  assert.deepEqual(l.map((x) => x.id), ["derived_estimated", "missing:loan.buy_rate", "missing:income.gross_monthly", "missing:vehicle.value_estimates"]);
  assert.equal(l[1].title, "Lender's buy rate");
  assert.equal(l[1].actionLabel, "Ask the lender");
  assert.ok(l.every((x) => !/\bverified\b/i.test(x.text + x.title)));
});

test("limitations: a_no_running_costs is disclosed with a link to add them (unknown is not $0)", () => {
  const r = clone();
  r.with_offer!.assumptions_used = ["a_no_running_costs", "a_illustrative_scenarios"];
  const l = limitations(r);
  const rc = l.find((x) => x.id === "a_no_running_costs")!;
  assert.equal(rc.text, RUNNING_COSTS_TEXT);
  assert.equal(rc.href, "/intake");
  assert.equal(rc.actionLabel, "Add running costs");
  assert.ok(l.some((x) => x.id === "a_illustrative_scenarios" && /not a forecast/.test(x.text)));
  assert.equal(l.filter((x) => x.id === "a_no_running_costs").length, 1);
});

test("limitations / runningCostsMissing: corrected engine signals via derived + metric status", () => {
  const r = clone();
  r.with_offer!.assumptions_used = [];
  assert.equal(runningCostsMissing(r), false);
  r.with_offer!.derived_status = "assumed";
  r.with_offer!.metrics.incremental_vehicle_costs.status = "assumed";
  assert.equal(runningCostsMissing(r), true);
  assert.ok(limitations(r).some((x) => x.id === "a_no_running_costs"));
});

// Regression (merge review of the UX redesign): live reports carry one scenario claim per run; the concern must use the
// WITH-loan claim, and the cash-flow figure must read the live field names.
test("scenarioClaim matches the requested run, never the other one", () => {
  const r = clone();
  const base = { type: "scenario_outcome", subject_metric: "savings_balance", direction: null, evidence_ids: [], assumption_ids: [], template_id: "t" };
  r.claims = [
    { ...base, claim_id: "cl_scn_sc_x_without_offer", values: { scenario_id: "sc_x", run: "without_offer" }, text: "Without this loan your savings stay above zero." },
    { ...base, claim_id: "cl_scn_sc_x_with_offer", values: { scenario_id: "sc_x", run: "with_offer" }, text: "With this loan the unfunded gap reaches $1,000." },
  ] as DecisionReport["claims"];
  assert.equal(scenarioClaim(r, "sc_x")?.claim_id, "cl_scn_sc_x_with_offer");
  assert.equal(scenarioClaim(r, "sc_x", "without_offer")?.claim_id, "cl_scn_sc_x_without_offer");
  r.claims = r.claims.filter((c) => c.claim_id.endsWith("without_offer"));
  assert.equal(scenarioClaim(r, "sc_x"), undefined);
});

test("cash-flow change figure reads live monthly_left_before/after values", () => {
  const r = clone();
  r.key_points = ["cl_live_cash"];
  r.claims = [{ claim_id: "cl_live_cash", type: "change", subject_metric: "monthly_left_after", direction: "down", evidence_ids: [], assumption_ids: [],
    template_id: "t_kp_cashflow", values: { monthly_left_before: "900.00", monthly_left_after: "474.86" },
    text: "Your monthly leftover goes from $900 to $475." }] as DecisionReport["claims"];
  const change = decisionSummary(r).change;
  assert.equal(change?.figure?.before, "900.00");
  assert.equal(change?.figure?.after, "474.86");
});

test("scenarioClaim accepts a combined claim with no run marker, but not the other run's claim", () => {
  const r = clone();
  const base = { type: "scenario_outcome", subject_metric: "savings_balance", direction: null, evidence_ids: [], assumption_ids: [], template_id: "t" };
  r.claims = [
    { ...base, claim_id: "cl_scn_sc_y_without_offer", values: { scenario_id: "sc_y", run: "without_offer" }, text: "Without this loan your savings stay above zero." },
    { ...base, claim_id: "cl_stress_y", values: { scenario_id: "sc_y" }, text: "With this loan the gap reaches $10; without it, savings last." },
  ] as DecisionReport["claims"];
  assert.equal(scenarioClaim(r, "sc_y")?.claim_id, "cl_stress_y");
});

// Constraint-aware highlights (UX review): payment / cost slots prefer options that do not draw down savings.
function mkAlt(id: string, m: Record<string, string>, d: Record<string, string>, extra: Partial<Alternative> = {}): Alternative {
  return { alt_id: id, label: id, lever_values: {}, assumption_flags: [], metrics: m, deltas_vs_base: d,
           feasible: true, infeasible_reasons: [], is_base: false, ...extra } as Alternative;
}
const BASE_ALT = mkAlt("base", { monthly_payment: "375.14", finance_charge: "3008.29", savings_after_purchase: "2000.00" },
  { monthly_payment: "0.00", finance_charge: "0.00", savings_after_purchase: "0.00" }, { is_base: true });

test("lower payment / lower cost prefer savings-neutral options over the savings-draining extreme", () => {
  const cf = { alternatives: [BASE_ALT,
    mkAlt("t72", { monthly_payment: "319.78", finance_charge: "3524.54", savings_after_purchase: "2000.00" },
        { monthly_payment: "-55.36", finance_charge: "516.25", savings_after_purchase: "0.00" }),
    mkAlt("t72_down2000", { monthly_payment: "287.81", finance_charge: "3222.00", savings_after_purchase: "0.00" },
        { monthly_payment: "-87.33", finance_charge: "213.71", savings_after_purchase: "-2000.00" }),
    mkAlt("t36", { monthly_payment: "597.18", finance_charge: "1998.32", savings_after_purchase: "2000.00" },
        { monthly_payment: "222.04", finance_charge: "-1009.97", savings_after_purchase: "0.00" }),
    mkAlt("t36_down2000", { monthly_payment: "537.46", finance_charge: "1848.48", savings_after_purchase: "0.00" },
        { monthly_payment: "162.32", finance_charge: "-1159.81", savings_after_purchase: "-2000.00" }),
  ] } as unknown as CounterfactualResult;
  const hl = highlightAlternatives(cf);
  assert.equal(hl.find((h) => h.slots.includes("lowerPayment"))?.altId, "t72");
  assert.equal(hl.find((h) => h.slots.includes("lowerTotalCost"))?.altId, "t36");
  assert.equal(hl.find((h) => h.slots.includes("preserveSavings")), undefined);   // nothing keeps MORE savings
});

test("falls back to a savings-reducing option only when no savings-neutral option improves the objective", () => {
  const cf = { alternatives: [BASE_ALT,
    mkAlt("down1000", { monthly_payment: "356.38", finance_charge: "2858.00", savings_after_purchase: "1000.00" },
        { monthly_payment: "-18.76", finance_charge: "-150.29", savings_after_purchase: "-1000.00" }),
  ] } as unknown as CounterfactualResult;
  const hl = highlightAlternatives(cf);
  assert.equal(hl.find((h) => h.slots.includes("lowerPayment"))?.altId, "down1000");
});
