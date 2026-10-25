"""Paired, floored scenario runs over ``engine.month_components`` / ``engine.month_net`` (stage_04 v1.1 §10).

Recursion per month t: raw = S_{t−1} + net_t. A surplus first repays the unfunded gap, then adds to savings.
Savings never go below 0; a shortfall beyond savings accumulates in ``unfunded_gap`` (no interest assumed).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from engine.cashflow import month_components
from engine.inputs import EngineInputs
from engine.money import ZERO, engine_context, fmt
from schemas.contracts import ScenarioMonth


@dataclass
class RunOutcome:
    paths: list[ScenarioMonth] = field(default_factory=list)
    nets: list[Decimal] = field(default_factory=list)
    first_shortfall_month: int | None = None
    months_of_runway: int = 0
    max_unfunded_gap: Decimal = ZERO
    recovery_month: int | None = None
    savings_end: Decimal = ZERO
    gap_end: Decimal = ZERO


def simulate(inputs: EngineInputs, run: str, transforms: dict | None, start: Decimal, horizon: int) -> RunOutcome:
    out = RunOutcome()
    with engine_context():
        savings = start
        gap = ZERO
        for t in range(1, horizon + 1):
            c = month_components(t, inputs, run, transforms)      # the engine is the only arithmetic source
            net = c["net"]
            out.nets.append(net)
            if net >= 0:
                repay = min(gap, net)
                gap -= repay
                savings += net - repay
            else:
                raw = savings + net
                if raw < 0:
                    savings = ZERO
                    gap += -raw
                    if out.first_shortfall_month is None:
                        out.first_shortfall_month = t
                else:
                    savings = raw
            if gap > out.max_unfunded_gap:
                out.max_unfunded_gap = gap
            if (out.first_shortfall_month is not None and out.recovery_month is None
                    and t > out.first_shortfall_month and gap == 0):
                out.recovery_month = t
            out.paths.append(ScenarioMonth(
                month=t, income=fmt(c["income"]), essential=fmt(c["essential"]), flexible=fmt(c["flexible"]),
                debt_payments=fmt(c["debt_payments"]), new_payment=fmt(c["new_payment"]),
                incremental_vehicle_costs=fmt(c["incremental_vehicle_costs"]), one_time=fmt(c["one_time"]),
                net=fmt(net), savings_balance=fmt(savings), unfunded_gap=fmt(gap)))
        out.months_of_runway = (out.first_shortfall_month - 1) if out.first_shortfall_month else horizon
        out.savings_end = savings
        out.gap_end = gap
    return out
