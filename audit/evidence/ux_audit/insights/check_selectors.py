"""Agent 5: independent expectations from the API JSON, compared with the shipped selectors' output."""
import json
from decimal import Decimal as D
sel = json.load(open("selectors_output.json"))
ok_all = True
def check(n, c, d=""):
    global ok_all; ok_all &= bool(c); print(f"  [{'PASS' if c else 'FAIL'}] {n} {d}")
for name in ["reference", "edge"]:
    rep = json.load(open(f"report_{name}.json", encoding="utf-8")); s = sel[name]; print("==", name)
    wm, bm = rep["with_offer"]["metrics"], rep["baseline"]["metrics"]
    ch = s["summary"]["change"]
    check("change figure == metrics F08/F09", (ch["figure"]["before"], ch["figure"]["after"]) == (wm["monthly_left_before"]["value"], wm["monthly_left_after"]["value"]), str(ch["figure"]))
    claim = next(c for c in rep["claims"] if c["claim_id"] in ch["claimIds"])
    check("change text is the backend claim text verbatim", claim.get("text") == ch["text"])
    gaps = [(D(x["max_unfunded_gap"]), x["scenario_id"]) for x in rep["scenarios"] if x["run"] == "with_offer" and D(x["max_unfunded_gap"]) > 0]
    exp = max(gaps)[1] if gaps else None
    check("concern = with_offer scenario with largest gap", s["worstGap"] == exp and s["summary"]["concern"]["scenarioId"] == exp, f"{exp} gaps={[(str(g), i) for g, i in gaps]}")
    cc = next(c for c in rep["claims"] if c["claim_id"] in s["summary"]["concern"]["claimIds"])
    wrun = next(x for x in rep["scenarios"] if x["run"] == "with_offer" and x["scenario_id"] == exp)
    check("concern claim is the WITH-loan claim and its gap matches the with_offer run",
          cc["claim_id"].endswith("_with_offer") and s["summary"]["concern"]["figure"]["value"] == wrun["max_unfunded_gap"], f"{cc['claim_id']} {wrun['max_unfunded_gap']}")
    alts = rep["counterfactual"]["alternatives"]; base = next(a for a in alts if a["is_base"])
    cands = [a for a in alts if a["feasible"] and not a["is_base"]]
    picks = {}
    for slot, m, mx in [("preserveSavings", "savings_after_purchase", True), ("lowerPayment", "monthly_payment", False), ("lowerTotalCost", "finance_charge", False)]:
        vals = [(D(a["metrics"][m]), i, a) for i, a in enumerate(cands) if a["metrics"].get(m) is not None]
        if not vals: continue
        best = (max(vals, key=lambda t: (t[0], -t[1])) if mx else min(vals, key=lambda t: (t[0], t[1])))[2]
        bv, basev = D(best["metrics"][m]), D(base["metrics"][m])
        if (bv > basev) if mx else (bv < basev): picks.setdefault(best["alt_id"], []).append(slot)
    got = {h["altId"]: h["slots"] for h in s["highlights"]}
    check("highlightAlternatives == independent selection (slots skipped when nothing improves)", got == picks, f"expected {picks} got {got}")
    check("every highlighted term alternative discloses same rate", all(h["same"] for h in s["highlights"] if "months" in h["label"]))
    check("a_no_running_costs disclosed in limitations", "a_no_running_costs" in s["limitations"] and "a_no_running_costs" in rep["with_offer"]["assumptions_used"])
    check("with_offer derived_status is 'assumed' (running costs)", rep["with_offer"]["derived_status"] == "assumed")
print("ALL PASS" if ok_all else "SOME FAIL")
