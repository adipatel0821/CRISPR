"""Agent 5 supplementary re-audit probes for D0-002..D0-005 at 780c472 (black-box)."""
import json, os
from engine.requirements import required_facts, evaluate_readiness
from schemas.contracts import LoanOffer, VerifiedFinancialTerm, FactInput, ManualOfferRequest, ErrorDetail, data_mode_from_env
def run(label, fn):
    try: print(f"[{label}] ->", str(fn())[:300])
    except Exception as e: print(f"[{label}] -> {type(e).__name__}: {str(e).splitlines()[0][:80]} | {str(e).splitlines()[1][:120] if len(str(e).splitlines())>1 else ''}")
def f(k, v, s="provided"): return {"key": k, "value": v, "status": s}
F = lambda *xs: {x["key"]: x for x in xs}
res = F(f("income.take_home_monthly","4200"), f("expenses.essential.total","2900"), f("debts.count","0"), f("savings.liquid","6000"))
def offer(terms):
    return LoanOffer(offer_id="o", session_id="s", origin="manual", ready_for_calculation=True,
        terms={k: VerifiedFinancialTerm(term_key=k, value=v, value_type="currency", status=st, source_kind="user_input") for k,(v,st) in terms.items()})
print("== D0-003 residual cases ==")
run("cash_down 0 provided + pfc_paid_in_cash 500 CONFLICTING", lambda: "loan.down_payment_source" in required_facts("reserve_impact", res, offer({"cash_down":("0.00","provided"),"pfc_paid_in_cash":("500.00","conflicting")})))
run("cash_down 0 provided + pfc_paid_in_cash MISSING (value None)", lambda: "loan.down_payment_source" in required_facts("reserve_impact", res, offer({"cash_down":("0.00","provided"),"pfc_paid_in_cash":(None,"missing")})))
run("cash_down 0 provided + pfc_paid_in_cash 0 provided", lambda: "loan.down_payment_source" in required_facts("reserve_impact", res, offer({"cash_down":("0.00","provided"),"pfc_paid_in_cash":("0.00","provided")})))
print("== D0-002 extras ==")
for v in ["1.0", " 2 ", "51", "", None]:
    run(f"debts.count={v!r}", lambda v=v: evaluate_readiness("cashflow_impact", F(f("income.take_home_monthly","1"), f("expenses.essential.total","1"), f("debts.count", v)), None).missing)
print("== D0-004 FactInput / ManualOfferRequest ==")
for k, v in [("income.take_home_monthly","-100"),("income.take_home_monthly","abc"),("income.take_home_monthly","4200.00"),("income.take_home_monthly","$4,200"),("income.take_home_monthly","4,20,0"),("income.take_home_monthly","4200.005"),("debts.count","1.5"),("debts[d1].monthly_payment","-5"),("loan.down_payment_source","Savings"),("vehicle.value_estimates",'[{"date":"2027-10-01","value":"18000"}]')]:
    run(f"FactInput {k}={v!r}", lambda k=k, v=v: FactInput(key=k, value=v).value)
run("FactInput declined drops value", lambda: FactInput(key="savings.liquid", value="5", status="declined").value)
for t in [{"term_months": 500}, {"term_months": "60"}, {"contract_rate": "1.5"}, {"contract_rate": "4.75"}, {"apr": "0.0580"}, {"principal": 20000.0}, {"principal": "20000"}, {"bogus": "1"}, {"variable_rate": "no"}]:
    run(f"ManualOfferRequest {t}", lambda t=t: ManualOfferRequest(terms=t).terms)
print("== D0-005 ==")
for m in [None, "PAID", " Paid ", "garbage", "off"]:
    run(f"data_mode_from_env({m!r})", lambda m=m: data_mode_from_env(m).value)
from fastapi.testclient import TestClient
from api.main import app
for m in ["synthetic_only", "PAID", "garbage"]:
    os.environ["LLM_DATA_MODE"] = m
    r = TestClient(app, raise_server_exceptions=False).get("/api/v1/health"); print(f"[health LLM_DATA_MODE={m}] ->", r.status_code, r.json())
os.environ.pop("LLM_DATA_MODE")
r = TestClient(app, raise_server_exceptions=False).get("/api/v1/nope"); print("[404 envelope, CP0 app] ->", r.status_code, r.text)
run("ErrorDetail(code='METHOD_NOT_ALLOWED') (code used by wt-4 errors.py)", lambda: ErrorDetail(code="METHOD_NOT_ALLOWED", message="m"))
run("ErrorDetail(code='HTTP_ERROR') (wt-4 default)", lambda: ErrorDetail(code="HTTP_ERROR", message="m"))
print("== schemas.json sync ==")
from pydantic import BaseModel
from pydantic.json_schema import models_json_schema
from schemas import contracts
ms = [o for o in vars(contracts).values() if isinstance(o, type) and issubclass(o, BaseModel) and o.__module__ == contracts.__name__ and not o.__name__.startswith("_")]
_, sch = models_json_schema([(m, "serialization") for m in ms], title="DecisionTwin contracts v1.1")
print("[schemas.json in sync]", sch == json.load(open("../contracts/schemas.json", encoding="utf-8")), len(ms), "models")
