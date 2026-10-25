"""Property tests (stage_03 §18): schedule ends at 0.00; Σ principal = principal; interest = TOP − principal;
longer term -> lower payment and higher interest; APR with no prepaid charge ≈ contract rate."""
from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st

from engine import payment, solve_apr
from engine.loan import schedule_payments

principals = st.integers(min_value=100_000, max_value=10_000_000).map(lambda c: Decimal(c) / 100)   # $1k–$100k
rates = st.integers(min_value=0, max_value=2500).map(lambda b: Decimal(b) / 10000)                  # 0–25%
terms = st.integers(min_value=6, max_value=96)


@settings(max_examples=150, deadline=None)
@given(principals, rates, terms)
def test_schedule_invariants(p, r, n):
    rows = schedule_payments(p, r, n)
    assert len(rows) == n
    assert rows[-1][3] == Decimal("0.00")
    assert sum(row[2] for row in rows) == p                      # Σ principal parts = principal
    top = sum(row[0] for row in rows)
    assert sum(row[1] for row in rows) == top - p                # interest = TOP − principal
    assert all(row[3] >= 0 for row in rows)
    level = payment(p, r, n)
    assert all(row[0] == level for row in rows[:-1])
    assert abs(rows[-1][0] - level) <= Decimal("0.01") * n       # final payment only absorbs cent residue


@settings(max_examples=100, deadline=None)
@given(principals, st.integers(min_value=1, max_value=2500).map(lambda b: Decimal(b) / 10000), terms, terms)
def test_longer_term_lower_payment_higher_interest(p, r, n1, n2):
    if n1 == n2:
        return
    a, b = sorted((n1, n2))
    pay_a, pay_b = payment(p, r, a), payment(p, r, b)
    int_a = sum(x[0] for x in schedule_payments(p, r, a)) - p
    int_b = sum(x[0] for x in schedule_payments(p, r, b)) - p
    assert pay_b <= pay_a
    assert int_b >= int_a


@settings(max_examples=40, deadline=None)
@given(st.integers(min_value=500_000, max_value=10_000_000).map(lambda c: Decimal(c) / 100),
       st.integers(min_value=50, max_value=2500).map(lambda b: Decimal(b) / 10000),
       st.integers(min_value=12, max_value=96))
def test_apr_without_prepaid_charges_matches_rate(p, r, n):
    pays = [row[0] for row in schedule_payments(p, r, n)]
    apr = solve_apr(p, pays, n)
    assert apr is not None and abs(apr - r) < Decimal("0.0005")
