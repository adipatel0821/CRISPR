"""CP0 smoke tests: shared contracts import and the readiness evaluator follows contracts §3.12."""
from engine.requirements import evaluate_readiness, OFFER_MINIMUM_SET
from schemas.contracts import LoanOffer


def fact(key, value, status="provided"):
    return {"key": key, "value": value, "status": status}


def facts(*items):
    return {f["key"]: f for f in items}


READY_OFFER = LoanOffer(offer_id="o1", session_id="s1", origin="manual", ready_for_calculation=True)


def test_loan_cost_needs_only_offer():
    r = evaluate_readiness("loan_cost", {}, READY_OFFER)
    assert r.available and r.required == [OFFER_MINIMUM_SET]
    r2 = evaluate_readiness("loan_cost", {}, None)
    assert not r2.available and r2.awaiting_offer


def test_debt_without_payment_blocks_cashflow():
    f = facts(fact("income.take_home_monthly", "4200"), fact("expenses.essential.total", "2900"),
              fact("debts.count", "1"), fact("debts[d1].type", "student_loan"),
              fact("debts[d1].monthly_payment", None, "missing"))
    r = evaluate_readiness("cashflow_impact", f, READY_OFFER)
    assert not r.available and r.missing == ["debts[d1].monthly_payment"]


def test_declined_is_reported_not_missing():
    f = facts(fact("income.take_home_monthly", "4200"), fact("expenses.essential.total", "2900"),
              fact("debts.count", "0"), fact("savings.liquid", None, "declined"))
    r = evaluate_readiness("reserve_impact", f, READY_OFFER)
    assert r.declined == ["savings.liquid"] and "loan.down_payment_source" in r.missing


def test_low_month_required_only_for_variable_income():
    base = [fact("income.take_home_monthly", "3400"), fact("expenses.essential.total", "2000"),
            fact("debts.count", "0"), fact("savings.liquid", "1000"), fact("loan.down_payment_source", "savings")]
    assert evaluate_readiness("stress_test", facts(*base), READY_OFFER).available
    var = facts(*base, fact("income.variability", "highly_variable"))
    assert evaluate_readiness("stress_test", var, READY_OFFER).missing == ["income.low_month"]
