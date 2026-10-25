"""Stage 5: A-11r, A-36, A-37, A-38, A-39 + Pareto, rate sensitivity, readiness, performance."""
import time
from decimal import Decimal

from counterfactual import evaluate
from engine import compute, payment
from engine.inputs import term
from tests.test_engine_helpers import household, offer, reference_offer

ADD_ONS = [
    {"item": "add_on", "name": "GAP", "amount": "1000.00", "optional": True},
    {"item": "add_on", "name": "Service contract", "amount": "1500.00", "optional": None},
    {"item": "add_on", "name": "Etching", "amount": "300.00", "optional": False},
]


def alt(result, **levers):
    for a in result.alternatives:
        if all(a.lever_values[k] == v for k, v in levers.items()):
            return a
    raise AssertionError(f"no alternative with {levers}")


# ---------------------------------------------------------------- A-11r base reproduction + monotonicity
def test_a11r_base_alternative_byte_equal_to_base_calc():
    hh, o = household(), reference_offer()
    cf = evaluate(hh, o)
    base = compute(hh, o)
    b = cf.alternatives[0]
    assert b.is_base and b.alt_id == "alt_000" and b.label == "Your offer as quoted"
    for k, v in b.metrics.items():
        if k == "break_even_m3":
            continue
        assert v == base.metrics[k].value, k
    assert b.metrics["monthly_payment"] == "375.14" and b.metrics["finance_charge"] == "3008.29"
    assert b.metrics["break_even_m3"] == "0.27"
    assert all(v in ("0.00", None) for v in b.deltas_vs_base.values())


def test_a11r_longer_term_lower_payment_higher_finance_charge():
    cf = evaluate(household(), reference_offer())
    by_term = {t: alt(cf, cash_down_delta="0", term_months=t, remove_optional_add_ons=False) for t in (36, 48, 60, 72)}
    pays = [Decimal(by_term[t].metrics["monthly_payment"]) for t in (36, 48, 60, 72)]
    fcs = [Decimal(by_term[t].metrics["finance_charge"]) for t in (36, 48, 60, 72)]
    assert pays == sorted(pays, reverse=True) and len(set(pays)) == 4
    assert fcs == sorted(fcs) and len(set(fcs)) == 4
    # CFPB en-753 table payments for $20,000 @ 4.75% (independent reference)
    assert [str(p) for p in pays] == ["597.18", "458.32", "375.14", "319.78"]


# ---------------------------------------------------------------- A-36 down-payment trade-off
def test_a36_extra_2000_down_from_savings():
    cf = evaluate(household(), reference_offer())
    a = alt(cf, cash_down_delta="2000", term_months=60, remove_optional_add_ons=False)
    assert a.feasible
    assert a.metrics["principal"] == "18000.00"
    assert a.metrics["monthly_payment"] == "337.62"              # independent: 375.1382 × 0.9 = 337.624
    assert Decimal(a.deltas_vs_base["monthly_payment"]) < 0
    assert a.deltas_vs_base["monthly_payment"] == "-37.52"
    assert a.metrics["savings_after_purchase"] == "0.00"
    assert a.deltas_vs_base["savings_after_purchase"] == "-2000.00"
    assert Decimal(a.deltas_vs_base["finance_charge"]) < 0


def test_cash_down_lever_bounded_by_savings_after_purchase():
    hh = household(**{"savings.liquid": "5000.00"})            # F13 = 1000
    cf = evaluate(hh, reference_offer())
    ok = alt(cf, cash_down_delta="1000", term_months=60, remove_optional_add_ons=False)
    too_much = alt(cf, cash_down_delta="2000", term_months=60, remove_optional_add_ons=False)
    assert ok.feasible and ok.metrics["savings_after_purchase"] == "0.00"
    assert not too_much.feasible and "savings after the purchase" in too_much.infeasible_reasons[0]
    assert too_much.alt_id not in cf.pareto_set


def test_extra_down_with_other_source_is_drawn_from_savings_and_flagged():
    hh = household(**{"loan.down_payment_source": "other"})    # F13 = 6000
    cf = evaluate(hh, reference_offer())
    a = alt(cf, cash_down_delta="500", term_months=60, remove_optional_add_ons=False)
    assert "extra_down_from_savings" in a.assumption_flags
    assert a.deltas_vs_base["savings_after_purchase"] == "-500.00"


# ---------------------------------------------------------------- A-37 no invented APRs
def test_a37_every_alternative_uses_a_verified_offer_rate():
    competitor = offer(offer_id="o_credit_union", principal="20000.00", contract_rate="0.0399", term_months="48",
                       cash_down="4000.00", cash_price="22000.00", taxes_title_fees="1500.00")
    unverified = offer(offer_id="o_unverified", principal="20000.00", contract_rate="0.0100", term_months="60",
                       cash_down="4000.00").model_copy(update={"ready_for_calculation": False})
    base = reference_offer()
    cf = evaluate(household(), base, competing_offers=[competitor, unverified])
    assert cf.levers["offer_id"] == ["o_test", "o_credit_union"]
    rates = {"o_test": Decimal("0.0475"), "o_credit_union": Decimal("0.0399")}
    offers = {"o_test": base, "o_credit_union": competitor}
    for a in cf.alternatives:
        assert a.lever_values["offer_id"] in rates
        assert not any("apr" in k or "rate" in k for k in a.metrics)
        if a.metrics["monthly_payment"] is None:
            continue
        expected = payment(Decimal(a.metrics["principal"]), rates[a.lever_values["offer_id"]],
                           int(a.lever_values["term_months"]))
        assert Decimal(a.metrics["monthly_payment"]) == expected
    # the competitor's own 48-month terms are shown without a same-rate assumption
    own = alt(cf, offer_id="o_credit_union", cash_down_delta="0", term_months=48, remove_optional_add_ons=False)
    assert "same_rate_assumed" not in own.assumption_flags
    assert own.metrics["monthly_payment"] == "451.49"           # $20,000 @ 3.99%/48: float annuity 451.4916


# ---------------------------------------------------------------- A-38 term label
def test_a38_term_alternatives_carry_same_rate_assumed():
    cf = evaluate(household(), reference_offer())
    for a in cf.alternatives:
        if a.lever_values["offer_id"] == "o_test" and a.lever_values["term_months"] != 60:
            assert "same_rate_assumed" in a.assumption_flags, a.alt_id
            assert "same rate assumed" in a.label
        if a.lever_values["term_months"] == 60:
            assert "same_rate_assumed" not in a.assumption_flags
    assert any("same_rate_assumed" in n for n in cf.notes)


# ---------------------------------------------------------------- A-39 required add-on never removed
def test_a39_only_optional_add_ons_are_removed():
    o = reference_offer(principal="22800.00", amount_financed="22300.00", itemization=ADD_ONS)
    cf = evaluate(household(), o)
    assert cf.levers["remove_optional_add_ons"] == [False, True]
    kept = alt(cf, cash_down_delta="0", term_months=60, remove_optional_add_ons=False)
    removed = alt(cf, cash_down_delta="0", term_months=60, remove_optional_add_ons=True)
    # only GAP ($1,000, optional=True) is removed; unknown (None) and required (False) stay
    assert Decimal(kept.metrics["principal"]) - Decimal(removed.metrics["principal"]) == Decimal("1000.00")
    assert removed.metrics["principal"] == "21800.00"


def test_a39_no_optional_add_on_means_no_removal_lever():
    items = [i for i in ADD_ONS if i["optional"] is not True]
    o = reference_offer(principal="21800.00", amount_financed="21300.00", itemization=items)
    cf = evaluate(household(), o)
    assert cf.levers["remove_optional_add_ons"] == [False]
    assert all(a.lever_values["remove_optional_add_ons"] is False for a in cf.alternatives)
    assert any("No add-on is marked optional" in n for n in cf.notes)


# ---------------------------------------------------------------- objectives, Pareto, sensitivity
def test_objectives_and_pareto_set():
    cf = evaluate(household(), reference_offer())
    assert [(o.metric, o.direction) for o in cf.objectives] == [
        ("finance_charge", "min"), ("monthly_left_after", "max"), ("savings_after_purchase", "max"),
        ("break_even_m3", "max")]
    ids = {a.alt_id: a for a in cf.alternatives}
    assert cf.pareto_set and all(ids[i].feasible for i in cf.pareto_set)
    # base keeps the most savings at the 60-month term; 72 months has the largest monthly leftover
    assert alt(cf, cash_down_delta="0", term_months=72, remove_optional_add_ons=False).alt_id in cf.pareto_set
    # +500 down at 72 months vs +500 at 60: neither dominates. Nothing dominated may be in the set.
    for i in cf.pareto_set:
        for b in cf.alternatives:
            if not b.feasible or b.alt_id == i:
                continue
            better_all = all(
                (Decimal(b.metrics[o.metric]) <= Decimal(ids[i].metrics[o.metric])) if o.direction == "min"
                else (Decimal(b.metrics[o.metric]) >= Decimal(ids[i].metrics[o.metric])) for o in cf.objectives)
            strictly = any(Decimal(b.metrics[o.metric]) != Decimal(ids[i].metrics[o.metric]) for o in cf.objectives)
            assert not (better_all and strictly), (b.alt_id, i)


def test_rate_sensitivity_is_a_statement():
    cf = evaluate(household(), reference_offer())
    rs = cf.rate_sensitivity
    # independent float check: $20,000 @ 5.75%/60 = 384.3354 -> 384.34; 384.34 − 375.14 = 9.20
    assert rs.per_point_monthly_payment_delta == "9.20"
    assert Decimal("540") < Decimal(rs.per_point_finance_charge_delta) < Decimal("565")    # ≈ 9.20 × 60
    assert rs.statement_claim_id == "cl_rate_1pt"
    assert cf.deferred_levers == ["price_change", "delay_purchase"]
    assert any("not an offer" in n for n in cf.notes)


def test_sensitivity_ranking_normalized_and_sorted():
    cf = evaluate(household(), reference_offer())
    effects = [Decimal(s.normalized_effect) for s in cf.sensitivity_ranking]
    assert effects == sorted(effects, reverse=True)
    top = cf.sensitivity_ranking[0]
    assert (top.lever, top.metric, top.normalized_effect) == ("cash_down_delta", "savings_after_purchase", "1.0000")


def test_not_ready_returns_empty_alternatives():
    cf = evaluate(household(**{"savings.liquid": None}), reference_offer())
    assert cf.alternatives == [] and cf.base_offer_id == "o_test"
    assert any("savings" in n for n in cf.notes)
    assert evaluate(household(), None).alternatives == []


def test_grid_performance():
    o = reference_offer(principal="22800.00", amount_financed="22300.00", itemization=ADD_ONS)
    t0 = time.perf_counter()
    cf = evaluate(household(), o)
    elapsed = time.perf_counter() - t0
    assert len(cf.alternatives) == 32
    assert elapsed < 1.5, elapsed
