"""Agent 5 behavioural probes of CP0 readiness evaluator + contracts (black-box)."""
import json, traceback
from engine.requirements import evaluate_readiness, required_facts
from schemas.contracts import (LoanOffer, VerifiedFinancialTerm, FinancialFact, Metric, ManualOfferRequest,
                               KnowledgeGraphEdge, FactStatus, ErrorDetail, ExplanationSection, Uncertainty)

def f(k, v, s="provided"): return {"key": k, "value": v, "status": s}
def F(*xs): return {x["key"]: x for x in xs}
READY = LoanOffer(offer_id="o1", session_id="s1", origin="manual", ready_for_calculation=True)
def offer_with(terms):
    return LoanOffer(offer_id="o2", session_id="s1", origin="manual", ready_for_calculation=True,
                     terms={k: VerifiedFinancialTerm(term_key=k, value=v, value_type="currency", status="provided",
                                                     source_kind="user_input") for k, v in terms.items()})
base = [f("income.take_home_monthly", "4200"), f("expenses.essential.total", "2900")]
def run(label, fn):
    try:
        r = fn(); out = (r if not hasattr(r, "model_dump") else
                     {k: v for k, v in r.model_dump().items() if k in ("available", "missing", "declined", "required", "awaiting_offer")}); s = str(out); print(f"[{label}] ->", s if len(s) < 600 else s[:600] + f" ...[truncated, {len(s)} chars]")
    except Exception as e:
        print(f"[{label}] -> EXCEPTION {type(e).__name__}: {e}")

print("== debts.count edge cases (cashflow_impact) ==")
for v in ["0", "2", "1.5", "0.4", "-1", "two", "none", "NaN", "Infinity", "1e3"]:
    run(f"debts.count={v!r}", lambda v=v: evaluate_readiness("cashflow_impact", F(*base, f("debts.count", v)), READY))
print("== debts.count=2 with item ids 'car' and 'd2' ==")
run("ids car,d2", lambda: evaluate_readiness("cashflow_impact", F(*base, f("debts.count", "2"),
    f("debts[car].monthly_payment", "300"), f("debts[d2].type", "bnpl")), READY))
print("== debts.count=0 but an item exists with a payment ==")
run("count0+item", lambda: evaluate_readiness("cashflow_impact", F(*base, f("debts.count", "0"),
    f("debts[d1].monthly_payment", "300")), READY))
print("== status passed as Enum ==")
run("enum status", lambda: evaluate_readiness("cashflow_impact", {
    "income.take_home_monthly": {"value": "1", "status": FactStatus.provided},
    "expenses.essential.total": {"value": "1", "status": FactStatus.estimated},
    "debts.count": {"value": "0", "status": FactStatus.provided}}, READY))
run("FinancialFact objects", lambda: evaluate_readiness("cashflow_impact", {
    k: FinancialFact(fact_id=k, session_id="s", key=k, value=v, value_type="currency", status="provided")
    for k, v in [("income.take_home_monthly", "1"), ("expenses.essential.total", "1"), ("debts.count", "0")]}, READY))
print("== down_payment_source condition ==")
res = [*base, f("debts.count", "0"), f("savings.liquid", "6000")]
run("no offer", lambda: required_facts("reserve_impact", F(*res), None))
run("cash_down=4000", lambda: required_facts("reserve_impact", F(*res), offer_with({"cash_down": "4000.00"})))
run("cash_down=0.00", lambda: required_facts("reserve_impact", F(*res), offer_with({"cash_down": "0.00"})))
run("cash_down=0, pfc_paid_in_cash=500", lambda: required_facts("reserve_impact", F(*res),
    offer_with({"cash_down": "0.00", "pfc_paid_in_cash": "500.00"})))
conf = offer_with({"cash_down": "0.00"}); conf.terms["cash_down"].status = "conflicting"
run("cash_down=0.00 but status conflicting", lambda: required_facts("reserve_impact", F(*res), conf))
run("flat dict offer (fixture shape) cash_down=0.00", lambda: required_facts("reserve_impact", F(*res),
    {"ready_for_calculation": True, "terms": {"cash_down": "0.00"}}))
print("== low_month ==")
st = [*res, f("loan.down_payment_source", "savings")]
run("variability missing", lambda: evaluate_readiness("stress_test", F(*st, f("income.variability", None, "missing")), READY))
run("variability somewhat_variable, low_month declined", lambda: evaluate_readiness("stress_test",
    F(*st, f("income.variability", "somewhat_variable"), f("income.low_month", None, "declined")), READY))
print("== contracts: money/rates as strings ==")
run("FinancialFact value float", lambda: FinancialFact(fact_id="x", session_id="s", key="k", value=4200.0, value_type="currency", status="provided"))
run("FinancialFact value 'abc' currency", lambda: FinancialFact(fact_id="x", session_id="s", key="k", value="abc", value_type="currency", status="provided").value)
run("FinancialFact value '-5.123' currency", lambda: FinancialFact(fact_id="x", session_id="s", key="k", value="-5.123", value_type="currency", status="provided").value)
run("Metric value float", lambda: Metric(value=375.14, formula_id="F01"))
run("ManualOfferRequest float rate", lambda: ManualOfferRequest(terms={"contract_rate": 0.0475}).terms)
run("ManualOfferRequest float principal 20000.0", lambda: ManualOfferRequest(terms={"principal": 20000.0}).terms)
run("VerifiedFinancialTerm term_months '500'", lambda: VerifiedFinancialTerm(term_key="term_months", value="500", value_type="integer", status="provided", source_kind="user_input").value)
run("VerifiedFinancialTerm apr '1.5'", lambda: VerifiedFinancialTerm(term_key="apr", value="1.5", value_type="rate", status="provided", source_kind="user_input").value)
run("VerifiedFinancialTerm model_self_report", lambda: VerifiedFinancialTerm(term_key="apr", value="0.05", value_type="rate", status="provided", source_kind="document", model_self_report="high").model_dump())
run("Uncertainty range without low/high", lambda: Uncertainty(kind="range").model_dump())
run("narrative_text non-null", lambda: ExplanationSection(section_id="k", template_text="t", narrative_text="x"))
run("ErrorDetail arbitrary code", lambda: ErrorDetail(code="WHATEVER", message="m").code)
run("KnowledgeGraphEdge dump default", lambda: KnowledgeGraphEdge(**{"edge_id": "e", "from": "a", "to": "b", "edge_type": "required_by"}).model_dump())
