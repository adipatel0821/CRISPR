"""SQLite (SQLModel) engine for DecisionTwin. Only `api` and `storage` touch the database.

* `DATABASE_URL` env var; default `sqlite:///<backend>/data/decisiontwin.db` (folder created on demand).
* WAL journal mode for file-backed SQLite (system_architecture.md §10).
* Tests call `configure(url)` (e.g. a tmp file or "sqlite://" in-memory) before creating the app client.
"""
from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "decisiontwin.db"

_engine: Engine | None = None
_url: str | None = None


def default_url() -> str:
    return f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"


def resolve_url(url: str | None = None) -> str:
    """Resolve the configured URL. Relative sqlite paths (`sqlite:///./data/x.db`) are anchored at backend/."""
    url = url or os.getenv("DATABASE_URL") or default_url()
    prefix = "sqlite:///"
    if url.startswith(prefix):
        raw = url[len(prefix):]
        if raw and raw != ":memory:" and not Path(raw).is_absolute():
            url = prefix + (BACKEND_DIR / raw).resolve().as_posix()
    return url


def _is_memory(url: str) -> bool:
    return url in ("sqlite://", "sqlite:///:memory:") or url.endswith(":memory:")


def _make_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        if _is_memory(url):
            eng = create_engine(url, connect_args={"check_same_thread": False}, poolclass=StaticPool)
        else:
            path = Path(url[len("sqlite:///"):])
            path.parent.mkdir(parents=True, exist_ok=True)
            eng = create_engine(url, connect_args={"check_same_thread": False})

            @event.listens_for(eng, "connect")
            def _sqlite_pragmas(dbapi_conn, _record):  # pragma: no cover - exercised via connect
                cur = dbapi_conn.cursor()
                cur.execute("PRAGMA journal_mode=WAL")
                cur.execute("PRAGMA foreign_keys=ON")
                cur.close()
        return eng
    return create_engine(url, pool_pre_ping=True)


def configure(url: str | None = None) -> Engine:
    """(Re)create the engine for `url` (or env/default) and create tables."""
    global _engine, _url
    if _engine is not None:
        _engine.dispose()
    _url = resolve_url(url)
    _engine = _make_engine(_url)
    init_db()
    return _engine


def get_engine() -> Engine:
    if _engine is None:
        configure()
    assert _engine is not None
    return _engine


def init_db() -> None:
    from storage import models  # noqa: F401  (register tables)
    SQLModel.metadata.create_all(get_engine() if _engine is None else _engine)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one SQLModel session per request."""
    with Session(get_engine()) as session:
        yield session


def ping() -> bool:
    try:
        with get_engine().connect() as conn:
            conn.exec_driver_sql("SELECT 1")
        return True
    except Exception:  # noqa: BLE001 - health check must never raise
        return False
