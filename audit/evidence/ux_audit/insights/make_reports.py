"""Agent 5: build DecisionReport JSON for the reference household and the demo EDGE household via the real API
(TestClient, throwaway DB; no ports). Run from backend/ with PYTHONPATH=. ; arg1 = scratch db path, arg2 = out dir."""
import json, os, sys
db, out = sys.argv[1], sys.argv[2]
if os.path.exists(db): os.remove(db)
os.environ["DATABASE_URL"] = "sqlite:///" + db.replace("\\", "/"); os.environ["LLM_DATA_MODE"] = "synthetic_only"; os.environ.pop("GEMINI_API_KEY", None)
from fastapi.testclient import TestClient
from api.main import app
REF_FACTS = [("income.take_home_monthly", "4200"), ("expenses.essential.total", "2900"), ("debts.count", "0"), ("savings.liquid", "6000"), ("loan.down_payment_source", "savings")]
REF_OFFER = {"cash_price": "22000.00", "taxes_title_fees": "1500.00", "cash_down": "4000.00", "principal": "20000.00", "amount_financed": "19500.00",
             "prepaid_finance_charges": "500.00", "contract_rate": "0.0475", "term_months": "60", "monthly_payment": "375.14"}
EDGE_FACTS = [("income.take_home_monthly", "3100"), ("income.variability", "stable"), ("expenses.essential.total", "2350"), ("debts.count", "2"),
              ("debts[d1].type", "student_loan"), ("debts[d1].monthly_payment", "210"), ("debts[d2].type", "bnpl"), ("debts[d2].monthly_payment", "95"),
              ("debts[d2].remaining_months", "4"), ("savings.liquid", "400"), ("loan.down_payment_source", "other")]
EDGE_OFFER = {"cash_price": "18000.00", "taxes_title_fees": "1200.00", "cash_down": "1500.00", "contract_rate": "0.0899", "term_months": "72"}
with TestClient(app) as c:
    for name, facts, offer in [("reference", REF_FACTS, REF_OFFER), ("edge", EDGE_FACTS, EDGE_OFFER)]:
        j = c.post("/api/v1/sessions", json={}).json(); H = {"Authorization": f"Bearer {j['token']}"}; sid = j["session_id"]
        assert c.post(f"/api/v1/sessions/{sid}/facts", headers=H, json={"facts": [{"key": k, "value": v} for k, v in facts]}).status_code == 200
        assert c.post(f"/api/v1/sessions/{sid}/offers", headers=H, json={"terms": offer}).status_code == 200
        r = c.post(f"/api/v1/sessions/{sid}/analysis", headers=H, json={}); assert r.status_code == 200, r.text[:300]
        open(os.path.join(out, f"report_{name}.json"), "w", encoding="utf-8").write(r.text)
        print(name, "ok")
