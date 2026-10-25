"""Shared dependencies: settings, DB session, bearer-token auth scoped to one session."""
from __future__ import annotations

import os

from fastapi import Depends, Header, Request
from sqlmodel import Session

from api.errors import not_found, unauthorized
from schemas.contracts import LlmDataMode, data_mode_from_env
from storage import repo
from storage.db import get_db
from storage.models import SessionRow

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
VALID_MODES = {m.value for m in LlmDataMode}


def data_mode() -> str:
    """LLM_DATA_MODE (default synthetic_only). Invalid values fall back to 'off' — the safest mode (D0-005)."""
    return data_mode_from_env(os.getenv("LLM_DATA_MODE")).value


def data_mode_valid() -> bool:
    raw = os.getenv("LLM_DATA_MODE")
    return raw is None or raw.strip().lower() in VALID_MODES


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS") or "http://localhost:3000"
    return [o.strip() for o in raw.split(",") if o.strip()]


def _bearer(authorization: str | None) -> str:
    if not authorization:
        raise unauthorized()
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise unauthorized()
    return token.strip()


def current_session(request: Request, authorization: str | None = Header(default=None),
                    db: Session = Depends(get_db)) -> SessionRow:
    """Resolve the bearer token to its session (401 when missing/unknown/expired)."""
    row = repo.session_by_token(db, _bearer(authorization))
    if row is None:
        raise unauthorized()
    if repo.is_expired(row):
        raise unauthorized("This session has expired. Start a new session.")
    request.state.session_id = row.id
    return row


def session_for_path(session_id: str, row: SessionRow = Depends(current_session)) -> SessionRow:
    """A token for session A used on session B's resources -> 404 (no existence leak, A-18)."""
    if row.id != session_id:
        raise not_found("Session")
    return row
