"""A-02, A-03r (1,000 seeded random sessions), A-04, A-20 (property), A-23 (50 random ledgers),
and the display-only refinement effect with a monkeypatched engine.compute."""
from __future__ import annotations

import json
import random
from types import SimpleNamespace

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

import engine
from engine import requirements as req
from intake import ledger, ontology, questions
from intake.errors import FactValidationError
from schemas.contracts import TERM_KEYS, AnalysisId
from tests.test_intake_support import Session, make_offer

ALL = [a.value for a in AnalysisId]
TERMINAL = {"provided", "estimated", "declined"}


def _random_valid(q, rng):
    k = q.kind
    if k == "currency":
        return str(rng.choice([0, 150, 1200, 2900, 4200, 6000, rng.randint(0, 9000)]))
    if k == "currency_pair":
        a = rng.randint(1500, 6000)
        return [str(a), str(rng.randint(500, a))]
    if k == "number":
        if q.fact_key == "debts.count":
            return str(rng.randint(0, 3))
        return str(rng.randint(0, 60))
    if k in ("choice", "multi_choice"):
        return rng.choice(q.choices)
    if k == "yes_no":
        return rng.choice(["Yes", "No"])
    if k == "free_text":
        return json.dumps([{"date": "2028-01-01", "value": str(rng.randint(1000, 20000))}])
    raise AssertionError(k)


def _random_offer(rng):
    roll = rng.random()
    if roll < 0.2:
        return None
    if roll < 0.3:
        return make_offer("4000.00", ready=False)
    return make_offer(rng.choice(["0.00", "1500.00", "4000.00", None]))


def test_a03r_a02_a04_thousand_random_sessions_no_reasks():
    rng = random.Random(20261024)
    reasks, a02_violations, unfinished, incomplete, questions_asked, ack_repeats = 0, 0, 0, 0, 0, 0
    for _ in range(1000):
        selected = rng.sample(ALL, rng.randint(1, len(ALL)))
        s = Session(selected, _random_offer(rng))
        asked_acks: set[str] = set()
        passes, steps = 0, 0
        while steps < 200:
            steps += 1
            resp = s.next()
            q = resp.question
            if q is None:
                assert all(r.priority_class == "refinement" for r in resp.refinements)
                if s.skipped and passes < 2 and rng.random() < 0.5:
                    s.skipped.clear()
                    passes += 1
                    continue
                # A-04: every selected analysis is available or explains why not
                for r in resp.readiness:
                    if not (r.available or r.declined or r.awaiting_offer or set(r.missing) <= s.skipped):
                        incomplete += 1
                break
            questions_asked += 1
            assert q.fact_key not in TERM_KEYS and q.fact_key != req.OFFER_MINIMUM_SET
            assert resp.refinements == []
            if q.rule_id:
                if q.rule_id in asked_acks:
                    ack_repeats += 1
                asked_acks.add(q.rule_id)
                s.answer(q, rng.choice(q.choices) if rng.random() < 0.85 else None,
                         skipped=rng.random() < 0.1)
                continue
            cur = s.facts.get(q.fact_key)
            if cur is not None and cur.status in TERMINAL:
                reasks += 1
            # A-02: why_we_ask names only unavailable selected analyses
            unavailable = {r.analysis_id for r in resp.readiness if not r.available}
            if not (q.why_we_ask.startswith("Needed for:") and q.blocks_analyses
                    and set(q.blocks_analyses) <= unavailable and set(q.blocks_analyses) <= set(selected)
                    and all(ontology.load_ontology().analysis_name(a) in q.why_we_ask for a in q.blocks_analyses)):
                a02_violations += 1
            roll = rng.random()
            if roll < 0.06:
                with pytest.raises(FactValidationError):
                    s.answer(q, "not a number" if q.kind in ("currency", "number", "currency_pair") else "zzz")
                continue
            if roll < 0.18:
                s.answer(q, skipped=True)
            elif roll < 0.30:
                s.answer(q, declined=True)
            elif roll < 0.40 and q.kind in ("currency", "number", "currency_pair"):
                s.answer(q, _random_valid(q, rng), marked_estimate=True)
            elif roll < 0.45 and q.fact_key == "income.take_home_monthly" and q.kind == "currency":
                s.answer(q, "2,800 to 4,000")
            else:
                s.answer(q, _random_valid(q, rng))
        else:
            unfinished += 1
    print(f"A-03r: 1000 sessions, {questions_asked} questions asked, re-asks={reasks}, "
          f"A-02 violations={a02_violations}, unfinished={unfinished}, incomplete={incomplete}")
    assert reasks == 0
    assert ack_repeats == 0
    assert a02_violations == 0
    assert unfinished == 0
    assert incomplete == 0


# ---------------------------------------------------------------------------
# random ledgers (shared by A-20 and A-23)
# ---------------------------------------------------------------------------
_VALUES = {
    "income.take_home_monthly": ["0.00", "3100.00", "4200.00"],
    "expenses.essential.total": ["2350.00", "2900.00", "5000.00"],
    "debts.count": ["0", "1", "2"],
    "debts[d1].monthly_payment": ["210.00", "0.00"],
    "debts[d2].monthly_payment": ["95.00"],
    "savings.liquid": ["400.00", "6000.00", "500000.00"],
    "loan.down_payment_source": ["savings", "other", "none"],
    "income.variability": ["stable", "somewhat_variable", "highly_variable"],
    "income.low_month": ["2800.00"],
    "income.gross_monthly": ["5200.00"],
    "vehicle.value_estimates": ['[{"date":"2028-01-01","value":"15000.00"}]'],
}
_STATUSES = ["absent", "provided", "estimated", "declined", "missing"]


def _ledger_from(choices):
    facts = {}
    for key, (status, idx) in choices.items():
        if status == "absent":
            continue
        vals = _VALUES[key]
        facts[key] = {"key": key, "fact_id": f"f_{key}", "status": status,
                      "value": None if status in ("declined", "missing") else vals[idx % len(vals)]}
    return facts


fact_choices = st.fixed_dictionaries({k: st.tuples(st.sampled_from(_STATUSES), st.integers(0, 5)) for k in _VALUES})
offer_strategy = st.sampled_from([None, "unready", "0.00", "1500.00", "4000.00", "nocash"])


def _offer(tag):
    if tag is None:
        return None
    if tag == "unready":
        return make_offer("4000.00", ready=False)
    return make_offer(None if tag == "nocash" else tag)


@settings(max_examples=400, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(choices=fact_choices, offer_tag=offer_strategy,
       selected=st.lists(st.sampled_from(ALL), min_size=1, max_size=7, unique=True))
def test_a20_no_refinement_while_blocking_exists(choices, offer_tag, selected):
    facts = _ledger_from(choices)
    offer = _offer(offer_tag)
    resp = questions.next_question(facts, selected, offer, [])
    # independent blocking check straight from the engine evaluator
    blocking_exists = any(k != req.OFFER_MINIMUM_SET
                          for r in req.evaluate_all(selected, facts, offer) if not r.available for k in r.missing)
    if blocking_exists:
        assert resp.question is not None and resp.question.priority_class == "blocking"
    if resp.question is not None:
        assert resp.refinements == []
        assert resp.question.priority_class == "blocking"
    if resp.refinements:
        assert resp.question is None and not blocking_exists
        assert all(q.priority_class == "refinement" for q in resp.refinements)


def test_a23_graph_readiness_equals_engine_readiness_on_50_random_ledgers():
    rng = random.Random(23)
    compared = 0
    for _ in range(50):
        choices = {k: (rng.choice(_STATUSES), rng.randint(0, 5)) for k in _VALUES}
        facts = _ledger_from(choices)
        offer = _offer(rng.choice([None, "unready", "0.00", "1500.00", "4000.00", "nocash"]))
        g = ontology.graph_readiness(ALL, facts, offer)
        e = req.evaluate_all(ALL, facts, offer)
        for gr, er in zip(g, e):
            assert gr.analysis_id == er.analysis_id
            assert gr.available == er.available, (gr, er)
            assert gr.awaiting_offer == er.awaiting_offer
            assert set(gr.missing) == set(er.missing), (gr.analysis_id, gr.missing, er.missing)
            assert set(gr.declined) == set(er.declined)
            assert set(gr.required) == set(er.required)
            compared += 1
    assert compared == 50 * len(ALL)


def test_readiness_is_the_engine_evaluator():
    facts = _ledger_from({"income.take_home_monthly": ("provided", 1)})
    assert questions.readiness(facts, ALL, None) == req.evaluate_all(ALL, facts, None)


# ---------------------------------------------------------------------------
# refinement effect (display only), engine.compute monkeypatched
# ---------------------------------------------------------------------------
def _complete_session():
    s = Session(["loan_cost", "cashflow_impact", "reserve_impact", "stress_test", "alternatives"],
                make_offer("4000.00"))
    s.run_script(["4200", "2900", "0", "6000", "savings"])
    return s


def test_refinement_effect_uses_engine_baseline(monkeypatch):
    calls = []

    def fake_compute(facts, offer, config=None, **kw):
        calls.append(offer)
        return SimpleNamespace(metrics={"monthly_left_before": SimpleNamespace(value="1300.00", status=None)})

    monkeypatch.setattr(engine, "compute", fake_compute, raising=False)
    final = _complete_session().next()
    flex = next(q for q in final.refinements if q.fact_key == "expenses.flexible.total")
    assert flex.refinement_effect is not None
    assert flex.refinement_effect.metric == "monthly_left_after"
    assert flex.refinement_effect.max_abs_change == "1300.00"
    assert calls and calls[0] is None                     # baseline (no-offer) computation
    others = [q for q in final.refinements if q.fact_key != "expenses.flexible.total"]
    assert all(q.refinement_effect is None for q in others)


def test_refinement_effect_omitted_without_engine_or_non_positive(monkeypatch):
    monkeypatch.delattr(engine, "compute", raising=False)
    final = _complete_session().next()
    assert all(q.refinement_effect is None for q in final.refinements)
    monkeypatch.setattr(engine, "compute", lambda f, o, **k: {"metrics": {"monthly_left_before": {"value": "-50.00"}}},
                        raising=False)
    final = _complete_session().next()
    assert all(q.refinement_effect is None for q in final.refinements)
