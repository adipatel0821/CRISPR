"""A-07r / A-24 / reference_case.json: engine vs INDEPENDENT reference values (CFPB en-753 table, CFPB auto
loan worksheet, Reg Z principal example). Expected numbers are hard-coded from the spec, never from the code."""
import json
from decimal import Decimal
from pathlib import Path

import pytest

from engine import compute, offer_checks, payment, resolve_principal, schedule, solve_apr
from engine.loan import schedule_payments, total_of_payments
from tests.test_engine_helpers import household, m, offer, reference_offer

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "reference_case.json"

# CFPB en-753: $20,000 at 4.75% (payment, total interest) — recomputed values in stage_03 §6
CFPB_EN753 = [
    (36, "597.18", "1498.32"),
    (48, "458.32", "1999.60"),
    (60, "375.14", "2508.29"),
    (72, "319.78", "3024.54"),
]


@pytest.mark.parametrize("n,pay,interest", CFPB_EN753)
def test_a07r_cfpb_en753_table(n, pay, interest):
    p = payment(Decimal("20000"), Decimal("0.0475"), n)
    assert p == Decimal(pay)
    rows = schedule(Decimal("20000"), Decimal("0.0475"), n)
    top = sum(Decimal(r.payment) for r in rows)
    assert top - Decimal("20000") == Decimal(interest)
    assert rows[-1].balance == "0.00"


@pytest.mark.parametrize("n,pay,interest", CFPB_EN753)
def test_a07r_cfpb_en753_through_compute(n, pay, interest):
    r = compute({}, offer(principal="20000.00", contract_rate="0.0475", term_months=str(n)))
    assert m(r, "monthly_payment") == pay
    assert m(r, "interest") == interest
    assert m(r, "total_of_payments") == str(Decimal("20000.00") + Decimal(interest))


def test_a07r_cfpb_worksheet():
    # CFPB Auto Loan Worksheet: $15,800 @ 3.5%, 48 months -> $353.22, TOP $16,954.80, interest $1,154.80
    r = compute({}, offer(principal="15800.00", contract_rate="0.035", term_months="48"))
    assert m(r, "monthly_payment") == "353.22"
    assert m(r, "total_of_payments") == "16954.80"
    assert m(r, "interest") == "1154.80"


def test_a07r_reg_z_principal_example():
    # $20,000 note, $500 prepaid finance charge in the note, AF $19,500, 4.75%, 60 months
    r = compute({}, reference_offer())
    assert m(r, "principal") == "20000.00"
    assert r.metrics["principal"].basis == "stated"
    assert m(r, "monthly_payment") == "375.14"
    assert m(r, "total_of_payments") == "22508.29"
    assert m(r, "interest") == "2508.29"
    assert m(r, "finance_charge") == "3008.29"
    assert abs(Decimal(m(r, "apr_recomputed")) - Decimal("0.05796")) < Decimal("0.00001")
    assert m(r, "apr_recomputed") == "0.05796"
    first = r.amortization_schedule[0]
    assert (first.n, first.payment, first.interest, first.principal, first.balance) == (
        1, "375.14", "79.17", "295.97", "19704.03")
    assert r.amortization_schedule[-1].balance == "0.00"
    assert len(r.amortization_schedule) == 60


def test_solve_apr_level_payment_and_schedule_agree():
    af = Decimal("19500")
    level = solve_apr(af, Decimal("375.14"), 60)
    pays = [p for p, *_ in schedule_payments(Decimal("20000"), Decimal("0.0475"), 60)]
    actual = solve_apr(af, pays, 60)
    for x in (level, actual):
        assert abs(x - Decimal("0.05796")) < Decimal("0.00001")


def test_solve_apr_no_prepaid_charge_returns_contract_rate():
    pays = [p for p, *_ in schedule_payments(Decimal("20000"), Decimal("0.0475"), 60)]
    assert abs(solve_apr(Decimal("20000"), pays, 60) - Decimal("0.0475")) < Decimal("0.00001")


def test_solve_apr_impossible_returns_none():
    assert solve_apr(Decimal("10000"), Decimal("100"), 12) is None     # payments sum below AF


def test_reference_case_fixture_every_expected_value():
    case = json.loads(FIXTURE.read_text(encoding="utf-8"))
    exp = case["expected"]
    r = compute(case["facts"], case["offer"])
    for key in ["principal", "monthly_payment", "total_of_payments", "interest", "finance_charge",
                "total_paid_through_deal", "monthly_left_before", "incremental_vehicle_costs",
                "monthly_left_after", "savings_after_purchase", "reserve_months_before", "reserve_months_after"]:
        assert m(r, key) == exp[key], key
    assert abs(Decimal(m(r, "apr_recomputed")) - Decimal(exp["apr_recomputed_approx"])) < Decimal("0.00001")
    row = r.amortization_schedule[0].model_dump()
    assert row == exp["first_schedule_row"]


def test_reference_contract_example_extras():
    # contracts §3.7 running example: ltv 0.909, payment/take-home 0.0893, savings months 1.43 / 0.48,
    # breakdown, RESERVE_LT_1_MONTH informational + triggered, DTI missing (no gross income)
    r = compute(household(), reference_offer())
    assert m(r, "ltv") == "0.909"
    assert m(r, "negative_equity_at_start") == "0.00"
    assert m(r, "payment_to_take_home") == "0.0893"
    smi = r.metrics["savings_months_of_income"]
    assert (smi.before, smi.after) == ("1.43", "0.48")
    assert r.metrics["total_paid_through_deal"].breakdown == {
        "cash_price": "22000.00", "taxes_title_fees": "1500.00", "add_ons": "0.00",
        "prior_loan_balance_rolled_in": "0.00", "finance_charge": "3008.29"}
    dti = r.metrics["dti_total"]
    assert dti.value is None and dti.status == "missing" and dti.missing_inputs == ["income.gross_monthly"]
    flags = {f.flag_id: f for f in r.flags}
    assert flags["RESERVE_LT_1_MONTH"].triggered and flags["RESERVE_LT_1_MONTH"].informational
    assert flags["RESERVE_LT_1_MONTH"].citation == "CFPB Making Ends Meet 2022 (savings groups)"
    assert flags["TERM_GT_60"].citation == "CFPB en-753" and not flags["TERM_GT_60"].triggered
    assert flags["NEGATIVE_EQUITY_AT_START"].citation == "CFPB en-769"
    assert flags["ADD_ONS_FINANCED"].citation == "CFPB en-797"
    assert flags["PREPAYMENT_PENALTY"].citation == "CFPB en-2132"
    assert not flags["PAYMENT_MISMATCH"].triggered and not flags["PFC_ASSUMED_ZERO"].triggered
    assert r.derived_status == "provided"
    assert r.metrics["monthly_payment"].mismatch == "0.00"
    assert r.metrics["apr_recomputed"].check == "pass"


def test_a24_financed_pfc_contract_payment_matches_disclosed():
    # Contract discloses AF $19,500 + $500 financed PFC (no principal line); payment $375.14
    o = offer(amount_financed="19500.00", prepaid_finance_charges="500.00", contract_rate="0.0475",
              term_months="60", monthly_payment="375.14", apr="0.0580")
    assert resolve_principal(o) == (Decimal("20000.00"), "derived")
    r = compute({}, o)
    assert abs(Decimal(m(r, "monthly_payment")) - Decimal("375.14")) <= Decimal("0.01")
    assert not {f.flag_id: f for f in r.flags}["PAYMENT_MISMATCH"].triggered
    rep = offer_checks(o)
    assert rep.payment_mismatch is not None and abs(rep.payment_mismatch) <= Decimal("0.01")
    assert not any("PAYMENT_MISMATCH" in w for w in rep.warnings)
    assert rep.apr_recompute == "pass"         # 5.80% disclosed vs 5.796% recomputed, within 1/8 pt


def test_reproducible_bytes_and_calc_id():
    a = compute(household(), reference_offer())
    b = compute(household(), reference_offer())
    assert a.calc_id == b.calc_id
    dump = lambda r: json.dumps(r.model_dump(mode="json", exclude={"computed_at"}), sort_keys=True)
    assert dump(a) == dump(b)


def test_total_of_payments_from_schedule_matches_table():
    pays = [p for p, *_ in schedule_payments(Decimal("20000"), Decimal("0.0475"), 72)]
    assert total_of_payments(pays) == Decimal("23024.54")


def test_compute_is_fast():
    import time
    hh, o = household(), reference_offer()
    compute(hh, o)
    t0 = time.perf_counter()
    for _ in range(20):
        compute(hh, o)
    per_call_ms = (time.perf_counter() - t0) / 20 * 1000
    assert per_call_ms < 25, per_call_ms        # target < 5 ms typical; generous bound for CI noise
