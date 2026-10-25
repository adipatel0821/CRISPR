"""Repository functions. Every query is scoped by `session_id`; there are no cross-session reads."""
from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timezone

from sqlmodel import Session, delete, select

from schemas.contracts import (Acknowledgement, DecisionReport, DocumentStatus, FinancialFact, LoanOffer)
from storage.models import (IDEMPOTENCY_TTL, SESSION_TTL, SESSION_SCOPED_TABLES, AcknowledgementRow, DocumentRow, FactRow,
                            IdempotencyRow, LlmCallRow, OfferRow, QuestionLogRow, ReportRow, SessionRow, SkipRow)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------- sessions
def create_session(db: Session, decision_type: str, selected: list[str], data_mode: str) -> tuple[SessionRow, str]:
    token = secrets.token_urlsafe(32)          # 32 bytes = 256 bits
    now = datetime.now(timezone.utc)
    row = SessionRow(token_hash=hash_token(token), decision_type=decision_type, created_at=now,
                     expires_at=now + SESSION_TTL,
                     selected_analyses_json=json.dumps(list(selected)), data_mode=data_mode)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, token


def session_by_token(db: Session, token: str) -> SessionRow | None:
    return db.exec(select(SessionRow).where(SessionRow.token_hash == hash_token(token))).first()


def is_expired(row: SessionRow, now: datetime | None = None) -> bool:
    return _aware(row.expires_at) <= (now or datetime.now(timezone.utc))


def selected_analyses(row: SessionRow) -> list[str]:
    return list(json.loads(row.selected_analyses_json or "[]"))


def bump_profile_version(db: Session, row: SessionRow) -> int:
    row.profile_version += 1
    db.add(row)
    return row.profile_version


def purge_session(db: Session, session_id: str) -> dict[str, int]:
    """Delete every row for the session, including llm_calls (A-15). Returns counts per table."""
    counts: dict[str, int] = {}
    for model in SESSION_SCOPED_TABLES:
        res = db.exec(delete(model).where(model.session_id == session_id))  # type: ignore[attr-defined]
        counts[model.__tablename__] = res.rowcount or 0
    res = db.exec(delete(SessionRow).where(SessionRow.id == session_id))
    counts["sessions"] = res.rowcount or 0
    db.commit()
    return counts


def count_rows(db: Session, session_id: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for model in SESSION_SCOPED_TABLES:
        out[model.__tablename__] = len(db.exec(select(model).where(model.session_id == session_id)).all())  # type: ignore[attr-defined]
    out["sessions"] = len(db.exec(select(SessionRow).where(SessionRow.id == session_id)).all())
    return out


# --------------------------------------------------------------------------- facts (append-only ledger)
def list_facts(db: Session, session_id: str) -> list[FinancialFact]:
    rows = db.exec(select(FactRow).where(FactRow.session_id == session_id).order_by(FactRow.seq)).all()
    return [FinancialFact.model_validate_json(r.data_json) for r in rows]


def add_facts(db: Session, session_id: str, new_facts: list[FinancialFact], superseded_ids: list[str]) -> None:
    if superseded_ids:
        for row in db.exec(select(FactRow).where(FactRow.session_id == session_id,
                                                 FactRow.fact_id.in_(list(superseded_ids)))).all():  # type: ignore[attr-defined]
            fact = FinancialFact.model_validate_json(row.data_json)
            fact.status = "superseded"
            row.status = "superseded"
            row.data_json = fact.model_dump_json()
            db.add(row)
    seq = len(db.exec(select(FactRow.fact_id).where(FactRow.session_id == session_id)).all())
    for fact in new_facts:
        if fact.session_id != session_id:
            raise ValueError("fact belongs to another session")
        seq += 1
        db.add(FactRow(fact_id=fact.fact_id, session_id=session_id, key=fact.key,
                       status=str(getattr(fact.status, "value", fact.status)), seq=seq,
                       data_json=fact.model_dump_json()))


# --------------------------------------------------------------------------- acknowledgements / skips / log
def list_acknowledgements(db: Session, session_id: str) -> list[Acknowledgement]:
    rows = db.exec(select(AcknowledgementRow).where(AcknowledgementRow.session_id == session_id)
                   .order_by(AcknowledgementRow.id)).all()
    return [Acknowledgement.model_validate_json(r.data_json) for r in rows]


def add_acknowledgement(db: Session, session_id: str, ack: Acknowledgement) -> None:
    db.add(AcknowledgementRow(session_id=session_id, rule_id=ack.rule_id, data_json=ack.model_dump_json()))


def skipped_keys(db: Session, session_id: str) -> set[str]:
    return {r.fact_key for r in db.exec(select(SkipRow).where(SkipRow.session_id == session_id)).all()}


def add_skip(db: Session, session_id: str, fact_key: str, pass_no: int = 1) -> None:
    db.add(SkipRow(session_id=session_id, fact_key=fact_key, pass_no=pass_no))


def log_question(db: Session, session_id: str, question_id: str, fact_key: str | None, outcome: str) -> None:
    db.add(QuestionLogRow(session_id=session_id, question_id=question_id, fact_key=fact_key, outcome=outcome))


def log_llm_call(db: Session, session_id: str, prompt_hash: str, latency_ms: int | None, outcome: str) -> None:
    db.add(LlmCallRow(session_id=session_id, prompt_hash=prompt_hash, latency_ms=latency_ms, outcome=outcome))


# --------------------------------------------------------------------------- documents
def save_document(db: Session, status: DocumentStatus) -> None:
    row = db.get(DocumentRow, status.doc_id)
    if row is None:
        row = DocumentRow(doc_id=status.doc_id, session_id=status.session_id, data_json=status.model_dump_json())
    elif row.session_id != status.session_id:
        raise ValueError("document belongs to another session")
    else:
        row.data_json = status.model_dump_json()
    db.add(row)


def get_document(db: Session, session_id: str, doc_id: str) -> DocumentStatus | None:
    row = db.exec(select(DocumentRow).where(DocumentRow.doc_id == doc_id,
                                            DocumentRow.session_id == session_id)).first()
    return DocumentStatus.model_validate_json(row.data_json) if row else None


# --------------------------------------------------------------------------- offers
def save_offer(db: Session, offer: LoanOffer) -> None:
    row = db.get(OfferRow, offer.offer_id)
    if row is not None and row.session_id != offer.session_id:
        raise ValueError("offer belongs to another session")
    if row is None:
        seq = len(db.exec(select(OfferRow.offer_id).where(OfferRow.session_id == offer.session_id)).all()) + 1
        row = OfferRow(offer_id=offer.offer_id, session_id=offer.session_id, seq=seq,
                       ready=bool(offer.ready_for_calculation), data_json=offer.model_dump_json())
    else:
        row.ready = bool(offer.ready_for_calculation)
        row.data_json = offer.model_dump_json()
    db.add(row)


def list_offers(db: Session, session_id: str) -> list[LoanOffer]:
    rows = db.exec(select(OfferRow).where(OfferRow.session_id == session_id).order_by(OfferRow.seq)).all()
    return [LoanOffer.model_validate_json(r.data_json) for r in rows]


def get_offer(db: Session, session_id: str, offer_id: str) -> LoanOffer | None:
    row = db.exec(select(OfferRow).where(OfferRow.offer_id == offer_id, OfferRow.session_id == session_id)).first()
    return LoanOffer.model_validate_json(row.data_json) if row else None


def latest_ready_offer(db: Session, session_id: str) -> LoanOffer | None:
    ready = [o for o in list_offers(db, session_id) if o.ready_for_calculation]
    return ready[-1] if ready else None


# --------------------------------------------------------------------------- reports (immutable)
def save_report(db: Session, report: DecisionReport) -> None:
    if db.get(ReportRow, report.report_id) is not None:
        raise ValueError("reports are immutable")
    db.add(ReportRow(report_id=report.report_id, session_id=report.session_id, data_json=report.model_dump_json()))


def get_report(db: Session, session_id: str, report_id: str) -> DecisionReport | None:
    row = db.exec(select(ReportRow).where(ReportRow.report_id == report_id,
                                          ReportRow.session_id == session_id)).first()
    return DecisionReport.model_validate_json(row.data_json) if row else None


def latest_report_id(db: Session, session_id: str) -> str | None:
    row = db.exec(select(ReportRow).where(ReportRow.session_id == session_id)
                  .order_by(ReportRow.created_at.desc())).first()  # type: ignore[attr-defined]
    return row.report_id if row else None


# --------------------------------------------------------------------------- idempotency
def get_idempotent(db: Session, session_id: str, route: str, key: str) -> IdempotencyRow | None:
    row = db.exec(select(IdempotencyRow).where(IdempotencyRow.session_id == session_id,
                                               IdempotencyRow.route == route,
                                               IdempotencyRow.key == key)).first()
    if row is None:
        return None
    if _aware(row.created_at) + IDEMPOTENCY_TTL <= datetime.now(timezone.utc):
        db.delete(row)
        db.commit()
        return None
    return row


def save_idempotent(db: Session, session_id: str, route: str, key: str, response_json: str,
                    status_code: int = 200) -> None:
    db.add(IdempotencyRow(key=key, session_id=session_id, route=route, response_json=response_json,
                          status_code=status_code))
