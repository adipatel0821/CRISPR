"""Stage 4 catalog v1.1 (config/scenarios.yaml) -> engine month_net transforms, and ``run_catalog``."""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from engine.config import EngineConfig, load_config
from engine.inputs import EngineInputs, build_inputs, coerce_offer, normalize_facts
from engine.money import ONE, engine_context, fmt, to_decimal
from engine.requirements import evaluate_readiness
from schemas.contracts import Assumption, ResilienceSummary, ScenarioResult

from .resilience import break_even
from .runner import simulate

RUNS = ("without_offer", "with_offer")


def scenario_transforms(entry: dict[str, Any], inputs: EngineInputs) -> dict | None:
    """Translate one catalog entry into month_net transforms; None when the scenario does not apply."""
    typ = entry["type"]
    p = entry.get("params") or {}
    if typ == "expense_spike":
        multiple = Decimal(str(p.get("multiple", "1")))
        return {"one_time": {int(p.get("month", 2)): inputs.essential.dec * multiple}}
    if typ == "income_cut":
        return {"income_factor": ONE - Decimal(str(p["fraction"])), "income_factor_months": list(p["months"])}
    if typ == "low_month":
        if not (inputs.income_variable and inputs.low_month.known):
            return None
        return {"income_override": inputs.low_month.dec, "income_override_months": None}
    if typ == "job_loss":
        return {"income_factor": Decimal("0"), "income_factor_months": list(p["months"])}
    if typ == "cost_rise":
        return {"vehicle_cost_rise": Decimal(str(p["fraction"])), "vehicle_cost_rise_from": int(p.get("from_month", 1))}
    raise ValueError(f"unknown scenario type {typ}")


def _assumptions(cfg: EngineConfig, ids: list[str]) -> list[Assumption]:
    out = []
    for aid in dict.fromkeys(ids):
        meta = cfg.assumptions[aid]
        out.append(Assumption(assumption_id=aid, text=meta["text"], citation=meta.get("citation")))
    return out


def start_balances(facts: Any, offer: Any, cfg: EngineConfig | None = None) -> tuple[Decimal | None, Decimal | None, str, str]:
    """(without_offer start = savings.liquid, with_offer start = F13, baseline calc_id, with-offer calc_id)."""
    from engine import compute

    cfg = cfg or load_config()
    base = compute(facts, None, cfg)
    with_offer = compute(facts, offer, cfg)
    s0 = to_decimal(normalize_facts(facts).get("savings.liquid", {}).get("value"))
    f13 = with_offer.metrics["savings_after_purchase"].value
    return s0, (Decimal(f13) if f13 is not None else None), base.calc_id, with_offer.calc_id


def run_catalog(facts: Any, offer: Any, config: EngineConfig | None = None
                ) -> tuple[list[ScenarioResult], ResilienceSummary | None]:
    """Run every applicable catalog scenario without and with the offer. Not ready -> ([], None)."""
    cfg = config or load_config()
    nf = normalize_facts(facts)
    lo = coerce_offer(offer)
    if not evaluate_readiness("stress_test", nf, lo).available:
        return [], None
    sc = cfg.scenarios_raw
    horizon = int(sc.get("horizon_months", 12))
    common = list(sc.get("common_assumption_ids", ["a_illustrative_scenarios", "a_gap_no_interest"]))
    with engine_context():
        inputs = build_inputs(nf, lo)
        s0, f13, base_calc_id, offer_calc_id = start_balances(nf, lo, cfg)
        if s0 is None or f13 is None:
            return [], None
        extra = [] if inputs.flexible.known else ["a_scenario_before_discretionary"]
        results: list[ScenarioResult] = []
        shortfall: dict[str, list[str]] = {"without_offer": [], "with_offer": []}
        deficit_runs = {run: inputs is not None and _baseline_deficit(inputs, run) for run in RUNS}
        for entry in sc.get("catalog", []):
            transforms = scenario_transforms(entry, inputs)
            if transforms is None:
                continue
            ids = common + list(entry.get("assumption_ids") or []) + extra
            for run in RUNS:
                start = s0 if run == "without_offer" else f13
                o = simulate(inputs, run, transforms, start, horizon)
                if o.first_shortfall_month is not None:
                    shortfall[run].append(entry["scenario_id"])
                results.append(ScenarioResult(
                    scenario_id=entry["scenario_id"], name=entry.get("name"), run=run,
                    calc_id=offer_calc_id if run == "with_offer" else base_calc_id, derived_status="assumed",
                    start_balance=fmt(start), monthly_paths=o.paths,
                    first_shortfall_month=o.first_shortfall_month, months_of_runway=o.months_of_runway,
                    max_unfunded_gap=fmt(o.max_unfunded_gap), recovery_month=o.recovery_month,
                    savings_end=fmt(o.savings_end), deficit_at_baseline=deficit_runs[run],
                    assumptions=_assumptions(cfg, ids)))
        be = {m: break_even(inputs, m, f13, horizon) for m in sc.get("break_even_months", [3, 6])}
        m3, m6 = be.get(3), be.get(6)
        summary = ResilienceSummary(
            break_even_m3=m3.display if m3 else None,
            break_even_m6=m6.display if m6 else None,
            capped=bool(m3 and m3.capped),
            deficit_at_baseline=bool(m3 and m3.deficit_at_baseline),
            scenarios_with_shortfall=shortfall)
    return results, summary


def _baseline_deficit(inputs: EngineInputs, run: str) -> bool:
    from engine.cashflow import month_net
    return month_net(1, inputs, run) < 0
