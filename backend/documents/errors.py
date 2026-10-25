"""Document / offer errors and their API mapping (contracts §4 error codes)."""
from __future__ import annotations

from typing import Any

from intake.errors import FactValidationError


class OfferValidationError(FactValidationError):
    """A typed offer term is invalid → 400 VALIDATION_ERROR."""


class UnsupportedProduct(Exception):
    """Variable-rate / balloon / other non fixed-rate amortizing product → 422 UNSUPPORTED_PRODUCT.
    `offer` carries the draft so the UI can still show the terms (stage_02 §16)."""

    code = "UNSUPPORTED_PRODUCT"

    def __init__(self, message: str, features: list[str], offer: Any = None):
        super().__init__(message)
        self.message = message
        self.features = features
        self.offer = offer
        self.details = {"unsupported_features": features}


class DataModeRestricted(Exception):
    """Real (non-fixture) upload while LLM_DATA_MODE=synthetic_only → 403 DATA_MODE_RESTRICTED (A-26)."""

    code = "DATA_MODE_RESTRICTED"

    def __init__(self, message: str | None = None):
        self.message = message or (
            "This demo runs in synthetic-only mode, so only the bundled sample documents can be uploaded. "
            "Your own documents are never sent anywhere in this mode. Enter your loan terms manually instead.")
        super().__init__(self.message)
        self.details = {"data_mode": "synthetic_only", "fallback": "manual_entry"}


class UnsupportedUpload(Exception):
    """Wrong type / too large / too many pages / encrypted / scanned → 400 VALIDATION_ERROR."""

    code = "VALIDATION_ERROR"

    def __init__(self, message: str, reason: str):
        super().__init__(message)
        self.message = message
        self.reason = reason
        self.details = {"reason": reason, "fallback": "manual_entry"}


class ExtractionFailed(Exception):
    """Text could not be read from an otherwise valid PDF → 422 EXTRACTION_FAILED."""

    code = "EXTRACTION_FAILED"

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {"fallback": "manual_entry"}
