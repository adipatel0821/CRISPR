"""Sessions, typed facts, adaptive questions, readiness (contracts §4)."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Body, Depends, Response
from sqlmodel import Session

from api import adapters, service
from api.deps import data_mode, session_for_path
from api.errors import ErrorMappingRoute, validation
from schemas.contracts import (Acknowledgement, AnalysisReadiness, FactsRequest, NextQuestionResponse,
                               QuestionResponse, SessionCreate, SessionCreated, SessionView)
from storage import repo
from storage.db import get_db
from storage.models import SessionRow

router = APIRouter(prefix="/api/v1", route_class=ErrorMappingRoute, tags=["sessions"])


@router.post("/sessions", response_model=SessionCreated, status_code=201)
def create_session(body: SessionCreate | None = Body(default=None), db: Session = Depends(get_db)) -> SessionCreated:
    body = body or SessionCreate()
    selected = [str(getattr(a, "value", a)) for a in body.selected_analyses]
    if not selected:
        raise validation("selected_analyses: choose at least one analysis.")
    row, token = repo.create_session(db, str(getattr(body.decision_type, "value", body.decision_type)),
                                     list(dict.fromkeys(selected)), data_mode())
    return SessionCreated(session_id=row.id, token=token, data_mode=row.data_mode,
                          selected_analyses=repo.selected_analyses(row), created_at=row.created_at)


@router.get("/sessions/{session_id}", response_model=SessionView)
def read_session(row: SessionRow = Depends(session_for_path), db: Session = Depends(get_db)) -> SessionView:
    return service.session_view(db, row)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(row: SessionRow = Depends(session_for_path), db: Session = Depends(get_db)) -> Response:
    repo.purge_session(db, row.id)
    return Response(status_code=204)


def _guard_negative(body: FactsRequest) -> None:
    """No ontology fact accepts a negative number (contracts §5: currency >= 0). Checked here as defence in depth;
    the intake ledger performs the full typed validation."""
    problems = []
    for item in body.facts:
        if item.value is None:
            continue
        try:
            value = Decimal(str(item.value).replace(",", "").replace("$", "").strip())
        except InvalidOperation:
            continue
        if value.is_finite() and value < 0:
            problems.append({"field": item.key, "message": f"{item.key}: must be zero or more (got a negative "
                                                           f"number). Enter the amount without a minus sign."})
    if problems:
        raise validation("; ".join(p["message"] for p in problems), {"fields": problems})


@router.post("/sessions/{session_id}/facts", response_model=SessionView)
def post_facts(body: FactsRequest, row: SessionRow = Depends(session_for_path),
               db: Session = Depends(get_db)) -> SessionView:
    _guard_negative(body)
    state = service.load_state(db, row)
    if body.facts:
        update = adapters.apply_inputs(row.id, state.all_facts, list(body.facts))
        repo.add_facts(db, row.id, list(update.new_facts), list(update.superseded_ids))
    if body.acknowledge_rules:
        db.flush()
        current = adapters.current_facts(repo.list_facts(db, row.id))
        snapshot = sorted(f.fact_id for f in current.values())
        known = {a.rule_id for a in state.acknowledgements}
        for rule_id in dict.fromkeys(body.acknowledge_rules):
            if rule_id not in known:
                repo.add_acknowledgement(db, row.id, Acknowledgement(rule_id=rule_id, fact_ids=snapshot))
    repo.bump_profile_version(db, row)
    db.commit()
    db.refresh(row)
    return service.session_view(db, row)


@router.get("/sessions/{session_id}/next-question", response_model=NextQuestionResponse)
def get_next_question(row: SessionRow = Depends(session_for_path),
                      db: Session = Depends(get_db)) -> NextQuestionResponse:
    state = service.load_state(db, row)
    nq = adapters.next_question(state.facts, state.selected, state.offer, state.acknowledgements, state.skipped)
    nq.profile_version = row.profile_version
    return nq


@router.post("/sessions/{session_id}/answers", response_model=NextQuestionResponse)
def post_answer(body: QuestionResponse, row: SessionRow = Depends(session_for_path),
                db: Session = Depends(get_db)) -> NextQuestionResponse:
    """Apply one answer (or skip / decline / estimate) and return the next question."""
    state = service.load_state(db, row)
    cand = adapters.find_candidate(body.question_id, state.facts, state.selected, state.offer,
                                   state.acknowledgements, state.skipped)
    if cand is None:
        raise validation("question_id: this question is no longer pending; fetch /next-question and answer that one.",
                         {"question_id": body.question_id})
    outcome = adapters.apply_answer(row.id, cand, body, state.all_facts)
    repo.add_facts(db, row.id, list(outcome.new_facts or []), list(outcome.superseded_ids or []))
    known = {a.rule_id for a in state.acknowledgements}
    for ack in outcome.acknowledgements or []:
        if ack.rule_id not in known:
            repo.add_acknowledgement(db, row.id, ack)
    if outcome.skipped_key:
        repo.add_skip(db, row.id, outcome.skipped_key)
    kind = ("declined" if body.declined else "skipped" if body.skipped
            else "estimate" if body.marked_estimate else "answered")
    repo.log_question(db, row.id, cand.question_id, cand.fact_key, kind)
    repo.bump_profile_version(db, row)
    db.commit()
    db.refresh(row)
    state = service.load_state(db, row)
    nq = adapters.next_question(state.facts, state.selected, state.offer, state.acknowledgements, state.skipped)
    nq.profile_version = row.profile_version
    return nq


@router.get("/sessions/{session_id}/readiness", response_model=list[AnalysisReadiness])
def get_readiness(row: SessionRow = Depends(session_for_path),
                  db: Session = Depends(get_db)) -> list[AnalysisReadiness]:
    state = service.load_state(db, row)
    return adapters.readiness(state.facts, state.selected, state.offer)
