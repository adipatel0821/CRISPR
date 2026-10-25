"""A-28..A-32 + missing-input rules. Expected values are the acceptance-plan / stage_03 review figures."""
from decimal import Decimal

from engine import build_inputs, compute, resolve_principal
from engine.cashflow import f08, f09
from tests.test_engine_helpers import fact, facts, household, m, offer, reference_offer


def flags(r):
    return {f.flag_id: f for f in r.flags}


# ---------------------------------------------------------------- A-28 trade-in accounting
def test_a28_trade_in_positive_equity():
    o = offer(cash_price="25000.00", cash_down="1000.00", trade_in_value="8000.00", trade_in_payoff="5000.00",
              contract_rate="0.07", term_months="60")
    principal, basis = resolve_principal(o)
    assert (principal, basis) == (Decimal("21000.00"), "derived")
    r = compute({}, o)
    assert m(r, "total_paid_through_deal") == "28949.43"
    assert r.metrics["total_paid_through_deal"].breakdown["prior_loan_balance_rolled_in"] == "0.00"
    assert not flags(r)["NEGATIVE_EQUITY_AT_START"].triggered


def test_a28_trade_in_negative_equity_rolled_in():
    o = offer(cash_price="25000.00", cash_down="1000.00", trade_in_value="8000.00", trade_in_payoff="10000.00",
              contract_rate="0.07", term_months="60")
    r = compute({}, o)
    assert m(r, "principal") == "26000.00"
    assert m(r, "total_paid_through_deal") == "31889.89"
    assert r.metrics["total_paid_through_deal"].breakdown["prior_loan_balance_rolled_in"] == "2000.00"
    assert m(r, "negative_equity_at_start") == "1000.00"       # 26,000 owed vs 25,000 price
    assert flags(r)["NEGATIVE_EQUITY_AT_START"].triggered
    assert any("itemization" in n for n in r.metrics["principal"].notes)


# ---------------------------------------------------------------- A-29 savings after purchase
def test_a29_reserve_after_uses_savings_after_down_payment():
    # savings 4,000; 3,000 down from savings; obligations essentials 2,400 + debt 100 + payment 600 + F14 50 = 3,150
    hh = facts(fact("income.take_home_monthly", "5000.00"), fact("expenses.essential.total", "2400.00"),
               fact("debts.count", "1"), fact("debts[d1].monthly_payment", "100.00"),
               fact("savings.liquid", "4000.00"), fact("loan.down_payment_source", "savings"),
               fact("vehicle.replaces_current", "false"), fact("vehicle.new_ownership_costs_monthly", "50.00"))
    o = offer(principal="36000.00", contract_rate="0", term_months="60", cash_down="3000.00")
    r = compute(hh, o)
    assert m(r, "monthly_payment") == "600.00"
    assert m(r, "savings_after_purchase") == "1000.00"
    assert m(r, "reserve_months_after") == "0.32"


# ---------------------------------------------------------------- A-30 replacement netting
def test_a30_replacement_netting_direct_formula():
    f14 = Decimal("310") - Decimal("260")
    assert f09(Decimal("3600"), Decimal("2300"), Decimal("150"), Decimal("420"), f14, Decimal("500")) == Decimal("180")


def test_a30_replacement_netting_through_compute():
    hh = facts(fact("income.take_home_monthly", "3600.00"), fact("expenses.essential.total", "2300.00"),
               fact("expenses.current_vehicle_costs_monthly", "260.00"), fact("vehicle.replaces_current", "true"),
               fact("expenses.flexible.total", "500.00"), fact("debts.count", "1"),
               fact("debts[d1].monthly_payment", "150.00"), fact("vehicle.new_ownership_costs_monthly", "310.00"))
    o = offer(principal="25200.00", contract_rate="0", term_months="60")      # 0% -> 420.00
    r = compute(hh, o)
    assert m(r, "monthly_payment") == "420.00"
    assert m(r, "incremental_vehicle_costs") == "50.00"
    assert m(r, "monthly_left_after") == "180.00"


# ---------------------------------------------------------------- A-31 no fabricated timeline
def test_a31_no_value_estimates_means_equity_timeline_missing():
    r = compute(household(), reference_offer())
    et = r.metrics["equity_timeline"]
    assert et.value is None and et.status == "missing"
    assert et.missing_inputs == ["vehicle.value_estimates"]


def test_equity_timeline_only_from_user_points():
    hh = household(**{"vehicle.value_estimates": '[{"month": 1, "value": "21000.00"}]'})
    r = compute(hh, reference_offer())
    et = r.metrics["equity_timeline"]
    # balance after payment 1 = 19,704.03 (schedule row 1) -> equity 1,295.97
    assert et.value == "1295.97" and et.label == "your estimate"
    assert et.points[0]["balance"] == "19704.03"


# ---------------------------------------------------------------- A-32 deficit
def test_a32_deficit_computed_and_flagged():
    hh = facts(fact("income.take_home_monthly", "2000.00"), fact("expenses.essential.total", "2300.00"),
               fact("debts.count", "0"))
    r = compute(hh, None)
    assert m(r, "monthly_left_before") == "-300.00"
    assert r.metrics["monthly_left_before"].label == "before discretionary spending"
    assert flags(r)["DEFICIT_BEFORE_LOAN"].triggered
    assert f08(Decimal("2000"), Decimal("2300"), Decimal("0")) == Decimal("-300")


def test_deficit_after_loan_flag():
    hh = household(**{"income.take_home_monthly": "3700.00"})     # 3700-2900-400 = 400 before; after = -25.14
    r = compute(hh, reference_offer())
    assert m(r, "monthly_left_after") == "-25.14"
    assert flags(r)["DEFICIT_AFTER_LOAN"].triggered and not flags(r)["DEFICIT_BEFORE_LOAN"].triggered


# ---------------------------------------------------------------- unknown is never zero
def test_missing_debt_payment_makes_monthly_left_before_missing():
    hh = facts(fact("income.take_home_monthly", "4200.00"), fact("expenses.essential.total", "2900.00"),
               fact("debts.count", "1"), fact("debts[d1].type", "student_loan"),
               fact("debts[d1].monthly_payment", None, "missing"))
    r = compute(hh, reference_offer())
    for name in ("monthly_left_before", "monthly_left_after", "reserve_months_before"):
        mt = r.metrics[name]
        assert mt.value is None and mt.status == "missing", name
        assert "debts[d1].monthly_payment" in mt.missing_inputs
    assert r.metrics["monthly_left_before"].value != "0.00"


def test_unknown_debt_count_is_missing():
    hh = facts(fact("income.take_home_monthly", "4200.00"), fact("expenses.essential.total", "2900.00"))
    r = compute(hh, None)
    assert r.metrics["monthly_left_before"].missing_inputs == ["debts.count"]


def test_declined_and_conflicting_facts_never_enter_as_numbers():
    hh = household(**{"savings.liquid": None})
    hh["savings.liquid"] = fact("savings.liquid", "6000.00", "declined")
    hh["income.take_home_monthly"] = fact("income.take_home_monthly", "4200.00", "conflicting")
    r = compute(hh, reference_offer())
    assert m(r, "savings_after_purchase") is None
    assert "savings.liquid" in r.metrics["savings_after_purchase"].missing_inputs
    assert m(r, "monthly_left_before") is None


def test_flexible_unknown_label_before_discretionary():
    hh = household(**{"expenses.flexible.total": None})
    r = compute(hh, reference_offer())
    assert m(r, "monthly_left_before") == "1300.00"
    assert r.metrics["monthly_left_before"].label == "before discretionary spending"
    assert m(r, "monthly_left_after") == "874.86"


def test_f14_unknown_new_costs_is_zero_with_label_and_assumption():
    # D1-001: the reference household has vehicle.replaces_current = true, so the current car's costs stay in
    # essentials and F14 = 0 really assumes the new car costs the same to run. The label changed for that
    # reason (contract change required by D1-001); the value did not.
    hh = household(**{"vehicle.new_ownership_costs_monthly": None})
    r = compute(hh, reference_offer())
    f14 = r.metrics["incremental_vehicle_costs"]
    assert f14.value == "0.00"
    assert f14.label == "assumes the new car costs the same to run as your current one"
    assert "a_no_running_costs" in r.assumptions_used
    assert m(r, "monthly_left_after") == "524.86"       # 900 − 375.14, nothing netted or added


def test_f14_unknown_new_costs_not_replacing_keeps_not_included_label():
    for rep in ("false", None):
        hh = household(**{"vehicle.new_ownership_costs_monthly": None, "vehicle.replaces_current": rep})
        r = compute(hh, reference_offer())
        f14 = r.metrics["incremental_vehicle_costs"]
        assert f14.value == "0.00" and f14.label == "new-car running costs not included"
        assert f14.status == "assumed"
        assert r.derived_status == "assumed"


# ---------------------------------------------------------------- D1-001 assumption -> derived_status
def test_d1_001_missing_new_costs_makes_result_assumed_without_changing_values():
    hh = household(**{"vehicle.new_ownership_costs_monthly": None})
    r = compute(hh, reference_offer())
    assert r.derived_status == "assumed"
    assert m(r, "incremental_vehicle_costs") == "0.00"
    assert m(r, "monthly_left_after") == "524.86"       # 4200 − 2900 − 400 − 375.14 − 0
    for name in ("incremental_vehicle_costs", "monthly_left_after", "reserve_months_after"):
        assert r.metrics[name].status == "assumed", name
    # F10 = F13 / (2900 + 375.14 + 0) = 2000 / 3275.14 = 0.6107 -> "0.61" (value unchanged by D1-001)
    assert m(r, "reserve_months_after") == "0.61"
    # metrics that do not depend on F14 keep their provided status
    assert r.metrics["monthly_payment"].status is None
    assert r.metrics["savings_after_purchase"].status is None


def test_d1_001_full_reference_household_stays_provided():
    r = compute(household(), reference_offer())
    assert r.derived_status == "provided"
    assert m(r, "incremental_vehicle_costs") == "50.00"  # 310 − 260
    assert r.metrics["incremental_vehicle_costs"].status is None
    assert "a_no_running_costs" not in r.assumptions_used


def test_d1_001_new_costs_known_replacement_unknown_is_assumed():
    hh = household(**{"vehicle.replaces_current": None})
    r = compute(hh, reference_offer())
    assert r.derived_status == "assumed"
    assert m(r, "incremental_vehicle_costs") == "310.00"  # nothing netted off
    assert r.metrics["incremental_vehicle_costs"].status == "assumed"
    assert "a_not_replacing" in r.assumptions_used
    assert m(r, "monthly_left_after") == "214.86"         # 4200 − 2900 − 400 − 375.14 − 310


def test_debt_paid_off_by_transaction_excluded_after():
    hh = household(**{"debts.count": "1", "debts[d1].monthly_payment": "200.00",
                      "debts[d1].paid_off_by_transaction": "true",
                      "income.gross_monthly": "6000.00"})
    r = compute(hh, reference_offer())
    assert m(r, "monthly_left_before") == "700.00"
    assert m(r, "monthly_left_after") == "474.86"
    assert m(r, "dti_total") == "0.0625"               # (0 + 375.14) / 6000 = 0.062523


def test_dti_includes_remaining_debts():
    hh = household(**{"debts.count": "1", "debts[d1].monthly_payment": "224.86", "income.gross_monthly": "6000.00"})
    r = compute(hh, reference_offer())
    assert m(r, "dti_total") == "0.1000"               # (224.86 + 375.14) / 6000


# ---------------------------------------------------------------- F00 variants + status propagation
def test_af_only_assumes_pfc_zero_and_flags():
    o = offer(amount_financed="20000.00", contract_rate="0.0475", term_months="60")
    assert resolve_principal(o) == (Decimal("20000.00"), "assumed_pfc_zero")
    r = compute({}, o)
    assert m(r, "monthly_payment") == "375.14"
    assert flags(r)["PFC_ASSUMED_ZERO"].triggered
    assert "a_pfc_zero" in r.assumptions_used
    assert r.derived_status == "assumed"


def test_apr_only_uses_apr_as_rate_with_assumption():
    o = offer(principal="20000.00", apr="0.0475", term_months="60")
    r = compute({}, o)
    assert m(r, "monthly_payment") == "375.14"
    assert "a_rate_from_apr" in r.assumptions_used
    assert any("APR was used" in w for w in r.warnings)


def test_estimated_input_propagates_to_derived_status():
    hh = household()
    hh["savings.liquid"] = fact("savings.liquid", "6000.00", "estimated")
    r = compute(hh, reference_offer())
    assert r.derived_status == "estimated"
    assert r.metrics["savings_after_purchase"].status == "estimated"
    assert r.derived_verification == "none"            # self-reported facts are never "verified"


def test_conflicting_offer_term_is_ignored():
    o = reference_offer()
    o.terms["principal"] = o.terms["principal"].model_copy(update={"status": "conflicting"})
    o.terms["amount_financed"] = o.terms["amount_financed"].model_copy(update={"status": "conflicting"})
    o.terms["cash_price"] = o.terms["cash_price"].model_copy(update={"status": "conflicting"})
    r = compute({}, o)
    assert m(r, "monthly_payment") is None
    assert r.metrics["monthly_payment"].missing_inputs == ["offer.minimum_set"]


def test_unsupported_product_not_calculated():
    o = reference_offer(variable_rate="true")
    r = compute({}, o)
    assert m(r, "monthly_payment") is None
    assert any("variable_rate" in w for w in r.warnings)


def test_baseline_result_shape():
    r = compute(household(), None)
    assert r.offer_id is None
    assert m(r, "monthly_left_before") == "900.00"
    assert m(r, "reserve_months_before") == "2.07"
    assert r.metrics["savings_months_of_income"].before == "1.43"
    assert r.metrics["savings_months_of_income"].after is None
    for name in ("monthly_payment", "monthly_left_after", "savings_after_purchase", "reserve_months_after"):
        assert r.metrics[name].status == "missing"
        assert r.metrics[name].missing_inputs == ["offer.minimum_set"]
    assert r.required_inputs["monthly_left_after"][-1] == "offer.minimum_set"


def test_down_payment_source_other_keeps_savings():
    hh = household(**{"loan.down_payment_source": "other"})
    r = compute(hh, reference_offer())
    assert m(r, "savings_after_purchase") == "6000.00"


def test_fixture_dict_facts_without_status_are_provided():
    inp = build_inputs([{"key": "income.take_home_monthly", "value": "4200.00"}], None)
    assert inp.take_home.known and inp.take_home.status == "provided"


# ---------------------------------------------------------------- CP1 audit finding 2: disputed PFC paid in cash
def _offer_with_pfc_cash(status, value="500.00", **over):
    o = reference_offer(pfc_paid_in_cash=value if value is not None else "0.00", **over)
    upd = {"status": status} if value is not None else {"status": status, "value": None}
    o.terms["pfc_paid_in_cash"] = o.terms["pfc_paid_in_cash"].model_copy(update=upd)
    return o


def test_pfc_cash_absent_is_zero_per_f00():
    # Reference: TOP 22,508.29 (finance charge 3,008.29 + AF 19,500); F04 = TOP + cash down 4,000 + 0
    r = compute(household(), reference_offer())
    assert m(r, "total_paid_through_deal") == "26508.29"
    assert m(r, "savings_after_purchase") == "2000.00"      # 6,000 − 4,000 − 0


def test_pfc_cash_provided_is_subtracted():
    r = compute(household(), _offer_with_pfc_cash("provided"))
    assert m(r, "total_paid_through_deal") == "27008.29"    # 22,508.29 + 4,000 + 500
    assert m(r, "savings_after_purchase") == "1500.00"      # 6,000 − 4,000 − 500
    assert m(r, "reserve_months_after") == "0.45"           # 1,500 / (2,900 + 375.14 + 50) = 0.4511


def test_pfc_cash_present_but_not_computable_is_unknown_never_zero():
    for status, value in (("conflicting", "500.00"), ("missing", None), ("declined", None)):
        r = compute(household(), _offer_with_pfc_cash(status, value))
        for name in ("total_paid_through_deal", "savings_after_purchase"):
            mt = r.metrics[name]
            assert mt.value is None and mt.status == "missing", (status, name)
            assert mt.missing_inputs == ["offer.pfc_paid_in_cash"], (status, name)
        rma = r.metrics["reserve_months_after"]
        assert rma.value is None and "offer.pfc_paid_in_cash" in rma.missing_inputs
        smi = r.metrics["savings_months_of_income"]
        assert smi.before == "1.43" and smi.after is None     # 6,000 / 4,200
        assert "offer.pfc_paid_in_cash" in smi.missing_inputs
        # loan math and monthly cash flow do not depend on it
        assert m(r, "monthly_payment") == "375.14"
        assert m(r, "monthly_left_after") == "474.86"         # 4,200 − 2,900 − 400 − 375.14 − 50


def test_pfc_cash_unknown_with_unknown_source_lists_both():
    hh = household(**{"loan.down_payment_source": None})
    r = compute(hh, _offer_with_pfc_cash("conflicting", cash_down="0.00"))
    f13 = r.metrics["savings_after_purchase"]
    assert f13.value is None
    assert set(f13.missing_inputs) == {"offer.pfc_paid_in_cash", "loan.down_payment_source"}


def test_pfc_cash_unknown_not_subtracted_when_source_not_savings():
    # F13 subtracts PFC paid in cash only when it comes out of savings; F04 (all cash through the deal) needs it.
    hh = household(**{"loan.down_payment_source": "other"})
    r = compute(hh, _offer_with_pfc_cash("conflicting"))
    assert m(r, "savings_after_purchase") == "6000.00"
    assert r.metrics["total_paid_through_deal"].missing_inputs == ["offer.pfc_paid_in_cash"]
