"""Small builders shared by engine/scenario/counterfactual tests (no tests and no production logic here)."""
from __future__ import annotations

from schemas.contracts import ItemizationItem, LoanOffer, VerifiedFinancialTerm, TERM_VALUE_TYPES


def fact(key, value, status="provided", verification="none"):
    return {"key": key, "value": value, "status": status, "verification": verification}


def facts(*items):
    return {f["key"]: f for f in items}


def household(**over):
    """The contracts' running-example household (reference_case.json), overridable by fact key suffix."""
    base = {
        "income.take_home_monthly": "4200.00",
        "income.variability": "stable",
        "expenses.essential.total": "2900.00",
        "expenses.current_vehicle_costs_monthly": "260.00",
        "vehicle.replaces_current": "true",
        "vehicle.new_ownership_costs_monthly": "310.00",
        "expenses.flexible.total": "400.00",
        "debts.count": "0",
        "savings.liquid": "6000.00",
        "loan.down_payment_source": "savings",
    }
    base.update(over)
    return {k: fact(k, v) for k, v in base.items() if v is not None}


def offer(offer_id="o_test", status="provided", verification="user_confirmed", itemization=(),
          unsupported=(), **terms):
    """LoanOffer with VerifiedFinancialTerm per given term (values as wire strings)."""
    t = {}
    for k, v in terms.items():
        if v is None:
            continue
        t[k] = VerifiedFinancialTerm(term_key=k, value=str(v), value_type=TERM_VALUE_TYPES.get(k, "currency"),
                                     status=status, verification=verification, source_kind="user_input")
    return LoanOffer(offer_id=offer_id, session_id="s_test", origin="manual", terms=t,
                     itemization=[i if isinstance(i, ItemizationItem) else ItemizationItem(**i) for i in itemization],
                     unsupported_features=list(unsupported), ready_for_calculation=not unsupported)


def reference_offer(**over):
    terms = dict(cash_price="22000.00", taxes_title_fees="1500.00", cash_down="4000.00", principal="20000.00",
                 amount_financed="19500.00", prepaid_finance_charges="500.00", contract_rate="0.0475",
                 apr="0.05796", term_months="60", monthly_payment="375.14")
    terms.update(over)
    return offer(**terms)


def m(result, name):
    return result.metrics[name].value
