"""Stage 5 — counterfactual alternatives (stage_05 v1.1, contracts §3.9).

Every alternative is ``engine.compute`` on a transformed offer/facts (no separate arithmetic) plus the
Stage 4 break-even (M = 3). Levers (config/levers.yaml): extra cash down (bounded by savings after purchase),
term (same_rate_assumed whenever it differs from the offer's), removal of add-ons marked optional == True
only, and competing verified offers. APRs/rates are never invented (A-37): every alternative uses the rate
of the offer named in its lever_values.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from engine.cashflow import MissingInputError
from engine.compute import compute, compute_from_inputs
from engine.config import EngineConfig, load_config
from engine.inputs import build_inputs, coerce_offer, minimum_set_present, normalize_facts
from engine.money import ZERO, engine_context, fmt, q, to_decimal
from engine.requirements import evaluate_readiness
from schemas.contracts import (
    Alternative,
    CalculationResult,
    CounterfactualResult,
    LoanOffer,
    Objective,
    RateSensitivity,
    SensitivityItem,
)
from scenarios.resilience import break_even

DEFAULT_NOTE = "Alternatives are what-if calculations under the stated assumptions, not predictions or recommendations."
ALT_METRICS = ["principal", "monthly_payment", "total_of_payments", "finance_charge", "interest",
               "total_paid_through_deal", "monthly_left_after", "savings_after_purchase", "reserve_months_after"]
PLACES = {"reserve_months_after": 2, "break_even_m3": 2}


@dataclass(frozen=True)
class _Eval:
    calc: CalculationResult
    break_even_m3: Decimal | None


# ---------------------------------------------------------------------------------------------- transforms
def _with_term(offer: LoanOffer, key: str, value: str) -> LoanOffer:
    terms = dict(offer.terms)
    old = terms[key]
    terms[key] = old.model_copy(update={"value": value})
    return offer.model_copy(update={"terms": terms})


def _drop_terms(offer: LoanOffer, keys: tuple[str, ...]) -> LoanOffer:
    return offer.model_copy(update={"terms": {k: v for k, v in offer.terms.items() if k not in keys}})


def _known_term(offer: LoanOffer, key: str) -> Decimal | None:
    t = offer.terms.get(key)
    if t is None or getattr(t.status, "value", t.status) not in {"provided", "estimated", "calculated"}:
        return None
    return to_decimal(t.value)


def _reduce_amount(offer: LoanOffer, amount: Decimal) -> LoanOffer:
    """Reduce the stated principal and/or amount financed by ``amount`` (an itemization-derived principal
    recomputes itself from the changed cash down / itemization)."""
    for key in ("principal", "amount_financed"):
        v = _known_term(offer, key)
        if v is not None:
            offer = _with_term(offer, key, str(v - amount))
    return offer


def transform(offer: LoanOffer, facts: dict[str, dict[str, Any]], *, cash_down_delta: Decimal, term_months: int,
              remove_optional: bool) -> tuple[LoanOffer, dict[str, dict[str, Any]], list[str]]:
    flags: list[str] = []
    o = offer
    f = dict(facts)
    # Disclosed figures describe the original contract only; drop them so they are not compared.
    o = _drop_terms(o, ("monthly_payment", "total_of_payments", "finance_charge", "total_sale_price"))
    if cash_down_delta > 0:
        cd = _known_term(o, "cash_down")
        if cd is not None:
            o = _with_term(o, "cash_down", str(cd + cash_down_delta))
        else:
            from schemas.contracts import VerifiedFinancialTerm
            terms = dict(o.terms)
            terms["cash_down"] = VerifiedFinancialTerm(term_key="cash_down", value=str(cash_down_delta),
                                                       value_type="currency", status="provided",
                                                       source_kind="calculation")
            o = o.model_copy(update={"terms": terms})
        o = _reduce_amount(o, cash_down_delta)
        src = (f.get("loan.down_payment_source") or {}).get("value")
        if src != "savings":
            # extra down must come from somewhere real: assume savings (and say so)
            sav = f.get("savings.liquid")
            if sav is not None and to_decimal(sav.get("value")) is not None:
                f["savings.liquid"] = {**sav, "value": str(to_decimal(sav["value"]) - cash_down_delta)}
            flags.append("extra_down_from_savings")
    native_term = int(_known_term(offer, "term_months"))
    if term_months != native_term:
        o = _with_term(o, "term_months", str(term_months))
        flags.append("same_rate_assumed")
    if remove_optional:
        keep, removed = [], ZERO
        for it in o.itemization:
            if it.item == "add_on" and it.optional is True and it.financed:
                removed += to_decimal(it.amount) or ZERO
            else:
                keep.append(it)
        o = o.model_copy(update={"itemization": keep})
        o = _reduce_amount(o, removed)
        flags.append("optional_add_ons_removed")
    return o, f, flags


# ---------------------------------------------------------------------------------------------- evaluation
def _evaluate(facts: dict, offer: LoanOffer, cfg: EngineConfig, horizon: int,
              calc: CalculationResult | None = None) -> _Eval:
    inputs = build_inputs(facts, offer)
    if calc is None:
        calc = compute_from_inputs(inputs, cfg)
    f13 = calc.metrics["savings_after_purchase"].value
    be = None
    if f13 is not None:
        try:
            be = break_even(inputs, 3, Decimal(f13), horizon).value
        except MissingInputError:
            be = None
    return _Eval(calc=calc, break_even_m3=be)


def _metrics(ev: _Eval) -> dict[str, str | None]:
    out = {k: ev.calc.metrics[k].value for k in ALT_METRICS}
    out["break_even_m3"] = fmt(q(ev.break_even_m3, 2, "ROUND_DOWN"), 2) if ev.break_even_m3 is not None else None
    return out


def _deltas(alt: dict[str, str | None], base: dict[str, str | None]) -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for k, v in alt.items():
        b = base.get(k)
        out[k] = fmt(Decimal(v) - Decimal(b), PLACES.get(k, 2)) if v is not None and b is not None else None
    return out


def _label(term: int, native: int, d: Decimal, remove: bool, offer_label: str | None) -> str:
    parts = []
    if offer_label:
        parts.append(offer_label)
    if term != native:
        parts.append(f"{term} months (same rate assumed)")
    if d > 0:
        parts.append(f"+${d:,.0f} down")
    if remove:
        parts.append("optional add-ons removed")
    return ", ".join(parts) if parts else "Your offer as quoted"


def _dominates(a: dict, b: dict, objectives: list[Objective]) -> bool:
    better = False
    compared = False
    for ob in objectives:
        va, vb = a.get(ob.metric), b.get(ob.metric)
        if va is None or vb is None:
            continue
        compared = True
        x, y = Decimal(va), Decimal(vb)
        if ob.direction == "min":
            x, y = -x, -y
        if x < y:
            return False
        if x > y:
            better = True
    return compared and better


def _verified_competitors(base: LoanOffer, competing: Any) -> list[LoanOffer]:
    out = []
    for c in competing or ():
        lo = coerce_offer(c)
        if lo is None or lo.offer_id == base.offer_id:
            continue
        if lo.ready_for_calculation and minimum_set_present(lo):
            out.append(lo)
    return out


def evaluate(facts: Any, offer: Any, config: EngineConfig | None = None,
             competing_offers: Any = ()) -> CounterfactualResult:
    cfg = config or load_config()
    lv = cfg.levers_raw
    objectives = [Objective(**o) for o in lv.get("objectives", [])]
    deferred = list(lv.get("deferred_levers", ["price_change", "delay_purchase"]))
    nf = normalize_facts(facts)
    base_offer = coerce_offer(offer)
    notes = [DEFAULT_NOTE]
    if base_offer is None:
        return CounterfactualResult(base_offer_id=None, deferred_levers=deferred, objectives=objectives,
                                    notes=notes + ["No loan offer yet, so no alternatives were calculated."])
    ready = evaluate_readiness("alternatives", nf, base_offer)
    if not ready.available:
        return CounterfactualResult(base_offer_id=base_offer.offer_id, deferred_levers=deferred,
                                    objectives=objectives, notes=notes + [ready.reason or "Not enough information."])
    horizon = int(cfg.scenarios_raw.get("horizon_months", 12))
    with engine_context():
        base_calc = compute(nf, base_offer, cfg)
        base_eval = _evaluate(nf, base_offer, cfg, horizon, calc=base_calc)
        base_metrics = _metrics(base_eval)
        base_f13 = to_decimal(base_metrics["savings_after_purchase"])
        native = int(_known_term(base_offer, "term_months"))
        cash_levels = [Decimal(str(x)) for x in lv["levers"]["cash_down_delta"]]
        term_levels = [int(x) for x in lv["levers"]["term_months"]]
        has_optional = any(it.item == "add_on" and it.optional is True and it.financed
                           for it in base_offer.itemization)
        remove_levels = [False, True] if has_optional else [False]
        competitors = _verified_competitors(base_offer, competing_offers)
        offers = [base_offer] + competitors

        alternatives: list[Alternative] = [Alternative(
            alt_id="alt_000", label="Your offer as quoted",
            lever_values={"cash_down_delta": "0", "term_months": native, "remove_optional_add_ons": False,
                          "offer_id": base_offer.offer_id},
            metrics=base_metrics, deltas_vs_base=_deltas(base_metrics, base_metrics), is_base=True)]
        counter = 1
        for o in offers:
            o_native = int(_known_term(o, "term_months"))
            terms_for_offer = list(dict.fromkeys(term_levels + [o_native]))
            for d in cash_levels:
                for term in terms_for_offer:
                    for remove in remove_levels:
                        if o is base_offer and d == 0 and term == native and not remove:
                            continue                       # that is the base alternative
                        if remove and not any(it.item == "add_on" and it.optional is True and it.financed
                                              for it in o.itemization):
                            continue
                        lever_values = {"cash_down_delta": str(d), "term_months": term,
                                        "remove_optional_add_ons": remove, "offer_id": o.offer_id}
                        label = _label(term, o_native, d, remove, None if o is base_offer else o.label)
                        reasons: list[str] = []
                        if d > 0:
                            if base_f13 is None:
                                reasons.append("Savings after the purchase are unknown, so an extra down payment "
                                               "cannot be checked.")
                            elif d > base_f13:
                                reasons.append(f"The extra down payment (${d:,.2f}) is more than your savings "
                                               f"after the purchase (${base_f13:,.2f}).")
                        try:
                            to, tf, flags = transform(o, nf, cash_down_delta=d, term_months=term,
                                                      remove_optional=remove)
                            ev = _evaluate(tf, to, cfg, horizon)
                        except (ValueError, ArithmeticError) as exc:  # never fail the whole result
                            notes.append(f"Alternative '{label}' could not be calculated ({exc}).")
                            continue
                        mets = _metrics(ev)
                        if mets["principal"] is not None and Decimal(mets["principal"]) < 0:
                            reasons.append("The extra down payment exceeds the amount borrowed.")
                        if mets["monthly_payment"] is None:
                            reasons.append("This alternative could not be calculated from the offer terms.")
                        alternatives.append(Alternative(
                            alt_id=f"alt_{counter:03d}", label=label, lever_values=lever_values,
                            assumption_flags=flags, metrics=mets, deltas_vs_base=_deltas(mets, base_metrics),
                            feasible=not reasons, infeasible_reasons=reasons))
                        counter += 1

        feasible = [a for a in alternatives if a.feasible]
        pareto = [a.alt_id for a in feasible
                  if not any(_dominates(b.metrics, a.metrics, objectives) for b in feasible if b is not a)]

        rate_sens = _rate_sensitivity(nf, base_offer, cfg, base_calc, lv)
        ranking = _sensitivity_ranking(alternatives, base_metrics, native, base_offer.offer_id, objectives)

    if any("same_rate_assumed" in a.assumption_flags for a in alternatives):
        notes.append("Different terms are shown at the same interest rate as your offer (same_rate_assumed); "
                     "a lender may price a different term differently.")
    if not has_optional:
        notes.append("No add-on is marked optional, so none was removed.")
    if rate_sens is not None:
        notes.append("The rate sensitivity is a calculation to help you ask the lender about the rate, not an offer.")
    return CounterfactualResult(
        base_offer_id=base_offer.offer_id,
        levers={"cash_down_delta": [str(x) for x in cash_levels], "term_months": term_levels,
                "remove_optional_add_ons": remove_levels, "offer_id": [o.offer_id for o in offers]},
        deferred_levers=deferred, alternatives=alternatives, pareto_set=pareto, objectives=objectives,
        rate_sensitivity=rate_sens, sensitivity_ranking=ranking, notes=list(dict.fromkeys(notes)))


def _rate_sensitivity(nf: dict, offer: LoanOffer, cfg: EngineConfig, base_calc: CalculationResult,
                      lv: dict) -> RateSensitivity | None:
    step = Decimal(str(lv.get("rate_sensitivity_points", "0.01")))
    key = "contract_rate" if _known_term(offer, "contract_rate") is not None else (
        "apr" if _known_term(offer, "apr") is not None else None)
    if key is None or base_calc.metrics["finance_charge"].value is None:
        return None
    bumped = _with_term(offer, key, str(_known_term(offer, key) + step))
    if key == "contract_rate" and _known_term(offer, "apr") is not None:
        bumped = _with_term(bumped, "apr", str(_known_term(offer, "apr") + step))
    calc = compute(nf, bumped, cfg)
    fc, pay = calc.metrics["finance_charge"].value, calc.metrics["monthly_payment"].value
    if fc is None or pay is None:
        return None
    return RateSensitivity(
        per_point_finance_charge_delta=fmt(Decimal(fc) - Decimal(base_calc.metrics["finance_charge"].value)),
        per_point_monthly_payment_delta=fmt(Decimal(pay) - Decimal(base_calc.metrics["monthly_payment"].value)),
        statement_claim_id="cl_rate_1pt")


def _sensitivity_ranking(alternatives: list[Alternative], base: dict, native: int, base_offer_id: str,
                         objectives: list[Objective]) -> list[SensitivityItem]:
    """One-at-a-time: for each lever, alternatives on the base offer where only that lever moved; effect =
    max |Δ metric| / |base metric| (relative change), ranked descending."""
    def only(alt: Alternative) -> str | None:
        lv = alt.lever_values
        if lv["offer_id"] != base_offer_id or not alt.feasible or alt.is_base:
            return None
        moved = [name for name, changed in (("cash_down_delta", lv["cash_down_delta"] != "0"),
                                            ("term_months", lv["term_months"] != native),
                                            ("remove_optional_add_ons", bool(lv["remove_optional_add_ons"])))
                 if changed]
        return moved[0] if len(moved) == 1 else None

    items: list[tuple[Decimal, str, str]] = []
    for lever in ("cash_down_delta", "term_months", "remove_optional_add_ons"):
        alts = [a for a in alternatives if only(a) == lever]
        if not alts:
            continue
        for ob in objectives:
            b = base.get(ob.metric)
            if b is None or Decimal(b) == 0:
                continue
            effects = [abs(Decimal(a.metrics[ob.metric]) - Decimal(b)) / abs(Decimal(b))
                       for a in alts if a.metrics.get(ob.metric) is not None]
            if effects:
                items.append((max(effects), lever, ob.metric))
    items.sort(key=lambda x: (-x[0], x[1], x[2]))
    return [SensitivityItem(lever=lever, metric=metric, normalized_effect=fmt(e, 4)) for e, lever, metric in items]
