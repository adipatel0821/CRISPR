"""DecisionTwin financial engine (Stage 3, calc_version 1.1.0). Pure functions; Decimal; no I/O except the
bundled config YAML. Public API per implementation/INTERFACES.md."""
from .cashflow import MissingInputError, month_components, month_net
from .checks import OfferCheckReport, offer_checks
from .compute import compute
from .config import EngineConfig, assumptions_payload, load_config
from .inputs import EngineInputs, build_inputs, coerce_offer
from .loan import payment, schedule, solve_apr
from .principal import resolve_offer, resolve_principal

__all__ = [
    "compute", "payment", "schedule", "solve_apr", "resolve_principal", "build_inputs", "month_net",
    "offer_checks", "load_config", "assumptions_payload",
    # extras
    "month_components", "MissingInputError", "OfferCheckReport", "EngineConfig", "EngineInputs",
    "coerce_offer", "resolve_offer",
]
