"""Ratios: F06 LTV, F06d negative equity at start, F07 payment/take-home, F07b DTI, F10b/F10 reserve months,
F11 savings months of income. No threshold verdicts here (flags live in flags.py)."""
from __future__ import annotations

from decimal import Decimal

from .derived import Derived, combine, missing
from .inputs import EngineInputs, Input
from .money import ZERO, engine_context
from .transaction import (
    debts_total,
    incremental_vehicle_costs,
    loan_payment_basis,
    new_payment,
    savings_after_purchase,
)

UNDEFINED = "undefined_zero_denominator"


def _div(num: Decimal, den: Decimal) -> Decimal | None:
    if den == 0:
        return None
    with engine_context():
        return num / den


def _ratio(num: Derived | Input, den_parts: list, den_value: Decimal | None) -> Derived:
    num_d = num if isinstance(num, Derived) else combine(num.dec, [num])
    probe = combine(ZERO, [num_d, *den_parts])
    if not probe.known:
        return combine(None, [num_d, *den_parts])
    v = _div(num_d.value, den_value)
    if v is None:
        return combine(None, [num_d, *den_parts], extra_missing=[UNDEFINED])
    return combine(v, [num_d, *den_parts])


def _cash_price(inputs: EngineInputs) -> Input:
    loan = inputs.loan
    for i in (loan.inputs_used if loan else ()):
        if i.key == "offer.cash_price":
            return i
    if loan is not None and loan.cash_price is not None:   # from the itemization
        return Input(key="offer.cash_price", raw=str(loan.cash_price), status="provided")
    return Input(key="offer.cash_price")


def ltv(inputs: EngineInputs) -> Derived:
    """F06 = principal / vehicle value (cash price; no separate value fact in the MVP)."""
    base = loan_payment_basis(inputs)
    if not base.known:
        return base
    cp = _cash_price(inputs)
    principal = combine(inputs.loan.principal, [base])
    return _ratio(principal, [cp], cp.dec)


def negative_equity_at_start(inputs: EngineInputs) -> Derived:
    """F06d = max(principal − vehicle value, 0)."""
    base = loan_payment_basis(inputs)
    if not base.known:
        return base
    cp = _cash_price(inputs)
    if not cp.known:
        return combine(None, [base, cp])
    return combine(max(inputs.loan.principal - cp.dec, ZERO), [base, cp])


def payment_to_take_home(inputs: EngineInputs) -> Derived:
    """F07 = payment / take-home (no threshold flag; no authoritative source)."""
    pay = new_payment(inputs)
    return _ratio(pay, [inputs.take_home], inputs.take_home.dec)


def dti_total(inputs: EngineInputs) -> Derived:
    """F07b = (Σ debts_after + payment) / gross monthly income; missing if gross is unknown."""
    pay = new_payment(inputs)
    debts = debts_total(inputs, after=True)
    num = combine((pay.value + debts.value) if pay.known and debts.known else None, [pay, debts])
    return _ratio(num, [inputs.gross], inputs.gross.dec)


def reserve_months_before(inputs: EngineInputs) -> Derived:
    """F10b = savings / (essential + Σ debts_before)."""
    debts = debts_total(inputs, after=False)
    den = (inputs.essential.dec + debts.value) if inputs.essential.known and debts.known else None
    return _ratio(inputs.savings, [inputs.essential, debts], den)


def reserve_months_after(inputs: EngineInputs) -> Derived:
    """F10 = F13 / (essential + Σ debts_after + payment + F14)."""
    f13 = savings_after_purchase(inputs)
    debts = debts_total(inputs, after=True)
    pay = new_payment(inputs)
    f14 = incremental_vehicle_costs(inputs)
    parts = [inputs.essential, debts, pay, f14]
    den = None
    if combine(ZERO, parts).known:
        den = inputs.essential.dec + debts.value + pay.value + f14.value
    return _ratio(f13, parts, den)


def savings_months_of_income(inputs: EngineInputs, *, after: bool) -> Derived:
    """F11 = savings / take-home (before) and F13 / take-home (after)."""
    num: Derived | Input = savings_after_purchase(inputs) if after else inputs.savings
    return _ratio(num, [inputs.take_home], inputs.take_home.dec)


__all__ = ["ltv", "negative_equity_at_start", "payment_to_take_home", "dti_total", "reserve_months_before",
           "reserve_months_after", "savings_months_of_income", "missing"]
