"""User verification of an extracted offer (POST /documents/{doc_id}/verify; stage_02 §11 verification
state). `evidence_matched_user_confirmed` only when the evidence matched AND the user confirmed;
a corrected value becomes user_input / user_confirmed; a rejected one becomes missing."""
from __future__ import annotations

from documents.errors import ExtractionFailed, OfferValidationError
from documents.terms import finalize_offer, make_term, parse_term_value
from schemas.contracts import DocumentStatus, LoanOffer, TermCandidate, TermEvidence, VerifyRequest


def _resolve_choice(offer: LoanOffer, choice: int, labels: list[str]) -> None:
    prefix = f"option_{choice}"
    for key, term in list(offer.terms.items()):
        cands = term.alternatives_found
        if not any(c.source.startswith("option_") for c in cands):
            continue
        mine = [c for c in cands if c.source == prefix or c.source.startswith(prefix + ":")]
        if not mine:
            del offer.terms[key]
            continue
        if len(mine) == 1 and mine[0].source == prefix:
            c = mine[0]
            new = make_term(key, c.value, status="provided", verification="evidence_matched", source_kind="document",
                            evidence=TermEvidence(kind="document", page=c.page, quote=c.quote,
                                                  quote_found_in_text=True, value_text=c.value,
                                                  display_label=f"From your document, p.{c.page}" if c.page
                                                  else "From your document"),
                            user_action="pending")
            new.checks = term.checks.model_copy()
            new.checks.quote_match = "pass"
            new.checks.label_anchor = "pass"
        else:
            new = make_term(key, None, status="conflicting", verification="none", source_kind="document",
                            user_action="pending")
            new.alternatives_found = [TermCandidate(value=c.value, source=c.source.split(":", 1)[-1],
                                                    quote=c.quote, page=c.page) for c in mine]
        offer.terms[key] = new
    offer.offer_choice = choice
    if 1 <= choice <= len(labels):
        offer.label = labels[choice - 1]


def apply_verification(status: DocumentStatus, req: VerifyRequest | dict) -> LoanOffer:
    """Raises OfferValidationError (400), ExtractionFailed (no draft), UnsupportedProduct (422)."""
    if not isinstance(req, VerifyRequest):
        req = VerifyRequest.model_validate(req)
    if status.draft_offer is None:
        raise ExtractionFailed("There is no extracted offer to verify for this document. Enter the terms manually.")
    offer = status.draft_offer.model_copy(deep=True)

    if offer.document_offers_count > 1 and offer.offer_choice is None:
        if req.offer_choice is None:
            raise OfferValidationError(
                f"This document shows {offer.document_offers_count} offers. Choose one first (offer_choice).",
                {"offers": status.offer_labels})
        if not 1 <= req.offer_choice <= offer.document_offers_count:
            raise OfferValidationError(f"offer_choice must be between 1 and {offer.document_offers_count}.",
                                       {"offer_choice": req.offer_choice})
        _resolve_choice(offer, req.offer_choice, status.offer_labels)

    errors = []
    for action in req.actions:
        key = action.term_key
        term = offer.terms.get(key)
        if action.action == "confirm":
            if term is None or term.value is None:
                errors.append({"term_key": key, "message": f"There is no value to confirm for {key}; "
                               "pick one of the values found or enter the correct one."})
                continue
            term.verification = ("evidence_matched_user_confirmed" if term.verification == "evidence_matched"
                                 else "user_confirmed")
            term.user_action = "confirmed"
        elif action.action == "correct":
            try:
                value = parse_term_value(key, action.value)
            except OfferValidationError as e:
                errors.append({"term_key": key, "message": e.message})
                continue
            old_alts = list(term.alternatives_found) if term else []
            if term is not None and term.value is not None and term.value != value:
                old_alts.append(TermCandidate(value=term.value, source="document",
                                              quote=term.evidence.quote if term.evidence else None,
                                              page=term.evidence.page if term.evidence else None))
            new = make_term(key, value, status="provided", verification="user_confirmed", source_kind="user_input",
                            evidence=TermEvidence(kind="user_input", value_text=str(action.value),
                                                  display_label="You corrected this"),
                            user_action="corrected")
            new.alternatives_found = old_alts
            offer.terms[key] = new
        elif action.action == "reject":
            if term is None:
                continue
            term.value, term.status, term.verification, term.user_action = None, "missing", "none", "rejected"
    if errors:
        raise OfferValidationError(errors[0]["message"] if len(errors) == 1 else
                                   "Some values need attention: " + "; ".join(e["message"] for e in errors),
                                   {"errors": errors})

    for t in offer.terms.values():          # reset engine-derived checks before re-running them
        t.checks.arithmetic = t.checks.itemization = t.checks.apr_recompute = t.checks.range = "not_applicable"
    offer.warnings = [w for w in offer.warnings if w not in ("PAYMENT_MISMATCH", "OFFER_CHECKS_UNAVAILABLE")]
    finalize_offer(offer)                    # raises UnsupportedProduct when blocked

    # ADR-S2-02: an extracted term enters calculation only after the user confirmed (or corrected) it.
    def ok(key: str) -> bool:
        t = offer.terms.get(key)
        return (t is not None and t.value is not None and t.status in ("provided", "estimated")
                and t.user_action in ("confirmed", "corrected"))

    offer.ready_for_calculation = bool(offer.ready_for_calculation and (ok("principal") or ok("amount_financed"))
                                       and (ok("contract_rate") or ok("apr")) and ok("term_months"))
    return offer
