"""Live CP1 walkthrough against a running API (default http://localhost:8000).

Drives the real HTTP surface the web app uses: session -> adaptive questions -> manual offer -> analysis,
using the synthetic reference case, and asserts the audited reference values. Exit code 0 = pass.
Usage (from backend/):  .venv/Scripts/python scripts/demo_walkthrough.py [--base http://localhost:8000]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
REF = json.loads((ROOT / "fixtures" / "reference_case.json").read_text(encoding="utf-8"))
ANSWERS = {f["key"]: f["value"] for f in REF["facts"]}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    base = ap.parse_args().base.rstrip("/") + "/api/v1"
    c = httpx.Client(timeout=30)
    failures: list[str] = []

    def check(name, cond, detail=""):
        print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail and not cond else ""))
        if not cond:
            failures.append(name)

    h = c.get(f"{base}/health").json()
    print("health:", h)
    s = c.post(f"{base}/sessions", json={}).json()
    sid, hdr = s["session_id"], {"Authorization": f"Bearer {s['token']}"}
    print("session:", sid, "data_mode:", s["data_mode"])

    # 1) offer first (two-track intake), so the down-payment question can quote the amount
    offer = c.post(f"{base}/sessions/{sid}/offers", headers=hdr,
                   json={"label": REF["offer"]["label"], "terms": REF["offer"]["terms"], "confirmed": True})
    check("manual offer accepted (200)", offer.status_code == 200, offer.text[:300])
    o = offer.json()
    check("offer ready_for_calculation", o.get("ready_for_calculation") is True, json.dumps(o.get("warnings")))
    check("itemization check pass (D0-001)",
          any(t.get("checks", {}).get("itemization") == "pass" for t in o["terms"].values()),
          json.dumps({k: t.get("checks", {}).get("itemization") for k, t in o["terms"].items()}))

    # 2) adaptive intake: answer only what is asked, from the reference household
    asked = []
    for _ in range(20):
        nq = c.get(f"{base}/sessions/{sid}/next-question", headers=hdr).json()
        q = nq["question"]
        if q is None:
            break
        asked.append(q["fact_key"])
        if q.get("rule_id"):
            val = "true"
        elif q["fact_key"] == "loan.down_payment_source":
            val = "savings"
        else:
            val = ANSWERS.get(q["fact_key"])
        r = c.post(f"{base}/sessions/{sid}/answers", headers=hdr,
                   json={"question_id": q["question_id"], "fact_key": q["fact_key"], "raw_answer": val, "typed_value": val})
        if r.status_code >= 400:
            failures.append(f"answer {q['fact_key']}: {r.status_code} {r.text[:200]}")
            break
    print("questions asked:", asked)
    check("P1-style intake stops after 5 blocking questions", asked == [
        "income.take_home_monthly", "expenses.essential.total", "debts.count", "savings.liquid",
        "loan.down_payment_source"], str(asked))

    # refinements via the form path (replacement car, running costs, flexible spending)
    extra = [f for f in REF["facts"] if f["key"] not in asked]
    r = c.post(f"{base}/sessions/{sid}/facts", headers=hdr, json={"facts": extra})
    check("refinement facts accepted", r.status_code == 200, r.text[:300])

    # 3) analysis
    rep = c.post(f"{base}/sessions/{sid}/analysis", headers=hdr, json={})
    check("analysis 200", rep.status_code == 200, rep.text[:300])
    rep = rep.json()
    m = rep["with_offer"]["metrics"]
    exp = REF["expected"]
    for k in ["principal", "monthly_payment", "total_of_payments", "interest", "finance_charge",
              "total_paid_through_deal", "monthly_left_before", "incremental_vehicle_costs", "monthly_left_after",
              "savings_after_purchase", "reserve_months_before", "reserve_months_after"]:
        check(f"{k} = {exp[k]}", m.get(k, {}).get("value") == exp[k], f"got {m.get(k)}")
    check("APR recomputed 0.05796", m["apr_recomputed"]["value"] == "0.05796", str(m["apr_recomputed"]))
    row1 = rep["with_offer"]["amortization_schedule"][0]
    check("schedule row 1", row1 == exp["first_schedule_row"], str(row1))
    check("readiness: all 5 core analyses available",
          all(r_["available"] for r_ in rep["readiness"] if r_["analysis_id"] in
              ("loan_cost", "cashflow_impact", "reserve_impact", "stress_test", "alternatives")),
          json.dumps([(r_["analysis_id"], r_["available"], r_["missing"]) for r_ in rep["readiness"]]))
    check("3 key points", len(rep["key_points"]) == 3)
    texts = {cl["claim_id"]: cl.get("text") for cl in rep["claims"]}
    for kp in rep["key_points"]:
        print("   key point:", texts.get(kp))
    check("scenarios present (paired)", len(rep["scenarios"]) >= 2 and
          {s_["run"] for s_ in rep["scenarios"]} == {"without_offer", "with_offer"})
    check("alternatives present", bool(rep.get("counterfactual") and rep["counterfactual"]["alternatives"]))
    blob = json.dumps(rep).lower()
    check("no 'verified' label anywhere in the report (A-42)", '"verified"' not in blob and "verified" not in
          " ".join(e["display_label"].lower() for e in rep["evidence"]))
    g = c.get(f"{base}/reports/{rep['report_id']}", headers=hdr)
    check("report retrievable", g.status_code == 200)

    # 4) failure paths
    bad = c.post(f"{base}/sessions/{sid}/facts", headers=hdr, json={"facts": [{"key": "income.take_home_monthly", "value": "-5"}]})
    check("negative income -> 400 VALIDATION_ERROR", bad.status_code == 400 and bad.json()["error"]["code"] == "VALIDATION_ERROR")
    other = c.post(f"{base}/sessions", json={}).json()
    leak = c.get(f"{base}/reports/{rep['report_id']}", headers={"Authorization": f"Bearer {other['token']}"})
    check("other session cannot read report (404)", leak.status_code == 404)
    noauth = c.get(f"{base}/sessions/{sid}")
    check("missing token -> 401", noauth.status_code == 401)
    d = c.delete(f"{base}/sessions/{sid}", headers=hdr)
    check("delete session", d.status_code in (200, 204))
    check("deleted session token no longer works", c.get(f"{base}/sessions/{sid}", headers=hdr).status_code in (401, 404))

    print("\nRESULT:", "PASS" if not failures else f"FAIL ({len(failures)}): {failures}")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
