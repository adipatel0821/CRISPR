"""Display formatting for claim values. Decimal only, explicit ROUND_HALF_UP; no arithmetic beyond rounding,
absolute value and the x100 percent display shift. One formatter for every template (stage 6 R6-07)."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

WHOLE = Decimal("1")
CENT = Decimal("0.01")


def dec(value: Any) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        d = Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return None
    return d if d.is_finite() else None


def dollars(value: Any) -> str:
    """Headline: whole dollars with thousands separators, absolute value ('3008.29' -> '3,008')."""
    d = dec(value)
    if d is None:
        raise ValueError("not a number")
    return f"{d.copy_abs().quantize(WHOLE, rounding=ROUND_HALF_UP):,}"


def cents(value: Any) -> str:
    """Detail: dollars and cents ('22508.29' -> '22,508.29'), absolute value."""
    d = dec(value)
    if d is None:
        raise ValueError("not a number")
    return f"{d.copy_abs().quantize(CENT, rounding=ROUND_HALF_UP):,.2f}"


def one_dp(value: Any) -> str:
    d = dec(value)
    if d is None:
        raise ValueError("not a number")
    return str(d.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def percent(rate: Any, places: int = 1) -> str:
    """Fraction -> percent text without trailing zeros ('0.05796', 3 -> '5.796'; '0.0893', 1 -> '8.9')."""
    d = dec(rate)
    if d is None:
        raise ValueError("not a number")
    q = (d * 100).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
    s = f"{q:f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


def integer(value: Any) -> str:
    d = dec(value)
    if d is None:
        raise ValueError("not a number")
    return str(int(d.quantize(WHOLE, rounding=ROUND_HALF_UP)))


def is_negative(value: Any) -> bool:
    d = dec(value)
    return d is not None and d < 0


def is_zero(value: Any) -> bool:
    d = dec(value)
    return d is not None and d == 0
