"""Manual offer (Milestone 2): A-27 payment typo, A-08 unsupported products, A-28 trade-in derived values,
validation errors. engine.offer_checks is monkeypatched with a small fake (Agent 1 owns the real one)."""
from __future__ import annotations

from pydantic import ValidationError

from decimal import Decimal
from types import SimpleNamespace

import pytest

import engine
from documents.errors import OfferValidationError, UnsupportedProduct
from documents.manual import build_manual_offer
from schemas.contracts import ManualOfferRequest

REF_PAYMENT = Decimal("375.14")   # reference_case.json / CFPB: $20,000 at 4.75 % for 60 months


def fake_offer_checks(offer):
    """Mimics engine.offer_checks for the reference loan: payment computed = $375.14."""
    disclosed = offer.terms.get("monthly_payment")
    mismatch = (Decimal(disclosed.value) - REF_PAYMENT) if disclosed else None
    has_principal = any(k in offer.terms for k in ("principal", "amount_financed"))
    basis = "stated" if "principal" in offer.terms else ("derived" if "prepaid_finance_charges" in offer.terms
                                                         else "assumed_pfc_zero")
    return SimpleNamespace(
        principal=Decimal("20000.00") if has_principal else None, principal_basis=basis if has_principal else None,
        computed_payment=REF_PAYMENT, payment_mismatch=mismatch,
        arithmetic="pass" if mismatch is None or abs(mismatch) <= 1 else "fail",
        apr_recompute="pass", itemization="not_applicable", range="pass", apr_recomputed=Decimal("0.05796"),
        unsupported_features=[], warnings=[])


@pytest.fixture
def checks(monkeypatch):
    monkeypatch.setattr(engine, "offer_checks", fake_offer_checks, raising=False)


REF_TERMS = {"cash_price": "22000.00", "taxes_title_fees": "1500.00", "cash_down": "4000.00",
             "principal": "20000.00", "amount_financed": "19500.00", "prepaid_finance_charges": "500.00",
             "contract_rate": "0.0475", "apr": "0.05796", "term_months": 60, "monthly_payment": "375.14"}


def test_reference_offer_ready_and_user_confirmed(checks):
    offer = build_manual_offer("s1", ManualOfferRequest(label="Dealer A", terms=REF_TERMS))
    assert offer.origin == "manual" and offer.offer_id.startswith("o_")
    assert offer.ready_for_calculation
    assert offer.warnings == []
    assert offer.derived.principal_basis == "stated"
    t = offer.terms["monthly_payment"]
    assert t.value == "375.14" and t.status == "provided" and t.source_kind == "user_input"
    assert t.verification == "user_confirmed"            # never "verified"/evidence_matched for typed values
    assert t.evidence.display_label == "You entered"
    assert t.checks.arithmetic == "pass" and offer.terms["apr"].checks.apr_recompute == "pass"
    assert offer.terms["term_months"].value == "60"
    assert offer.terms["contract_rate"].value == "0.0475"
    assert offer.derived.negative_equity_rolled_in == "0.00" and offer.derived.trade_in_equity is None


def test_unconfirmed_entry_has_no_verification(checks):
    offer = build_manual_offer("s1", {"terms": REF_TERMS, "confirmed": False})
    assert all(t.verification == "none" for t in offer.terms.values())


def test_a27_manual_payment_typo_warns(checks):
    terms = {**REF_TERMS, "monthly_payment": "3,751.40"}
    offer = build_manual_offer("s1", ManualOfferRequest(terms=terms))
    assert "PAYMENT_MISMATCH" in offer.warnings
    assert offer.terms["monthly_payment"].value == "3751.40"
    assert offer.terms["monthly_payment"].checks.arithmetic == "fail"
    assert offer.ready_for_calculation                    # a warning, not a block


def test_a24_one_cent_difference_is_not_a_mismatch(checks):
    offer = build_manual_offer("s1", ManualOfferRequest(terms={**REF_TERMS, "monthly_payment": "375.15"}))
    assert "PAYMENT_MISMATCH" not in offer.warnings


@pytest.mark.parametrize("terms,feature", [
    ({"variable_rate": True}, "variable_rate"),
    ({"variable_rate": "yes"}, "variable_rate"),
    ({"balloon_payment": "5000.00"}, "balloon_payment"),
    ({"balloon_payment": True}, "balloon_payment"),
])
def test_a08_unsupported_products(checks, terms, feature):
    with pytest.raises(UnsupportedProduct) as e:
        build_manual_offer("s1", ManualOfferRequest(terms={**REF_TERMS, **terms}))
    assert e.value.features == [feature]
    assert e.value.code == "UNSUPPORTED_PRODUCT"
    assert "fixed-rate" in e.value.message or "equal monthly payments" in e.value.message
    assert e.value.offer is not None and not e.value.offer.ready_for_calculation
    assert e.value.offer.terms["principal"].value == "20000.00"      # terms still shown


def test_no_balloon_is_supported(checks):
    offer = build_manual_offer("s1", ManualOfferRequest(terms={**REF_TERMS, "balloon_payment": "0",
                                                               "variable_rate": False}))
    assert offer.ready_for_calculation and offer.unsupported_features == []


@pytest.mark.parametrize("payoff,equity,rolled", [("5000", "3000.00", "0.00"), ("10000", "-2000.00", "2000.00")])
def test_a28_trade_in_derived(checks, payoff, equity, rolled):
    terms = {"cash_price": "25000", "cash_down": "1000", "trade_in_value": "8000", "trade_in_payoff": payoff,
             "contract_rate": "0.07", "term_months": 60, "amount_financed": "20000"}
    offer = build_manual_offer("s1", ManualOfferRequest(terms=terms))
    assert offer.derived.trade_in_equity == equity
    assert offer.derived.negative_equity_rolled_in == rolled


def test_rate_validation(checks):
    # The builder keeps its own checks for internal callers (model_construct bypasses the contract model);
    # the contract model itself also rejects these values at the API boundary (tests/test_cp0_directives.py).
    with pytest.raises(OfferValidationError) as e:
        build_manual_offer("s1", ManualOfferRequest.model_construct(terms={**REF_TERMS, "contract_rate": "4.75"}))
    assert "0.0475" in e.value.message
    offer = build_manual_offer("s1", ManualOfferRequest(terms={**REF_TERMS, "contract_rate": "4.75%"}))
    assert offer.terms["contract_rate"].value == "0.0475"
    with pytest.raises(OfferValidationError):
        build_manual_offer("s1", ManualOfferRequest.model_construct(terms={**REF_TERMS, "apr": "-0.01"}))


@pytest.mark.parametrize("bad", [{"term_months": 500}, {"term_months": 5}, {"term_months": "60.5"},
                                 {"cash_price": "-1"}, {"monthly_payment": "abc"}, {"loan_amount": "20000"}])
def test_validation_errors(checks, bad):
    with pytest.raises(OfferValidationError) as e:
        build_manual_offer("s1", ManualOfferRequest.model_construct(terms={**REF_TERMS, **bad}))
    assert e.value.message
    with pytest.raises(ValidationError):            # and the contract model rejects it at the API boundary
        ManualOfferRequest(terms={**REF_TERMS, **bad})


def test_not_ready_without_rate(checks):
    terms = {k: v for k, v in REF_TERMS.items() if k not in ("contract_rate", "apr")}
    offer = build_manual_offer("s1", ManualOfferRequest(terms=terms))
    assert not offer.ready_for_calculation


def test_not_ready_when_engine_cannot_resolve_principal(checks):
    terms = {k: v for k, v in REF_TERMS.items() if k not in ("principal", "amount_financed")}
    offer = build_manual_offer("s1", ManualOfferRequest(terms=terms))
    assert not offer.ready_for_calculation


def test_engine_absent_falls_back_and_says_so(monkeypatch):
    monkeypatch.delattr(engine, "offer_checks", raising=False)
    offer = build_manual_offer("s1", ManualOfferRequest(terms=REF_TERMS))
    assert "OFFER_CHECKS_UNAVAILABLE" in offer.warnings
    assert offer.ready_for_calculation
    assert offer.terms["monthly_payment"].checks.arithmetic == "not_applicable"
