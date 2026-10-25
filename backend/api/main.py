"""FastAPI application entry point: `uvicorn api.main:app --port 8000` (run from backend/)."""
from __future__ import annotations

import logging
import re
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from api import errors
from api.deps import MAX_UPLOAD_BYTES, cors_origins
from api.routers import analysis, offers, sessions
from schemas.contracts import CALC_VERSION
from storage import db as storage_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
MULTIPART_SLACK = 64 * 1024   # multipart framing overhead allowed above the 10 MB file cap


@asynccontextmanager
async def lifespan(_app: FastAPI):
    storage_db.get_engine()          # creates the engine (and tables) from DATABASE_URL on first use
    storage_db.init_db()
    try:
        from sqlmodel import Session

        from storage import repo
        with Session(storage_db.get_engine()) as db:
            purged = repo.purge_expired(db)
        if purged:
            logging.getLogger("decisiontwin.api").info("purged %d expired sessions", purged)
    except Exception:  # noqa: BLE001 - retention sweep must never block start-up
        logging.getLogger("decisiontwin.api").warning("expired-session sweep failed")
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="DecisionTwin API", version=CALC_VERSION, lifespan=lifespan,
                  description="Deterministic, source-labelled auto-loan decision analysis (contracts v1.1).")
    errors.install(app)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        incoming = request.headers.get("x-request-id", "")
        rid = incoming if REQUEST_ID_RE.match(incoming) else f"req_{uuid.uuid4().hex[:16]}"
        request.state.request_id = rid
        if request.method == "POST" and request.url.path.endswith("/documents"):
            try:
                length = int(request.headers.get("content-length") or 0)
            except ValueError:
                length = 0
            if length > MAX_UPLOAD_BYTES + MULTIPART_SLACK:
                return errors.error_response(request, 400, "VALIDATION_ERROR", offers.TOO_LARGE,
                                             {"max_bytes": MAX_UPLOAD_BYTES})
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response

    app.add_middleware(CORSMiddleware, allow_origins=cors_origins(), allow_credentials=False,
                       allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
                       allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
                       expose_headers=["X-Request-ID"])
    app.include_router(sessions.router)
    app.include_router(offers.router)
    app.include_router(analysis.router)
    return app


app = create_app()
