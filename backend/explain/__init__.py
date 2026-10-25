"""Claim-based deterministic explanations (stage 6 v1.1, ADR-023). Public API per implementation/INTERFACES.md."""
from explain.builder import Explanations, build_explanations
from explain.templates import DeniedLanguageError, check_text, find_denied

__all__ = ["Explanations", "build_explanations", "DeniedLanguageError", "check_text", "find_denied"]
