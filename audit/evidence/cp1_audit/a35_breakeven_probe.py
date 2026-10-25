"""A-35 spot-check: break-even edges (deficit fixture -> 0 + deficit flag; large savings -> capped)."""
from schemas.contracts import LoanOffer, VerifiedFinancialTerm, TERM_VALUE_TYPES
from scenarios import run_catalog
def F(**kv): return {k: {"key": k, "value": v, "status": "provided"} for k, v in kv.items()}
def offer(**t): return LoanOffer(offer_id="o", session_id="s", origin="manual", ready_for_calculation=True, terms={k: VerifiedFinancialTerm(term_key=k, value=str(v), value_type=TERM_VALUE_TYPES.get(k, "currency"), status="provided", source_kind="user_input") for k, v in t.items()})
O = offer(principal="20000.00", contract_rate="0.0475", term_months="60", cash_down="4000.00")
base = {"income.take_home_monthly": "4200.00", "income.variability": "stable", "expenses.essential.total": "2900.00", "debts.count": "0", "savings.liquid": "6000.00", "loan.down_payment_source": "savings"}
for label, over in [("deficit (take-home 2500)", {"income.take_home_monthly": "2500.00"}), ("large savings (5,000,000)", {"savings.liquid": "5000000.00"}), ("reference", {})]:
    _, rs = run_catalog(F(**{**base, **over}), O)
    print(f"{label}: break_even_m3={rs.break_even_m3} m6={rs.break_even_m6} capped={rs.capped} deficit_at_baseline={rs.deficit_at_baseline} shortfalls={rs.scenarios_with_shortfall}")
