"""Household cash flow: F08 monthly left before, F09 monthly left after, and ``month_net(t)`` for Stage 4.

Flexible spending is subtracted only when known; otherwise the label says "before discretionary spending".
Negative results are legitimate (deficits are computed and flagged, never rejected).
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from .derived import Derived, combine
from .inputs import EngineInputs
from .money import ZERO, engine_context
from .transaction import debts_total, incremental_vehicle_costs, new_payment

LABEL_WITH_FLEX = "after essentials, debts and flexible spending"
LABEL_NO_FLEX = "before discretionary spending"


class MissingInputError(ValueError):
    def __init__(self, missing: list[str]):
        super().__init__("missing inputs: " + ", ".join(missing))
        self.missing = missing


# ---- pure arithmetic (also used directly by reference tests) ------------------------------------
def f08(take_home: Decimal, essential: Decimal, debts_before: Decimal, flexible: Decimal | None = None) -> Decimal:
    with engine_context():
        return take_home - essential - debts_before - (flexible if flexible is not None else ZERO)


def f09(take_home: Decimal, essential: Decimal, debts_after: Decimal, payment: Decimal, f14: Decimal,
        flexible: Decimal | None = None) -> Decimal:
    with engine_context():
        return take_home - essential - debts_after - payment - f14 - (flexible if flexible is not None else ZERO)


def _flex(inputs: EngineInputs) -> tuple[Decimal | None, str]:
    return (inputs.flexible.dec, LABEL_WITH_FLEX) if inputs.flexible.known else (None, LABEL_NO_FLEX)


def monthly_left_before(inputs: EngineInputs) -> Derived:
    debts = debts_total(inputs, after=False)
    flex, label = _flex(inputs)
    parts = [inputs.take_home, inputs.essential, debts] + ([inputs.flexible] if flex is not None else [])
    probe = combine(ZERO, parts)
    if not probe.known:
        return combine(None, parts, label=label)
    return combine(f08(inputs.take_home.dec, inputs.essential.dec, debts.value, flex), parts, label=label)


def monthly_left_after(inputs: EngineInputs, labels: dict[str, str] | None = None) -> Derived:
    debts = debts_total(inputs, after=True)
    pay = new_payment(inputs)
    f14 = incremental_vehicle_costs(inputs, labels)
    flex, label = _flex(inputs)
    parts = [inputs.take_home, inputs.essential, debts, pay, f14] + ([inputs.flexible] if flex is not None else [])
    probe = combine(ZERO, parts)
    if not probe.known:
        return combine(None, parts, label=label)
    return combine(f09(inputs.take_home.dec, inputs.essential.dec, debts.value, pay.value, f14.value, flex),
                   parts, label=label)


# ---- month_net(t) -------------------------------------------------------------------------------
def _in_months(t: int, months: Any) -> bool:
    return months is None or t in months


def month_components(t: int, inputs: EngineInputs, run: str, transforms: dict | None = None) -> dict[str, Decimal]:
    """All cash-flow components of month t (1-based) for a run; ``net`` is what ``month_net`` returns.

    transforms (all optional, data only):
      income_override (Decimal) + income_override_months (list[int] | None = every month)
      income_factor (Decimal)   + income_factor_months (list[int] | None)
      one_time: {month: Decimal}
      vehicle_cost_rise (Decimal fraction) + vehicle_cost_rise_from (int month, default 1)
    Debts drop out after their remaining_months; the new payment and F14 apply only to ``with_offer``.
    """
    run = getattr(run, "value", run)
    if run not in ("without_offer", "with_offer"):
        raise ValueError(f"unknown run {run!r}")
    tr = transforms or {}
    after = run == "with_offer"
    debts = debts_total(inputs, after=after, month=t)
    missing = [k for k in (inputs.take_home, inputs.essential) if not k.known]
    miss_keys = [m.key for m in missing] + list(debts.missing)
    pay = ZERO
    f14 = ZERO
    if after:
        loan = inputs.loan
        if loan is None or not loan.computable:
            miss_keys.append("offer.minimum_set")
        else:
            pay = loan.payment_in_month(t)
        f14d = incremental_vehicle_costs(inputs)
        f14 = f14d.value if f14d.value is not None else ZERO
    if miss_keys:
        raise MissingInputError(list(dict.fromkeys(miss_keys)))
    with engine_context():
        income = inputs.take_home.dec
        if "income_override" in tr and _in_months(t, tr.get("income_override_months")):
            income = Decimal(tr["income_override"])
        if "income_factor" in tr and _in_months(t, tr.get("income_factor_months")):
            income = income * Decimal(tr["income_factor"])
        if after and "vehicle_cost_rise" in tr and t >= int(tr.get("vehicle_cost_rise_from", 1)):
            f14 = f14 + abs(f14) * Decimal(tr["vehicle_cost_rise"])
        one_time = Decimal((tr.get("one_time") or {}).get(t, ZERO))
        essential = inputs.essential.dec
        flexible = inputs.flexible.dec if inputs.flexible.known else ZERO
        net = income - essential - flexible - debts.value - pay - f14 - one_time
    return {"income": income, "essential": essential, "flexible": flexible, "debt_payments": debts.value,
            "new_payment": pay, "incremental_vehicle_costs": f14, "one_time": one_time, "net": net}


def month_net(t: int, inputs: EngineInputs, run: str, transforms: dict | None = None) -> Decimal:
    """Monthly net cash flow used by Stage 4 (the single arithmetic source for scenarios)."""
    return month_components(t, inputs, run, transforms)["net"]
