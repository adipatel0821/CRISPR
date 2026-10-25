"""Shared helpers to type offer terms and finalize a LoanOffer (used by manual entry, the document
pipeline and verification so all three run the SAME checks — stage_02 FR8)."""
from __future__ import annotations

import uuid
from collections.abc import Mapping
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

from documents.errors import OfferValidationError, UnsupportedProduct
from schemas.contracts import TERM_KEYS, TERM_VALUE_TYPES, LoanOffer, TermChecks, VerifiedFinancialTerm

CENT = Decimal("0.01")
MISMATCH_TOLERANCE = Decimal("1.00")       # C05: offer payment vs computed payment by > $1
TERM_MIN, TERM_MAX = 6, 96

# Which report-level engine check applies to which term (TermChecks are per term).
ARITHMETIC_TERMS = {"monthly_payment", "total_of_payments", "finance_charge", "amount_financed", "total_sale_price"}
ITEMIZATION_TERMS = {"cash_price", "taxes_title_fees", "cash_down", "trade_in_value", "trade_in_payoff",
                     "amount_financed", "prepaid_finance_charges", "principal"}
APR_TERMS = {"apr"}
FEATURE_TEXT = {
    "variable_rate": "This loan has a variable rate. DecisionTwin only models fixed-rate loans, so the payment "
                     "and cost figures would be wrong.",
    "balloon_payment": "This loan ends with a balloon payment. DecisionTwin only models loans that are paid off "
                       "in equal monthly payments, so the figures would be wrong.",
}


def new_offer_id() -> str:
    return "o_" + uuid.uuid4().hex


def _dec(raw: Any, key: str) -> Decimal:
    if isinstance(raw, bool):
        raise OfferValidationError(f"Enter a number for {key.replace('_', ' ')}.", {"term_key": key})
    s = str(raw).strip().replace(",", "").replace("$", "").replace(" ", "")
    try:
        d = Decimal(s)
    except (InvalidOperation, ValueError):
        raise OfferValidationError(f"We couldn't read \"{raw}\" as a number for {key.replace('_', ' ')}.",
                                   {"term_key": key, "value": str(raw)}) from None
    if not d.is_finite():
        raise OfferValidationError(f"Enter a finite number for {key.replace('_', ' ')}.", {"term_key": key})
    return d


def parse_term_value(key: str, raw: Any) -> str:
    """Typed, normalized string value for a term (contracts §5 validation rules)."""
    if key not in TERM_VALUE_TYPES:
        raise OfferValidationError(f"Unknown loan term \"{key}\". Use one of: {', '.join(TERM_KEYS)}.",
                                   {"term_key": key, "allowed": TERM_KEYS})
    vt = TERM_VALUE_TYPES[key]
    label = key.replace("_", " ")
    if vt == "currency":
        d = _dec(raw, key)
        if d < 0:
            raise OfferValidationError(f"The {label} can't be negative.", {"term_key": key, "value": str(raw)})
        return str(d.quantize(CENT, rounding=ROUND_HALF_UP))
    if vt == "rate":
        s = str(raw).strip()
        pct = s.endswith("%")
        d = _dec(s.rstrip("%"), key)
        if pct:                                   # explicitly marked as a percent by the user
            d = d / Decimal(100)
        if d < 0 or d >= 1:
            raise OfferValidationError(
                f"Enter the {label} as a fraction, e.g. 0.0475 (or as a percent with a % sign, e.g. 4.75%).",
                {"term_key": key, "value": s})
        return format(d.normalize(), "f") if d != 0 else "0"
    if vt == "integer":
        d = _dec(raw, key)
        if d != d.to_integral_value():
            raise OfferValidationError(f"Enter a whole number of months for {label}.", {"term_key": key})
        n = int(d)
        if key == "term_months" and not (TERM_MIN <= n <= TERM_MAX):
            raise OfferValidationError(f"Enter a loan term between {TERM_MIN} and {TERM_MAX} months.",
                                       {"term_key": key, "value": str(raw)})
        return str(n)
    if vt == "boolean":
        if isinstance(raw, bool):
            return "true" if raw else "false"
        s = str(raw).strip().lower()
        if s in ("true", "yes", "y", "1"):
            return "true"
        if s in ("false", "no", "n", "0", "none", ""):
            return "false"
        if key == "balloon_payment":             # an amount means a balloon exists when > 0
            try:
                return "true" if _dec(s, key) > 0 else "false"
            except OfferValidationError:
                pass
        raise OfferValidationError(f"Answer yes or no for {label}.", {"term_key": key, "value": str(raw)})
    return str(raw)


def term_value(offer: LoanOffer, key: str) -> Decimal | None:
    t = offer.terms.get(key)
    if t is None or t.value is None or t.status in ("missing", "declined", "conflicting"):
        return None
    if TERM_VALUE_TYPES.get(key) == "boolean":
        return None
    try:
        return Decimal(t.value)
    except (InvalidOperation, ValueError):
        return None


def unsupported_features(offer: LoanOffer) -> list[str]:
    out = []
    for key in ("variable_rate", "balloon_payment"):
        t = offer.terms.get(key)
        if t is not None and t.value == "true" and t.status not in ("missing", "declined"):
            out.append(key)
    return out


def _get(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, Mapping):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _check(v: Any) -> str:
    v = getattr(v, "value", v)
    return v if v in ("pass", "warn", "fail", "not_applicable") else "not_applicable"


def run_offer_checks(offer: LoanOffer) -> Any | None:
    """engine.offer_checks(offer) imported lazily (Agent 1). None when the engine is not available."""
    try:
        from engine import offer_checks
    except ImportError:
        return None
    return offer_checks(offer)


def finalize_offer(offer: LoanOffer, *, raise_unsupported: bool = True) -> LoanOffer:
    """Run the engine's offer checks and fill per-term checks, derived values, warnings and
    ready_for_calculation. Raises UnsupportedProduct (with the draft offer) when blocked."""
    features = unsupported_features(offer)
    report = run_offer_checks(offer)
    if report is not None:
        for f in _get(report, "unsupported_features", None) or []:
            if f not in features:
                features.append(f)
    offer.unsupported_features = features

    # derived values
    tv, tp = term_value(offer, "trade_in_value"), term_value(offer, "trade_in_payoff")
    principal_basis = None
    principal = None
    if report is not None:
        principal = _get(report, "principal")
        principal_basis = _get(report, "principal_basis")
    if tv is not None and tp is not None:
        equity = tv - tp
        offer.derived.trade_in_equity = str(equity.quantize(CENT))
        offer.derived.negative_equity_rolled_in = str(max(Decimal(0), -equity).quantize(CENT))
    elif "trade_in_value" not in offer.terms and "trade_in_payoff" not in offer.terms:
        offer.derived.trade_in_equity = None
        offer.derived.negative_equity_rolled_in = "0.00"
    if principal_basis in ("stated", "derived", "assumed_pfc_zero"):
        offer.derived.principal_basis = principal_basis

    # per-term checks
    warnings = list(offer.warnings)
    if report is not None:
        arithmetic, itemization = _check(_get(report, "arithmetic")), _check(_get(report, "itemization"))
        apr_check, range_check = _check(_get(report, "apr_recompute")), _check(_get(report, "range"))
        mismatch = _get(report, "payment_mismatch")
        for key, term in offer.terms.items():
            c = term.checks
            if key in ARITHMETIC_TERMS:
                c.arithmetic = arithmetic
            if key in ITEMIZATION_TERMS:
                c.itemization = itemization
            if key in APR_TERMS:
                c.apr_recompute = apr_check
            c.range = range_check
        for w in _get(report, "warnings", None) or []:
            if w not in warnings:
                warnings.append(w)
        if mismatch is not None and "monthly_payment" in offer.terms:
            try:
                mismatch_d = abs(Decimal(str(mismatch)))
            except (InvalidOperation, ValueError):
                mismatch_d = Decimal(0)
            if mismatch_d > MISMATCH_TOLERANCE:
                offer.terms["monthly_payment"].checks.arithmetic = "fail"
                if "PAYMENT_MISMATCH" not in warnings:
                    warnings.append("PAYMENT_MISMATCH")
    else:
        if "OFFER_CHECKS_UNAVAILABLE" not in warnings:
            warnings.append("OFFER_CHECKS_UNAVAILABLE")
    offer.warnings = warnings

    # readiness: minimum computable set (contracts §3.6)
    def usable(key: str) -> bool:
        t = offer.terms.get(key)
        return t is not None and t.value is not None and t.status in ("provided", "estimated")

    if report is not None:
        principal_ok = principal is not None
    else:  # engine absent: same minimum set rule, without the F00 resolution
        principal_ok = usable("principal") or usable("amount_financed")
    no_conflict = not any(t.status == "conflicting" for t in offer.terms.values())
    offer.ready_for_calculation = bool(
        principal_ok and (usable("contract_rate") or usable("apr")) and usable("term_months")
        and no_conflict and not features
        and not (offer.document_offers_count > 1 and offer.offer_choice is None))

    if features and raise_unsupported:
        msg = " ".join(FEATURE_TEXT.get(f, f"Unsupported feature: {f}.") for f in features)
        raise UnsupportedProduct(msg + " You can still see the terms you entered.", features, offer)
    return offer


def blank_checks() -> TermChecks:
    return TermChecks()


def make_term(key: str, value: str | None, *, status: str, verification: str, source_kind: str,
              evidence: Any = None, user_action: str | None = None) -> VerifiedFinancialTerm:
    return VerifiedFinancialTerm(term_key=key, value=value, value_type=TERM_VALUE_TYPES[key], status=status,
                                 verification=verification, source_kind=source_kind, evidence=evidence,
                                 user_action=user_action)
