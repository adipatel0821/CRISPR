"""Shared value validators — contracts v1.1 §5 (D0-004). Every module parses wire values through these
helpers so currency / rate / term rules are enforced once.

All parsers return normalized strings (the wire format) or raise ValueError with a user-actionable message.
"""
from __future__ import annotations

import json
import re
from decimal import Decimal, InvalidOperation
from typing import Any

_CURRENCY_RE = re.compile(r"^\d+(\.\d{1,2})?$")
_RATE_RE = re.compile(r"^\d*\.?\d+$")
_INT_RE = re.compile(r"^\d+$")

TERM_MIN, TERM_MAX = 6, 96
MAX_CURRENCY = Decimal("100000000")   # sanity bound: $100M


def _clean(value: Any) -> str:
    if isinstance(value, bool) or not isinstance(value, (str, int)):
        # floats are rejected on purpose: money is never a binary float
        raise ValueError("must be a decimal string such as \"4200.00\" (numbers with fractions must be sent as strings)")
    return str(value).strip().replace(",", "").replace("$", "").replace(" ", "")


def parse_currency(value: Any, *, allow_negative: bool = False) -> str:
    s = _clean(value)
    neg = allow_negative and s.startswith("-")
    body = s[1:] if neg else s
    if not _CURRENCY_RE.match(body):
        raise ValueError("must be a non-negative dollar amount with at most 2 decimals, e.g. \"4200.00\"")
    d = Decimal(body)
    if d > MAX_CURRENCY:
        raise ValueError("is implausibly large")
    return f"{-d if neg else d:.2f}"


def parse_rate(value: Any) -> str:
    """Rates are fractions: "0.0475" = 4.75%. 0 <= r < 1."""
    s = _clean(value)
    if not _RATE_RE.match(s):
        raise ValueError("must be a rate written as a fraction, e.g. \"0.0475\" for 4.75%")
    d = Decimal(s)
    if not (Decimal(0) <= d < Decimal(1)):
        raise ValueError("must be a fraction between 0 and 1, e.g. \"0.0475\" for 4.75%")
    return format(d.normalize(), "f") if d != 0 else "0"


def parse_int(value: Any, *, lo: int | None = None, hi: int | None = None) -> str:
    s = _clean(value)
    if not _INT_RE.match(s):
        raise ValueError("must be a whole number")
    n = int(s)
    if (lo is not None and n < lo) or (hi is not None and n > hi):
        raise ValueError(f"must be between {lo} and {hi}")
    return str(n)


def parse_term_months(value: Any) -> str:
    try:
        return parse_int(value, lo=TERM_MIN, hi=TERM_MAX)
    except ValueError:
        raise ValueError(f"loan term must be a whole number of months between {TERM_MIN} and {TERM_MAX}") from None


def parse_bool(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    s = str(value).strip().lower()
    if s in {"true", "yes", "y", "1"}:
        return "true"
    if s in {"false", "no", "n", "0"}:
        return "false"
    raise ValueError("must be true or false")


def parse_decimal_count(value: Any) -> int | None:
    """Strict non-negative integer count (e.g. debts.count). Returns None when invalid (never raises)."""
    try:
        return int(parse_int(value, lo=0, hi=50))
    except (ValueError, InvalidOperation, TypeError):
        return None


def parse_value_estimates(value: Any) -> str:
    items = json.loads(value) if isinstance(value, str) else value
    if not isinstance(items, list) or not items:
        raise ValueError("must be a list of {date, value} estimates")
    out = []
    for it in items:
        if not isinstance(it, dict) or "date" not in it or "value" not in it:
            raise ValueError("each estimate needs a date and a value")
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(it["date"])):
            raise ValueError("estimate dates must be YYYY-MM-DD")
        out.append({"date": str(it["date"]), "value": parse_currency(it["value"])})
    return json.dumps(out)


# Value types of canonical fact keys whose type is fixed (ontology v1.1). Debt item fields are matched by suffix.
FACT_VALUE_TYPES: dict[str, str] = {
    "income.take_home_monthly": "currency",
    "income.low_month": "currency",
    "income.gross_monthly": "currency",
    "expenses.essential.total": "currency",
    "expenses.current_vehicle_costs_monthly": "currency",
    "expenses.flexible.total": "currency",
    "savings.liquid": "currency",
    "vehicle.new_ownership_costs_monthly": "currency",
    "debts.count": "debt_count",
    "vehicle.replaces_current": "boolean",
    "vehicle.value_estimates": "value_estimates",
    "income.variability": "enum:stable,somewhat_variable,highly_variable",
    "loan.down_payment_source": "enum:savings,other,none",
}
DEBT_FIELD_TYPES = {"monthly_payment": "currency", "balance": "currency", "remaining_months": "count",
                    "paid_off_by_transaction": "boolean", "type": "text"}
_DEBT_RE = re.compile(r"^debts\[[A-Za-z0-9_]+\]\.(?P<f>[a-z_]+)$")


def fact_value_type(key: str) -> str | None:
    if key in FACT_VALUE_TYPES:
        return FACT_VALUE_TYPES[key]
    m = _DEBT_RE.match(key)
    return DEBT_FIELD_TYPES.get(m.group("f")) if m else None


def normalize_fact_value(key: str, value: Any) -> str:
    """Validate + normalize a fact value for a known key. Unknown keys pass through (intake rejects them)."""
    vt = fact_value_type(key)
    if vt is None or vt == "text":
        if isinstance(value, str) and len(value) > 1000:
            raise ValueError("must be at most 1,000 characters")
        return value if isinstance(value, str) else str(value)
    if vt == "currency":
        return parse_currency(value)
    if vt == "count":
        return parse_int(value, lo=0, hi=600)
    if vt == "debt_count":
        return parse_int(value, lo=0, hi=50)
    if vt == "boolean":
        return parse_bool(value)
    if vt == "value_estimates":
        return parse_value_estimates(value)
    if vt.startswith("enum:"):
        allowed = vt[5:].split(",")
        s = str(value).strip()
        if s not in allowed:
            raise ValueError(f"must be one of: {', '.join(allowed)}")
        return s
    raise ValueError(f"unsupported value type {vt}")


TERM_PARSERS = {
    "currency": parse_currency,
    "rate": parse_rate,
    "integer": parse_term_months,
    "boolean": parse_bool,
}
