"""Loan arithmetic: F01 payment, F01s schedule, F02 total of payments, F03/F03i, F05 APR solver.

Conventions (stage_03 §11): nominal annual rate, monthly compounding, payments in arrears, first period
regular; payment rounded once to cents (ROUND_HALF_UP), interest rounded per line, final payment absorbs
the rounding residue so the balance ends at exactly 0.00.
"""
from __future__ import annotations

from decimal import Decimal

from schemas.contracts import ScheduleRow

from .money import ONE, TWELVE, ZERO, engine_context, round2


def _check(principal: Decimal, annual_rate: Decimal, n: int) -> None:
    if not isinstance(n, int) or isinstance(n, bool) or n <= 0:
        raise ValueError("term must be a positive integer number of months")
    if principal < 0:
        raise ValueError("principal must be non-negative")
    if annual_rate < 0:
        raise ValueError("rate must be non-negative")


def payment(principal: Decimal, annual_rate: Decimal, n: int) -> Decimal:
    """F01: level monthly payment on the PRINCIPAL (note amount), rounded to cents."""
    principal, annual_rate = Decimal(principal), Decimal(annual_rate)
    _check(principal, annual_rate, n)
    with engine_context():
        r = annual_rate / TWELVE
        if r == 0:
            return round2(principal / n)
        return round2(principal * r / (ONE - (ONE + r) ** (-n)))


def schedule_payments(principal: Decimal, annual_rate: Decimal, n: int) -> list[tuple[Decimal, Decimal, Decimal, Decimal]]:
    """F01s as Decimal tuples (payment, interest, principal_part, balance) for k = 1..n."""
    principal, annual_rate = Decimal(principal), Decimal(annual_rate)
    level = payment(principal, annual_rate, n)
    rows: list[tuple[Decimal, Decimal, Decimal, Decimal]] = []
    with engine_context():
        r = annual_rate / TWELVE
        balance = principal
        for k in range(1, n + 1):
            interest = round2(balance * r)
            if k < n:
                pay = level
                part = pay - interest
                balance = balance - part
            else:
                part = balance
                pay = balance + interest
                balance = ZERO
            rows.append((pay, interest, part, round2(balance)))
    return rows


def schedule(principal: Decimal, annual_rate: Decimal, n: int) -> list[ScheduleRow]:
    """F01s amortization schedule on the principal; the final payment absorbs the rounding residue."""
    return [ScheduleRow(n=k, payment=str(round2(p)), interest=str(round2(i)), principal=str(round2(pr)),
                        balance=str(round2(b)))
            for k, (p, i, pr, b) in enumerate(schedule_payments(principal, annual_rate, n), start=1)]


def total_of_payments(payments: list[Decimal]) -> Decimal:
    """F02: Σ scheduled payments."""
    with engine_context():
        return round2(sum(payments, ZERO))


def finance_charge(top: Decimal, amount_financed: Decimal) -> Decimal:
    """F03: TILA finance charge = TOP − amount financed (includes prepaid finance charges)."""
    return round2(top - amount_financed)


def interest(top: Decimal, principal: Decimal) -> Decimal:
    """F03i: interest = TOP − principal."""
    return round2(top - principal)


def _present_value(x: Decimal, payments: list[Decimal]) -> Decimal:
    v = ONE / (ONE + x / TWELVE)
    pv = ZERO
    disc = ONE
    for p in payments:
        disc *= v
        pv += p * disc
    return pv


def solve_apr(amount_financed: Decimal, payments: list[Decimal] | Decimal, n: int,
              *, tol: Decimal = Decimal("1e-12"), max_iter: int = 200) -> Decimal | None:
    """F05: APR x solving AF = Σ P_k / (1 + x/12)^k by bisection on [0, 2].

    ``payments`` is either the actual schedule payments (incl. the adjusted final payment) or a level payment
    applied for n months. No further prepaid-charge subtraction happens here (the caller passes AF).
    Returns None when no solution exists in [0, 2] (e.g. payments sum below AF).
    """
    with engine_context():
        af = Decimal(amount_financed)
        if isinstance(payments, (list, tuple)):
            pays = [Decimal(p) for p in payments]
        else:
            pays = [Decimal(payments)] * int(n)
        if af <= 0 or not pays:
            return None
        lo, hi = ZERO, Decimal("2")
        f_lo = sum(pays, ZERO) - af          # PV at x = 0
        if f_lo < 0:
            return None
        if f_lo == 0:
            return ZERO
        if _present_value(hi, pays) - af > 0:
            return None
        for _ in range(max_iter):
            mid = (lo + hi) / 2
            if _present_value(mid, pays) - af > 0:
                lo = mid
            else:
                hi = mid
            if hi - lo < tol:
                break
        return (lo + hi) / 2
