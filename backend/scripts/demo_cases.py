"""The three synthetic demo cases (normal / edge / failure) through the real API (in-process, temp SQLite).

Expected values are independent hand/Decimal computations (see comments), not engine output.
Usage (from backend/):  .venv/Scripts/python scripts/demo_cases.py      exit code 0 = all pass
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["DATABASE_URL"] = f"sqlite:///{Path(tempfile.mkdtemp(prefix='dt_cases_'), 'c.db').as_posix()}"
os.environ.setdefault("LLM_DATA_MODE", "synthetic_only")

from fastapi.testclient import TestClient  # noqa: E402

from api.main import app  # noqa: E402

API = "/api/v1"
REF = json.loads((ROOT / "fixtures" / "reference_case.json").read_text(encoding="utf-8"))
failures: list[str] = []


def check(name, cond, detail=""):
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail and not cond else ""))
    if not cond:
        failures.append(name)


def session(c):
    s = c.post(f"{API}/sessions", json={}).json()
    return s["session_id"], {"Authorization": f"Bearer {s['token']}"}


def flags(calc):
    return {f["flag_id"] for f in calc["flags"] if f["triggered"]}


with TestClient(app) as c:
    # ------------------------------------------------------------------ NORMAL
    print("NORMAL — complete profile, standard fixed-rate auto loan (reference case)")
    sid, h = session(c)
    c.post(f"{API}/sessions/{sid}/facts", headers=h, json={"facts": REF["facts"]})
    c.post(f"{API}/sessions/{sid}/offers", headers=h, json={"label": "Dealer offer A", "terms": REF["offer"]["terms"]})
    rep = c.post(f"{API}/sessions/{sid}/analysis", headers=h, json={}).json()
    m = rep["with_offer"]["metrics"]
    check("payment 375.14", m["monthly_payment"]["value"] == "375.14")
    check("monthly left 900.00 -> 474.86", m["monthly_left_before"]["value"] == "900.00" and m["monthly_left_after"]["value"] == "474.86")
    check("RESERVE_LT_1_MONTH informational flag", "RESERVE_LT_1_MONTH" in flags(rep["with_offer"]))
    check("paired scenarios", {s["run"] for s in rep["scenarios"]} == {"without_offer", "with_offer"})

    # ------------------------------------------------------------------ EDGE
    # Household (P3-like): take-home 3,100; essentials 2,350; student loan 210/mo; BNPL 95/mo with 4 payments left;
    # savings 400. Offer: price 18,000 + taxes 1,200 - cash down 1,500 (from "other") = AF 17,700 (itemization,
    # IMP-008); 8.99% for 72 months. Independent Decimal schedule: payment 318.96, TOP 22,965.58, FC 5,265.58.
    # Left before = 3100-2350-210-95 = 445.00; after = 445.00-318.96 = 126.04 (no running costs given -> labelled).
    # Reserve after = 400 / (2350+305+318.96) = 0.13 months.
    print("EDGE — limited savings, two existing obligations (one ending), long term, shock")
    sid, h = session(c)
    edge_facts = [
        {"key": "income.take_home_monthly", "value": "3100"}, {"key": "income.variability", "value": "stable"},
        {"key": "expenses.essential.total", "value": "2350"}, {"key": "debts.count", "value": "2"},
        {"key": "debts[d1].type", "value": "student_loan"}, {"key": "debts[d1].monthly_payment", "value": "210"},
        {"key": "debts[d2].type", "value": "bnpl"}, {"key": "debts[d2].monthly_payment", "value": "95"},
        {"key": "debts[d2].remaining_months", "value": "4"},
        {"key": "savings.liquid", "value": "400"}, {"key": "loan.down_payment_source", "value": "other"},
    ]
    r = c.post(f"{API}/sessions/{sid}/facts", headers=h, json={"facts": edge_facts})
    check("edge facts accepted", r.status_code == 200, r.text[:200])
    r = c.post(f"{API}/sessions/{sid}/offers", headers=h, json={"label": "Used-car offer (72 mo)", "terms": {
        "cash_price": "18000.00", "taxes_title_fees": "1200.00", "cash_down": "1500.00",
        "contract_rate": "0.0899", "term_months": 72}})
    check("edge offer ready (principal derived from itemization)", r.status_code == 200 and r.json()["ready_for_calculation"], r.text[:300])
    rep = c.post(f"{API}/sessions/{sid}/analysis", headers=h, json={}).json()
    m = rep["with_offer"]["metrics"]
    check("edge principal 17700.00 (derived)", m["principal"]["value"] == "17700.00", str(m["principal"]))
    check("edge payment 318.96", m["monthly_payment"]["value"] == "318.96", m["monthly_payment"]["value"])
    check("edge TOP 22965.58 / FC 5265.58", m["total_of_payments"]["value"] == "22965.58" and m["finance_charge"]["value"] == "5265.58",
          f"{m['total_of_payments']['value']} / {m['finance_charge']['value']}")
    check("edge left 445.00 -> 126.04", m["monthly_left_before"]["value"] == "445.00" and m["monthly_left_after"]["value"] == "126.04",
          f"{m['monthly_left_before']['value']} -> {m['monthly_left_after']['value']}")
    check("edge savings after purchase 400.00 (down not from savings)", m["savings_after_purchase"]["value"] == "400.00")
    check("edge reserve after 0.13", m["reserve_months_after"]["value"] == "0.13", m["reserve_months_after"]["value"])
    check("edge flags TERM_GT_60 + RESERVE_LT_1_MONTH", {"TERM_GT_60", "RESERVE_LT_1_MONTH"} <= flags(rep["with_offer"]))
    spike = next((s for s in rep["scenarios"] if s["scenario_id"] == "sc_expense_spike" and s["run"] == "with_offer"), None)
    check("edge expense shock produces an unfunded gap with the loan", spike is not None and spike["max_unfunded_gap"] != "0.00",
          json.dumps(spike and {k: spike[k] for k in ("first_shortfall_month", "max_unfunded_gap")}))
    if spike:
        m5 = spike["monthly_paths"][4]
        check("BNPL debt ends after month 4 in the simulation (month 5 debts = 210.00)", m5["debt_payments"] == "210.00", m5["debt_payments"])

    # ------------------------------------------------------------------ FAILURE
    print("FAILURE — missing/contradictory terms, invalid input, deficit, AI unavailable")
    sid, h = session(c)
    c.post(f"{API}/sessions/{sid}/facts", headers=h, json={"facts": REF["facts"]})
    r = c.post(f"{API}/sessions/{sid}/offers", headers=h, json={"terms": {"principal": "20000.00", "term_months": 60}})
    check("offer without any rate is stored but not ready", r.status_code == 200 and r.json()["ready_for_calculation"] is False, r.text[:200])
    r = c.post(f"{API}/sessions/{sid}/analysis", headers=h, json={})
    check("analysis without a ready offer -> 422 INSUFFICIENT_INFORMATION with readiness",
          r.status_code == 422 and r.json()["error"]["code"] == "INSUFFICIENT_INFORMATION", f"{r.status_code} {r.text[:200]}")
    typo = dict(REF["offer"]["terms"], monthly_payment="3751.40")      # A-27: decimal-point typo
    r = c.post(f"{API}/sessions/{sid}/offers", headers=h, json={"terms": typo}).json()
    check("contract payment typo 3,751.40 vs computed 375.14 -> PAYMENT_MISMATCH warning",
          any("PAYMENT_MISMATCH" in w for w in r.get("warnings", [])), json.dumps(r.get("warnings")))
    r = c.post(f"{API}/sessions/{sid}/offers", headers=h, json={"terms": {"principal": "20000", "contract_rate": "0.0475", "term_months": 500}})
    check("term 500 -> 400 VALIDATION_ERROR on terms.term_months",
          r.status_code == 400 and r.json()["error"]["details"]["fields"][0]["field"] == "terms.term_months", r.text[:200])
    r = c.post(f"{API}/sessions/{sid}/offers", headers=h, json={"terms": dict(REF["offer"]["terms"], variable_rate=True)})
    check("variable-rate product -> 422 UNSUPPORTED_PRODUCT", r.status_code == 422 and r.json()["error"]["code"] == "UNSUPPORTED_PRODUCT", r.text[:200])

    # deficit household: essentials 2,900 + debts 410 > take-home 3,100 -> -210.00 before the loan (A-21/A-32)
    sid, h = session(c)
    c.post(f"{API}/sessions/{sid}/offers", headers=h, json={"terms": REF["offer"]["terms"]})
    answers = {"income.take_home_monthly": "3100", "expenses.essential.total": "2900", "debts.count": "1",
               "debts[d1].monthly_payment": "410", "savings.liquid": "1000", "loan.down_payment_source": "other"}
    acks, seen = 0, []
    for _ in range(15):
        q = c.get(f"{API}/sessions/{sid}/next-question", headers=h).json()["question"]
        if q is None:
            break
        seen.append(q["question_id"])
        if q.get("rule_id"):
            acks += 1
            val = "true"
        else:
            val = answers.get(q["fact_key"], "0")
        c.post(f"{API}/sessions/{sid}/answers", headers=h, json={"question_id": q["question_id"], "fact_key": q["fact_key"],
                                                                 "raw_answer": val, "typed_value": val})
    check("deficit acknowledged exactly once, no loop", acks == 1 and len(seen) == len(set(seen)), str(seen))
    rep = c.post(f"{API}/sessions/{sid}/analysis", headers=h, json={}).json()
    check("deficit analysed (-210.00) and flagged, not rejected",
          rep["baseline"]["metrics"]["monthly_left_before"]["value"] == "-210.00" and "DEFICIT_BEFORE_LOAN" in flags(rep["with_offer"]),
          rep["baseline"]["metrics"]["monthly_left_before"]["value"])
    kp = {cl["claim_id"]: cl.get("text") for cl in rep["claims"]}
    check("deficit leads the key points", "-$210" in (kp.get(rep["key_points"][0]) or "") or "210" in (kp.get(rep["key_points"][0]) or ""),
          str([kp.get(k) for k in rep["key_points"]]))
    check("report data_mode shown", rep["data_mode"] in ("synthetic_only", "off"))

print("\nRESULT:", "PASS" if not failures else f"FAIL ({len(failures)}): {failures}")
sys.exit(0 if not failures else 1)
