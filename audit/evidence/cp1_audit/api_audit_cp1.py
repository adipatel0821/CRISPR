"""Agent 5 CP1 API audit through the REAL merged modules (no fakes) via TestClient on a throwaway SQLite DB.
Run from backend/: PYTHONPATH=. .venv/Scripts/python.exe <this file> <scratch_db_path>"""
import os, sys, sqlite3, json
from decimal import Decimal as D

DB = sys.argv[1]
if os.path.exists(DB):
    os.remove(DB)
os.environ["DATABASE_URL"] = "sqlite:///" + DB.replace("\\", "/")
os.environ["LLM_DATA_MODE"] = "synthetic_only"
os.environ.pop("GEMINI_API_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402
from api.main import app  # noqa: E402
from schemas.contracts import ErrorBody, ErrorCode  # noqa: E402

R = []


def check(name, ok, detail=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {name} {detail}")


def err_ok(r, status, code):
    try:
        body = ErrorBody.model_validate(r.json())
        return r.status_code == status and body.error.code == code, f"-> {r.status_code} {r.json()}"[:300]
    except Exception as e:  # noqa: BLE001
        return False, f"-> {r.status_code} {r.text[:200]} ({type(e).__name__})"


HH = [("income.take_home_monthly", "4200.00"), ("income.variability", "stable"), ("expenses.essential.total", "2900.00"),
      ("expenses.current_vehicle_costs_monthly", "260.00"), ("vehicle.replaces_current", "true"),
      ("vehicle.new_ownership_costs_monthly", "310.00"), ("expenses.flexible.total", "400.00"), ("debts.count", "0"),
      ("savings.liquid", "6000.00"), ("loan.down_payment_source", "savings")]
REF = dict(cash_price="22000.00", taxes_title_fees="1500.00", cash_down="4000.00", principal="20000.00",
           amount_financed="19500.00", prepaid_finance_charges="500.00", contract_rate="0.0475",
           apr="0.05796", term_months=60, monthly_payment="375.14")

with TestClient(app, raise_server_exceptions=False) as c:
    def new_session():
        r = c.post("/api/v1/sessions", json={})
        j = r.json(); return j["session_id"], {"Authorization": f"Bearer {j['token']}"}

    print("== vertical slice through the API (reference case) ==")
    sid, H = new_session()
    r = c.post(f"/api/v1/sessions/{sid}/facts", headers=H, json={"facts": [{"key": k, "value": v} for k, v in HH]})
    check("POST facts 200", r.status_code == 200, f"-> {r.status_code} {r.text[:200] if r.status_code != 200 else ''}")
    r = c.post(f"/api/v1/sessions/{sid}/offers", headers=H, json={"label": "Dealer offer A", "terms": REF})
    check("POST manual offer 200", r.status_code == 200, f"-> {r.status_code} {r.text[:300] if r.status_code != 200 else ''}")
    offer = r.json() if r.status_code == 200 else {}
    check("offer ready_for_calculation", offer.get("ready_for_calculation") is True)
    itm = {k: t["checks"]["itemization"] for k, t in offer.get("terms", {}).items()}
    check("D0-001 via API: itemization check pass on terms", set(itm.values()) - {"not_applicable"} == {"pass"}, str(set(itm.values())))
    r = c.get(f"/api/v1/sessions/{sid}/readiness", headers=H)
    check("readiness: all 5 core analyses available", r.status_code == 200 and all(a["available"] for a in r.json()),
          str([(a["analysis_id"], a["available"]) for a in r.json()]) if r.status_code == 200 else r.text[:200])
    r = c.post(f"/api/v1/sessions/{sid}/analysis", headers=H, json={})
    check("POST analysis 200", r.status_code == 200, f"-> {r.status_code} {r.text[:300] if r.status_code != 200 else ''}")
    rep = r.json() if r.status_code == 200 else {}
    wm = {k: v.get("value") for k, v in (rep.get("with_offer") or {}).get("metrics", {}).items()}
    bm = {k: v.get("value") for k, v in (rep.get("baseline") or {}).get("metrics", {}).items()}
    exp = {"principal": "20000.00", "monthly_payment": "375.14", "total_of_payments": "22508.29", "interest": "2508.29",
           "finance_charge": "3008.29", "total_paid_through_deal": "26508.29", "apr_recomputed": "0.05796",
           "monthly_left_before": "900.00", "incremental_vehicle_costs": "50.00", "monthly_left_after": "474.86",
           "savings_after_purchase": "2000.00", "reserve_months_before": "2.07", "reserve_months_after": "0.60"}
    bad = {k: (wm.get(k), v) for k, v in exp.items() if wm.get(k) != v}
    check("report.with_offer metrics == independent recompute (13 values)", not bad, str(bad))
    check("report.baseline: F08 900.00, loan metrics missing", bm.get("monthly_left_before") == "900.00" and bm.get("monthly_payment") is None,
          str({k: bm.get(k) for k in ("monthly_left_before", "monthly_payment")}))
    check("report.schema/calc version, disclaimer, narrative_text null",
          rep.get("schema_version") == "1.1" and rep.get("disclaimers") and all(s.get("narrative_text") is None for s in rep.get("explanations", [])))
    check("report: 8 scenario results (4 scenarios x 2 runs), counterfactual present",
          len(rep.get("scenarios", [])) == 8 and rep.get("counterfactual") is not None, f"scenarios={len(rep.get('scenarios', []))}")
    # every numeric string in claims traces to a report value (spot: claims carry evidence ids)
    check("A-12r spot: every claim has >=1 evidence id or assumption id",
          all(cl.get("evidence_ids") or cl.get("assumption_ids") or cl.get("type") == "missing" for cl in rep.get("claims", [])),
          f"claims={len(rep.get('claims', []))}")
    report_id = rep.get("report_id")
    r = c.get(f"/api/v1/reports/{report_id}", headers=H)
    check("GET report by id 200 and identical payment", r.status_code == 200 and
          r.json()["with_offer"]["metrics"]["monthly_payment"]["value"] == "375.14")

    print("== A-27 manual typo through API ==")
    r = c.post(f"/api/v1/sessions/{sid}/offers", headers=H, json={"label": "typo", "terms": {**REF, "monthly_payment": "3751.40"}})
    o27 = r.json() if r.status_code == 200 else {}
    txt = json.dumps(o27)
    check("typo offer accepted (200) and warns about payment", r.status_code == 200 and ("3751.40" in txt) and
          (any("payment" in w.lower() for w in o27.get("warnings", [])) or o27["terms"]["monthly_payment"]["checks"]["arithmetic"] in ("warn", "fail")),
          f"-> {r.status_code} warnings={o27.get('warnings')} arith={o27.get('terms', {}).get('monthly_payment', {}).get('checks', {}).get('arithmetic')}")

    print("== A-17 invalid input ==")
    r = c.post(f"/api/v1/sessions/{sid}/facts", headers=H, json={"facts": [{"key": "income.take_home_monthly", "value": "-4200"}]})
    ok, d = err_ok(r, 400, "VALIDATION_ERROR"); check("negative income -> 400 VALIDATION_ERROR", ok, d)
    check("negative income message names the field", "income.take_home_monthly" in r.text, "")
    r = c.post(f"/api/v1/sessions/{sid}/facts", headers=H, json={"facts": [{"key": "income.take_home_monthly", "value": "abc"}]})
    ok, d = err_ok(r, 400, "VALIDATION_ERROR"); check("non-numeric income -> 400", ok, d)
    r = c.post(f"/api/v1/sessions/{sid}/offers", headers=H, json={"terms": {**REF, "term_months": 500}})
    ok, d = err_ok(r, 400, "VALIDATION_ERROR"); check("term 500 -> 400 VALIDATION_ERROR", ok, d)
    r = c.post(f"/api/v1/sessions/{sid}/offers", headers=H, json={"terms": {**REF, "contract_rate": 0.0475}})
    ok, d = err_ok(r, 400, "VALIDATION_ERROR"); check("float rate -> 400", ok, d)
    r = c.post(f"/api/v1/sessions/{sid}/facts", headers=H, json={"facts": [{"key": "no.such.key", "value": "1"}]})
    check("unknown fact key -> 400/422 error body", r.status_code in (400, 422) and "error" in r.json(), f"-> {r.status_code} {r.text[:160]}")
    big = b"%PDF-1.4\n" + b"0" * (50 * 1024 * 1024)
    r = c.post(f"/api/v1/sessions/{sid}/documents", headers=H, files={"file": ("big.pdf", big, "application/pdf")})
    check("50 MB upload -> 400/403/413/422 with error body, no crash", r.status_code in (400, 403, 413, 422) and "error" in r.json(),
          f"-> {r.status_code} {r.text[:200]}")
    r = c.post(f"/api/v1/sessions/{sid}/documents", headers=H, files={"file": ("enc.pdf", b"%PDF-1.4\n1 0 obj<</Encrypt 2 0 R>>endobj\n%%EOF", "application/pdf")})
    check("encrypted/garbage PDF (non-fixture) -> 4xx error body, no 500", 400 <= r.status_code < 500 and "error" in r.json(),
          f"-> {r.status_code} {r.text[:200]}")

    print("== A-18 session isolation ==")
    sidB, HB = new_session()
    r = c.get(f"/api/v1/sessions/{sidB}", headers=H)
    check("token A on session B -> 404 (no leak)", r.status_code in (401, 404) and "error" in r.json(), f"-> {r.status_code} {r.text[:160]}")
    r = c.get(f"/api/v1/sessions/{sid}")
    ok, d = err_ok(r, 401, "UNAUTHORIZED"); check("missing token -> 401 UNAUTHORIZED", ok, d)
    r = c.get(f"/api/v1/sessions/{sid}", headers={"Authorization": "Bearer nope"})
    ok, d = err_ok(r, 401, "UNAUTHORIZED"); check("bad token -> 401", ok, d)
    r = c.get(f"/api/v1/reports/{report_id}", headers=HB)
    check("report of A with token B -> 404", r.status_code in (401, 404), f"-> {r.status_code}")

    print("== error envelope 404 / 405 / 501 ==")
    ok, d = err_ok(c.get("/api/v1/nope"), 404, "NOT_FOUND"); check("unknown route 404 envelope", ok, d)
    r = c.delete("/api/v1/health")
    try:
        body = ErrorBody.model_validate(r.json()); ok = r.status_code == 405 and body.error.code in set(ErrorCode)
    except Exception:  # noqa: BLE001
        ok = False
    check("405 on DELETE /health -> ErrorBody with ErrorCode member", ok, f"-> {r.status_code} {r.text[:200]}")
    ok, d = err_ok(c.post(f"/api/v1/reports/{report_id}/explain", headers=H), 501, "NOT_IMPLEMENTED"); check("explain -> 501", ok, d)
    os.environ["LLM_DATA_MODE"] = "garbage"
    r = c.get("/api/v1/health"); check("health invalid mode -> 200 degraded/off", r.status_code == 200 and r.json()["status"] == "degraded"
                                       and r.json()["data_mode"] == "off", f"-> {r.status_code} {r.text[:160]}")
    os.environ["LLM_DATA_MODE"] = "synthetic_only"

    print("== A-15 DELETE purge ==")
    r = c.delete(f"/api/v1/sessions/{sid}", headers=H)
    check("DELETE session -> 204", r.status_code == 204, f"-> {r.status_code}")
    r = c.get(f"/api/v1/sessions/{sid}", headers=H)
    check("after delete: token rejected (401/404)", r.status_code in (401, 404), f"-> {r.status_code}")
    r = c.get(f"/api/v1/reports/{report_id}", headers=H)
    check("after delete: report gone (401/404)", r.status_code in (401, 404), f"-> {r.status_code}")

con = sqlite3.connect(DB)
leftover = {}
for (tbl,) in con.execute("select name from sqlite_master where type='table'"):
    cols = [r[1] for r in con.execute(f"pragma table_info('{tbl}')")]
    n = 0
    for row in con.execute(f"select * from '{tbl}'"):
        if any(sid in str(v) for v in row if v is not None):
            n += 1
    if n:
        leftover[tbl] = n
check("raw SQLite scan: no row anywhere mentions the deleted session id", not leftover, str(leftover))
print(f"\nTOTAL: {sum(R)} PASS / {len(R) - sum(R)} FAIL")
