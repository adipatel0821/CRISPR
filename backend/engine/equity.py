"""F12 equity timeline — ONLY from the user's own vehicle value estimates (no default depreciation; ADR-S3-07).

Each estimate point is ``{"date": "YYYY-MM-DD", "value": "18000.00"}`` or ``{"month": 12, "value": ...}``.
Dates are converted to loan months relative to ``as_of`` (month 0 = as_of's month = loan start).
Equity at a point = user value − scheduled balance after that month's payment.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from .derived import Derived, combine, missing
from .inputs import EngineInputs
from .money import ZERO, fmt, to_decimal
from .transaction import loan_payment_basis


def _month_index(point: dict[str, Any], as_of: date) -> int | None:
    if "month" in point:
        try:
            return int(point["month"])
        except (TypeError, ValueError):
            return None
    d = point.get("date")
    if not d:
        return None
    try:
        y, m, _ = (int(x) for x in str(d)[:10].split("-"))
    except ValueError:
        return None
    return (y - as_of.year) * 12 + (m - as_of.month)


def equity_timeline(inputs: EngineInputs, as_of: date) -> tuple[Derived, list[dict[str, str | int]]]:
    pts = inputs.value_estimate_points()
    base = loan_payment_basis(inputs)
    if pts is None:
        return combine(None, [inputs.value_estimates, base]), []
    if not base.known:
        return combine(None, [inputs.value_estimates, base]), []
    loan = inputs.loan
    out: list[dict[str, str | int]] = []
    for p in pts:
        k = _month_index(p, as_of)
        v = to_decimal(p.get("value"))
        if k is None or v is None or k < 0:
            continue
        balance = loan.principal if k == 0 else (loan.rows[k - 1][3] if k <= len(loan.rows) else ZERO)
        out.append({"month": k, "date": str(p.get("date")) if p.get("date") else None, "value": fmt(v),
                    "balance": fmt(balance), "equity": fmt(v - balance), "source": "your estimate"})
    if not out:
        return missing("vehicle.value_estimates"), []
    out.sort(key=lambda r: r["month"])
    first = Decimal(out[0]["equity"])
    d = combine(first, [inputs.value_estimates, base], label="your estimate")
    return d, out
