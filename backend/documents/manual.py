"""Manual offer entry (POST /sessions/{id}/offers). Same LoanOffer shape and the same engine checks as
document extraction (stage_02 FR8). Self-reported terms are never labelled verified: at most
`user_confirmed` (the user affirmed the typed values)."""
from __future__ import annotations

from typing import Any

from documents.errors import OfferValidationError
from documents.terms import finalize_offer, make_term, new_offer_id, parse_term_value
from schemas.contracts import ItemizationItem, LoanOffer, ManualOfferRequest, TermEvidence


def build_manual_offer(session_id: str, req: ManualOfferRequest | dict[str, Any]) -> LoanOffer:
    """Raises OfferValidationError (400) or UnsupportedProduct (422, carries the draft offer)."""
    if not isinstance(req, ManualOfferRequest):
        req = ManualOfferRequest.model_validate(req)
    verification = "user_confirmed" if req.confirmed else "none"
    terms = {}
    errors = []
    for key, raw in req.terms.items():
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            continue                                   # not entered: absent, never zero
        try:
            value = parse_term_value(key, raw)
        except OfferValidationError as e:
            errors.append({"term_key": key, "message": e.message})
            continue
        terms[key] = make_term(
            key, value, status="provided", verification=verification, source_kind="user_input",
            evidence=TermEvidence(kind="user_input", display_label="You entered", value_text=str(raw)),
            user_action="confirmed" if req.confirmed else "pending")
    if errors:
        msg = errors[0]["message"] if len(errors) == 1 else "Some loan terms need fixing: " + "; ".join(
            e["message"] for e in errors)
        raise OfferValidationError(msg, {"errors": errors})
    items = []
    for it in req.itemization:
        amount = parse_term_value("cash_price", it.amount)       # currency rule: 2 dp, >= 0
        items.append(ItemizationItem(**{**it.model_dump(), "amount": amount}))
    offer = LoanOffer(offer_id=new_offer_id(), session_id=session_id, label=req.label, origin="manual",
                      terms=terms, itemization=items)
    return finalize_offer(offer)
