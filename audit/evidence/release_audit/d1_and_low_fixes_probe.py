"""Agent 5 release audit: D1-001 directive tests + CP1 LOW-fix probes (black-box). Run from backend/ with PYTHONPATH=."""
import os
from schemas.contracts import LoanOffer, VerifiedFinancialTerm, TERM_VALUE_TYPES
from engine import compute
R = []
def check(n, got, exp):
    ok = got == exp; R.append(ok); print(f"  [{'PASS' if ok else 'FAIL'}] {n}: got={got!r} expected={exp!r}")
def F(**kv): return {k: {"key": k, "value": v, "status": "provided", "verification": "none"} for k, v in kv.items()}
def offer(st=None, **t):
    st = st or {}
    return LoanOffer(offer_id="o", session_id="s", origin="manual", ready_for_calculation=True,
        terms={k: VerifiedFinancialTerm(term_key=k, value=None if st.get(k) == "missing" else str(v), value_type=TERM_VALUE_TYPES.get(k, "currency"),
               status=st.get(k, "provided"), verification="user_confirmed", source_kind="user_input") for k, v in t.items()})
HH = {"income.take_home_monthly": "4200.00", "income.variability": "stable", "expenses.essential.total": "2900.00",
      "expenses.current_vehicle_costs_monthly": "260.00", "vehicle.replaces_current": "true",
      "vehicle.new_ownership_costs_monthly": "310.00", "expenses.flexible.total": "400.00", "debts.count": "0",
      "savings.liquid": "6000.00", "loan.down_payment_source": "savings"}
REF = dict(cash_price="22000.00", taxes_title_fees="1500.00", cash_down="4000.00", principal="20000.00",
           amount_financed="19500.00", prepaid_finance_charges="500.00", contract_rate="0.0475", apr="0.05796",
           term_months="60", monthly_payment="375.14")
print("== D1-001 verification tests ==")
hn = {k: v for k, v in HH.items() if k != "vehicle.new_ownership_costs_monthly"}
r1 = compute(F(**hn), offer(**REF))
check("(1) new costs missing -> derived_status assumed", r1.derived_status, "assumed")
check("(1) values unchanged F09/F14", (r1.metrics["monthly_left_after"].value, r1.metrics["incremental_vehicle_costs"].value), ("524.86", "0.00"))
check("(1) precise label when replacing", r1.metrics["incremental_vehicle_costs"].label, "assumes the new car costs the same to run as your current one")
r2 = compute(F(**HH), offer(**REF))
check("(2) full reference household -> provided", r2.derived_status, "provided")
h3 = {k: v for k, v in HH.items() if k != "vehicle.replaces_current"}
check("(3) new costs given, replaces_current absent -> assumed", compute(F(**h3), offer(**REF)).derived_status, "assumed")
h4 = {k: v for k, v in hn.items() if k != "vehicle.replaces_current"}
check("(4) new costs missing, not replacing -> label not included", compute(F(**h4), offer(**REF)).metrics["incremental_vehicle_costs"].label, "new-car running costs not included")
print("== LOW-2 disputed pfc_paid_in_cash ==")
rp = compute(F(**HH), offer(st={"pfc_paid_in_cash": "conflicting"}, **REF, pfc_paid_in_cash="500.00"))
check("F04 missing with offer.pfc_paid_in_cash", (rp.metrics["total_paid_through_deal"].value, "offer.pfc_paid_in_cash" in (rp.metrics["total_paid_through_deal"].missing_inputs or [])), (None, True))
check("F13 missing with offer.pfc_paid_in_cash", (rp.metrics["savings_after_purchase"].value, "offer.pfc_paid_in_cash" in (rp.metrics["savings_after_purchase"].missing_inputs or [])), (None, True))
rq = compute(F(**HH), offer(**REF, pfc_paid_in_cash="0.00"))
check("provided pfc_paid_in_cash 0 -> F13 2000.00, F04 26508.29", (rq.metrics["savings_after_purchase"].value, rq.metrics["total_paid_through_deal"].value), ("2000.00", "26508.29"))
hother = dict(HH); hother["loan.down_payment_source"] = "other"
check("source=other + disputed pfc -> F13 = savings (not subtracted)", compute(F(**hother), offer(st={"pfc_paid_in_cash": "conflicting"}, **REF, pfc_paid_in_cash="500.00")).metrics["savings_after_purchase"].value, "6000.00")
print(f"\nTOTAL: {sum(R)} PASS / {len(R)-sum(R)} FAIL")
