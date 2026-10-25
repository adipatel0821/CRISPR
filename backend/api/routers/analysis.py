"""Analysis orchestration, reports, deferred narration, config and health (contracts §4)."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Header, Request
from fastapi.responses import JSONResponse
from sqlmodel import Session

from api import adapters, service
from api.deps import current_session, data_mode, session_for_path
from api.errors import ApiError, ErrorMappingRoute, not_found, request_id
from schemas.contracts import AnalysisRequest, DecisionReport, HealthResponse
from storage import repo
from storage.db import get_db, ping
from storage.models import SessionRow

router = APIRouter(prefix="/api/v1", route_class=ErrorMappingRoute, tags=["analysis"])


@router.post("/sessions/{session_id}/analysis", response_model=DecisionReport)
def post_analysis(request: Request, body: AnalysisRequest | None = Body(default=None),
                  idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
                  row: SessionRow = Depends(session_for_path), db: Session = Depends(get_db)):
    route = "POST /analysis"
    if idempotency_key:
        hit = repo.get_idempotent(db, row.id, route, idempotency_key)
        if hit is not None:
            return JSONResponse(content=DecisionReport.model_validate_json(hit.response_json).model_dump(mode="json"),
                                status_code=hit.status_code)
    report = service.run_analysis(db, row, (body or AnalysisRequest()).offer_id, request_id(request))
    if idempotency_key:
        repo.save_idempotent(db, row.id, route, idempotency_key, report.model_dump_json())
        db.commit()
    return report


@router.get("/reports/{report_id}", response_model=DecisionReport)
def get_report(report_id: str, row: SessionRow = Depends(current_session),
               db: Session = Depends(get_db)) -> DecisionReport:
    report = repo.get_report(db, row.id, report_id)
    if report is None:
        raise not_found("Report")
    return report


@router.post("/reports/{report_id}/explain")
def explain_report(report_id: str, row: SessionRow = Depends(current_session), db: Session = Depends(get_db)):
    if repo.get_report(db, row.id, report_id) is None:
        raise not_found("Report")
    raise ApiError(501, "NOT_IMPLEMENTED",
                   "AI narration is deferred in this version; the report's template explanations are complete.")


@router.get("/config/assumptions")
def get_assumptions() -> dict:
    return adapters.assumptions_payload()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    db_ok = ping()
    return HealthResponse(status="ok" if db_ok else "degraded", db=db_ok,
                          llm_configured=adapters.llm_configured(), data_mode=data_mode())
