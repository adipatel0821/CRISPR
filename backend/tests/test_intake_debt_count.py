"""Lowering debts.count retires the extra debt items (Agent 2 known defect reported at CP1).

Readiness is checked with engine.requirements (debt_requirements / evaluate_readiness); expected key lists are
written out by hand.
"""
from __future__ import annotations

from engine import requirements as req
from intake import ledger, questions
from schemas.contracts import FactInput
from tests.test_intake_support import Session, make_offer


def _put(ledger_list, key, value, status="provided"):
    upd = ledger.apply_inputs("s", ledger_list, [FactInput.model_construct(key=key, value=value, status=status)])
    return ledger_list + upd.new_facts, upd


BASE = [("income.take_home_monthly", "4200"), ("expenses.essential.total", "2900"), ("savings.liquid", "6000"),
        ("loan.down_payment_source", "savings")]


def _household_with_three_debts():
    led: list = []
    for k, v in BASE:
        led, _ = _put(led, k, v)
    led, _ = _put(led, "debts.count", "3")
    for i, pay in ((1, "210"), (2, "95"), (3, "40")):
        led, _ = _put(led, f"debts[d{i}].monthly_payment", pay)
    led, _ = _put(led, "debts[d3].balance", "800")
    return led


def test_lowering_count_supersedes_extra_items_highest_first():
    led = _household_with_three_debts()
    before = ledger.current_facts(led)
    old_ids = {k: before[k].fact_id for k in ("debts[d2].monthly_payment", "debts[d3].monthly_payment",
                                               "debts[d3].balance")}
    led, upd = _put(led, "debts.count", "1")
    tombs = [f for f in upd.new_facts if f.status == "superseded"]
    # d3's facts are retired before d2's (highest ids first), every one points at the fact it retires
    assert [f.key for f in tombs] == ["debts[d3].balance", "debts[d3].monthly_payment", "debts[d2].monthly_payment"]
    assert all(f.value is None and f.supersedes == old_ids[f.key] for f in tombs)
    assert set(old_ids.values()) <= set(upd.superseded_ids)
    cur = ledger.current_facts(led)
    assert cur["debts.count"].value == "1"
    assert cur["debts[d1].monthly_payment"].value == "210.00"
    assert not any(k.startswith(("debts[d2]", "debts[d3]")) for k in cur)
    assert req.debt_requirements(cur) == ["debts.count", "debts[d1].monthly_payment"]
    r = req.evaluate_readiness("cashflow_impact", cur, make_offer("4000.00"))
    assert r.available and r.missing == []
    r = req.evaluate_readiness("reserve_impact", cur, make_offer("4000.00"))
    assert r.available and r.missing == []


def test_storage_style_marking_gives_the_same_current_facts():
    """repo.add_facts marks superseded_ids rows status=superseded; current_facts must agree with the
    pointer-only (in-memory) view."""
    led = _household_with_three_debts()
    led2, upd = _put(led, "debts.count", "1")
    stored = []
    for f in led2:
        d = f.model_dump(mode="json")
        if f.fact_id in upd.superseded_ids:
            d["status"] = "superseded"
        stored.append(d)
    assert set(ledger.current_facts(stored)) == set(ledger.current_facts(led2))


def test_raising_count_again_requires_the_new_items():
    led = _household_with_three_debts()
    led, _ = _put(led, "debts.count", "1")
    led, upd = _put(led, "debts.count", "3")
    cur = ledger.current_facts(led)
    assert cur["debts[d2].monthly_payment"].status == "missing" and cur["debts[d2].monthly_payment"].value is None
    assert cur["debts[d3].monthly_payment"].status == "missing"
    assert "debts[d3].balance" not in cur                 # the retired balance does not come back
    assert req.debt_requirements(cur) == ["debts.count", "debts[d1].monthly_payment", "debts[d2].monthly_payment",
                                          "debts[d3].monthly_payment"]
    r = req.evaluate_readiness("cashflow_impact", cur, make_offer("4000.00"))
    assert not r.available
    assert set(r.missing) == {"debts[d2].monthly_payment", "debts[d3].monthly_payment"}


def test_count_zero_retires_every_item_and_means_no_debts():
    led = _household_with_three_debts()
    led, _ = _put(led, "debts.count", "0")
    cur = ledger.current_facts(led)
    assert not any(k.startswith("debts[") for k in cur)
    assert req.debt_requirements(cur) == ["debts.count"]
    assert req.evaluate_readiness("cashflow_impact", cur, make_offer("4000.00")).available


def test_unchanged_or_raised_count_retires_nothing():
    led = _household_with_three_debts()
    _, upd = _put(led, "debts.count", "3")
    assert upd.new_facts == [] and upd.superseded_ids == []
    _, upd = _put(led, "debts.count", "4")
    assert not any(f.status == "superseded" for f in upd.new_facts)
    assert [f.key for f in upd.new_facts if f.status == "missing"] == ["debts[d4].monthly_payment"]


def test_declined_count_retires_nothing():
    led = _household_with_three_debts()
    _, upd = _put(led, "debts.count", None, status="declined")
    assert not any(f.status == "superseded" for f in upd.new_facts)


def test_lowering_count_through_the_interview():
    """Same defect via the answers path: 3 announced placeholders, user corrects the count to 1."""
    s = Session(["cashflow_impact"], make_offer("4000.00"))
    for k, v in BASE[:2]:
        s.ledger, _ = _put(s.ledger, k, v)
    q = questions.build_candidate("debts.count", s.facts, s.offer, priority="blocking", blocks=["cashflow_impact"])
    s.answer(q, "3")
    assert set(req.evaluate_readiness("cashflow_impact", s.facts, s.offer).missing) == {
        "debts[d1].monthly_payment", "debts[d2].monthly_payment", "debts[d3].monthly_payment"}
    s.answer(q, "1")
    r = req.evaluate_readiness("cashflow_impact", s.facts, s.offer)
    assert r.missing == ["debts[d1].monthly_payment"]
    nxt = s.next().question
    assert nxt is not None and nxt.fact_key == "debts[d1].monthly_payment"
    s.answer(nxt, "210")
    assert req.evaluate_readiness("cashflow_impact", s.facts, s.offer).available
    assert s.next().question is None
