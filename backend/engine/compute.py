"""compute(): facts + offer -> CalculationResult (contracts §3.7). Pure; partial results, never exceptions,
for missing inputs. offer=None -> baseline (no-offer) result."""
from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from schemas.contracts import CALC_VERSION, CalculationResult, Metric, ScheduleRow

from engine.requirements import REQUIRED_INPUTS

from . import loan as L
from .cashflow import monthly_left_after, monthly_left_before
from .config import EngineConfig, load_config
from .derived import Derived, combine, missing
from .equity import equity_timeline
from .flags import build_flags
from .inputs import EngineInputs, build_inputs, coerce_offer, weakest_status, weakest_verification
from .money import ZERO, engine_context, fmt, q
from .ratios import (
    dti_total,
    ltv,
    negative_equity_at_start,
    payment_to_take_home,
    reserve_months_after,
    reserve_months_before,
    savings_months_of_income,
)
from .result import metric, missing_metric, stable_id
from .transaction import (
    OFFER_MIN,
    incremental_vehicle_costs,
    loan_af_basis,
    loan_payment_basis,
    savings_after_purchase,
    trade_in_rolled_in,
)

LOAN_METRICS = ["principal", "monthly_payment", "total_of_payments", "finance_charge", "interest",
                "total_paid_through_deal", "apr_recomputed", "ltv", "negative_equity_at_start",
                "payment_to_take_home", "dti_total"]
FORMULA = {"principal": "F00", "monthly_payment": "F01", "total_of_payments": "F02", "finance_charge": "F03",
           "interest": "F03i", "total_paid_through_deal": "F04", "apr_recomputed": "F05", "ltv": "F06",
           "negative_equity_at_start": "F06d", "payment_to_take_home": "F07", "dti_total": "F07b"}


def _fingerprint(inputs: EngineInputs, offer: Any, profile_version: int) -> dict[str, Any]:
    lo = coerce_offer(offer)
    return {"facts": {k: [v.get("value"), v.get("status"), v.get("verification")] for k, v in inputs.facts.items()},
            "offer": lo.model_dump(mode="json") if lo is not None else None,
            "profile_version": profile_version, "calc_version": CALC_VERSION}


def compute(facts: Any, offer: Any, config: EngineConfig | None = None, *, profile_version: int = 0,
            as_of: date | None = None) -> CalculationResult:
    cfg = config or load_config()
    with engine_context():
        inputs = build_inputs(facts, offer)
        return compute_from_inputs(inputs, cfg, profile_version=profile_version, as_of=as_of,
                                   calc_id=stable_id("c", _fingerprint(inputs, offer, profile_version)))


def compute_from_inputs(inputs: EngineInputs, cfg: EngineConfig, *, profile_version: int = 0,
                        as_of: date | None = None, calc_id: str | None = None) -> CalculationResult:
    computed_at = datetime.now(timezone.utc)
    as_of = as_of or computed_at.date()
    labels = cfg.labels
    loan = inputs.loan
    has_offer = loan is not None
    metrics: dict[str, Metric] = {}
    used: list[Derived] = []            # every Derived that produced a value (for derived_status)
    assumptions: list[str] = []
    warnings: list[str] = []
    schedule_rows: list[ScheduleRow] = []

    def put(name: str, d: Derived, kind: str = "money", **extra: Any) -> Derived:
        metrics[name] = metric(d, FORMULA.get(name, extra.pop("formula_id", None) or name), kind, **extra)
        if d.known:
            used.append(d)
            assumptions.extend(d.assumptions)
        return d

    # ---------------------------------------------------------------- loan metrics (F00–F07b)
    pb = loan_payment_basis(inputs)
    pay_value: Decimal | None = None
    payment_mismatch: Decimal | None = None
    if has_offer and loan.unsupported:
        warnings.append("Unsupported loan features: " + ", ".join(loan.unsupported)
                        + ". Only fixed-rate, fully amortizing monthly loans are calculated.")
    if has_offer:
        warnings.extend(loan.warnings)
    if pb.known:
        tol_id = cfg.tolerance("identity")
        notes = list(loan.notes)
        put("principal", combine(loan.principal, [pb]), basis=loan.principal_basis, **({"notes": notes} if notes else {}))
        pay_value = loan.level_payment
        extra: dict[str, Any] = {}
        if loan.disclosed_payment is not None:
            payment_mismatch = pay_value - loan.disclosed_payment
            extra = {"disclosed": fmt(loan.disclosed_payment), "mismatch": fmt(payment_mismatch)}
        put("monthly_payment", combine(pay_value, [pb]), **extra)
        top = L.total_of_payments(list(loan.payments))
        ab = loan_af_basis(inputs)
        fc = L.finance_charge(top, loan.amount_financed)
        put("total_of_payments", combine(top, [pb]),
            **({"disclosed": fmt(loan.disclosed_top),
                "check": "pass" if abs(top - loan.disclosed_top) <= tol_id else "warn"}
               if loan.disclosed_top is not None else {}))
        put("finance_charge", combine(fc, [ab]),
            **({"disclosed": fmt(loan.disclosed_finance_charge),
                "check": "pass" if abs(fc - loan.disclosed_finance_charge) <= tol_id else "warn"}
               if loan.disclosed_finance_charge is not None else {}))
        put("interest", combine(L.interest(top, loan.principal), [pb]))

        # F04 total paid through this deal
        cd = loan.cash_down
        miss: list[str] = []
        if cd is None:
            if inputs.down_source.known and inputs.down_source.text == "none":
                cd = ZERO
            else:
                miss.append("offer.cash_down")
        eq = loan.trade_in_equity
        if eq is None:
            miss.append("offer.trade_in_payoff" if loan.trade_in_payoff is None else "offer.trade_in_value")
        if miss:
            put("total_paid_through_deal", combine(None, [ab], extra_missing=miss))
        else:
            total = top + cd + loan.pfc_paid_in_cash + max(eq, ZERO)
            breakdown: dict[str, str] = {}
            if loan.cash_price is not None:
                breakdown["cash_price"] = fmt(loan.cash_price)
            if loan.taxes_title_fees is not None:
                breakdown["taxes_title_fees"] = fmt(loan.taxes_title_fees)
            breakdown["add_ons"] = fmt(loan.add_ons_financed_total)
            breakdown["prior_loan_balance_rolled_in"] = fmt(max(-eq, ZERO))
            breakdown["finance_charge"] = fmt(fc)
            put("total_paid_through_deal", combine(total, [ab]), breakdown=breakdown)

        # F05 APR recomputed on the amount financed
        apr = L.solve_apr(loan.amount_financed, list(loan.payments), loan.n)
        if apr is None:
            warnings.append("The APR could not be recomputed from these terms.")
            put("apr_recomputed", combine(None, [ab], extra_missing=["apr_solver"]), "apr")
        else:
            check = "not_applicable"
            if loan.apr_disclosed is not None:
                check = "pass" if abs(apr - loan.apr_disclosed) <= cfg.tolerance("apr") else "warn"
            put("apr_recomputed", combine(apr, [ab]), "apr", check=check,
                **({"disclosed": str(loan.apr_disclosed)} if loan.apr_disclosed is not None else {}))
        schedule_rows = L.schedule(loan.principal, loan.rate, loan.n)
    else:
        for name in ["principal", "monthly_payment", "total_of_payments", "finance_charge", "interest",
                     "total_paid_through_deal", "apr_recomputed"]:
            metrics[name] = missing_metric(FORMULA[name], [OFFER_MIN],
                                           **({"basis": loan.principal_basis} if name == "principal" and has_offer
                                              else {}))

    put("ltv", ltv(inputs), "ltv")
    neg = put("negative_equity_at_start", negative_equity_at_start(inputs))
    put("payment_to_take_home", payment_to_take_home(inputs), "ratio")
    put("dti_total", dti_total(inputs), "ratio")

    # ---------------------------------------------------------------- household (F08–F14)
    mlb = put("monthly_left_before", monthly_left_before(inputs), formula_id="F08")
    rmb = put("reserve_months_before", reserve_months_before(inputs), "months", formula_id="F10b")
    if has_offer:
        f14 = put("incremental_vehicle_costs", incremental_vehicle_costs(inputs, labels), formula_id="F14")
        if f14.known:
            assumptions.extend(f14.assumptions)
        mla = put("monthly_left_after", monthly_left_after(inputs, labels), formula_id="F09")
        f13 = put("savings_after_purchase", savings_after_purchase(inputs), formula_id="F13")
        rma = put("reserve_months_after", reserve_months_after(inputs), "months", formula_id="F10")
    else:
        for name, fid in [("incremental_vehicle_costs", "F14"), ("monthly_left_after", "F09"),
                          ("savings_after_purchase", "F13"), ("reserve_months_after", "F10")]:
            metrics[name] = missing_metric(fid, [OFFER_MIN])
        mla = rma = f13 = missing(OFFER_MIN)

    smi_b = savings_months_of_income(inputs, after=False)
    smi_a = savings_months_of_income(inputs, after=True) if has_offer else missing(OFFER_MIN)
    for d in (smi_b, smi_a):
        if d.known:
            used.append(d)
    smi_missing = list(dict.fromkeys(([] if smi_b.known else list(smi_b.missing))
                                     + ([] if smi_a.known else list(smi_a.missing))))
    metrics["savings_months_of_income"] = Metric(
        value=None, formula_id="F11", before=fmt(smi_b.value, 2) if smi_b.known else None,
        after=fmt(smi_a.value, 2) if smi_a.known else None,
        status="missing" if not smi_b.known and not smi_a.known else None,
        missing_inputs=smi_missing or None)

    eq_d, points = equity_timeline(inputs, as_of)
    if eq_d.known:
        put("equity_timeline", eq_d, formula_id="F12", points=points)
    else:
        metrics["equity_timeline"] = missing_metric("F12", list(eq_d.missing) or ["vehicle.value_estimates"])

    # ---------------------------------------------------------------- flags
    def rounded(d: Derived, places: int = 2) -> Decimal | None:
        return q(d.value, places) if d.known else None

    reserve_for_flag = rounded(rma) if has_offer else rounded(rmb)
    flags = build_flags(
        cfg,
        term_months=loan.n if has_offer else None,
        negative_equity=rounded(neg) if has_offer else None,
        rolled_in=trade_in_rolled_in(inputs) if has_offer else None,
        left_before=rounded(mlb), left_after=rounded(mla) if has_offer else None,
        reserve_months=reserve_for_flag,
        add_ons_financed=loan.add_ons_financed_total if has_offer else None,
        prepayment_penalty=loan.prepayment_penalty if has_offer else None,
        payment_mismatch=payment_mismatch,
        pfc_assumed_zero=bool(has_offer and "a_pfc_zero" in loan.assumptions),
        has_offer=has_offer,
    )
    for f in flags:
        if f.flag_id == "PAYMENT_MISMATCH" and f.triggered:
            warnings.append(f.detail)
    if has_offer:
        assumptions.extend(loan.assumptions)

    statuses = [s for d in used for s in d.statuses]
    verifs = [v for d in used for v in d.verifications]
    return CalculationResult(
        calc_id=calc_id or stable_id("c", {"offer_id": inputs.offer_id, "pv": profile_version}),
        profile_version=profile_version,
        offer_id=inputs.offer_id,
        derived_status=weakest_status(statuses),
        derived_verification=weakest_verification(verifs),
        metrics=metrics,
        amortization_schedule=schedule_rows,
        flags=flags,
        required_inputs={k: list(v) for k, v in REQUIRED_INPUTS.items()},
        assumptions_used=list(dict.fromkeys(assumptions)),
        warnings=list(dict.fromkeys(w for w in warnings if w)),
        computed_at=computed_at,
    )
