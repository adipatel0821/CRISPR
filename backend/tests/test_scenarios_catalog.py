"""Stage 4: A-09r, A-10r, A-33, A-34, A-35 + readiness gating. Expected paths are hand-computed below."""
from decimal import Decimal
from pathlib import Path

import pytest

from engine import build_inputs, month_net
from scenarios import break_even, run_catalog, simulate
from tests.test_engine_helpers import household, reference_offer

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def by(results, scenario_id, run):
    return next(r for r in results if r.scenario_id == scenario_id and r.run == run)


# ---------------------------------------------------------------- A-09r baseline equality, month by month
def test_a09r_baseline_net_equals_engine_month_net_with_debt_ending_month_4():
    hh = household(**{"debts.count": "1", "debts[d1].monthly_payment": "300.00", "debts[d1].remaining_months": "4"})
    inputs = build_inputs(hh, reference_offer())
    # hand-computed: without the offer 4200 − 2900 − 400 − 300 = 600 for months 1–4, then 900
    expected_without = [Decimal("600")] * 4 + [Decimal("900")] * 8
    # with the offer: 600 − 375.14 − 50 = 174.86 for months 1–4, then 474.86
    expected_with = [Decimal("174.86")] * 4 + [Decimal("474.86")] * 8
    for run, expected, start in (("without_offer", expected_without, Decimal("6000")),
                                 ("with_offer", expected_with, Decimal("2000"))):
        out = simulate(inputs, run, None, start, 12)
        for t in range(1, 13):
            assert out.nets[t - 1] == month_net(t, inputs, run) == expected[t - 1], (run, t)
            assert Decimal(out.paths[t - 1].net) == expected[t - 1]
        assert out.paths[3].debt_payments == "300.00" and out.paths[4].debt_payments == "0.00"


def test_a09r_catalog_without_offer_cost_rise_equals_baseline_path():
    hh = household(**{"debts.count": "1", "debts[d1].monthly_payment": "300.00", "debts[d1].remaining_months": "4"})
    results, _ = run_catalog(hh, reference_offer())
    r = by(results, "sc_cost_rise", "without_offer")       # cost rise touches only the with-offer run
    inputs = build_inputs(hh, reference_offer())
    assert [Decimal(p.net) for p in r.monthly_paths] == [month_net(t, inputs, "without_offer") for t in range(1, 13)]


# ---------------------------------------------------------------- A-10r labels
def test_a10r_every_scenario_assumption_is_illustrative_and_no_cfpb_median():
    results, _ = run_catalog(household(), reference_offer())
    assert results
    for r in results:
        assert r.assumptions
        for a in r.assumptions:
            assert "Illustrative" in a.text, a.assumption_id
            assert a.text.startswith("Illustrative")
        assert r.derived_status == "assumed"
    for name in ("assumptions.yaml", "scenarios.yaml", "levers.yaml"):
        assert "CFPB median" not in (CONFIG_DIR / name).read_text(encoding="utf-8")


# ---------------------------------------------------------------- A-33 floor and gap (hand-computed)
def test_a33_job_loss_floor_and_unfunded_gap():
    results, _ = run_catalog(household(), reference_offer())
    w = by(results, "sc_job_loss", "with_offer")
    # start 2000.00; normal net 474.86; job-loss months 2–3 net = 474.86 − 4200 = −3725.14
    # m1 2474.86 | m2 raw −1250.28 -> S 0, gap 1250.28 | m3 gap 4975.42 | m4.. gap −474.86 per month
    assert w.start_balance == "2000.00"
    assert [p.savings_balance for p in w.monthly_paths[:3]] == ["2474.86", "0.00", "0.00"]
    assert [p.unfunded_gap for p in w.monthly_paths[:4]] == ["0.00", "1250.28", "4975.42", "4500.56"]
    assert all(Decimal(p.savings_balance) >= 0 for p in w.monthly_paths)
    assert w.max_unfunded_gap == "4975.42"
    assert w.first_shortfall_month == 2 and w.months_of_runway == 1
    assert w.recovery_month is None                     # 4975.42 / 474.86 > 9 remaining months
    assert w.monthly_paths[-1].unfunded_gap == "701.68"  # 4975.42 − 9 × 474.86
    assert w.savings_end == "0.00"
    wo = by(results, "sc_job_loss", "without_offer")
    # start 6000; net 900; months 2–3 net −3300 -> 6900, 3600, 300, then +900/month; never short
    assert [p.savings_balance for p in wo.monthly_paths[:4]] == ["6900.00", "3600.00", "300.00", "1200.00"]
    assert wo.first_shortfall_month is None and wo.months_of_runway == 12
    assert wo.savings_end == "8400.00"                  # 6000 + 12×900 − 2×4200
    assert any(a.assumption_id == "a_no_job_benefits" for a in w.assumptions)


def test_a33_gap_recovery_month():
    # smaller job loss impact: take-home 4200, savings 2500 after purchase -> gap recovers
    hh = household(**{"savings.liquid": "6500.00"})
    results, _ = run_catalog(hh, reference_offer())
    w = by(results, "sc_job_loss", "with_offer")
    # start 2500: m1 2974.86 | m2 raw −750.28 gap 750.28 | m3 gap 4475.42 | ... gap 4475.42 − 474.86k
    # k=9 (m12): 4475.42 − 4273.74 = 201.68 -> still not recovered
    assert w.max_unfunded_gap == "4475.42" and w.recovery_month is None
    hh2 = household(**{"savings.liquid": "9500.00"})
    results2, _ = run_catalog(hh2, reference_offer())
    w2 = by(results2, "sc_job_loss", "with_offer")
    # start 5500: m1 5974.86 | m2 2249.72 | m3 raw −1475.42 -> gap 1475.42 | m4 1000.56 | m5 525.70 | m6 50.84
    # m7: net 474.86 repays 50.84 -> gap 0, savings 424.02 -> recovery month 7
    assert w2.first_shortfall_month == 3 and w2.months_of_runway == 2
    assert w2.max_unfunded_gap == "1475.42"
    assert w2.recovery_month == 7
    assert w2.monthly_paths[6].savings_balance == "424.02"


def test_expense_spike_and_income_cut_paths():
    results, _ = run_catalog(household(), reference_offer())
    spike = by(results, "sc_expense_spike", "with_offer")
    assert spike.monthly_paths[1].one_time == "2900.00"
    assert spike.monthly_paths[1].savings_balance == "49.72"      # 2474.86 + 474.86 − 2900
    assert spike.first_shortfall_month is None
    cut = by(results, "sc_income_cut", "with_offer")
    assert [p.income for p in cut.monthly_paths[:5]] == ["4200.00", "3150.00", "3150.00", "3150.00", "4200.00"]
    assert cut.monthly_paths[3].savings_balance == "749.44"       # 2474.86 − 3 × 575.14
    rise = by(results, "sc_cost_rise", "with_offer")
    assert rise.monthly_paths[0].incremental_vehicle_costs == "60.00"   # 50 × 1.2
    assert rise.monthly_paths[0].net == "464.86"


def test_low_month_only_for_variable_income():
    stable, _ = run_catalog(household(), reference_offer())
    assert not any(r.scenario_id == "sc_low_month" for r in stable)
    var = household(**{"income.variability": "highly_variable", "income.low_month": "3000.00"})
    results, _ = run_catalog(var, reference_offer())
    low = by(results, "sc_low_month", "with_offer")
    assert low.monthly_paths[0].income == "3000.00"
    assert low.monthly_paths[0].net == "-725.14"                  # 474.86 − 1200
    assert low.first_shortfall_month == 3                          # 2000 − 725.14×3 < 0 in month 3


def test_seed_and_horizon_recorded_in_config():
    from engine import load_config
    sc = load_config().scenarios_raw
    assert sc["seed"] == 20261024 and sc["horizon_months"] == 12


# ---------------------------------------------------------------- A-34 paired runs
FIXTURES = [
    household(),
    household(**{"savings.liquid": "4500.00"}),
    household(**{"income.take_home_monthly": "3500.00"}),
    household(**{"income.variability": "somewhat_variable", "income.low_month": "3300.00"}),
    household(**{"debts.count": "1", "debts[d1].monthly_payment": "250.00", "debts[d1].remaining_months": "3"}),
]


@pytest.mark.parametrize("hh", FIXTURES)
def test_a34_without_offer_runway_at_least_with_offer(hh):
    results, _ = run_catalog(hh, reference_offer())
    assert results
    ids = {r.scenario_id for r in results}
    for sid in ids:
        assert by(results, sid, "without_offer").months_of_runway >= by(results, sid, "with_offer").months_of_runway


# ---------------------------------------------------------------- A-35 break-even edges
def test_a35_reference_break_even_values():
    _, summary = run_catalog(household(), reference_offer())
    # M=3: min_k (2000 + 474.86k)/(4200·min(k,3)) at k=3 = 3424.58/12600 = 0.27179 -> "0.27" (contracts §3.8)
    assert summary.break_even_m3 == "0.27"
    # M=6: 4849.16/25200 = 0.19243 -> "0.19"
    assert summary.break_even_m6 == "0.19"
    assert not summary.capped and not summary.deficit_at_baseline
    assert "sc_job_loss" in summary.scenarios_with_shortfall["with_offer"]
    assert "sc_job_loss" not in summary.scenarios_with_shortfall["without_offer"]


def test_a35_break_even_is_sustainable_and_tight():
    inputs = build_inputs(household(), reference_offer())
    be = break_even(inputs, 3, Decimal("2000"), 12)
    ok = simulate(inputs, "with_offer", {"income_factor": Decimal("1") - Decimal(be.display),
                                         "income_factor_months": [1, 2, 3]}, Decimal("2000"), 12)
    assert ok.first_shortfall_month is None
    worse = simulate(inputs, "with_offer", {"income_factor": Decimal("1") - Decimal("0.28"),
                                            "income_factor_months": [1, 2, 3]}, Decimal("2000"), 12)
    assert worse.first_shortfall_month is not None


def test_a35_deficit_fixture_zero_and_flag():
    hh = household(**{"income.take_home_monthly": "3500.00"})     # 3500 − 2900 − 400 − 375.14 − 50 < 0
    results, summary = run_catalog(hh, reference_offer())
    assert summary.break_even_m3 == "0.00" and summary.break_even_m6 == "0.00"
    assert summary.deficit_at_baseline is True
    assert all(r.deficit_at_baseline for r in results if r.run == "with_offer")
    assert not any(r.deficit_at_baseline for r in results if r.run == "without_offer")   # 200/month before


def test_a35_large_savings_capped():
    hh = household(**{"savings.liquid": "200000.00"})
    _, summary = run_catalog(hh, reference_offer())
    assert summary.break_even_m3 == "1.00" and summary.capped is True
    assert summary.break_even_m6 == "1.00"


# ---------------------------------------------------------------- readiness gating
def test_not_ready_returns_empty():
    assert run_catalog(household(**{"savings.liquid": None}), reference_offer()) == ([], None)
    assert run_catalog(household(), None) == ([], None)
    var_no_low = household(**{"income.variability": "highly_variable"})
    assert run_catalog(var_no_low, reference_offer()) == ([], None)


def test_flexible_unknown_adds_illustrative_note():
    results, _ = run_catalog(household(**{"expenses.flexible.total": None}), reference_offer())
    a_ids = {a.assumption_id for a in results[0].assumptions}
    assert "a_scenario_before_discretionary" in a_ids
