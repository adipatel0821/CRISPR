// Decision report selectors: choose and order backend content, never compute.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nextActions, principalConcerns, reportSummary, scenarioClaimFor } from "./report-view.ts";
import { RUNNING_COSTS_TEXT } from "../../lib/insights.ts";
import type { DecisionReport } from "../../lib/contracts.ts";

const FIXTURE: DecisionReport = JSON.parse(readFileSync(new URL("../../fixtures/report.json", import.meta.url), "utf8"));
const clone = (): DecisionReport => JSON.parse(JSON.stringify(FIXTURE));

test("principalConcerns: fixture = job-loss gap first, then the low-reserve flag", () => {
  const c = principalConcerns(FIXTURE);
  assert.deepEqual(
    c.map((x) => [x.id, x.tone]),
    [
      ["gap:sc_job_loss", "gap"],
      ["RESERVE_LT_1_MONTH", "attention"],
    ],
  );
  assert.ok(c[0].text.includes("$4,975.42"));
  assert.deepEqual(c[0].href, "/stress");
  // the flag uses the backend claim text
  assert.ok(c[1].text.startsWith("After the $4,000.00 down payment"));
});

test("principalConcerns: running costs not included is disclosed, never as a confirmed $0", () => {
  const r = clone();
  r.with_offer!.assumptions_used = ["a_no_running_costs"];
  // with other concerns present it is not repeated here (it stays in Financial impact + Next actions)
  assert.ok(!principalConcerns(r).some((x) => x.id === "running_costs"));
  assert.ok(nextActions(r).some((x) => x.id === "a_no_running_costs"));
  // as the only issue, it is the concern
  r.with_offer!.flags = [];
  r.baseline!.flags = [];
  r.scenarios = [];
  const c = principalConcerns(r);
  assert.equal(c.length, 1);
  const rc = c[0];
  assert.equal(rc.id, "running_costs");
  assert.equal(rc.text, RUNNING_COSTS_TEXT);
  assert.equal(rc.href, "/intake");
});

test("principalConcerns: no flags, no gap, nothing missing → empty", () => {
  const r = clone();
  r.with_offer!.flags = [];
  r.baseline!.flags = [];
  r.scenarios = [];
  assert.deepEqual(principalConcerns(r), []);
});

test("nextActions: ask-the-lender first, then fillable gaps, then notes", () => {
  const a = nextActions(FIXTURE);
  assert.equal(a[0].id, "missing:loan.buy_rate");
  assert.equal(a[0].kind, "ask");
  assert.equal(a[0].citation, "CFPB en-727, en-759");
  const kinds = a.map((x) => x.kind);
  const order = { ask: 0, fill: 1, note: 2 } as const;
  assert.deepEqual([...kinds].sort((x, y) => order[x] - order[y]), kinds);
  assert.ok(a.some((x) => x.id === "missing:income.gross_monthly" && x.kind === "note"));
});

test("nextActions: running costs become a fillable action with a link", () => {
  const r = clone();
  r.with_offer!.assumptions_used = ["a_no_running_costs"];
  const rc = nextActions(r).find((x) => x.id === "a_no_running_costs");
  assert.ok(rc);
  assert.equal(rc.kind, "fill");
  assert.equal(rc.href, "/intake");
  assert.equal(rc.actionLabel, "Add running costs");
});

test("reportSummary / principalConcerns: a gap concern uses the WITH-loan scenario claim, never the without-loan one", () => {
  const r = clone();
  const orig = r.claims.find((c) => c.claim_id === "cl_stress_job_loss")!;
  // live backend shape: one claim per run, the without-loan one listed first
  r.claims = r.claims.filter((c) => c.claim_id !== "cl_stress_job_loss");
  r.claims.push(
    { ...orig, claim_id: "cl_scn_sc_job_loss_without_offer", text: "Without this loan your savings stay above zero.", values: { scenario_id: "sc_job_loss", run: "without_offer" } },
    { ...orig, claim_id: "cl_scn_sc_job_loss_with_offer", values: { ...orig.values, run: "with_offer" } },
  );
  const s = reportSummary(r);
  assert.equal(s.concern?.kind, "unfunded_gap");
  assert.deepEqual(s.concern?.claimIds, ["cl_scn_sc_job_loss_with_offer"]);
  assert.equal(s.concern?.text, orig.text);
  assert.equal(scenarioClaimFor(r, "sc_job_loss", "with_offer")?.claim_id, "cl_scn_sc_job_loss_with_offer");
  const c = principalConcerns(r);
  assert.equal(c[0].id, "gap:sc_job_loss");
  assert.equal(c[0].text, orig.text);
  // only a without-loan claim: fall back to a template over backend strings
  r.claims = r.claims.filter((x) => x.claim_id !== "cl_scn_sc_job_loss_with_offer");
  const t = reportSummary(r).concern!;
  assert.match(t.text, /with this loan your savings run out in month 2 and the unfunded gap reaches \$4,975\.42/);
  assert.deepEqual(t.claimIds, []);
});
