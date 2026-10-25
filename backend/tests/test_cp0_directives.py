"""Regression tests for audit directives D0-002 … D0-005 (verification tests as written by Agent 5)."""
import pytest
from fastapi.testclient import TestClient
from hypothesis import given, strategies as st
from pydantic import ValidationError

from engine.requirements import evaluate_readiness, required_facts
from schemas.contracts import ErrorBody, ErrorCode, FactInput, LoanOffer, ManualOfferRequest, Uncertainty


def fact(key, value, status="provided"):
    return {"key": key, "value": value, "status": status}


BASE = {f["key"]: f for f in [fact("income.take_home_monthly", "4200.00"), fact("expenses.essential.total", "2900.00"),
                               fact("savings.liquid", "6000.00"), fact("loan.down_payment_source", "savings")]}
READY = LoanOffer(offer_id="o1", session_id="s1", origin="manual", ready_for_calculation=True)


# ---- D0-002 -------------------------------------------------------------------------------------------
@pytest.mark.parametrize("bad", ["two", "none", "0.4", "1.5", "-1", "NaN", "Infinity", "1e3", ""])
def test_invalid_debt_count_is_unknown_not_zero(bad):
    facts = dict(BASE, **{"debts.count": fact("debts.count", bad)})
    for analysis in ("cashflow_impact", "reserve_impact", "stress_test", "alternatives", "dti"):
        r = evaluate_readiness(analysis, facts, READY)
        assert r.available is False and "debts.count" in r.missing


@pytest.mark.parametrize("good,expected_missing", [("0", []), ("2", ["debts[d1].monthly_payment", "debts[d2].monthly_payment"])])
def test_valid_debt_counts_unchanged(good, expected_missing):
    facts = dict(BASE, **{"debts.count": fact("debts.count", good)})
    assert evaluate_readiness("cashflow_impact", facts, READY).missing == expected_missing


@given(st.text(max_size=12))
def test_readiness_never_raises_for_any_count_text(text):
    facts = dict(BASE, **{"debts.count": fact("debts.count", text)})
    assert evaluate_readiness("reserve_impact", facts, READY).analysis_id == "reserve_impact"


# ---- D0-003 -------------------------------------------------------------------------------------------
def test_down_source_needed_when_pfc_cash_conflicting():
    o = _offer(pfc_cash="500.00")
    o.terms["pfc_paid_in_cash"].status = "conflicting"
    assert "loan.down_payment_source" in required_facts("reserve_impact", BASE, o)


def test_down_source_omitted_when_pfc_cash_zero():
    assert "loan.down_payment_source" not in required_facts("reserve_impact", BASE, _offer(pfc_cash="0.00"))


def _offer(cash_down_status="provided", pfc_cash=None):
    terms = {"cash_down": {"term_key": "cash_down", "value": "0.00", "value_type": "currency",
                           "status": cash_down_status, "source_kind": "user_input"}}
    if pfc_cash is not None:
        terms["pfc_paid_in_cash"] = {"term_key": "pfc_paid_in_cash", "value": pfc_cash, "value_type": "currency",
                                     "status": "provided", "source_kind": "user_input"}
    return LoanOffer(offer_id="o2", session_id="s1", origin="manual", ready_for_calculation=True, terms=terms)


def test_down_source_needed_when_pfc_paid_in_cash():
    assert "loan.down_payment_source" in required_facts("reserve_impact", BASE, _offer(pfc_cash="500.00"))


def test_down_source_needed_when_cash_down_conflicting():
    assert "loan.down_payment_source" in required_facts("reserve_impact", BASE, _offer(cash_down_status="conflicting"))


def test_down_source_omitted_when_zero_down_and_no_pfc_cash():
    assert "loan.down_payment_source" not in required_facts("reserve_impact", BASE, _offer())


# ---- IMP-009 (auditor question: declined low_month) ----------------------------------------------------
def test_declined_low_month_does_not_block_stress():
    facts = dict(BASE, **{"debts.count": fact("debts.count", "0"),
                          "income.variability": fact("income.variability", "highly_variable"),
                          "income.low_month": fact("income.low_month", None, "declined")})
    assert evaluate_readiness("stress_test", facts, READY).available
    facts["income.low_month"] = fact("income.low_month", None, "missing")
    assert evaluate_readiness("stress_test", facts, READY).missing == ["income.low_month"]


# ---- D0-004 -------------------------------------------------------------------------------------------
@pytest.mark.parametrize("bad", ["-100", "abc", "-5.123", "4200.123", 4200.5])
def test_fact_currency_rejected(bad):
    with pytest.raises(ValidationError):
        FactInput(key="income.take_home_monthly", value=bad)


def test_fact_currency_normalized():
    assert FactInput(key="income.take_home_monthly", value="$4,200").value == "4200.00"
    assert FactInput(key="savings.liquid", value=None, status="declined").value is None


@pytest.mark.parametrize("terms", [{"term_months": 500}, {"contract_rate": "1.5"}, {"principal": 20000.0},
                                   {"principal": "-1"}, {"nonsense_term": "1"}])
def test_manual_offer_terms_rejected(terms):
    with pytest.raises(ValidationError):
        ManualOfferRequest(terms=terms)


def test_manual_offer_reference_terms_valid():
    req = ManualOfferRequest(terms={"principal": "20000.00", "amount_financed": "19500", "prepaid_finance_charges": "500",
                                    "contract_rate": "0.0475", "apr": "0.05796", "term_months": 60, "cash_down": "4000"})
    assert req.terms["term_months"] == "60" and req.terms["amount_financed"] == "19500.00"


def test_range_uncertainty_requires_bounds():
    with pytest.raises(ValidationError):
        Uncertainty(kind="range")
    assert Uncertainty(kind="range", low="2800", high="4000").low == "2800.00"


# ---- D0-005 -------------------------------------------------------------------------------------------
def test_error_code_enum_and_body():
    assert {c.value for c in ErrorCode} >= {"VALIDATION_ERROR", "NOT_FOUND", "LLM_UNAVAILABLE", "NOT_IMPLEMENTED"}
    with pytest.raises(ValidationError):
        ErrorBody(error={"code": "MADE_UP", "message": "x"})


def test_health_survives_invalid_data_mode(monkeypatch):
    from api.main import app
    monkeypatch.setenv("LLM_DATA_MODE", "PAIDX")
    r = TestClient(app).get("/api/v1/health")
    assert r.status_code == 200 and r.json()["status"] == "degraded" and r.json()["data_mode"] == "off"
