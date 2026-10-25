"""Append-only fact ledger (contracts §3.1, stage_01 §9). Pure functions over lists of FinancialFact.

* apply_inputs validates + normalizes typed values and appends new facts. A change to an existing key
  creates a NEW fact with `supersedes = <old fact_id>`; the old id is reported in `superseded_ids`
  (storage marks it superseded). Nothing is ever edited in place.
* current_facts returns the latest non-superseded fact per key.
* Unknown is never zero: a declined fact carries value None.
"""
from __future__ import annotations

import json
import re
import uuid
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

from intake.errors import FactValidationError
from intake.ontology import FactSpec, load_ontology
from schemas.contracts import FactEvidence, FactInput, FinancialFact, Uncertainty

NORMALIZER = "typed_widget@1.1"
CENT = Decimal("0.01")
_TRUE = {"true", "yes", "y", "1", "t"}
_FALSE = {"false", "no", "n", "0", "f"}


@dataclass
class LedgerUpdate:
    new_facts: list[FinancialFact] = field(default_factory=list)
    superseded_ids: list[str] = field(default_factory=list)


def new_fact_id() -> str:
    return "f_" + uuid.uuid4().hex


def _get(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, Mapping):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _status(obj: Any) -> str | None:
    s = _get(obj, "status")
    return getattr(s, "value", s)


# ---------------------------------------------------------------------------
# Normalization (C01 validators)
# ---------------------------------------------------------------------------
def parse_decimal(raw: Any, what: str = "amount") -> Decimal:
    if isinstance(raw, bool):
        raise FactValidationError(f"Enter a number for {what}.", {"value": raw})
    if isinstance(raw, (int, Decimal)):
        d = Decimal(raw)
    elif isinstance(raw, float):
        d = Decimal(repr(raw))
    else:
        s = str(raw).strip().lower()
        s = re.sub(r"[\s$,]", "", s)
        s = re.sub(r"(usd|dollars?|/mo(nth)?|permonth|amonth)$", "", s)
        mult = Decimal(1)
        if s.endswith("k"):
            mult, s = Decimal(1000), s[:-1]
        if s.startswith("(") and s.endswith(")"):
            s = "-" + s[1:-1]
        try:
            d = Decimal(s) * mult
        except (InvalidOperation, ValueError):
            raise FactValidationError(
                f"We couldn't read \"{raw}\" as a number for {what}. Enter digits only, e.g. 4200 or 4,200.",
                {"value": str(raw)}) from None
    if not d.is_finite():
        raise FactValidationError(f"Enter a finite number for {what}.", {"value": str(raw)})
    return d


def normalize_currency(raw: Any, label: str) -> str:
    d = parse_decimal(raw, label)
    if d < 0:
        raise FactValidationError(f"{label[:1].upper() + label[1:]} can't be negative. Enter 0 or more.",
                                  {"value": str(raw), "validator": "nonnegative"})
    return str(d.quantize(CENT, rounding=ROUND_HALF_UP))


def normalize_integer(raw: Any, spec: FactSpec) -> str:
    d = parse_decimal(raw, spec.label)
    if d != d.to_integral_value():
        raise FactValidationError(f"Enter a whole number for {spec.label}.", {"value": str(raw)})
    n = int(d)
    lo = spec.min if spec.min is not None else None
    hi = spec.max if spec.max is not None else None
    if (lo is not None and n < lo) or (hi is not None and n > hi):
        raise FactValidationError(f"Enter a whole number between {lo} and {hi} for {spec.label}.",
                                  {"value": str(raw), "validator": f"range:{lo}..{hi}"})
    return str(n)


def normalize_enum(raw: Any, spec: FactSpec) -> str:
    s = str(raw).strip()
    low = s.lower()
    for value, label in spec.enum.items():
        if low == value.lower() or low == str(label).lower():
            return value
    if spec.key == "income.variability" and low == "variable":
        return "somewhat_variable"
    raise FactValidationError(
        f"Choose one of: {', '.join(spec.enum.values())}.",
        {"value": s, "allowed": list(spec.enum)})


def normalize_boolean(raw: Any, spec: FactSpec) -> str:
    if isinstance(raw, bool):
        return "true" if raw else "false"
    s = str(raw).strip().lower()
    if s in _TRUE:
        return "true"
    if s in _FALSE:
        return "false"
    raise FactValidationError(f"Answer yes or no for {spec.label}.", {"value": str(raw)})


def normalize_value_list(raw: Any, spec: FactSpec) -> str:
    items = raw
    if isinstance(raw, str):
        try:
            items = json.loads(raw)
        except json.JSONDecodeError:
            raise FactValidationError(
                'Enter value estimates as a list like [{"date": "2027-10-01", "value": "18000"}].',
                {"value": raw}) from None
    if isinstance(items, Mapping):
        items = [items]
    if not isinstance(items, list) or not items:
        raise FactValidationError("Enter at least one estimate with a date and a value.", {"value": str(raw)})
    out = []
    for it in items:
        if not isinstance(it, Mapping) or "date" not in it or "value" not in it:
            raise FactValidationError("Each estimate needs a date and a value.", {"value": str(it)})
        try:
            d = date.fromisoformat(str(it["date"]))
        except ValueError:
            raise FactValidationError(f"Use a date like 2027-10-01 (got \"{it['date']}\").",
                                      {"value": str(it["date"])}) from None
        out.append({"date": d.isoformat(), "value": normalize_currency(it["value"], "the estimated value")})
    out.sort(key=lambda x: x["date"])
    return json.dumps(out, separators=(",", ":"))


def normalize(spec: FactSpec, raw: Any) -> str:
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        raise FactValidationError(f"Enter a value for {spec.label}, or choose skip / prefer not to say.",
                                  {"value": raw})
    vt = spec.value_type
    if vt == "currency":
        return normalize_currency(raw, spec.label)
    if vt == "integer":
        return normalize_integer(raw, spec)
    if vt == "enum":
        return normalize_enum(raw, spec)
    if vt == "boolean":
        return normalize_boolean(raw, spec)
    if vt == "date_value_list":
        return normalize_value_list(raw, spec)
    if vt == "rate":
        d = parse_decimal(raw, spec.label)
        if not (Decimal(0) <= d < 1):
            raise FactValidationError("Enter the rate as a fraction, e.g. 0.0475.", {"value": str(raw)})
        return str(d)
    return str(raw)[:1000]


def validate_stored(key: str, value: Any) -> str | None:
    """C01 re-check of a stored value. Returns an error message or None."""
    spec = load_ontology().spec_for(key)
    if spec is None:
        return f"Unknown fact key {key}"
    if value is None:
        return None
    try:
        normalize(spec, value)
    except FactValidationError as e:
        return e.message
    return None


# ---------------------------------------------------------------------------
# Ledger operations
# ---------------------------------------------------------------------------
def current_facts(all_facts: Iterable[Any]) -> dict[str, Any]:
    """Latest non-superseded fact per key (append order breaks created_at ties)."""
    facts = list(all_facts)
    superseded = {_get(f, "supersedes") for f in facts if _get(f, "supersedes")}
    out: dict[str, Any] = {}
    for f in facts:
        if _get(f, "fact_id") in superseded or _status(f) == "superseded":
            continue
        out[_get(f, "key")] = f       # later entries win
    return out


def make_fact(session_id: str, key: str, value: str | None, status: str, spec: FactSpec | None = None, *,
              supersedes: str | None = None, original: str | None = None,
              uncertainty: Uncertainty | None = None, ref: str | None = None,
              display_label: str = "You told us") -> FinancialFact:
    spec = spec or load_ontology().spec_for(key)
    if spec is None:
        raise FactValidationError(f"Unknown fact key \"{key}\".", {"key": key})
    if uncertainty is None:
        uncertainty = Uncertainty(kind="approximate" if status == "estimated" else
                                  "unknown" if value is None else "exact")
    return FinancialFact(
        fact_id=new_fact_id(), session_id=session_id, key=key, value=value, value_type=spec.value_type,
        unit=spec.unit, status=status, verification="none", source_kind="user_input", uncertainty=uncertainty,
        evidence=FactEvidence(kind="user_input", ref=ref, display_label=display_label),
        original_representation=original, normalized_by=NORMALIZER if value is not None else None,
        supersedes=supersedes)


def _unknown_key_error(key: str) -> FactValidationError:
    onto = load_ontology()
    return FactValidationError(
        f"Unknown fact key \"{key}\". Use one of the ontology keys (e.g. income.take_home_monthly, "
        f"debts[d1].monthly_payment).", {"key": key, "known_keys": onto.known_keys()})


def apply_inputs(session_id: str, existing: list[Any], inputs: list[FactInput | Mapping[str, Any]]) -> LedgerUpdate:
    """Validate + normalize typed inputs and append facts. Atomic: raises before producing anything.

    Raises FactValidationError (message, details) on an unknown key or invalid value.
    """
    onto = load_ontology()
    current = dict(current_facts(existing))
    update = LedgerUpdate()
    errors: list[dict[str, Any]] = []
    staged: list[tuple[str, str | None, str, FactSpec, Any, Uncertainty | None]] = []
    for raw_inp in inputs:
        inp = raw_inp if isinstance(raw_inp, FactInput) else FactInput.model_validate(raw_inp)
        spec = onto.spec_for(inp.key)
        if spec is None:
            raise _unknown_key_error(inp.key)
        status = inp.status
        try:
            value = None if status == "declined" else normalize(spec, inp.value)
        except FactValidationError as e:
            errors.append({"key": inp.key, "message": e.message, **(e.details if isinstance(e.details, dict) else {})})
            continue
        unc = inp.uncertainty
        if unc is not None and getattr(unc.kind, "value", unc.kind) == "range":
            if unc.low is None or unc.high is None:
                errors.append({"key": inp.key, "message": "A range needs both a low and a high value."})
                continue
            unc = Uncertainty(kind="range", low=normalize_currency(unc.low, spec.label),
                              high=normalize_currency(unc.high, spec.label))
        original = inp.original_representation if inp.original_representation is not None else (
            None if inp.value is None else str(inp.value))
        staged.append((inp.key, value, status, spec, original, unc))
    if errors:
        msg = errors[0]["message"] if len(errors) == 1 else f"{len(errors)} answers need fixing: " + "; ".join(
            e["message"] for e in errors)
        raise FactValidationError(msg, {"errors": errors})

    for key, value, status, spec, original, unc in staged:
        old = current.get(key)
        if old is not None and _get(old, "value") == value and _status(old) == status:
            continue                                      # idempotent re-submit: nothing new
        fact = make_fact(session_id, key, value, status, spec, supersedes=_get(old, "fact_id") if old else None,
                         original=original, uncertainty=unc)
        if old is not None:
            update.superseded_ids.append(_get(old, "fact_id"))
        update.new_facts.append(fact)
        current[key] = fact
        if key == "debts.count" and value is not None:
            update.new_facts += _debt_placeholders(session_id, current, int(value))
    return update


def _debt_placeholders(session_id: str, current: dict[str, Any], count: int) -> list[FinancialFact]:
    """Announced debt items get an explicit `missing` monthly_payment fact (d1..dN) so each item has its
    own status (R1-06) and readiness blocks on it; unknown is never zero."""
    out = []
    for k in range(1, count + 1):
        key = f"debts[d{k}].monthly_payment"
        if key not in current:
            f = make_fact(session_id, key, None, "missing", display_label="Not answered yet")
            current[key] = f
            out.append(f)
    return out


def retract(session_id: str, existing: list[Any], key: str) -> LedgerUpdate:
    """Mark a key as missing again (user said a value was wrong in a plausibility check)."""
    current = current_facts(existing)
    old = current.get(key)
    fact = make_fact(session_id, key, None, "missing", supersedes=_get(old, "fact_id") if old else None,
                     display_label="You said this was not right")
    return LedgerUpdate(new_facts=[fact], superseded_ids=[_get(old, "fact_id")] if old else [])
