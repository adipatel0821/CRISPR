"""CP1 audit LOW-1: the typed-answer path obeys contracts §5 like /facts does.

Expected values are written out by hand from the contract text, not computed by the code under test.
"""
from __future__ import annotations

import pytest

from intake import ledger, questions
from intake.errors import FactValidationError
from schemas.contracts import FactInput, QuestionResponse, Uncertainty
from schemas.validation import normalize_fact_value
from tests.test_intake_support import make_offer


# ---------------------------------------------------------------------------
# 1. typed-answer path obeys contracts §5
# ---------------------------------------------------------------------------
def _ask(key: str):
    return questions.build_candidate(key, {}, None, priority="blocking", blocks=["cashflow_impact"])


def _answer(key: str, typed=None, raw=None, existing=None):
    q = _ask(key)
    resp = QuestionResponse(question_id=q.question_id, fact_key=key, typed_value=typed, raw_answer=raw)
    return questions.apply_answer("s_t", q, resp, existing or [])


@pytest.mark.parametrize("typed,raw", [
    ("4200.005", None),     # audit: was rounded to 4200.01
    (None, "4200.005"),
    ("1e3", None),          # audit: was accepted as 1000.00
    (None, "1e3"),
    (4200.5, None),         # audit: JSON float was accepted
    (0.1, None),
])
def test_answers_reject_what_facts_rejects(typed, raw):
    with pytest.raises(FactValidationError) as e:
        _answer("income.take_home_monthly", typed=typed, raw=raw)
    assert e.value.message                      # friendly re-ask text
    # /facts (contract) rejects the same input
    with pytest.raises(ValueError):
        normalize_fact_value("income.take_home_monthly", typed if typed is not None else raw)


@pytest.mark.parametrize("typed,expected", [
    ("4200", "4200.00"), ("$4,200", "4200.00"), ("4,200.50", "4200.50"), (4200, "4200.00"), ("4.2k", "4200.00"),
])
def test_answers_keep_friendly_parsing_and_store_contract_values(typed, expected):
    out = _answer("income.take_home_monthly", typed=typed)
    v = out.new_facts[0].value
    assert v == expected
    assert normalize_fact_value("income.take_home_monthly", v) == expected


def test_currency_pair_rejects_float_inside_list():
    q = _pair_question()
    with pytest.raises(FactValidationError) as e:
        questions.apply_answer("s_t", q, QuestionResponse(question_id=q.question_id, typed_value=["4200", 2800.5]), [])
    assert "type it as text" in e.value.message


def _pair_question():
    facts = {"income.variability": {"key": "income.variability", "fact_id": "f_v", "status": "provided",
                                    "value": "somewhat_variable"}}
    q = questions.build_candidate("income.take_home_monthly", facts, make_offer("4000.00"), priority="blocking",
                                  blocks=["stress_test"])
    assert q.kind == "currency_pair", q.kind
    return q


def test_range_uncertainty_bounds_follow_the_contract():
    with pytest.raises(FactValidationError):
        ledger.apply_inputs("s", [], [FactInput.model_construct(
            key="savings.liquid", value="6000", status="estimated",
            uncertainty=Uncertainty.model_construct(kind="range", low="5000.005", high="7000"))])
    upd = ledger.apply_inputs("s", [], [{"key": "savings.liquid", "value": "6000", "status": "estimated",
                                         "uncertainty": {"kind": "range", "low": "5,000", "high": "7000.5"}}])
    u = upd.new_facts[0].uncertainty
    assert (u.low, u.high) == ("5000.00", "7000.50")
