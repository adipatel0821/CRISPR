"""Intake rules (stage_01 §9.2 v1.1). Pure.

* H01_deficit            essentials + Σ known debt payments > take-home → ONE acknowledgement
                         question. Once acknowledged it is never asked again and never becomes a
                         conflict (A-21). A user whose expenses exceed income can never loop.
* H02_savings_high       savings > 36 × take-home → plausibility confirm once.
* H02_down_payment       offer cash_down > savings while down_payment_source = savings → confirm once
                         ("where will the rest come from?").
* C01_invalid_value      a stored value fails its ontology validator (re-ask).
Deficits are valid states: no rule here ever produces a blocking conflict for them.
"""
from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Literal

from engine import requirements as req
from schemas.contracts import Acknowledgement

H01 = "H01_deficit"
H02_SAVINGS = "H02_savings_high"
H02_DOWN = "H02_down_payment"
ACK_RULES = (H01, H02_SAVINGS, H02_DOWN)
SAVINGS_PLAUSIBILITY_MULTIPLE = Decimal(36)

# The fact a rule's acknowledgement question is attached to (QuestionCandidate.fact_key).
RULE_FACT_KEY = {H01: "expenses.essential.total", H02_SAVINGS: "savings.liquid", H02_DOWN: "loan.down_payment_source"}
# Dependency order used for acknowledgement questions (they are asked before any blocking question).
RULE_ORDER = {H01: 0, H02_SAVINGS: 1, H02_DOWN: 2}


@dataclass
class RuleHit:
    rule_id: str
    kind: Literal["acknowledgement", "validation", "conflict"]
    fact_keys: list[str]
    message: str
    values: dict[str, str] = field(default_factory=dict)
    fact_ids: list[str] = field(default_factory=list)


def _dec(facts: Mapping[str, Any], key: str) -> Decimal | None:
    if not req.is_known(facts, key):
        return None
    return req._decimal(req._value(facts.get(key)))


def _fid(facts: Mapping[str, Any], key: str) -> str | None:
    f = facts.get(key)
    if f is None:
        return None
    return f.get("fact_id") if isinstance(f, Mapping) else getattr(f, "fact_id", None)


def fmt_money(d: Decimal, whole: bool = False) -> str:
    """$4,000 / $375.14 / −$210 (whole=True rounds half-up to dollars)."""
    neg = d < 0
    a = abs(d)
    if whole:
        a = a.quantize(Decimal(1), rounding=ROUND_HALF_UP)
        s = f"{a:,.0f}"
    elif a == a.to_integral_value():
        s = f"{a:,.0f}"
    else:
        s = f"{a.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):,.2f}"
    return ("−$" if neg else "$") + s


def known_debt_payments(facts: Mapping[str, Any]) -> tuple[Decimal, list[str]]:
    """Σ of KNOWN debt item payments (missing ones are never summed as 0; they block separately)."""
    total, keys = Decimal(0), []
    for item in req.debt_item_ids(facts):
        k = f"debts[{item}].monthly_payment"
        v = _dec(facts, k)
        if v is not None:
            total += v
            keys.append(k)
    return total, keys


def acknowledged(acks: list[Acknowledgement] | None) -> set[str]:
    out = set()
    for a in acks or []:
        out.add(a.get("rule_id") if isinstance(a, Mapping) else a.rule_id)
    return out


def deficit_amount(facts: Mapping[str, Any]) -> Decimal | None:
    take = _dec(facts, "income.take_home_monthly")
    ess = _dec(facts, "expenses.essential.total")
    if take is None or ess is None:
        return None
    debts, _ = known_debt_payments(facts)
    gap = ess + debts - take
    return gap if gap > 0 else None


def offer_cash_down(offer: Any) -> Decimal | None:
    return req.cash_down_amount(offer)


def check_rules(facts: Mapping[str, Any], offer: Any = None,
                acknowledgements: list[Acknowledgement] | None = None) -> list[RuleHit]:
    """All rule hits that still need the user's attention, in the order they should be asked."""
    done = acknowledged(acknowledgements)
    hits: list[RuleHit] = []

    gap = deficit_amount(facts)
    if gap is not None and H01 not in done:
        _, debt_keys = known_debt_payments(facts)
        keys = ["income.take_home_monthly", "expenses.essential.total", *debt_keys]
        hits.append(RuleHit(
            rule_id=H01, kind="acknowledgement", fact_keys=keys,
            message=f"This leaves about {fmt_money(-gap, whole=True)} each month before this loan. Is that right?",
            values={"monthly_gap": str(gap.quantize(Decimal('0.01')))},
            fact_ids=[i for i in (_fid(facts, k) for k in keys) if i]))

    take = _dec(facts, "income.take_home_monthly")
    savings = _dec(facts, "savings.liquid")
    if (take is not None and savings is not None and take > 0
            and savings > SAVINGS_PLAUSIBILITY_MULTIPLE * take and H02_SAVINGS not in done):
        keys = ["savings.liquid", "income.take_home_monthly"]
        hits.append(RuleHit(
            rule_id=H02_SAVINGS, kind="acknowledgement", fact_keys=keys,
            message=(f"You listed {fmt_money(savings)} in savings, which is more than three years of take-home pay. "
                     f"Is that right?"),
            values={"savings": str(savings), "take_home": str(take)},
            fact_ids=[i for i in (_fid(facts, k) for k in keys) if i]))

    cash_down = offer_cash_down(offer)
    source = req._value(facts.get("loan.down_payment_source")) if req.is_known(facts, "loan.down_payment_source") else None
    if (cash_down is not None and cash_down > 0 and savings is not None and source == "savings"
            and cash_down > savings and H02_DOWN not in done):
        keys = ["loan.down_payment_source", "savings.liquid"]
        hits.append(RuleHit(
            rule_id=H02_DOWN, kind="acknowledgement", fact_keys=keys,
            message=(f"Your {fmt_money(cash_down)} down payment is more than the {fmt_money(savings)} savings you "
                     f"listed. Where will the rest come from?"),
            values={"cash_down": str(cash_down), "savings": str(savings)},
            fact_ids=[i for i in (_fid(facts, k) for k in keys) if i]))

    # C01: stored values that fail their validator (e.g. written by another path).
    from intake.ledger import validate_stored  # local import: ledger imports ontology only
    for key, f in facts.items():
        if not req.is_known(facts, key):
            continue
        err = validate_stored(key, req._value(f))
        if err:
            hits.append(RuleHit(rule_id="C01_invalid_value", kind="validation", fact_keys=[key], message=err,
                                fact_ids=[i for i in [_fid(facts, key)] if i]))
    return hits


def acknowledgement_hits(facts: Mapping[str, Any], offer: Any = None,
                         acknowledgements: list[Acknowledgement] | None = None) -> list[RuleHit]:
    return [h for h in check_rules(facts, offer, acknowledgements) if h.kind == "acknowledgement"]


def acknowledge(rule_ids: list[str], facts: Mapping[str, Any], offer: Any = None,
                existing: list[Acknowledgement] | None = None) -> list[Acknowledgement]:
    """Acknowledgement records for FactsRequest.acknowledge_rules (form path). Unknown rule ids are
    ignored; rules already acknowledged are not duplicated."""
    done = acknowledged(existing)
    pending = {h.rule_id: h for h in check_rules(facts, offer, existing) if h.kind == "acknowledgement"}
    out = []
    for rid in rule_ids:
        if rid in done or rid not in ACK_RULES:
            continue
        hit = pending.get(rid)
        out.append(Acknowledgement(rule_id=rid, fact_ids=hit.fact_ids if hit else []))
        done.add(rid)
    return out
