"""Transaction effects: loan provenance, F13 savings after purchase, F14 incremental vehicle costs, debts.

``debts_after`` excludes debt items with ``paid_off_by_transaction = true`` (e.g. a trade-in payoff).
"""
from __future__ import annotations

from decimal import Decimal

from .derived import Derived, combine, missing
from .inputs import EngineInputs, Input
from .money import ZERO

OFFER_MIN = "offer.minimum_set"


def _loan_term_input(inputs: EngineInputs, term_key: str) -> Input | None:
    loan = inputs.loan
    if loan is None:
        return None
    for i in loan.inputs_used:
        if i.key == f"offer.{term_key}":
            return i
    return None


def loan_payment_basis(inputs: EngineInputs) -> Derived:
    """Provenance of payment / schedule / TOP / interest (principal, rate, term)."""
    loan = inputs.loan
    if loan is None or not loan.computable:
        return missing(OFFER_MIN)
    statuses = [i.status for i in loan.inputs_used]
    if "a_rate_from_apr" in loan.assumptions or loan.principal_basis == "assumed_pfc_zero":
        statuses.append("assumed")
    return Derived(value=ZERO, statuses=tuple(statuses),
                   verifications=tuple(i.verification for i in loan.inputs_used),
                   assumptions=tuple(a for a in loan.assumptions
                                     if a == "a_rate_from_apr" or loan.principal_basis == "assumed_pfc_zero"))


def loan_af_basis(inputs: EngineInputs) -> Derived:
    """Provenance of amount-financed metrics (finance charge, APR)."""
    base = loan_payment_basis(inputs)
    loan = inputs.loan
    if not base.known:
        return base
    statuses = list(base.statuses)
    if loan.amount_financed_basis == "assumed_pfc_zero":
        statuses.append("assumed")
    return Derived(value=ZERO, statuses=tuple(statuses), verifications=base.verifications,
                   assumptions=loan.assumptions)


def new_payment(inputs: EngineInputs) -> Derived:
    base = loan_payment_basis(inputs)
    if not base.known:
        return base
    return combine(inputs.loan.level_payment, [base])


def debts_total(inputs: EngineInputs, *, after: bool, month: int | None = None) -> Derived:
    """Σ monthly debt payments; ``after`` drops paid-off-by-transaction items; ``month`` drops ended debts."""
    if inputs.debt_missing:
        return missing(*inputs.debt_missing)
    total = ZERO
    parts: list[Input] = [inputs.debts_count]
    for d in inputs.debts:
        if after and d.paid_off_by_transaction:
            continue
        if month is not None and not d.active_in_month(month):
            continue
        parts.append(d.monthly_payment)
        if d.monthly_payment.known:
            total += d.monthly_payment.dec
    return combine(total, parts)


def savings_after_purchase(inputs: EngineInputs) -> Derived:
    """F13 = savings − (cash down if source = savings) − (PFC paid in cash if source = savings)."""
    loan = inputs.loan
    if loan is None:
        return missing(OFFER_MIN)
    sav = inputs.savings
    src = inputs.down_source
    cd_in = _loan_term_input(inputs, "cash_down")
    if not sav.known:
        return combine(None, [sav])
    if src.known:
        if src.text == "savings":
            if loan.cash_down is None:
                return combine(None, [sav, src], extra_missing=["offer.cash_down"])
            value = sav.dec - loan.cash_down - loan.pfc_paid_in_cash
            return combine(value, [sav, src] + ([cd_in] if cd_in else []))
        return combine(sav.dec, [sav, src])
    if loan.cash_down is not None and loan.cash_down == 0 and loan.pfc_paid_in_cash == 0:
        return combine(sav.dec, [sav] + ([cd_in] if cd_in else []))
    return combine(None, [sav, src])


def incremental_vehicle_costs(inputs: EngineInputs, labels: dict[str, str] | None = None) -> Derived:
    """F14 = new ownership costs − (replaces current ? current-car costs : 0); may be negative.

    Unknown new-car costs -> 0 with the label "new-car running costs not included" and assumption
    a_no_running_costs (never silently claimed).
    """
    labels = labels or {}
    new = inputs.new_ownership_costs
    if not new.known:
        return Derived(value=ZERO, label=labels.get("incremental_costs_not_included",
                                                     "new-car running costs not included"),
                       assumptions=("a_no_running_costs",))
    rep = inputs.replaces_current
    if rep.known and rep.boolean:
        cur = inputs.current_vehicle_costs
        if cur.known:
            return combine(new.dec - cur.dec, [new, rep, cur])
        return combine(new.dec, [new, rep],
                       notes=["Current-car costs were not provided, so nothing was netted off."])
    if rep.known:
        return combine(new.dec, [new, rep])
    return combine(new.dec, [new], assumptions=["a_not_replacing"])


def trade_in_rolled_in(inputs: EngineInputs) -> Decimal | None:
    loan = inputs.loan
    if loan is None or loan.trade_in_equity is None:
        return None
    return max(-loan.trade_in_equity, ZERO)
