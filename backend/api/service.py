"""Session state assembly + the /analysis orchestration (INTERFACES.md). No arithmetic happens here."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from sqlmodel import Session

from api import adapters
from api.errors import ApiError, map_domain_error, not_found
from schemas.contracts import (Acknowledgement, AnalysisReadiness, Conflict, DecisionReport, FinancialFact,
                               FinancialProfile, LoanOffer, SessionView)
from storage import repo
from storage.models import SessionRow, new_id

log = logging.getLogger("decisiontwin.api")


@dataclass
class SessionState:
    row: SessionRow
    all_facts: list[FinancialFact]
    facts: dict[str, FinancialFact]
    acknowledgements: list[Acknowledgement]
    offers: list[LoanOffer]
    offer: LoanOffer | None            # latest ready offer, else latest offer, else None
    skipped: set[str]

    @property
    def selected(self) -> list[str]:
        return repo.selected_analyses(self.row)


def choose_offer(offers: list[LoanOffer]) -> LoanOffer | None:
    ready = [o for o in offers if o.ready_for_calculation]
    if ready:
        return ready[-1]
    return offers[-1] if offers else None


def load_state(db: Session, row: SessionRow) -> SessionState:
    all_facts = repo.list_facts(db, row.id)
    facts = dict(adapters.current_facts(all_facts))
    offers = repo.list_offers(db, row.id)
    return SessionState(row=row, all_facts=all_facts, facts=facts,
                        acknowledgements=repo.list_acknowledgements(db, row.id), offers=offers,
                        offer=choose_offer(offers), skipped=repo.skipped_keys(db, row.id))


def _conflicts(facts: dict[str, FinancialFact]) -> list[Conflict]:
    out = []
    for key, fact in facts.items():
        if str(getattr(fact.status, "value", fact.status)) == "conflicting":
            out.append(Conflict(rule_id="conflicting_value", fact_keys=[key],
                                message="Two different values were given for this item; please choose one."))
    return out


def profile(state: SessionState) -> FinancialProfile:
    return FinancialProfile(session_id=state.row.id, decision_type=state.row.decision_type,
                            selected_analyses=state.selected, facts=state.facts,
                            readiness=adapters.readiness(state.facts, state.selected, state.offer),
                            acknowledgements=state.acknowledgements, conflicts=_conflicts(state.facts),
                            profile_version=state.row.profile_version)


def session_view(db: Session, row: SessionRow) -> SessionView:
    state = load_state(db, row)
    return SessionView(profile=profile(state), offers=state.offers, data_mode=row.data_mode,
                       latest_report_id=repo.latest_report_id(db, row.id))


# --------------------------------------------------------------------------- analysis orchestration
def _stage(name: str, request_id: str | None, fn, *args, **kwargs):
    """Run one optional stage. Domain errors propagate (they map to 4xx); anything else is logged and the stage
    is omitted so a partial report is still returned (never a 500 for a missing optional analysis)."""
    try:
        return fn(*args, **kwargs)
    except ApiError:
        raise
    except Exception as exc:  # noqa: BLE001
        if map_domain_error(exc) is not None:
            raise
        log.error("analysis stage failed stage=%s request_id=%s type=%s", name, request_id, type(exc).__name__)
        return None


def _available(readiness: list[AnalysisReadiness], analysis_id: str) -> bool:
    return any(str(getattr(r.analysis_id, "value", r.analysis_id)) == analysis_id and r.available
               for r in readiness)


def _profile_summary(state: SessionState) -> dict[str, Any]:
    return {
        "profile_version": state.row.profile_version,
        "selected_analyses": state.selected,
        "facts": {k: {"value": f.value, "status": str(getattr(f.status, "value", f.status)),
                      "verification": str(getattr(f.verification, "value", f.verification)),
                      "source_kind": str(getattr(f.source_kind, "value", f.source_kind)), "fact_id": f.fact_id}
                  for k, f in sorted(state.facts.items())},
    }


def run_analysis(db: Session, row: SessionRow, offer_id: str | None, request_id: str | None) -> DecisionReport:
    state = load_state(db, row)
    ready_offers = [o for o in state.offers if o.ready_for_calculation]
    if offer_id:
        offer = next((o for o in state.offers if o.offer_id == offer_id), None)
        if offer is None:
            raise not_found("Offer")
    else:
        offer = ready_offers[-1] if ready_offers else None
    readiness = adapters.readiness(state.facts, state.selected, offer)
    if offer is None or not offer.ready_for_calculation:
        raise ApiError(422, "INSUFFICIENT_INFORMATION",
                       "A loan offer with amount, rate and term is needed before the analysis can run.",
                       {"readiness": [r.model_dump(mode="json") for r in readiness]})

    pv = row.profile_version
    baseline = _stage("baseline", request_id, adapters.compute, state.facts, None, profile_version=pv)
    with_offer = _stage("with_offer", request_id, adapters.compute, state.facts, offer, profile_version=pv)

    scenarios, resilience = [], None
    if _available(readiness, "stress_test"):
        out = _stage("scenarios", request_id, adapters.run_catalog, state.facts, offer)
        if out is not None:
            scenarios, resilience = list(out[0]), out[1]

    counterfactual = None
    if _available(readiness, "alternatives"):
        competing = [o for o in ready_offers if o.offer_id != offer.offer_id]
        counterfactual = _stage("counterfactual", request_id, adapters.evaluate_counterfactual,
                                state.facts, offer, competing)

    expl = None
    if baseline is not None or with_offer is not None:
        expl = _stage("explain", request_id, adapters.build_explanations, state.facts, offer, baseline, with_offer,
                      scenarios, resilience, counterfactual, readiness)

    report = DecisionReport(
        report_id=new_id("r_"), session_id=row.id, data_mode=row.data_mode, readiness=readiness,
        profile_summary=_profile_summary(state), offer=offer, baseline=baseline, with_offer=with_offer,
        scenarios=scenarios, resilience=resilience, counterfactual=counterfactual,
    )
    if expl is not None:
        report.key_points = list(expl.key_points)
        report.claims = list(expl.claims)
        report.evidence = list(expl.evidence)
        report.explanations = list(expl.sections)
        report.assumptions = list(expl.assumptions)
        report.missing_information = list(expl.missing_information)
    repo.save_report(db, report)
    db.commit()
    return report
