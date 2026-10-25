// Agent 5: run the shipped web selectors (web/src/lib/insights.ts, type-stripped by node 24) on API report JSON.
import { readFileSync } from "node:fs";
import { decisionSummary, highlightAlternatives, limitations, worstGapScenario } from "../../../../web/src/lib/insights.ts";
const out = {};
for (const name of ["reference", "edge"]) {
  const rep = JSON.parse(readFileSync(new URL(`./report_${name}.json`, import.meta.url), "utf-8"));
  const s = decisionSummary(rep);
  out[name] = {
    summary: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v && { kind: v.kind, text: v.text, figure: v.figure ?? null, claimIds: v.claimIds, altId: v.altId ?? null, scenarioId: v.scenarioId ?? null }])),
    worstGap: worstGapScenario(rep)?.scenario_id ?? null,
    highlights: highlightAlternatives(rep.counterfactual).map((h) => ({ altId: h.altId, label: h.label, slots: h.slots, same: h.sameRateAssumed })),
    limitations: limitations(rep).map((l) => l.id),
  };
}
console.log(JSON.stringify(out, null, 1));
