"""Metric assembly helpers: ``Derived`` -> contracts ``Metric`` with the formatting policy."""
from __future__ import annotations

import hashlib
import json
from typing import Any

from schemas.contracts import Metric

from .derived import Derived
from .money import fmt

PLACES = {
    "money": 2, "apr": 5, "ltv": 3, "ratio": 4, "months": 2,
}


def metric(d: Derived, formula_id: str, kind: str = "money", **extra: Any) -> Metric:
    """Missing input -> Metric(value=None, status="missing", missing_inputs=[...]).

    A computed metric carries ``status`` only when its weakest input is weaker than ``provided``.
    """
    label = extra.pop("label", None) or d.label
    if d.value is None or d.missing:
        return Metric(value=None, formula_id=formula_id, status="missing",
                      missing_inputs=list(d.missing) or None, label=label, **extra)
    status = d.status
    return Metric(value=fmt(d.value, PLACES[kind]), formula_id=formula_id,
                  status=None if status == "provided" else status, label=label, **extra)


def missing_metric(formula_id: str, keys: list[str], **extra: Any) -> Metric:
    return Metric(value=None, formula_id=formula_id, status="missing", missing_inputs=keys, **extra)


def stable_id(prefix: str, payload: Any) -> str:
    """Deterministic id (same inputs -> same id) so results are reproducible byte-for-byte."""
    blob = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))
    return f"{prefix}_{hashlib.sha256(blob.encode('utf-8')).hexdigest()[:20]}"
