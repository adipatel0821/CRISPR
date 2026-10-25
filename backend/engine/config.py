"""Engine configuration: config/assumptions.yaml (+ scenarios.yaml, levers.yaml).

Pure apart from reading the three bundled YAML files (cached). Config is public and contains no user data.
"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


@dataclass(frozen=True)
class EngineConfig:
    assumptions_raw: dict[str, Any]
    scenarios_raw: dict[str, Any]
    levers_raw: dict[str, Any]
    flags: dict[str, dict[str, Any]] = field(default_factory=dict)
    assumptions: dict[str, dict[str, Any]] = field(default_factory=dict)
    labels: dict[str, str] = field(default_factory=dict)

    # --- tolerances -----------------------------------------------------------------
    def tolerance(self, name: str) -> Decimal:
        return Decimal(str(self.assumptions_raw["tolerances"][name]))

    @property
    def term_min(self) -> int:
        return int(self.assumptions_raw["supported"]["term_months_min"])

    @property
    def term_max(self) -> int:
        return int(self.assumptions_raw["supported"]["term_months_max"])

    def assumption_text(self, assumption_id: str) -> str:
        return self.assumptions[assumption_id]["text"]

    def flag_meta(self, flag_id: str) -> dict[str, Any]:
        return self.flags.get(flag_id, {})


def _read(name: str) -> dict[str, Any]:
    with open(CONFIG_DIR / name, encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


@lru_cache(maxsize=1)
def _load_cached() -> EngineConfig:
    a = _read("assumptions.yaml")
    s = _read("scenarios.yaml")
    lv = _read("levers.yaml")
    return EngineConfig(assumptions_raw=a, scenarios_raw=s, levers_raw=lv,
                        flags=a.get("flags", {}), assumptions=a.get("assumptions", {}),
                        labels=a.get("labels", {}))


def load_config() -> EngineConfig:
    """Return the (cached, immutable) engine configuration."""
    return _load_cached()


def assumptions_payload() -> dict[str, Any]:
    """Body of GET /api/v1/config/assumptions: thresholds, citations, assumption texts, scenario catalog, levers."""
    cfg = load_config()
    a = copy.deepcopy(cfg.assumptions_raw)
    return {
        "version": a.get("version"),
        "rounding": a.get("rounding", {}),
        "tolerances": a.get("tolerances", {}),
        "supported": a.get("supported", {}),
        "flags": a.get("flags", {}),
        "assumptions": [{"assumption_id": k, "text": v["text"], "source_kind": "assumption",
                         "citation": v.get("citation")} for k, v in a.get("assumptions", {}).items()],
        "labels": a.get("labels", {}),
        "context": a.get("context", {}),
        "scenarios": copy.deepcopy(cfg.scenarios_raw),
        "levers": copy.deepcopy(cfg.levers_raw),
    }
