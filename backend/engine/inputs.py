"""EngineInputs: immutable, normalized view of facts + offer, carrying status and verification per input.

Only facts with status in {provided, estimated, calculated} enter as numbers (contracts §6.1). Everything
else is represented as an ``Input`` whose ``known`` is False — never as zero.
"""
from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from decimal import Decimal
from types import MappingProxyType
from typing import Any

from schemas.contracts import (
    COMPUTABLE_STATUSES,
    STATUS_STRENGTH,
    TERM_VALUE_TYPES,
    VERIFICATION_STRENGTH,
    LoanOffer,
    VerifiedFinancialTerm,
)

from .money import ZERO, to_bool, to_decimal

COMPUTABLE = frozenset(s.value for s in COMPUTABLE_STATUSES)
VARIABLE_INCOME = frozenset({"somewhat_variable", "highly_variable", "variable"})


def _enum(v: Any) -> Any:
    return getattr(v, "value", v)


def _get(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, Mapping):
        return obj.get(name, default)
    return getattr(obj, name, default)


# ---------------------------------------------------------------------------
# Status / verification propagation (contracts §1.3)
# ---------------------------------------------------------------------------
def weakest_status(statuses: Iterable[str | None]) -> str:
    worst = 0
    for s in statuses:
        s = _enum(s)
        if s in STATUS_STRENGTH:
            worst = max(worst, STATUS_STRENGTH.index(s))
    return STATUS_STRENGTH[worst]


def weakest_verification(verifications: Iterable[str | None]) -> str:
    best_index = 0
    seen = False
    for v in verifications:
        v = _enum(v)
        if v in VERIFICATION_STRENGTH:
            seen = True
            best_index = max(best_index, VERIFICATION_STRENGTH.index(v))
    return VERIFICATION_STRENGTH[best_index] if seen else "none"


# ---------------------------------------------------------------------------
# Facts
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Input:
    key: str
    raw: Any = None
    status: str = "missing"
    verification: str = "none"

    @property
    def known(self) -> bool:
        return self.status in COMPUTABLE and self.raw is not None

    @property
    def dec(self) -> Decimal | None:
        return to_decimal(self.raw) if self.known else None

    @property
    def boolean(self) -> bool | None:
        return to_bool(self.raw) if self.known else None

    @property
    def text(self) -> str | None:
        return str(self.raw) if self.known else None


def normalize_facts(facts: Any) -> dict[str, dict[str, Any]]:
    """Accept Mapping[key, FinancialFact | dict] or an iterable of facts; return key -> plain dict.

    A dict without ``status`` but with a value is treated as ``provided`` (fixture convenience).
    """
    if facts is None:
        return {}
    items: Iterable[tuple[str, Any]]
    if isinstance(facts, Mapping):
        items = facts.items()
    else:
        items = ((_get(f, "key"), f) for f in facts)
    out: dict[str, dict[str, Any]] = {}
    for key, f in items:
        key = key or _get(f, "key")
        value = _get(f, "value")
        status = _enum(_get(f, "status")) or ("provided" if value is not None else "missing")
        out[key] = {
            "key": key,
            "value": value,
            "status": status,
            "verification": _enum(_get(f, "verification")) or "none",
            "fact_id": _get(f, "fact_id"),
        }
    return out


@dataclass(frozen=True)
class DebtItem:
    debt_id: str
    monthly_payment: Input
    remaining_months: Input
    paid_off_by_transaction: bool
    balance: Input
    type: str | None = None

    def active_in_month(self, t: int) -> bool:
        rm = self.remaining_months.dec
        return True if rm is None else t <= int(rm)


# ---------------------------------------------------------------------------
# Offer coercion and term reading
# ---------------------------------------------------------------------------
def coerce_offer(offer: Any) -> LoanOffer | None:
    """LoanOffer passes through; a dict (e.g. fixture) with plain or structured terms becomes a LoanOffer."""
    if offer is None or isinstance(offer, LoanOffer):
        return offer
    d = dict(offer)
    terms: dict[str, Any] = {}
    for k, v in (d.get("terms") or {}).items():
        if isinstance(v, VerifiedFinancialTerm):
            terms[k] = v
        elif isinstance(v, Mapping) and "status" in v:
            terms[k] = VerifiedFinancialTerm(**{"term_key": k, "value_type": TERM_VALUE_TYPES.get(k, "currency"),
                                                "source_kind": "user_input", **v})
        elif v is not None:
            value = ("true" if v else "false") if isinstance(v, bool) else str(v)
            terms[k] = VerifiedFinancialTerm(term_key=k, value=value,
                                             value_type=TERM_VALUE_TYPES.get(k, "currency"),
                                             status="provided", verification="none", source_kind="user_input")
    d["terms"] = terms
    d.setdefault("offer_id", "o_local")
    d.setdefault("session_id", "s_local")
    d.setdefault("origin", "manual")
    lo = LoanOffer(**{k: v for k, v in d.items() if k in LoanOffer.model_fields})
    if "ready_for_calculation" not in d:
        lo = lo.model_copy(update={"ready_for_calculation": minimum_set_present(lo)})
    return lo


def term(offer: LoanOffer | None, key: str) -> Input:
    """Read LoanOffer.terms[key] as an Input (only computable statuses count as known)."""
    if offer is None:
        return Input(key=f"offer.{key}")
    t = offer.terms.get(key)
    if t is None:
        return Input(key=f"offer.{key}")
    return Input(key=f"offer.{key}", raw=t.value, status=_enum(t.status), verification=_enum(t.verification))


def minimum_set_present(offer: LoanOffer) -> bool:
    have_amount = term(offer, "principal").known or term(offer, "amount_financed").known or (
        term(offer, "cash_price").known and term(offer, "cash_down").known)
    have_rate = term(offer, "contract_rate").known or term(offer, "apr").known
    have_term = term(offer, "term_months").known
    return have_amount and have_rate and have_term and not offer.unsupported_features


# ---------------------------------------------------------------------------
# EngineInputs
# ---------------------------------------------------------------------------
FACT_FIELDS = {
    "take_home": "income.take_home_monthly",
    "gross": "income.gross_monthly",
    "variability": "income.variability",
    "low_month": "income.low_month",
    "essential": "expenses.essential.total",
    "current_vehicle_costs": "expenses.current_vehicle_costs_monthly",
    "flexible": "expenses.flexible.total",
    "debts_count": "debts.count",
    "savings": "savings.liquid",
    "down_source": "loan.down_payment_source",
    "replaces_current": "vehicle.replaces_current",
    "new_ownership_costs": "vehicle.new_ownership_costs_monthly",
    "value_estimates": "vehicle.value_estimates",
}


@dataclass(frozen=True)
class EngineInputs:
    take_home: Input
    gross: Input
    variability: Input
    low_month: Input
    essential: Input
    current_vehicle_costs: Input
    flexible: Input
    debts_count: Input
    savings: Input
    down_source: Input
    replaces_current: Input
    new_ownership_costs: Input
    value_estimates: Input
    debts: tuple[DebtItem, ...] = ()
    debt_missing: tuple[str, ...] = ()          # concrete debt keys that are required but unknown
    loan: Any = None                            # principal.ResolvedLoan | None
    offer_id: str | None = None
    facts: Mapping[str, dict[str, Any]] = field(default_factory=lambda: MappingProxyType({}))

    @property
    def income_variable(self) -> bool:
        return self.variability.known and self.variability.text in VARIABLE_INCOME

    def value_estimate_points(self) -> list[dict[str, Any]] | None:
        if not self.value_estimates.known:
            return None
        raw = self.value_estimates.raw
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except ValueError:
                return None
        if not isinstance(raw, list) or not raw:
            return None
        return [dict(p) for p in raw if isinstance(p, Mapping)]


def _fact_input(facts: Mapping[str, dict[str, Any]], key: str) -> Input:
    f = facts.get(key)
    if f is None:
        return Input(key=key)
    return Input(key=key, raw=f.get("value"), status=f.get("status") or "missing",
                 verification=f.get("verification") or "none")


def build_inputs(facts: Any, offer: Any) -> EngineInputs:
    """Normalize facts (Mapping[key, FinancialFact | dict]) and an offer into frozen EngineInputs."""
    from engine.requirements import debt_item_ids, debt_requirements, is_known

    from .principal import resolve_offer

    nf = normalize_facts(facts)
    kwargs = {name: _fact_input(nf, key) for name, key in FACT_FIELDS.items()}

    debts: list[DebtItem] = []
    debt_missing: list[str] = []
    if is_known(nf, "debts.count"):
        count = int(to_decimal(nf["debts.count"]["value"]) or ZERO)
        if count > 0:
            for req in debt_requirements(nf):
                if req != "debts.count" and not is_known(nf, req):
                    debt_missing.append(req)
            for did in debt_item_ids(nf):
                debts.append(DebtItem(
                    debt_id=did,
                    monthly_payment=_fact_input(nf, f"debts[{did}].monthly_payment"),
                    remaining_months=_fact_input(nf, f"debts[{did}].remaining_months"),
                    paid_off_by_transaction=bool(_fact_input(nf, f"debts[{did}].paid_off_by_transaction").boolean),
                    balance=_fact_input(nf, f"debts[{did}].balance"),
                    type=_fact_input(nf, f"debts[{did}].type").text,
                ))
    else:
        debt_missing.append("debts.count")

    lo = coerce_offer(offer)
    loan = resolve_offer(lo) if lo is not None else None
    return EngineInputs(**kwargs, debts=tuple(debts), debt_missing=tuple(debt_missing), loan=loan,
                        offer_id=lo.offer_id if lo is not None else None, facts=MappingProxyType(nf))
