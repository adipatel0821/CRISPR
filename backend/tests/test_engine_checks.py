"""offer_checks: A-27 typo, ranges, itemization (contracts §3.6), unsupported features, config payload."""
from decimal import Decimal

from engine import assumptions_payload, load_config, offer_checks
from tests.test_engine_helpers import offer, reference_offer


def test_reference_offer_all_checks_pass():
    rep = offer_checks(reference_offer(total_of_payments="22508.29", finance_charge="3008.29"))
    assert rep.principal == Decimal("20000.00") and rep.principal_basis == "stated"
    assert rep.computed_payment == Decimal("375.14")
    assert (rep.arithmetic, rep.apr_recompute, rep.itemization, rep.range) == ("pass", "pass", "pass", "pass")
    assert rep.unsupported_features == []


def test_a27_manual_typo_payment_mismatch_warns():
    rep = offer_checks(reference_offer(monthly_payment="3751.40"))
    assert rep.computed_payment == Decimal("375.14")
    assert rep.payment_mismatch == Decimal("375.14") - Decimal("3751.40")
    assert rep.arithmetic == "warn"
    assert any("PAYMENT_MISMATCH" in w for w in rep.warnings)


def test_a27_payment_mismatch_flag_in_compute():
    from engine import compute
    r = compute({}, reference_offer(monthly_payment="3751.40"))
    f = {x.flag_id: x for x in r.flags}["PAYMENT_MISMATCH"]
    assert f.triggered and "3376.26" in f.detail
    assert r.metrics["monthly_payment"].mismatch == "-3376.26"


def test_payment_within_one_dollar_passes():
    rep = offer_checks(reference_offer(monthly_payment="376.00"))
    assert rep.arithmetic == "pass"


def test_apr_outside_eighth_point_warns_never_fails():
    rep = offer_checks(reference_offer(apr="0.0620"))
    assert rep.apr_recompute == "warn"
    assert rep.range == "pass"


def test_apr_below_contract_rate_warns():
    rep = offer_checks(offer(principal="20000.00", contract_rate="0.0475", apr="0.0400", term_months="60"))
    assert rep.range == "warn"


def test_rate_out_of_range_fails():
    rep = offer_checks(offer(principal="20000.00", contract_rate="4.75", term_months="60"))
    assert rep.range == "fail"
    assert rep.computed_payment is None


def test_term_outside_support_is_unsupported():
    rep = offer_checks(offer(principal="20000.00", contract_rate="0.0475", term_months="120"))
    assert "term_outside_supported_range" in rep.unsupported_features
    assert rep.range == "warn"


def test_non_integer_term_fails():
    rep = offer_checks(offer(principal="20000.00", contract_rate="0.0475", term_months="60.5"))
    assert rep.range == "fail"


def test_variable_rate_and_balloon_unsupported():
    rep = offer_checks(reference_offer(variable_rate="true", balloon_payment="2500.00"))
    assert set(rep.unsupported_features) >= {"variable_rate", "balloon_payment"}
    rep2 = offer_checks(reference_offer(variable_rate="false", balloon_payment="false"))
    assert rep2.unsupported_features == []


def test_itemization_mismatch_warns():
    rep = offer_checks(reference_offer(taxes_title_fees="2500.00"))       # itemized 20,500 vs AF 19,500
    assert rep.itemization == "warn"


def test_itemization_with_financed_add_on():
    o = reference_offer(principal="21000.00", amount_financed="20500.00", monthly_payment=None, apr=None,
                        itemization=[{"item": "add_on", "name": "GAP", "amount": "1000.00", "optional": True}])
    rep = offer_checks(o)
    assert rep.itemization == "pass"


def test_disclosed_totals_mismatch_warns():
    rep = offer_checks(reference_offer(total_of_payments="22600.00"))
    assert rep.arithmetic == "warn"


def test_config_citations_and_no_cfpb_median():
    cfg = load_config()
    assert cfg.flags["TERM_GT_60"]["citation"] == "CFPB en-753"
    assert cfg.flags["NEGATIVE_EQUITY_AT_START"]["citation"] == "CFPB en-769"
    assert cfg.flags["RESERVE_LT_1_MONTH"]["citation"] == "CFPB Making Ends Meet 2022 (savings groups)"
    assert cfg.flags["RESERVE_LT_1_MONTH"]["informational"] is True
    assert cfg.flags["ADD_ONS_FINANCED"]["citation"] == "CFPB en-797"
    assert cfg.flags["PREPAYMENT_PENALTY"]["citation"] == "CFPB en-2132"
    assert cfg.tolerance("payment_mismatch") == Decimal("1.00")
    assert cfg.tolerance("apr") == Decimal("0.00125")
    assert cfg.assumption_text("a_illustrative_scenarios").startswith("Illustrative")
    for aid in ("a_pfc_zero", "a_rate_from_apr", "a_no_running_costs", "a_illustrative_scenarios",
                "a_gap_no_interest", "a_same_rate_assumed", "a_no_job_benefits"):
        assert aid in cfg.assumptions


def test_assumptions_payload_shape():
    p = assumptions_payload()
    assert {"flags", "assumptions", "tolerances", "rounding", "scenarios", "levers"} <= set(p)
    assert any(a["assumption_id"] == "a_pfc_zero" for a in p["assumptions"])
    assert "CFPB median" not in repr(p)
