"""Break-even income drop (stage_04 v1.1 §10 step 5, R4-07).

break_even_M = the largest fraction p ∈ [0, 1] such that income reduced by p for months 1..M (with_offer run,
starting from savings after purchase) never produces a shortfall over the horizon.

With no shortfall the balance after k months is S0 + Σ_{t≤k} net_t(0) − p·Σ_{t≤min(k,M)} income_t, so the
answer is exactly min_k (S0 + C_k) / I_k (the bisection target in the stage doc, solved in closed form).
All month values come from ``engine.month_components``. Rounded DOWN to 2 dp so a sustainable fraction is
never overstated. Baseline deficit -> "0.00" with deficit_at_baseline; p = 1 sustainable -> "1.00", capped.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_DOWN, Decimal

from engine.cashflow import month_components
from engine.inputs import EngineInputs
from engine.money import ONE, ZERO, engine_context, q


@dataclass(frozen=True)
class BreakEven:
    value: Decimal | None            # exact fraction (unrounded), None when not computable
    capped: bool = False
    deficit_at_baseline: bool = False

    @property
    def display(self) -> str | None:
        if self.value is None:
            return None
        return str(q(self.value, 2, ROUND_DOWN))


def break_even(inputs: EngineInputs, months: int, start: Decimal | None, horizon: int = 12,
               run: str = "with_offer") -> BreakEven:
    if start is None:
        return BreakEven(None)
    with engine_context():
        comps = [month_components(t, inputs, run, None) for t in range(1, horizon + 1)]
        if start < 0:                        # already short at purchase: no income drop is sustainable
            return BreakEven(ZERO)
        if comps[0]["net"] < 0:
            return BreakEven(ZERO, deficit_at_baseline=True)
        best: Decimal | None = None
        cum_net = ZERO
        cum_income = ZERO
        for t, c in enumerate(comps, start=1):
            cum_net += c["net"]
            if t <= months:
                cum_income += c["income"]
            if start + cum_net < 0:          # shortfall even with no income drop
                return BreakEven(ZERO, deficit_at_baseline=True)
            if cum_income > 0:
                p = (start + cum_net) / cum_income
                best = p if best is None or p < best else best
        if best is None or best >= ONE:
            return BreakEven(ONE, capped=True)
        return BreakEven(best)
