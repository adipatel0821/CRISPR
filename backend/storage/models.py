"""SQLModel tables. Every row is keyed by `session_id`; JSON payloads are the contract models serialised with
`model_dump_json()` (string decimals preserved). Uploaded bytes are never stored (system_architecture.md §9).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlmodel import Field, SQLModel

SESSION_TTL = timedelta(hours=24)
IDEMPOTENCY_TTL = timedelta(hours=24)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}{uuid4().hex}"


class SessionRow(SQLModel, table=True):
    __tablename__ = "sessions"
    id: str = Field(default_factory=lambda: new_id("s_"), primary_key=True)
    token_hash: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=_now)
    expires_at: datetime = Field(default_factory=lambda: _now() + SESSION_TTL)
    decision_type: str = "AUTO_LOAN"
    selected_analyses_json: str = "[]"
    data_mode: str = "synthetic_only"
    profile_version: int = 0


class FactRow(SQLModel, table=True):
    __tablename__ = "facts"
    fact_id: str = Field(primary_key=True)
    session_id: str = Field(index=True)
    key: str = Field(index=True)
    status: str
    seq: int = 0                    # insertion order within the session (append-only ledger)
    data_json: str                  # FinancialFact


class AcknowledgementRow(SQLModel, table=True):
    __tablename__ = "acknowledgements"
    id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    rule_id: str
    data_json: str                  # Acknowledgement


class SkipRow(SQLModel, table=True):
    __tablename__ = "skips"
    id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    fact_key: str
    pass_no: int = 1
    created_at: datetime = Field(default_factory=_now)


class QuestionLogRow(SQLModel, table=True):
    __tablename__ = "question_log"
    id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    question_id: str
    fact_key: str | None = None
    outcome: str                    # answered | skipped | declined | estimate
    created_at: datetime = Field(default_factory=_now)


class DocumentRow(SQLModel, table=True):
    __tablename__ = "documents"
    doc_id: str = Field(primary_key=True)
    session_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=_now)
    data_json: str                  # DocumentStatus


class OfferRow(SQLModel, table=True):
    __tablename__ = "offers"
    offer_id: str = Field(primary_key=True)
    session_id: str = Field(index=True)
    seq: int = 0
    ready: bool = False
    created_at: datetime = Field(default_factory=_now)
    data_json: str                  # LoanOffer


class ReportRow(SQLModel, table=True):
    __tablename__ = "reports"
    report_id: str = Field(primary_key=True)
    session_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=_now)
    data_json: str                  # DecisionReport (immutable once written)


class LlmCallRow(SQLModel, table=True):
    __tablename__ = "llm_calls"
    id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    prompt_hash: str
    latency_ms: int | None = None
    outcome: str
    created_at: datetime = Field(default_factory=_now)


class IdempotencyRow(SQLModel, table=True):
    __tablename__ = "idempotency"
    id: int | None = Field(default=None, primary_key=True)
    key: str = Field(index=True)
    session_id: str = Field(index=True)
    route: str
    status_code: int = 200
    response_json: str
    created_at: datetime = Field(default_factory=_now)


SESSION_SCOPED_TABLES = [FactRow, AcknowledgementRow, SkipRow, QuestionLogRow, DocumentRow, OfferRow, ReportRow,
                         LlmCallRow, IdempotencyRow]
