"""Engine-published input requirements (contracts §3.7 `required_inputs`, §3.12 readiness table).

Owner: Agent 1 (Financial Core). Stage 1 readiness MUST call `evaluate_readiness` (A-23 parity);
it must not keep its own copy of these lists.

Conventions
-----------
* Fact keys are canonical ontology keys (config/ontology.yaml).
* Debt items use ids d1, d2, ... : `debts[d1].monthly_payment`, `debts[d1].remaining_months`,
  `debts[d1].paid_off_by_transaction`, `debts[d1].type`.
* `debts.count = "0"` (provided) records "no debts" explicitly.
* A fact counts as known only when its status is provided / estimated / calculated.
* "offer.minimum_set" is satisfied by a LoanOffer with ready_for_calculation = True.
"""
from __future__ import annotations

import re
from collections.abc import Mapping
from decimal import Decimal, InvalidOperation
from typing import Any

from schemas.contracts import AnalysisReadiness, COMPUTABLE_STATUSES, FactStatus
from schemas.validation import parse_decimal_count

OFFER_MINIMUM_SET = "offer.minimum_set"
DEBT_ITEM_RE = re.compile(r"^debts\[(?P<id>[A-Za-z0-9_]+)\]\.(?P<field>[a-z_]+)$")

# metric -> inputs (static map echoed in CalculationResult.required_inputs)
REQUIRED_INPUTS: dict[str, list[str]] = {
    "principal": [OFFER_MINIMUM_SET],
    "monthly_payment": [OFFER_MINIMUM_SET],
    "total_of_payments": [OFFER_MINIMUM_SET],
    "finance_charge": [OFFER_MINIMUM_SET],
    "interest": [OFFER_MINIMUM_SET],
    "total_paid_through_deal": [OFFER_MINIMUM_SET],
    "apr_recomputed": [OFFER_MINIMUM_SET],
    "ltv": [OFFER_MINIMUM_SET],
    "negative_equity_at_start": [OFFER_MINIMUM_SET],
    "payment_to_take_home": ["income.take_home_monthly", OFFER_MINIMUM_SET],
    "dti_total": ["income.gross_monthly", "debts.*.monthly_payment", OFFER_MINIMUM_SET],
    "monthly_left_before": ["income.take_home_monthly", "expenses.essential.total", "debts.*.monthly_payment"],
    "incremental_vehicle_costs": [],  # refinement-only inputs; 0 when no ownership costs are given (labelled)
    "monthly_left_after": ["income.take_home_monthly", "expenses.essential.total", "debts.*.monthly_payment",
                           OFFER_MINIMUM_SET],
    "savings_after_purchase": ["savings.liquid", "loan.down_payment_source", OFFER_MINIMUM_SET],
    "reserve_months_before": ["savings.liquid", "expenses.essential.total", "debts.*.monthly_payment"],
    "reserve_months_after": ["savings.liquid", "loan.down_payment_source", "expenses.essential.total",
                             "debts.*.monthly_payment", OFFER_MINIMUM_SET],
    "savings_months_of_income": ["savings.liquid", "income.take_home_monthly", "loan.down_payment_source",
                                 OFFER_MINIMUM_SET],
    "equity_timeline": ["vehicle.value_estimates", OFFER_MINIMUM_SET],
}

# analysis -> metrics it displays
ANALYSIS_METRICS: dict[str, list[str]] = {
    "loan_cost": ["principal", "monthly_payment", "total_of_payments", "finance_charge", "interest",
                  "total_paid_through_deal", "apr_recomputed"],
    "cashflow_impact": ["monthly_left_before", "incremental_vehicle_costs", "monthly_left_after",
                        "payment_to_take_home"],
    "reserve_impact": ["savings_after_purchase", "reserve_months_before", "reserve_months_after",
                       "savings_months_of_income"],
    "stress_test": ["savings_after_purchase", "monthly_left_after"],
    "alternatives": ["monthly_payment", "finance_charge", "monthly_left_after", "savings_after_purchase"],
    "dti": ["dti_total"],
    "equity_timeline": ["equity_timeline"],
}

REASONS: dict[str, str] = {
    "income.take_home_monthly": "your monthly take-home pay",
    "expenses.essential.total": "your essential monthly expenses",
    "debts.count": "whether you have existing debt payments",
    "savings.liquid": "the savings you could use in an emergency",
    "loan.down_payment_source": "where your down payment comes from",
    "income.low_month": "your take-home pay in a slow month",
    "income.gross_monthly": "your gross (before-tax) monthly income",
    "vehicle.value_estimates": "your estimate of the car's future value",
    OFFER_MINIMUM_SET: "a loan offer with amount, rate and term",
}

VARIABLE_INCOME = {"somewhat_variable", "highly_variable", "variable"}


def _status(fact: Any) -> str | None:
    if fact is None:
        return None
    s = fact.get("status") if isinstance(fact, Mapping) else getattr(fact, "status", None)
    return getattr(s, "value", s)


def _value(fact: Any) -> Any:
    if fact is None:
        return None
    return fact.get("value") if isinstance(fact, Mapping) else getattr(fact, "value", None)


_COMPUTABLE = {s.value for s in COMPUTABLE_STATUSES}


def is_known(facts: Mapping[str, Any], key: str) -> bool:
    if _status(facts.get(key)) not in _COMPUTABLE:
        return False
    if key == "debts.count":                      # D0-002: an invalid count is unknown, never "no debts"
        return parse_decimal_count(_value(facts[key])) is not None
    return True


def is_declined(facts: Mapping[str, Any], key: str) -> bool:
    return _status(facts.get(key)) == FactStatus.declined.value


def debt_item_ids(facts: Mapping[str, Any]) -> list[str]:
    ids: list[str] = []
    for k in facts:
        m = DEBT_ITEM_RE.match(k)
        if m and m.group("id") not in ids:
            ids.append(m.group("id"))
    return sorted(ids, key=lambda s: (len(s), s))


def _decimal(v: Any) -> Decimal | None:
    try:
        return Decimal(str(v)) if v is not None else None
    except (InvalidOperation, ValueError):
        return None


def debt_requirements(facts: Mapping[str, Any]) -> list[str]:
    """Expand `debts.*.monthly_payment` into concrete keys. Unknown count => `debts.count` itself."""
    if not is_known(facts, "debts.count"):
        return ["debts.count"]
    count = parse_decimal_count(_value(facts["debts.count"]))
    if not count:
        return ["debts.count"]
    ids = debt_item_ids(facts)
    for k in range(len(ids) + 1, count + 1):          # items announced but not yet created
        candidate = f"d{k}"
        while candidate in ids:
            candidate += "x"
        ids.append(candidate)
    return ["debts.count"] + [f"debts[{i}].monthly_payment" for i in ids]


def _term_amount(offer: Any, key: str) -> Decimal | None:
    """Value of an offer term, or None when absent or not computable (e.g. conflicting) — D0-003."""
    if offer is None:
        return None
    terms = offer.get("terms") if isinstance(offer, Mapping) else getattr(offer, "terms", {})
    term = (terms or {}).get(key)
    if term is None or _status(term) not in _COMPUTABLE:
        return None
    return _decimal(_value(term))


def _down_payment_source_needed(offer: Any) -> bool:
    """Needed unless the offer is known to take nothing from the buyer's pocket at signing:
    cash_down known == 0 AND no prepaid finance charge paid in cash (F13 subtracts both when source = savings)."""
    cash_down = _term_amount(offer, "cash_down")
    if cash_down is None or cash_down != 0:
        return True
    terms = (offer.get("terms") if isinstance(offer, Mapping) else getattr(offer, "terms", {})) or {}
    if "pfc_paid_in_cash" not in terms:
        return False
    pfc_cash = _term_amount(offer, "pfc_paid_in_cash")
    return pfc_cash is None or pfc_cash > 0     # present but disputed/unknown => still needed (D0-003 reopen)


def _offer_ready(offer: Any) -> bool:
    if offer is None:
        return False
    return bool(offer.get("ready_for_calculation") if isinstance(offer, Mapping)
                else getattr(offer, "ready_for_calculation", False))


def required_facts(analysis_id: str, facts: Mapping[str, Any], offer: Any = None) -> list[str]:
    """Concrete requirement tokens for one analysis given the current facts/offer."""
    a = getattr(analysis_id, "value", analysis_id)
    cash = ["income.take_home_monthly", "expenses.essential.total", *debt_requirements(facts)]
    down_needed = _down_payment_source_needed(offer)   # unknown offer => still needed
    reserve = cash + ["savings.liquid"] + (["loan.down_payment_source"] if down_needed else [])
    if a == "loan_cost":
        req: list[str] = []
    elif a == "cashflow_impact":
        req = cash
    elif a in ("reserve_impact", "alternatives"):
        req = reserve
    elif a == "stress_test":
        req = list(reserve)
        variability = _value(facts.get("income.variability"))
        # IMP-009: low_month is asked (blocking) for variable income, but it serves sc_low_month only —
        # if the user declines it, stress_test stays available and sc_low_month is skipped.
        if (is_known(facts, "income.variability") and variability in VARIABLE_INCOME
                and not is_declined(facts, "income.low_month")):
            req.append("income.low_month")
    elif a == "dti":
        req = ["income.gross_monthly", *debt_requirements(facts)]
    elif a == "equity_timeline":
        req = ["vehicle.value_estimates"]
    else:
        raise ValueError(f"unknown analysis {a}")
    return req + [OFFER_MINIMUM_SET]


def evaluate_readiness(analysis_id: str, facts: Mapping[str, Any], offer: Any = None) -> AnalysisReadiness:
    req = required_facts(analysis_id, facts, offer)
    missing, declined = [], []
    awaiting_offer = False
    for key in req:
        if key == OFFER_MINIMUM_SET:
            if not _offer_ready(offer):
                awaiting_offer = True
            continue
        if is_known(facts, key):
            continue
        (declined if is_declined(facts, key) else missing).append(key)
    available = not missing and not declined and not awaiting_offer
    reason = None
    if not available:
        parts = [REASONS.get(k, k.replace("_", " ")) for k in missing + declined]
        if awaiting_offer:
            parts.append(REASONS[OFFER_MINIMUM_SET])
        reason = "Needs " + ", ".join(parts) + "."
        if declined:
            reason += " (You chose not to share some of this.)"
    return AnalysisReadiness(analysis_id=getattr(analysis_id, "value", analysis_id), available=available,
                             awaiting_offer=awaiting_offer, required=req, missing=missing,
                             declined=declined, reason=reason)


def evaluate_all(selected: list[str], facts: Mapping[str, Any], offer: Any = None) -> list[AnalysisReadiness]:
    return [evaluate_readiness(a, facts, offer) for a in selected]


def cash_down_amount(offer: Any) -> Decimal | None:
    """Public accessor: computable cash_down of an offer, or None (used by intake rule H02)."""
    return _term_amount(offer, "cash_down")


def down_payment_source_needed(offer: Any) -> bool:
    """Public form of the D0-003 rule (used by intake's generated-graph parity check)."""
    return _down_payment_source_needed(offer)
