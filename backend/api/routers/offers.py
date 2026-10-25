"""Manual offers, document upload, extraction status and per-term verification (contracts §4)."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, File, Header, Request, UploadFile
from fastapi.responses import JSONResponse
from sqlmodel import Session

from api import adapters
from api.deps import MAX_UPLOAD_BYTES, current_session, session_for_path
from api.errors import ApiError, ErrorMappingRoute, not_found, validation
from schemas.contracts import TERM_VALUE_TYPES, DocumentStatus, LoanOffer, ManualOfferRequest, VerifyRequest
from storage import repo
from storage.db import get_db
from storage.models import SessionRow, new_id

router = APIRouter(prefix="/api/v1", route_class=ErrorMappingRoute, tags=["offers"])

MAGIC = ((b"%PDF-", "application/pdf"), (b"\x89PNG\r\n\x1a\n", "image/png"), (b"\xff\xd8\xff", "image/jpeg"))
TOO_LARGE = "file: the upload is larger than 10 MB. Upload a smaller file or type the loan terms in."


def sniff(data: bytes) -> str | None:
    for magic, mime in MAGIC:
        if data.startswith(magic):
            return mime
    return None


def validate_manual_terms(terms: dict) -> None:
    """Contract §5 wire rules, checked before the offer builder runs (defence in depth for A-17)."""
    problems: list[dict] = []
    for key, raw in terms.items():
        vtype = TERM_VALUE_TYPES.get(key)
        if vtype is None:
            problems.append({"field": f"terms.{key}", "message": f"terms.{key}: unknown loan term."})
            continue
        if raw is None:
            continue
        if vtype == "boolean":
            if not isinstance(raw, bool) and str(raw).lower() not in ("true", "false"):
                problems.append({"field": f"terms.{key}", "message": f"terms.{key}: must be true or false."})
            continue
        if isinstance(raw, bool):
            problems.append({"field": f"terms.{key}", "message": f"terms.{key}: must be a number."})
            continue
        try:
            value = Decimal(str(raw).replace(",", "").strip())
        except InvalidOperation:
            problems.append({"field": f"terms.{key}", "message": f"terms.{key}: must be a number."})
            continue
        if not value.is_finite():
            problems.append({"field": f"terms.{key}", "message": f"terms.{key}: must be a number."})
        elif vtype == "integer":
            if value != value.to_integral_value() or not (6 <= value <= 96):
                problems.append({"field": f"terms.{key}",
                                 "message": f"terms.{key}: the loan term must be a whole number of months "
                                            f"between 6 and 96."})
        elif vtype == "rate":
            if not (Decimal(0) <= value < Decimal(1)):
                problems.append({"field": f"terms.{key}",
                                 "message": f"terms.{key}: enter the rate as a fraction between 0 and 1 "
                                            f"(for example 0.0475 for 4.75%)."})
        elif value < 0:
            problems.append({"field": f"terms.{key}", "message": f"terms.{key}: must be zero or more."})
    if problems:
        raise validation("; ".join(p["message"] for p in problems), {"fields": problems})


@router.post("/sessions/{session_id}/offers", response_model=LoanOffer)
def post_manual_offer(body: ManualOfferRequest, row: SessionRow = Depends(session_for_path),
                      db: Session = Depends(get_db)) -> LoanOffer:
    validate_manual_terms(body.terms)
    offer = adapters.build_manual_offer(row.id, body)
    if offer.session_id != row.id:
        raise ApiError(500, "INTERNAL", "Something went wrong on our side. Please retry.")
    repo.save_offer(db, offer)
    repo.bump_profile_version(db, row)
    db.commit()
    return offer


async def _read_capped(file: UploadFile) -> bytes:
    chunks, total = [], 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise validation(TOO_LARGE, {"max_bytes": MAX_UPLOAD_BYTES})
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/sessions/{session_id}/documents", response_model=DocumentStatus)
async def upload_document(request: Request, file: UploadFile = File(...),
                          idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
                          row: SessionRow = Depends(session_for_path), db: Session = Depends(get_db)):
    route = "POST /documents"
    if idempotency_key:
        hit = repo.get_idempotent(db, row.id, route, idempotency_key)
        if hit is not None:
            return JSONResponse(content=DocumentStatus.model_validate_json(hit.response_json).model_dump(mode="json"),
                                status_code=hit.status_code)
    data = await _read_capped(file)
    await file.close()
    if not data:
        raise validation("file: the upload is empty.")
    if sniff(data) is None:
        raise ApiError(422, "EXTRACTION_FAILED",
                       "This file is not a PDF, PNG or JPEG. Upload one of those or type the loan terms in.")
    doc_id = new_id("d_")
    filename = (file.filename or "upload")[:200]
    llm = adapters.get_llm_client()
    status = adapters.process_document(row.id, doc_id, filename, data, row.data_mode, llm)
    del data                                    # uploaded bytes are not kept after processing
    if status.session_id != row.id or status.doc_id != doc_id:
        raise ApiError(500, "INTERNAL", "Something went wrong on our side. Please retry.")
    repo.save_document(db, status)
    if idempotency_key:
        repo.save_idempotent(db, row.id, route, idempotency_key, status.model_dump_json())
    db.commit()
    return status


@router.get("/documents/{doc_id}", response_model=DocumentStatus)
def get_document(doc_id: str, row: SessionRow = Depends(current_session),
                 db: Session = Depends(get_db)) -> DocumentStatus:
    status = repo.get_document(db, row.id, doc_id)
    if status is None:
        raise not_found("Document")
    return status


@router.post("/documents/{doc_id}/verify", response_model=LoanOffer)
def verify_document(doc_id: str, body: VerifyRequest, row: SessionRow = Depends(current_session),
                    db: Session = Depends(get_db)) -> LoanOffer:
    status = repo.get_document(db, row.id, doc_id)
    if status is None:
        raise not_found("Document")
    offer = adapters.apply_verification(status, body)
    if offer.session_id != row.id:
        raise ApiError(500, "INTERNAL", "Something went wrong on our side. Please retry.")
    repo.save_offer(db, offer)
    repo.bump_profile_version(db, row)
    db.commit()
    return offer
