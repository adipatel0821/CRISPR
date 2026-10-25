"""Claim builder (stage 6 §9, contracts §3.10): typed claims from report values -> template sentences -> sections.

Pure: no DB, no HTTP, no LLM. Every number in a sentence is a value copied (and only rounded for display) from a
CalculationResult / ScenarioResult / ResilienceSummary / CounterfactualResult, a fact, or an offer term, and the
claim carries the evidence ids of those sources. Missing values never become zero: a claim whose value is unknown
is simply not made (the missing-information section says what is needed instead).
"""
from __future__ import annotations

import logging
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

from explain import format as fmt
from explain.templates import ASSUMPTION_FLAG_TEXT, TEMPLATES, DeniedLanguageError, render
from schemas.contracts import (Assumption, Claim, ExplanationEvidence, ExplanationSection, MissingInfoItem)

log = logging.getLogger("decisiontwin.explain")

FORMULA_NAMES = {
    "F00": "Principal", "F01": "Monthly payment", "F01s": "Payment schedule", "F02": "Total of payments",
    "F03": "Finance charge", "F03i": "Interest", "F04": "Total paid through this deal", "F05": "APR recomputed",
    "F06": "Loan-to-value", "F06d": "Negative equity at start", "F07": "Payment as a share of take-home pay",
    "F07b": "Debt-to-income", "F08": "Monthly left before", "F09": "Monthly left after",
    "F10": "Reserve months after", "F10b": "Reserve months before", "F11": "Savings in months of income",
    "F12": "Equity timeline", "F13": "Savings after purchase", "F14": "Change in car running costs",
}

ANALYSIS_NAMES = {
    "loan_cost": "the loan cost", "cashflow_impact": "the monthly cash-flow view",
    "reserve_impact": "the savings view", "stress_test": "the stress tests", "alternatives": "the alternatives",
    "dti": "the debt-to-income ratio", "equity_timeline": "the equity timeline",
}

KNOWN_ASSUMPTIONS = {
    "a_pfc_zero": "The offer does not state prepaid finance charges, so they are assumed to be $0.",
    "a_illustrative_scenarios": ("Illustrative scenario chosen by DecisionTwin to show how your plan responds. "
                                 "It is not a forecast of what will happen to you."),
    "a_gap_no_interest": ("Any shortfall beyond your savings is shown as an unfunded gap; no interest on it is "
                          "assumed."),
    "same_rate_assumed": "Term alternatives assume the lender would offer the same rate for a different term.",
}

FLAG_EVIDENCE = {   # flag -> (kind, key) of the source it rests on
    "TERM_GT_60": ("term", "term_months"), "NEGATIVE_EQUITY_AT_START": ("metric", "negative_equity_at_start"),
    "DEFICIT_BEFORE_LOAN": ("metric", "monthly_left_before"), "DEFICIT_AFTER_LOAN": ("metric", "monthly_left_after"),
    "RESERVE_LT_1_MONTH": ("metric", "reserve_months_after"),
    "ADD_ONS_FINANCED": ("metric", "total_paid_through_deal"), "PREPAYMENT_PENALTY": ("term", "prepayment_penalty"),
    "PAYMENT_MISMATCH": ("metric", "monthly_payment"), "PFC_ASSUMED_ZERO": ("assumption", "a_pfc_zero"),
}
FLAG_FORMULA_FALLBACK = {"negative_equity_at_start": "F06d", "monthly_left_before": "F08",
                         "monthly_left_after": "F09", "reserve_months_after": "F10",
                         "total_paid_through_deal": "F04", "monthly_payment": "F01"}

LENDER_BUY_RATE_CITATION = "CFPB en-727, en-759"
ADD_ON_CITATION = "CFPB en-797"


@dataclass
class Explanations:
    claims: list[Claim] = field(default_factory=list)
    evidence: list[ExplanationEvidence] = field(default_factory=list)
    sections: list[ExplanationSection] = field(default_factory=list)
    key_points: list[str] = field(default_factory=list)        # claim ids, ranked
    missing_information: list[MissingInfoItem] = field(default_factory=list)
    assumptions: list[Assumption] = field(default_factory=list)


# --------------------------------------------------------------------------- tolerant accessors
def _get(obj: Any, name: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, Mapping):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _s(v: Any) -> str | None:
    if v is None:
        return None
    return str(getattr(v, "value", v))


class _Ctx:
    """Collects evidence (deduplicated by id) and claims."""

    def __init__(self, facts: Mapping, offer: Any, baseline: Any, with_offer: Any):
        self.facts = facts or {}
        self.offer = offer
        self.baseline = baseline
        self.with_offer = with_offer
        self.evidence: dict[str, ExplanationEvidence] = {}
        self.claims: dict[str, Claim] = {}
        self.assumptions: dict[str, Assumption] = {}

    # ---- metrics / facts / terms -----------------------------------------------------------------------------
    def metric(self, name: str, prefer_baseline: bool = False):
        order = (self.baseline, self.with_offer) if prefer_baseline else (self.with_offer, self.baseline)
        for calc in order:
            m = (_get(calc, "metrics") or {}).get(name)
            if m is not None:
                return m
        return None

    def mval(self, name: str, prefer_baseline: bool = False) -> str | None:
        m = self.metric(name, prefer_baseline)
        v = _get(m, "value")
        return None if v is None or fmt.dec(v) is None else str(v)

    def fact(self, key: str):
        f = self.facts.get(key)
        if f is None or _s(_get(f, "status")) not in ("provided", "estimated", "calculated"):
            return None
        return f

    def term(self, key: str):
        t = (_get(self.offer, "terms") or {}).get(key)
        if t is None or _get(t, "value") is None:
            return None
        if _s(_get(t, "status")) in ("missing", "declined", "conflicting", "superseded"):
            return None
        return t

    def flags(self) -> list:
        out, seen = [], set()
        for calc in (self.with_offer, self.baseline):
            for fl in _get(calc, "flags") or []:
                fid = _get(fl, "flag_id")
                if fid not in seen and _get(fl, "triggered"):
                    seen.add(fid)
                    out.append(fl)
        return out

    # ---- evidence ----------------------------------------------------------------------------------------------
    def _add_ev(self, ev: ExplanationEvidence) -> str:
        self.evidence.setdefault(ev.evidence_id, ev)
        return ev.evidence_id

    def ev_calc(self, metric_name: str | None = None, formula_id: str | None = None) -> str | None:
        if formula_id is None:
            formula_id = _get(self.metric(metric_name), "formula_id") if metric_name else None
        if not formula_id:
            return None
        name = FORMULA_NAMES.get(formula_id, formula_id)
        verification = _s(_get(self.with_offer or self.baseline, "derived_verification")) or "none"
        return self._add_ev(ExplanationEvidence(
            evidence_id=f"ev_calc_{formula_id}", kind="calculation", verification=verification,
            ref={"formula_id": formula_id, **({"metric": metric_name} if metric_name else {})},
            display_label=f"Calculated · {name}"))

    def ev_fact(self, fact: Any) -> str:
        fid = _get(fact, "fact_id")
        status = _s(_get(fact, "status"))
        verification = _s(_get(fact, "verification")) or "none"
        if status == "estimated":
            label = "Your estimate"
        elif verification in ("user_confirmed",):
            label = "You confirmed"
        else:
            label = "You told us"
        return self._add_ev(ExplanationEvidence(
            evidence_id=f"ev_fact_{fid}", kind=_s(_get(fact, "source_kind")) or "user_input",
            verification=verification, ref={"fact_id": fid, "key": _get(fact, "key")}, display_label=label))

    def ev_term(self, key: str) -> str | None:
        t = self.term(key)
        if t is None:
            return None
        verification = _s(_get(t, "verification")) or "none"
        source = _s(_get(t, "source_kind")) or "user_input"
        evid = _get(t, "evidence")
        ref: dict[str, Any] = {"term_key": key, "offer_id": _get(self.offer, "offer_id")}
        if source == "document":
            page = _get(evid, "page")
            label = "From your document" + (f", p.{page}" if page is not None else "")
            if verification in ("evidence_matched", "evidence_matched_user_confirmed"):
                label += " · matched"
            if verification in ("user_confirmed", "evidence_matched_user_confirmed"):
                label += " · you confirmed"
            kind = "document"
            ref.update({k: _get(evid, k) for k in ("doc_id", "page", "quote") if _get(evid, k) is not None})
        else:
            label = "You confirmed" if verification == "user_confirmed" else "You entered"
            kind = "user_input"
        return self._add_ev(ExplanationEvidence(evidence_id=f"ev_term_{key}", kind=kind,
                                                verification=verification, ref=ref, display_label=label))

    def ev_scn(self, scenario_id: str, run: str, name: str | None = None) -> str:
        return self._add_ev(ExplanationEvidence(
            evidence_id=f"ev_scn_{scenario_id}_{run}", kind="calculation", verification="none",
            ref={"scenario_id": scenario_id, "run": run},
            display_label="Calculated · illustrative scenario" + (f" · {name}" if name else "")))

    def ev_asm(self, assumption_id: str, text: str | None = None) -> str:
        self.assumption(assumption_id, text)
        return self._add_ev(ExplanationEvidence(
            evidence_id=f"ev_asm_{assumption_id}", kind="assumption", verification="none",
            ref={"assumption_id": assumption_id}, display_label="Assumption"))

    def ev_alt(self, alt_id: str) -> str:
        return self._add_ev(ExplanationEvidence(
            evidence_id=f"ev_calc_alt_{alt_id}", kind="calculation", verification="none",
            ref={"alt_id": alt_id}, display_label="Calculated · what-if alternative"))

    def ev_ext(self, citation: str) -> str:
        slug = "".join(c if c.isalnum() else "_" for c in citation.lower()).strip("_")
        return self._add_ev(ExplanationEvidence(
            evidence_id=f"ev_ext_{slug}", kind="external_source", verification="none",
            ref={"citation": citation}, display_label=f"Source · {citation}"))

    def ev_readiness(self) -> str:
        return self._add_ev(ExplanationEvidence(
            evidence_id="ev_calc_readiness", kind="calculation", verification="none",
            ref={"formula_id": "readiness"}, display_label="Calculated · readiness check"))

    def assumption(self, assumption_id: str, text: str | None = None, citation: str | None = None) -> None:
        if assumption_id in self.assumptions:
            return
        self.assumptions[assumption_id] = Assumption(
            assumption_id=assumption_id, text=text or KNOWN_ASSUMPTIONS.get(assumption_id, assumption_id),
            citation=citation)

    # ---- claims ------------------------------------------------------------------------------------------------
    def claim(self, claim_id: str, ctype: str, subject: str, template_id: str, values: dict,
              evidence_ids: Iterable[str | None], assumption_ids: Iterable[str] = (),
              direction: str | None = None) -> str | None:
        evs = [e for e in dict.fromkeys(evidence_ids) if e]
        if not evs:
            log.warning("claim %s dropped: no evidence", claim_id)
            return None
        try:
            text = render(template_id, values)
        except (KeyError, ValueError, DeniedLanguageError) as exc:
            log.warning("claim %s dropped: %s", claim_id, type(exc).__name__)
            return None
        if claim_id in self.claims:
            claim_id = f"{claim_id}_{len(self.claims)}"
        self.claims[claim_id] = Claim(claim_id=claim_id, type=ctype, subject_metric=subject, values=values,
                                      direction=direction, evidence_ids=evs, assumption_ids=list(assumption_ids),
                                      template_id=template_id, text=text)
        return claim_id


def _direction(before: str | None, after: str | None) -> str | None:
    b, a = fmt.dec(before), fmt.dec(after)
    if b is None or a is None:
        return None
    return "up" if a > b else "down" if a < b else "none"


def _available(readiness: list | None, analysis_id: str) -> bool:
    if readiness is None:
        return True
    return any(_s(_get(r, "analysis_id")) == analysis_id and _get(r, "available") for r in readiness)


# --------------------------------------------------------------------------- key points
def _months(ctx: _Ctx) -> tuple[str | None, str | None]:
    t = ctx.term("term_months")
    if t is not None and fmt.dec(_get(t, "value")) is not None:
        return fmt.integer(_get(t, "value")), ctx.ev_term("term_months")
    sched = _get(ctx.with_offer, "amortization_schedule") or []
    if sched:
        return str(len(sched)), ctx.ev_calc(formula_id="F01s")
    return None, None


def kp_cost(ctx: _Ctx) -> str | None:
    fc, interest = ctx.mval("finance_charge"), ctx.mval("interest")
    months, ev_months = _months(ctx)
    if fc is None or months is None:
        return None
    pfc_term = ctx.term("prepaid_finance_charges")
    pfc = _s(_get(pfc_term, "value")) if pfc_term is not None else None
    values: dict[str, Any] = {"finance_charge": fc, "finance_charge_display": fmt.dollars(fc), "months": months}
    evs = [ctx.ev_calc("finance_charge"), ev_months]
    if interest is not None and pfc is not None and fmt.dec(pfc) is not None and not fmt.is_zero(pfc):
        values.update({"interest": interest, "interest_display": fmt.dollars(interest),
                       "prepaid_finance_charges": pfc, "pfc_display": fmt.dollars(pfc)})
        evs += [ctx.ev_calc("interest"), ctx.ev_term("prepaid_finance_charges")]
        tid = "t_kp_cost"
    else:
        tid = "t_kp_cost_simple"
    return ctx.claim("cl_kp_cost", "value", "finance_charge", tid, values, evs)


def kp_cashflow(ctx: _Ctx) -> tuple[str | None, bool]:
    """Returns (claim id, deficit_before)."""
    before = ctx.mval("monthly_left_before", prefer_baseline=True)
    after = ctx.mval("monthly_left_after")
    if before is None:
        return None, False
    car = ctx.mval("incremental_vehicle_costs")
    car_changed = car is not None and not fmt.is_zero(car)
    evs = [ctx.ev_calc("monthly_left_before"), ctx.ev_calc("monthly_left_after") if after else None,
           ctx.ev_calc("incremental_vehicle_costs") if car_changed else None]
    values: dict[str, Any] = {"monthly_left_before": before, "before_display": fmt.dollars(before)}
    if after is not None:
        values.update({"monthly_left_after": after, "after_display": fmt.dollars(after)})
    if car_changed:
        values["incremental_vehicle_costs"] = car
    deficit_before = fmt.is_negative(before)
    if deficit_before:
        if after is None:
            tid = "t_kp_deficit_before_only"
        else:
            tid = "t_kp_deficit_before" if fmt.is_negative(after) else "t_kp_deficit_before_recovers"
        return ctx.claim("cl_kp_cashflow", "change", "monthly_left_after" if after else "monthly_left_before", tid,
                         values, evs, direction=_direction(before, after)), True
    if after is None:
        return None, False
    if fmt.is_negative(after):
        tid = "t_kp_cashflow_shortfall" if car_changed else "t_kp_cashflow_shortfall_nocar"
    else:
        tid = "t_kp_cashflow" if car_changed else "t_kp_cashflow_nocar"
    return ctx.claim("cl_kp_cashflow", "change", "monthly_left_after", tid, values, evs,
                     direction=_direction(before, after)), False


def kp_reserve(ctx: _Ctx) -> str | None:
    savings_fact = ctx.fact("savings.liquid")
    after = ctx.mval("savings_after_purchase")
    if savings_fact is None or after is None or fmt.dec(_get(savings_fact, "value")) is None:
        return None
    savings = str(_get(savings_fact, "value"))
    months = ctx.mval("reserve_months_after")
    values: dict[str, Any] = {"savings_liquid": savings, "savings_display": fmt.dollars(savings),
                              "savings_after_purchase": after, "after_display": fmt.dollars(after)}
    evs = [ctx.ev_fact(savings_fact), ctx.ev_calc("savings_after_purchase")]
    if fmt.is_negative(after):
        tid = "t_kp_reserve_shortfall"
    else:
        if months is not None:
            values.update({"reserve_months_after": months, "reserve_after_display": fmt.one_dp(months)})
            evs.append(ctx.ev_calc("reserve_months_after"))
        same = fmt.dec(savings) == fmt.dec(after)
        if months is None:
            tid = "t_kp_reserve_nomonths"
        else:
            tid = "t_kp_reserve_same" if same else "t_kp_reserve"
    return ctx.claim("cl_kp_reserve", "change", "savings_after_purchase", tid, values, evs,
                     direction=_direction(savings, after))


# --------------------------------------------------------------------------- detail sections
def loan_cost_claims(ctx: _Ctx) -> list[str | None]:
    out: list[str | None] = []
    months, ev_months = _months(ctx)
    pay = ctx.metric("monthly_payment")
    pay_v = ctx.mval("monthly_payment")
    if pay_v is not None and months is not None:
        out.append(ctx.claim("cl_cost_payment", "value", "monthly_payment", "t_cost_payment",
                             {"monthly_payment": pay_v, "payment_display": fmt.cents(pay_v), "months": months},
                             [ctx.ev_calc("monthly_payment"), ev_months]))
    disclosed, mismatch = _get(pay, "disclosed"), _get(pay, "mismatch")
    if pay_v is not None and fmt.dec(disclosed) is not None and fmt.dec(mismatch) is not None \
            and abs(fmt.dec(mismatch)) > 1:
        out.append(ctx.claim("cl_cost_payment_mismatch", "threshold_flag", "monthly_payment",
                             "t_cost_payment_mismatch",
                             {"disclosed": str(disclosed), "disclosed_display": fmt.cents(disclosed),
                              "monthly_payment": pay_v, "payment_display": fmt.cents(pay_v),
                              "mismatch": str(mismatch), "mismatch_display": fmt.cents(mismatch)},
                             [ctx.ev_calc("monthly_payment"), ctx.ev_term("monthly_payment")]))
    top = ctx.mval("total_of_payments")
    if top is not None:
        out.append(ctx.claim("cl_cost_total_of_payments", "value", "total_of_payments", "t_cost_total_of_payments",
                             {"total_of_payments": top, "total_display": fmt.cents(top)},
                             [ctx.ev_calc("total_of_payments")]))
    fc, interest = ctx.mval("finance_charge"), ctx.mval("interest")
    pfc_term = ctx.term("prepaid_finance_charges")
    pfc = _s(_get(pfc_term, "value")) if pfc_term is not None else None
    if fc is not None and interest is not None:
        values = {"finance_charge": fc, "finance_charge_display": fmt.cents(fc), "interest": interest,
                  "interest_display": fmt.cents(interest)}
        evs = [ctx.ev_calc("finance_charge"), ctx.ev_calc("interest")]
        if pfc is not None and fmt.dec(pfc) is not None and not fmt.is_zero(pfc):
            values.update({"prepaid_finance_charges": pfc, "pfc_display": fmt.cents(pfc)})
            evs.append(ctx.ev_term("prepaid_finance_charges"))
            tid = "t_cost_finance_split"
        else:
            tid = "t_cost_finance_interest"
        out.append(ctx.claim("cl_cost_finance_charge", "value", "finance_charge", tid, values, evs))
    total = ctx.mval("total_paid_through_deal")
    if total is not None:
        out.append(ctx.claim("cl_cost_total_deal", "value", "total_paid_through_deal", "t_cost_total_deal",
                             {"total_paid_through_deal": total, "total_display": fmt.cents(total)},
                             [ctx.ev_calc("total_paid_through_deal")]))
    apr_m = ctx.metric("apr_recomputed")
    apr = ctx.mval("apr_recomputed")
    if apr is not None:
        values = {"apr_recomputed": apr, "apr_display": fmt.percent(apr, 3)}
        evs = [ctx.ev_calc("apr_recomputed")]
        apr_term = ctx.term("apr")
        tid = "t_cost_apr"
        if _s(_get(apr_m, "check")) == "warn" and apr_term is not None and fmt.dec(_get(apr_term, "value")):
            values.update({"disclosed_apr": str(_get(apr_term, "value")),
                           "disclosed_display": fmt.percent(_get(apr_term, "value"), 3)})
            evs.append(ctx.ev_term("apr"))
            tid = "t_cost_apr_warn"
        out.append(ctx.claim("cl_cost_apr", "value", "apr_recomputed", tid, values, evs))
    return out


def with_loan_claims(ctx: _Ctx, readiness: list | None) -> list[str | None]:
    out: list[str | None] = []
    if _available(readiness, "cashflow_impact"):
        before = ctx.mval("monthly_left_before", prefer_baseline=True)
        if before is not None:
            label = _get(ctx.metric("monthly_left_before", prefer_baseline=True), "label")
            if fmt.is_negative(before):
                out.append(ctx.claim("cl_cash_before", "value", "monthly_left_before", "t_cash_before_deficit",
                                     {"monthly_left_before": before, "value_display": fmt.dollars(before)},
                                     [ctx.ev_calc("monthly_left_before")]))
            else:
                out.append(ctx.claim("cl_cash_before", "value", "monthly_left_before", "t_cash_before",
                                     {"monthly_left_before": before, "value_display": fmt.dollars(before),
                                      "label": label or "after essentials and debt payments"},
                                     [ctx.ev_calc("monthly_left_before")]))
        car = ctx.mval("incremental_vehicle_costs")
        if car is not None and not fmt.is_zero(car):
            out.append(ctx.claim("cl_cash_car", "change", "incremental_vehicle_costs",
                                 "t_cash_car_down" if fmt.is_negative(car) else "t_cash_car_up",
                                 {"incremental_vehicle_costs": car, "value_display": fmt.dollars(car)},
                                 [ctx.ev_calc("incremental_vehicle_costs")],
                                 direction="down" if fmt.is_negative(car) else "up"))
        after = ctx.mval("monthly_left_after")
        if after is not None:
            out.append(ctx.claim("cl_cash_after", "change", "monthly_left_after",
                                 "t_cash_after_deficit" if fmt.is_negative(after) else "t_cash_after",
                                 {"monthly_left_after": after, "value_display": fmt.dollars(after)},
                                 [ctx.ev_calc("monthly_left_after")], direction=_direction(before, after)))
        ratio = ctx.mval("payment_to_take_home")
        if ratio is not None:
            out.append(ctx.claim("cl_cash_ratio", "value", "payment_to_take_home", "t_cash_ratio",
                                 {"payment_to_take_home": ratio, "pct_display": fmt.percent(ratio, 1)},
                                 [ctx.ev_calc("payment_to_take_home")]))
    if _available(readiness, "reserve_impact"):
        sap = ctx.mval("savings_after_purchase")
        if sap is not None and not fmt.is_negative(sap):
            out.append(ctx.claim("cl_reserve_savings_after", "value", "savings_after_purchase",
                                 "t_reserve_savings_after",
                                 {"savings_after_purchase": sap, "value_display": fmt.cents(sap)},
                                 [ctx.ev_calc("savings_after_purchase")]))
        rb, ra = ctx.mval("reserve_months_before", prefer_baseline=True), ctx.mval("reserve_months_after")
        if rb is not None and ra is not None:
            out.append(ctx.claim("cl_reserve_months", "change", "reserve_months_after", "t_reserve_months",
                                 {"reserve_months_before": rb, "before_display": fmt.one_dp(rb),
                                  "reserve_months_after": ra, "after_display": fmt.one_dp(ra)},
                                 [ctx.ev_calc("reserve_months_before"), ctx.ev_calc("reserve_months_after")],
                                 direction=_direction(rb, ra)))
    dti = ctx.mval("dti_total")
    if dti is not None and _available(readiness, "dti"):
        out.append(ctx.claim("cl_dti", "value", "dti_total", "t_dti",
                             {"dti_total": dti, "pct_display": fmt.percent(dti, 1)}, [ctx.ev_calc("dti_total")]))
    for fl in ctx.flags():
        fid = _get(fl, "flag_id")
        tid = f"t_flag_{fid}"
        kind, key = FLAG_EVIDENCE.get(fid, (None, None))
        evs: list[str | None] = []
        asm: list[str] = []
        if kind == "term":
            evs.append(ctx.ev_term(key))
        elif kind == "metric":
            evs.append(ctx.ev_calc(key) or ctx.ev_calc(formula_id=FLAG_FORMULA_FALLBACK.get(key)))
        elif kind == "assumption":
            evs.append(ctx.ev_asm(key))
            asm.append(key)
        if not any(evs):
            evs.append(ctx.ev_calc(formula_id=FLAG_FORMULA_FALLBACK.get(key or "", "F01")))
        values = {"flag_id": fid}
        if _get(fl, "citation"):
            values["citation"] = _get(fl, "citation")
            evs.append(ctx.ev_ext(_get(fl, "citation")))
        if tid in TEMPLATES:
            out.append(ctx.claim(f"cl_flag_{fid.lower()}", "threshold_flag", key or fid, tid, values, evs, asm))
    return out


RUN_PHRASE = {"without_offer": "without this loan", "with_offer": "with this loan"}


def stress_claims(ctx: _Ctx, scenarios: list | None, resilience: Any) -> list[str | None]:
    out: list[str | None] = []
    for sc in scenarios or []:
        sid, run = _get(sc, "scenario_id"), _s(_get(sc, "run"))
        name = _get(sc, "name") or str(sid).replace("sc_", "").replace("_", " ")
        asm_ids = []
        evs = [ctx.ev_scn(sid, run, name)]
        for a in _get(sc, "assumptions") or []:
            aid = _get(a, "assumption_id")
            ctx.assumption(aid, _get(a, "text"), _get(a, "citation"))
            evs.append(ctx.ev_asm(aid, _get(a, "text")))
            asm_ids.append(aid)
        base = {"scenario_id": sid, "run": run, "name": name, "run_phrase": RUN_PHRASE.get(run, run)}
        first = _get(sc, "first_shortfall_month")
        if first is not None:
            gap = _get(sc, "max_unfunded_gap")
            if fmt.dec(gap) is None:
                continue
            values = {**base, "first_shortfall_month": first, "month": str(first), "max_unfunded_gap": str(gap),
                      "gap_display": fmt.dollars(gap)}
            out.append(ctx.claim(f"cl_scn_{sid}_{run}", "scenario_outcome", "savings_balance", "t_scn_shortfall",
                                 values, evs, asm_ids, direction="down"))
        else:
            end = _get(sc, "savings_end")
            if fmt.dec(end) is None:
                continue
            runway = _get(sc, "months_of_runway")
            values = {**base, "savings_end": str(end), "end_display": fmt.dollars(end)}
            if runway is not None:
                values.update({"months_of_runway": runway, "months": str(runway)})
                tid = "t_scn_ok"
            else:
                tid = "t_scn_ok_nomonths"
            out.append(ctx.claim(f"cl_scn_{sid}_{run}", "scenario_outcome", "savings_balance", tid, values, evs,
                                 asm_ids))
    if resilience is not None:
        words = {"break_even_m3": "three", "break_even_m6": "six"}
        if _get(resilience, "deficit_at_baseline"):
            out.append(ctx.claim("cl_scn_break_even", "scenario_outcome", "break_even_m3",
                                 "t_scn_break_even_deficit", {"deficit_at_baseline": True},
                                 [ctx.ev_scn("break_even", "with_offer")]))
        else:
            for key in ("break_even_m3", "break_even_m6"):
                v = _get(resilience, key)
                if fmt.dec(v) is None:
                    continue
                evs = [ctx.ev_scn(key, "with_offer")]
                if _get(resilience, "capped"):
                    out.append(ctx.claim(f"cl_scn_{key}", "scenario_outcome", key, "t_scn_break_even_capped",
                                         {key: str(v), "capped": True, "horizon_word": words[key]}, evs))
                else:
                    out.append(ctx.claim(f"cl_scn_{key}", "scenario_outcome", key, "t_scn_break_even",
                                         {key: str(v), "pct_display": fmt.percent(v, 0),
                                          "horizon_word": words[key]}, evs))
    return out


def alternatives_claims(ctx: _Ctx, cf: Any, limit: int = 6) -> list[str | None]:
    out: list[str | None] = []
    if cf is None:
        return out
    alts = {_get(a, "alt_id"): a for a in _get(cf, "alternatives") or []}
    order = [aid for aid in (_get(cf, "pareto_set") or []) if aid in alts] or list(alts)
    count = 0
    for aid in order:
        alt = alts[aid]
        if _get(alt, "is_base") or not _get(alt, "feasible", True):
            continue
        m = _get(alt, "metrics") or {}
        pay, fc, sap = m.get("monthly_payment"), m.get("finance_charge"), m.get("savings_after_purchase")
        if fmt.dec(pay) is None or fmt.dec(fc) is None:
            continue
        flags = list(_get(alt, "assumption_flags") or [])
        values: dict[str, Any] = {"alt_id": aid, "label": _get(alt, "label"), "monthly_payment": str(pay),
                                  "payment_display": fmt.dollars(pay), "finance_charge": str(fc),
                                  "fc_display": fmt.dollars(fc), "assumption_flags": flags}
        evs = [ctx.ev_alt(aid)] + [ctx.ev_asm(f) for f in flags]
        if flags:
            values["flags_text"] = "; ".join(ASSUMPTION_FLAG_TEXT.get(f, f.replace("_", " ")) for f in flags)
        has_sap = fmt.dec(sap) is not None
        if has_sap:
            values.update({"savings_after_purchase": str(sap), "sap_display": fmt.dollars(sap)})
        tid = {(False, False): "t_alt", (True, False): "t_alt_flags", (False, True): "t_alt_savings",
               (True, True): "t_alt_flags_savings"}[(bool(flags), has_sap)]
        cid = ctx.claim(f"cl_alt_{aid}", "comparison", "alternative", tid, values, evs, flags)
        if cid:
            out.append(cid)
            count += 1
        if count >= limit:
            break
    rs = _get(cf, "rate_sensitivity")
    fcd = _get(rs, "per_point_finance_charge_delta")
    if fmt.dec(fcd) is not None:
        pd = _get(rs, "per_point_monthly_payment_delta")
        values = {"per_point_finance_charge_delta": str(fcd), "fc_display": fmt.dollars(fcd)}
        tid = "t_alt_rate"
        if fmt.dec(pd) is not None:
            values.update({"per_point_monthly_payment_delta": str(pd), "payment_display": fmt.dollars(pd)})
            tid = "t_alt_rate_payment"
        out.append(ctx.claim(_get(rs, "statement_claim_id") or "cl_rate_1pt", "comparison", "finance_charge", tid,
                             values, [ctx.ev_calc(formula_id="F03")]))
    if any(out):
        out.append(ctx.claim("cl_alt_note", "value", "alternative", "t_alt_note", {},
                             [ctx.ev_asm("a_what_if", "Alternatives are what-if calculations under the stated "
                                                      "assumptions, not predictions.")], ["a_what_if"]))
    return out


def _reason(key: str) -> str:
    try:
        from engine.requirements import DEBT_ITEM_RE, REASONS
    except Exception:  # noqa: BLE001
        REASONS, DEBT_ITEM_RE = {}, None
    if key in REASONS:
        return REASONS[key]
    if DEBT_ITEM_RE is not None:
        m = DEBT_ITEM_RE.match(key)
        if m:
            return f"the {m.group('field').replace('_', ' ')} for debt {m.group('id')}"
    return key.replace(".", " ").replace("_", " ")


def _join(names: list[str]) -> str:
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " and " + names[-1]


def missing_info(ctx: _Ctx, readiness: list | None) -> tuple[list[str | None], list[MissingInfoItem]]:
    claims: list[str | None] = []
    items: list[MissingInfoItem] = []
    by_key: dict[str, dict[str, Any]] = {}
    awaiting: list[str] = []
    for r in readiness or []:
        if _get(r, "available"):
            continue
        aid = _s(_get(r, "analysis_id"))
        if _get(r, "awaiting_offer"):
            awaiting.append(aid)
        for status, keys in (("missing", _get(r, "missing") or []), ("declined", _get(r, "declined") or [])):
            for key in keys:
                entry = by_key.setdefault(key, {"status": status, "analyses": []})
                if aid not in entry["analyses"]:
                    entry["analyses"].append(aid)
    for key, entry in by_key.items():
        names = [ANALYSIS_NAMES.get(a, a) for a in entry["analyses"]]
        reason = _reason(key)
        why = f"Needed for {_join(names)}."
        if entry["status"] == "declined":
            why += " You chose not to share it, so these are not shown."
        items.append(MissingInfoItem(fact_key=key, why_it_matters=why))
        evs = [ctx.ev_readiness()]
        f = ctx.facts.get(key)
        if f is not None and _get(f, "fact_id"):
            evs.append(ctx.ev_fact(f))
        claims.append(ctx.claim(f"cl_missing_{key}", "missing", key,
                                "t_declined" if entry["status"] == "declined" else "t_missing",
                                {"fact_key": key, "reason": reason, "analyses_text": _join(names),
                                 "analyses": entry["analyses"]}, evs))
    if awaiting and ctx.offer is None:
        names = [ANALYSIS_NAMES.get(a, a) for a in awaiting]
        claims.append(ctx.claim("cl_missing_offer", "missing", "offer.minimum_set", "t_missing_offer",
                                {"analyses_text": _join(names), "analyses": awaiting}, [ctx.ev_readiness()]))
    if ctx.offer is not None:
        items.append(MissingInfoItem(
            fact_key="loan.buy_rate", ask_the_lender=True, citation=LENDER_BUY_RATE_CITATION,
            why_it_matters=("Dealers can add to the rate the lender approved; knowing the buy rate shows how much "
                            "of your rate is dealer markup and gives you something to negotiate.")))
        evs = [ctx.ev_ext(LENDER_BUY_RATE_CITATION), ctx.ev_term("contract_rate") or ctx.ev_term("apr")]
        claims.append(ctx.claim("cl_lender_buy_rate", "missing", "loan.buy_rate", "t_lender_buy_rate",
                                {"fact_key": "loan.buy_rate", "citation": LENDER_BUY_RATE_CITATION}, evs))
        for i, item in enumerate(_get(ctx.offer, "itemization") or []):
            if _get(item, "item") != "add_on" or _get(item, "optional") is not None:
                continue
            name = _get(item, "name") or "add-on product"
            key = f"offer.add_on.{i}"
            items.append(MissingInfoItem(
                fact_key=key, ask_the_lender=True, citation=ADD_ON_CITATION,
                why_it_matters=(f"It is not known whether the {name} is optional. Optional add-ons can be removed, "
                                "which lowers the amount financed.")))
            claims.append(ctx.claim(f"cl_lender_add_on_{i}", "missing", key, "t_lender_add_on",
                                    {"fact_key": key, "name": name, "citation": ADD_ON_CITATION},
                                    [ctx.ev_ext(ADD_ON_CITATION)]))
    return claims, items


# --------------------------------------------------------------------------- assembly
SECTION_TITLES = {
    "key_points": "Key points", "loan_cost": "What this loan costs", "with_this_loan": "With this loan",
    "stress": "Under stress (illustrative)", "alternatives": "Alternatives (what-if)",
    "missing_info": "Missing information and questions for the lender",
}


def _section(ctx: _Ctx, section_id: str, claim_ids: list[str | None]) -> ExplanationSection | None:
    ids = [c for c in dict.fromkeys(claim_ids) if c and c in ctx.claims]
    if not ids:
        return None
    kinds: list[str] = []
    for cid in ids:
        for eid in ctx.claims[cid].evidence_ids:
            k = _s(ctx.evidence[eid].kind)
            if k not in kinds:
                kinds.append(k)
    return ExplanationSection(section_id=section_id, title=SECTION_TITLES[section_id], claims=ids,
                              template_text=" ".join(ctx.claims[c].text for c in ids), provenance_tags=kinds)


def _load_assumption_texts() -> dict[str, dict]:
    try:
        from engine import assumptions_payload
        payload = assumptions_payload()
    except Exception:  # noqa: BLE001 - optional enrichment only
        return {}
    items = payload.get("assumptions") if isinstance(payload, Mapping) else None
    out: dict[str, dict] = {}
    if isinstance(items, Mapping):
        items = [{"assumption_id": k, **(v if isinstance(v, Mapping) else {"text": v})} for k, v in items.items()]
    for it in items or []:
        if isinstance(it, Mapping) and it.get("assumption_id") and it.get("text"):
            out[str(it["assumption_id"])] = dict(it)
    return out


def build_explanations(facts, offer, baseline, with_offer, scenarios, resilience, counterfactual,
                       readiness) -> Explanations:
    ctx = _Ctx(facts or {}, offer, baseline, with_offer)

    cost_id = kp_cost(ctx) if _available(readiness, "loan_cost") else None
    cash_id, deficit_before = kp_cashflow(ctx) if _available(readiness, "cashflow_impact") else (None, False)
    reserve_id = kp_reserve(ctx) if _available(readiness, "reserve_impact") else None
    ranked = [cash_id, cost_id, reserve_id] if deficit_before else [cost_id, cash_id, reserve_id]
    key_points = [c for c in ranked if c]

    loan = loan_cost_claims(ctx) if _available(readiness, "loan_cost") else []
    with_loan = with_loan_claims(ctx, readiness)
    stress = stress_claims(ctx, scenarios, resilience) if _available(readiness, "stress_test") else []
    alts = alternatives_claims(ctx, counterfactual) if _available(readiness, "alternatives") else []
    miss_claims, miss_items = missing_info(ctx, readiness)

    # assumptions used by the calculations themselves
    for calc in (baseline, with_offer):
        for aid in _get(calc, "assumptions_used") or []:
            ctx.assumption(aid)
    texts = _load_assumption_texts()
    for aid, a in list(ctx.assumptions.items()):
        if aid in texts and (a.text == aid or aid in KNOWN_ASSUMPTIONS and a.text == KNOWN_ASSUMPTIONS[aid]):
            ctx.assumptions[aid] = Assumption(assumption_id=aid, text=texts[aid]["text"],
                                              citation=texts[aid].get("citation") or a.citation)

    sections = [s for s in (
        _section(ctx, "key_points", key_points), _section(ctx, "loan_cost", loan),
        _section(ctx, "with_this_loan", with_loan), _section(ctx, "stress", stress),
        _section(ctx, "alternatives", alts), _section(ctx, "missing_info", miss_claims)) if s is not None]

    return Explanations(claims=list(ctx.claims.values()), evidence=list(ctx.evidence.values()), sections=sections,
                        key_points=key_points, missing_information=miss_items,
                        assumptions=list(ctx.assumptions.values()))
