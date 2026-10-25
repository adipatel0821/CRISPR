"""Stage 4 — illustrative, paired, floored stress scenarios over the engine's month_net (calc v1.1)."""
from .catalog import run_catalog, scenario_transforms, start_balances
from .resilience import BreakEven, break_even
from .runner import RunOutcome, simulate

__all__ = ["run_catalog", "break_even", "BreakEven", "simulate", "RunOutcome", "scenario_transforms",
           "start_balances"]
