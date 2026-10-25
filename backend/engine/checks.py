"""offer_checks(): deterministic consistency checks on a LoanOffer (used by Stage 2 extraction/manual entry).

Checks never block on their own except range failures; APR recompute is warn-only (Reg Z ⅛-pt tolerance).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from schemas.contracts import LoanOffer

from . import loan as L
from .config import EngineConfig, load_config
from .inputs import coerce_offer, term
from .money import ZERO, engine_context, to_decimal
from .principal import resolve_offer


@dataclass
class OfferCheckReport:
    principal: Decimal | None = None
    principal_basis: str = "missing"
    computed_payment: Decimal | None = None
    payment_mismatch: Decimal | None = None        # computed − disclosed
    arithmetic: str = "not_applicable"
    apr_recompute: str = "not_applicable"
    itemization: str = "not_applicable"
    range: str = "not_applicable"
    apr_recomputed: Decimal | None = None
    unsupported_features: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    computed_total_of_payments: Decimal | None = None
    computed_finance_charge: Decimal | None = None


def _worst(results: list[str]) -> str:
    order = ["fail", "warn", "pass"]
    present = [r for r in results if r in order]
    if not present:
        return "not_applicable"
    return min(present, key=order.index)


def offer_checks(offer: LoanOffer | dict[str, Any], config: EngineConfig | None = None) -> OfferCheckReport:
    cfg = config or load_config()
    lo = coerce_offer(offer)
    rep = OfferCheckReport()
    with engine_context():
        r = resolve_offer(lo, supported_terms=(cfg.term_min, cfg.term_max))
        rep.principal, rep.principal_basis = r.principal, r.principal_basis
        rep.assumptions = list(r.assumptions)
        rep.warnings.extend(r.warnings)
        tol_pay = cfg.tolerance("payment_mismatch")
        tol_id = cfg.tolerance("identity")

        # ---- range checks -------------------------------------------------------------------
        ranges: list[str] = []
        for key in ("contract_rate", "apr"):
            t = term(lo, key)
            if t.known:
                v = to_decimal(t.raw)
                ok = v is not None and ZERO <= v < 1
                ranges.append("pass" if ok else "fail")
                if not ok:
                    rep.warnings.append(f"{key} must be a fraction between 0 and 1 (e.g. 0.0475 for 4.75%).")
        if r.apr_disclosed is not None and r.contract_rate_disclosed is not None:
            if r.apr_disclosed < r.contract_rate_disclosed - cfg.tolerance("apr_below_contract_rate"):
                ranges.append("warn")
                rep.warnings.append("The APR is lower than the contract rate, which is unusual; please re-check both.")
        tm = term(lo, "term_months")
        if tm.known:
            nd = to_decimal(tm.raw)
            if nd is None or nd != nd.to_integral_value() or nd <= 0:
                ranges.append("fail")
                rep.warnings.append("The term must be a whole number of months.")
            elif not (cfg.term_min <= int(nd) <= cfg.term_max):
                ranges.append("warn")
                rep.warnings.append(f"Terms outside {cfg.term_min}–{cfg.term_max} months are not supported.")
            else:
                ranges.append("pass")
        for key in ("cash_price", "taxes_title_fees", "cash_down", "trade_in_value", "trade_in_payoff",
                    "principal", "amount_financed", "prepaid_finance_charges", "pfc_paid_in_cash",
                    "monthly_payment", "finance_charge", "total_of_payments"):
            t = term(lo, key)
            if t.known:
                v = to_decimal(t.raw)
                if v is None or v < 0:
                    ranges.append("fail")
                    rep.warnings.append(f"{key} must be a non-negative amount.")
        rep.range = _worst(ranges)
        rep.unsupported_features = list(r.unsupported)

        # ---- payment / arithmetic identities --------------------------------------------------
        arith: list[str] = []
        if r.computable:
            rep.computed_payment = r.level_payment
            top = L.total_of_payments(list(r.payments))
            fc = L.finance_charge(top, r.amount_financed)
            rep.computed_total_of_payments, rep.computed_finance_charge = top, fc
            if r.disclosed_payment is not None:
                rep.payment_mismatch = rep.computed_payment - r.disclosed_payment
                if abs(rep.payment_mismatch) > tol_pay:
                    arith.append("warn")
                    rep.warnings.append(
                        f"PAYMENT_MISMATCH: the disclosed payment ${r.disclosed_payment:.2f} differs from the "
                        f"calculated ${rep.computed_payment:.2f} by ${abs(rep.payment_mismatch):.2f}. "
                        "Fees may be financed, the first period may be irregular, or a value may be mistyped.")
                else:
                    arith.append("pass")
            if r.disclosed_top is not None:
                ok = abs(top - r.disclosed_top) <= tol_id
                arith.append("pass" if ok else "warn")
                if not ok:
                    rep.warnings.append(f"The disclosed total of payments ${r.disclosed_top:.2f} differs from the "
                                        f"calculated ${top:.2f}.")
            if r.disclosed_finance_charge is not None:
                ok = abs(fc - r.disclosed_finance_charge) <= tol_id
                arith.append("pass" if ok else "warn")
                if not ok:
                    rep.warnings.append(f"The disclosed finance charge ${r.disclosed_finance_charge:.2f} differs "
                                        f"from the calculated ${fc:.2f}.")
            # ---- APR recompute (warn only) -----------------------------------------------------
            apr = L.solve_apr(r.amount_financed, list(r.payments), r.n)
            rep.apr_recomputed = apr
            if apr is not None and r.apr_disclosed is not None:
                if abs(apr - r.apr_disclosed) <= cfg.tolerance("apr"):
                    rep.apr_recompute = "pass"
                else:
                    rep.apr_recompute = "warn"
                    rep.warnings.append(f"The recomputed APR {apr * 100:.3f}% is more than 1/8 point from the "
                                        f"disclosed {r.apr_disclosed * 100:.3f}%.")
            elif apr is None and r.apr_disclosed is not None:
                rep.apr_recompute = "warn"
                rep.warnings.append("The APR could not be recomputed from these terms.")
        rep.arithmetic = _worst(arith)

        # ---- itemization (contracts §3.6, clarified: itemized total = principal − financed PFC) -------
        stated_amount = term(lo, "principal").known or term(lo, "amount_financed").known
        if (r.principal is not None and stated_amount      # not circular with an itemization-derived principal
                and r.cash_price is not None and r.cash_down is not None and r.taxes_title_fees is not None
                and r.trade_in_equity is not None
                and not (r.pfc is not None and r.pfc_paid_in_cash_unknown)):   # financed PFC unknown -> no check
            itemized = r.cash_price + r.taxes_title_fees + r.add_ons_financed_total - r.cash_down - r.trade_in_equity
            if r.pfc is not None:
                target = r.principal - (r.pfc - r.pfc_paid_in_cash)
            else:
                target = r.amount_financed
            ok = abs(itemized - target) <= tol_id
            rep.itemization = "pass" if ok else "warn"
            if not ok:
                rep.warnings.append(f"The itemization adds up to ${itemized:.2f} but the amount financed "
                                    f"is ${target:.2f}.")
    return rep
