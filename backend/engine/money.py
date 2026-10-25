"""Decimal helpers shared by every engine module (ADR-S3-01).

* 28-digit context, ROUND_HALF_UP everywhere; quantization is always explicit.
* Wire format is a string decimal; ``-0.00`` is normalised to ``0.00`` so output bytes are reproducible.
"""
from __future__ import annotations

from decimal import ROUND_DOWN, ROUND_HALF_UP, Context, Decimal, InvalidOperation, localcontext
from typing import Any

CTX = Context(prec=28, rounding=ROUND_HALF_UP)
ZERO = Decimal("0")
ONE = Decimal("1")
CENT = Decimal("0.01")
TWELVE = Decimal("12")

PLACES = {
    2: Decimal("0.01"),
    3: Decimal("0.001"),
    4: Decimal("0.0001"),
    5: Decimal("0.00001"),
}


def engine_context():
    """Context manager used by every public engine entry point."""
    return localcontext(CTX)


def to_decimal(value: Any) -> Decimal | None:
    """Parse a wire value (string/int/Decimal) into Decimal. Floats are refused (never money on the wire)."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        raise TypeError("floats are not accepted as money/rate values; pass a string decimal")
    try:
        text = str(value).strip().replace(",", "").replace("$", "")
        if text == "":
            return None
        return Decimal(text)
    except (InvalidOperation, ValueError):
        return None


def to_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"true", "yes", "y", "1"}:
        return True
    if text in {"false", "no", "n", "0"}:
        return False
    return None


def q(value: Decimal, places: int = 2, rounding: str = ROUND_HALF_UP) -> Decimal:
    out = value.quantize(PLACES[places], rounding=rounding)
    if out == 0:
        out = abs(out)          # never emit "-0.00"
    return out


def round2(value: Decimal) -> Decimal:
    return q(value, 2)


def fmt(value: Decimal | None, places: int = 2, rounding: str = ROUND_HALF_UP) -> str | None:
    if value is None:
        return None
    return str(q(value, places, rounding))


def fmt_down(value: Decimal | None, places: int = 2) -> str | None:
    return fmt(value, places, ROUND_DOWN)
