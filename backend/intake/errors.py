"""Intake errors. The API maps FactValidationError to 400 VALIDATION_ERROR (contracts §4)."""
from __future__ import annotations

from typing import Any


class FactValidationError(ValueError):
    """A fact or answer failed ontology validation. `message` is user-facing and actionable."""

    def __init__(self, message: str, details: dict[str, Any] | list[Any] | None = None):
        super().__init__(message)
        self.message = message
        self.details = details if details is not None else {}

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.message
