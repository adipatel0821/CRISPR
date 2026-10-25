"""Agent 5 CP1 engine audit: the merged engine vs independent Decimal arithmetic (written by the auditor; the expected
side never imports project code). Run from backend/:  PYTHONPATH=. .venv/Scripts/python.exe <this file>
"""
from decimal import Decimal as D, ROUND_HALF_UP, getcontext

getcontext().prec = 28
C = D("0.01")
R = []


def r2(x): return x.quantize(C, rounding=ROUND_HALF_UP)


# ------------------------------------------------------------------ independent reference arithmetic
def ind_payment(P, i, n):
    r = i / 12
    return r2(P / n) if r == 0 else r2(P * r / (1 - (1 + r) ** -n))


def ind_schedule(P, i, n):
    r = i / 12; pay = ind_payment(P, i, n); bal = P; rows = []
    for k in range(1, n + 1):
        I = r2(bal * r); p = pay if k < n else bal + I
        bal = bal - (p - I); rows.append((p, I, bal))
    return pay, rows


def ind_apr(AF, pays):
    lo, hi = D(0), D(2)
    for _ in range(200):
        mid = (lo + hi) / 2; r = mid / 12
        pv = sum(p / (1 + r) ** (k + 1) for k, p in enumerate(pays))
        lo, hi = (mid, hi) if pv > AF else (lo, mid)
    return ((lo + hi) / 2).quantize(D("0.00001"), ROUND_HALF_UP)


def check(name, got, exp):
    ok = str(got) == str(exp)
    R.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}: engine={got!r} expected={exp!r}")


# ------------------------------------------------------------------ engine under test
from schemas.contracts import LoanOffer, VerifiedFinancialTerm, TERM_VALUE_TYPES, ManualOfferRequest  # noqa: E402
from engine import compute, offer_checks  # noqa: E402


def F(**kv):
    return {k: {"key": k, "value": v, "status": "provided", "verification": "none"} for k, v in kv.items()}


def offer(**terms):
    t = {k: VerifiedFinancialTerm(term_key=k, value=str(v), value_type=TERM_VALUE_TYPES.get(k, "currency"),
                                  status="provided", verification="user_confirmed", source_kind="user_input")
         for k, v in terms.items()}
    return LoanOffer(offer_id="o_audit", session_id="s_audit", origin="manual", terms=t, ready_for_calculation=True)


def mv(res, k): return res.metrics[k].value
def flag(res, fid): return next((f.triggered for f in res.flags if f.flag_id == fid), None)


HH = dict(**{"income.take_home_monthly": "4200.00", "income.variability": "stable",
             "expenses.essential.total": "2900.00", "expenses.current_vehicle_costs_monthly": "260.00",
             "vehicle.replaces_current": "true", "vehicle.new_ownership_costs_monthly": "310.00",
             "expenses.flexible.total": "400.00", "debts.count": "0", "savings.liquid": "6000.00",
             "loan.down_payment_source": "savings"})
REF = dict(cash_price="22000.00", taxes_title_fees="1500.00", cash_down="4000.00", principal="20000.00",
           amount_financed="19500.00", prepaid_finance_charges="500.00", contract_rate="0.0475",
           apr="0.05796", term_months="60", monthly_payment="375.14")

print("== A-07r CFPB en-753 ($20,000 @ 4.75%) + worksheet ($15,800 @ 3.5%, 48) ==")
for P, i, n in [(D(20000), D("0.0475"), 36), (D(20000), D("0.0475"), 48), (D(20000), D("0.0475"), 60),
                (D(20000), D("0.0475"), 72), (D(15800), D("0.035"), 48)]:
    pay, rows = ind_schedule(P, i, n); top = sum(r[0] for r in rows)
    res = compute({}, offer(principal=str(P), contract_rate=str(i), term_months=str(n)))
    check(f"{P}@{i}/{n} payment", mv(res, "monthly_payment"), pay)
    check(f"{P}@{i}/{n} TOP", mv(res, "total_of_payments"), top)
    check(f"{P}@{i}/{n} interest", mv(res, "interest"), top - P)
    sched = res.amortization_schedule
    check(f"{P}@{i}/{n} schedule rows/final balance/final payment",
          (len(sched), sched[-1].balance, sched[-1].payment), (n, "0.00", str(rows[-1][0])))
    check(f"{P}@{i}/{n} every row byte-equal",
          all((s.payment, s.interest, s.balance) == (str(r[0]), str(r[1]), str(r2(r[2]))) for s, r in zip(sched, rows)), True)

print("== Reference case full compute (contracts §3.7) ==")
res = compute(F(**HH), offer(**REF))
pay, rows = ind_schedule(D(20000), D("0.0475"), 60); top = sum(r[0] for r in rows)
exp = {"principal": "20000.00", "monthly_payment": str(pay), "total_of_payments": str(top), "interest": str(top - 20000),
       "finance_charge": str(top - D("19500")), "total_paid_through_deal": str(top + 4000),
       "apr_recomputed": str(ind_apr(D("19500"), [r[0] for r in rows])), "monthly_left_before": "900.00",
       "incremental_vehicle_costs": "50.00", "monthly_left_after": str(D(4200) - 2900 - pay - 50 - 400),
       "savings_after_purchase": "2000.00", "reserve_months_before": str(r2(D(6000) / 2900)),
       "reserve_months_after": str(r2(D(2000) / (2900 + pay + 50))),
       "payment_to_take_home": str((pay / 4200).quantize(D("0.0001"), ROUND_HALF_UP)),
       "ltv": str((D(20000) / 22000).quantize(D("0.001"), ROUND_HALF_UP))}
for k, v in exp.items():
    check(k, mv(res, k), v)
check("F11 before/after", (res.metrics["savings_months_of_income"].before, res.metrics["savings_months_of_income"].after),
      (str(r2(D(6000) / 4200)), str(r2(D(2000) / 4200))))
check("F04 breakdown sums to total", sum(D(v) for v in res.metrics["total_paid_through_deal"].breakdown.values()),
      D(exp["total_paid_through_deal"]))
check("dti_total missing (no gross)", (mv(res, "dti_total"), res.metrics["dti_total"].status), (None, "missing"))
check("A-31 equity_timeline missing", (mv(res, "equity_timeline"), res.metrics["equity_timeline"].status), (None, "missing"))
check("A-24 no PAYMENT_MISMATCH, mismatch 0.00", (flag(res, "PAYMENT_MISMATCH"), res.metrics["monthly_payment"].mismatch), (False, "0.00"))
check("RESERVE_LT_1_MONTH triggered (0.60)", flag(res, "RESERVE_LT_1_MONTH"), True)
check("APR exactly 5 dp string", mv(res, "apr_recomputed"), "0.05796")
check("apr check pass", res.metrics["apr_recomputed"].check, "pass")

print("== A-24 variant: AF + PFC stated, no principal (derived) ==")
r24 = compute(F(**HH), offer(**{k: v for k, v in REF.items() if k != "principal"}))
check("principal derived", (mv(r24, "principal"), r24.metrics["principal"].basis), ("20000.00", "derived"))
check("payment = disclosed", (mv(r24, "monthly_payment"), flag(r24, "PAYMENT_MISMATCH")), ("375.14", False))
r24b = compute(F(**HH), offer(**{k: v for k, v in REF.items() if k not in ("principal", "prepaid_finance_charges")}))
check("AF only -> assumed_pfc_zero + mismatch flag reveals fee", (r24b.metrics["principal"].basis,
      flag(r24b, "PFC_ASSUMED_ZERO"), flag(r24b, "PAYMENT_MISMATCH")), ("assumed_pfc_zero", True, True))

print("== A-28 trade-in accounting (itemization-derived principal, IMP-008) ==")
for payoff, tp_exp, roll_exp in [("5000.00", "28949.43", "0.00"), ("10000.00", "31889.89", "2000.00")]:
    eq = D(8000) - D(payoff); Pn = D(25000) - D(1000) - eq
    pay28, rows28 = ind_schedule(Pn, D("0.07"), 60); top28 = sum(r[0] for r in rows28)
    ind_tp = top28 + 1000 + max(eq, D(0))
    r28 = compute(F(**HH), offer(cash_price="25000.00", cash_down="1000.00", contract_rate="0.07", term_months="60",
                                 trade_in_value="8000.00", trade_in_payoff=payoff))
    check(f"payoff {payoff} principal", mv(r28, "principal"), str(r2(Pn)))
    check(f"payoff {payoff} total_paid_through_deal (plan {tp_exp})", mv(r28, "total_paid_through_deal"), str(ind_tp))
    check(f"payoff {payoff} plan value", str(ind_tp), tp_exp)
    check(f"payoff {payoff} rolled-in", r28.metrics["total_paid_through_deal"].breakdown.get("prior_loan_balance_rolled_in"), roll_exp)
    check(f"payoff {payoff} negative_equity_at_start", mv(r28, "negative_equity_at_start"), str(r2(max(Pn - 25000, D(0)))))

print("== A-29 savings after purchase / reserve after ==")
h29 = dict(HH); h29.update({"savings.liquid": "4000.00", "expenses.flexible.total": None,
                            "vehicle.new_ownership_costs_monthly": None})
h29 = {k: v for k, v in h29.items() if v is not None}
r29 = compute(F(**h29), offer(principal="15000.00", contract_rate="0", term_months="60", cash_down="3000.00"))
check("payment 0% = 250.00", mv(r29, "monthly_payment"), "250.00")
check("F13 = 1000.00", mv(r29, "savings_after_purchase"), "1000.00")
check("reserve after = 1000/3150 = 0.32", mv(r29, "reserve_months_after"), str(r2(D(1000) / 3150)))

print("== A-30 replacement netting ==")
h30 = {"income.take_home_monthly": "3600.00", "expenses.essential.total": "2300.00",
       "expenses.current_vehicle_costs_monthly": "260.00", "vehicle.replaces_current": "true",
       "vehicle.new_ownership_costs_monthly": "310.00", "expenses.flexible.total": "500.00", "debts.count": "1",
       "debts[d1].monthly_payment": "150.00", "debts[d1].type": "student_loan", "savings.liquid": "5000.00",
       "loan.down_payment_source": "other"}
r30 = compute(F(**h30), offer(principal="25200.00", contract_rate="0", term_months="60"))
check("payment 420.00", mv(r30, "monthly_payment"), "420.00")
check("monthly_left_after = 180.00", mv(r30, "monthly_left_after"), "180.00")

print("== A-32 deficit computed and flagged ==")
h32 = dict(HH); h32["income.take_home_monthly"] = "2000.00"
r32 = compute(F(**h32), offer(**REF))
check("monthly_left_before = -1300.00", mv(r32, "monthly_left_before"), "-1300.00")
check("DEFICIT_BEFORE_LOAN / AFTER flags", (flag(r32, "DEFICIT_BEFORE_LOAN"), flag(r32, "DEFICIT_AFTER_LOAN")), (True, True))

print("== A-27 manual typo ($3,751.40 vs $375.14) ==")
r27 = compute(F(**HH), offer(**{**REF, "monthly_payment": "3751.40"}))
check("PAYMENT_MISMATCH triggered", (flag(r27, "PAYMENT_MISMATCH"), r27.metrics["monthly_payment"].mismatch), (True, "-3376.26"))
oc27 = offer_checks(offer(**{**REF, "monthly_payment": "3751.40"}))
check("offer_checks.payment_mismatch", str(oc27.payment_mismatch), "-3376.26")

print("== D0-001 itemization (IMP-007) ==")
check("reference itemization", offer_checks(offer(**REF)).itemization, "pass")
oc_bad = offer_checks(offer(**{**REF, "cash_price": "22002.00"}))
check("cash_price +2.00 -> non-pass", oc_bad.itemization in ("warn", "fail"), True)
print(f"     (value returned: {oc_bad.itemization!r})")
check("AF-only offer itemization", offer_checks(offer(**{k: v for k, v in REF.items() if k not in ('principal',)})).itemization, "pass")
try:
    from documents.manual import build_manual_offer
    mo = build_manual_offer("s_audit", ManualOfferRequest(terms=dict(REF)))
    check("manual path terms[*].checks.itemization == pass",
          {t.checks.itemization for t in mo.terms.values()} - {"not_applicable"}, {"pass"})
    check("manual path ready_for_calculation", mo.ready_for_calculation, True)
except Exception as e:  # noqa: BLE001
    check(f"manual path build ({type(e).__name__}: {e})", False, True)

print("== Missing-value handling (unknown never zero) ==")
hf = {k: v for k, v in HH.items() if k != "expenses.flexible.total"}
rf = compute(F(**hf), offer(**REF))
check("no flexible -> F08 = 1300.00 labelled 'before discretionary spending'",
      (mv(rf, "monthly_left_before"), rf.metrics["monthly_left_before"].label), ("1300.00", "before discretionary spending"))
hn = {k: v for k, v in HH.items() if k != "vehicle.new_ownership_costs_monthly"}
rn = compute(F(**hn), offer(**REF))
print(f"     no new-car costs -> F14={mv(rn, 'incremental_vehicle_costs')!r} label={rn.metrics['incremental_vehicle_costs'].label!r} "
      f"assumptions_used={rn.assumptions_used} derived_status={rn.derived_status!r} F09={mv(rn, 'monthly_left_after')!r}")
check("no new-car costs -> a_no_running_costs recorded", "a_no_running_costs" in rn.assumptions_used, True)
check("no new-car costs -> F14 labelled", bool(rn.metrics["incremental_vehicle_costs"].label), True)
hd = dict(HH); hd.update({"debts.count": "1", "debts[d1].type": "credit_card"})
fd = F(**hd); fd["debts[d1].monthly_payment"] = {"key": "debts[d1].monthly_payment", "value": None, "status": "missing"}
rd = compute(fd, offer(**REF))
for k in ["monthly_left_before", "monthly_left_after", "reserve_months_before", "reserve_months_after"]:
    check(f"debt payment missing -> {k} missing", (mv(rd, k), rd.metrics[k].status), (None, "missing"))
check("debt payment missing -> missing_inputs names the item", "debts[d1].monthly_payment" in (rd.metrics["monthly_left_before"].missing_inputs or []), True)
hneg = dict(HH); hneg["savings.liquid"] = "2500.00"
rneg = compute(F(**hneg), offer(**REF))
check("negative F13 computed (2500-4000)", mv(rneg, "savings_after_purchase"), "-1500.00")
check("negative F13 -> RESERVE_LT_1_MONTH", flag(rneg, "RESERVE_LT_1_MONTH"), True)
print(f"     negative F13 -> reserve_months_after={mv(rneg, 'reserve_months_after')!r} warnings={rneg.warnings}")
fdec = F(**HH); fdec["savings.liquid"] = {"key": "savings.liquid", "value": None, "status": "declined"}
rdec = compute(fdec, offer(**REF))
check("declined savings -> F13 missing", (mv(rdec, "savings_after_purchase"), rdec.metrics["savings_after_purchase"].status), (None, "missing"))
fest = F(**HH); fest["income.take_home_monthly"]["status"] = "estimated"
check("estimated input propagates to derived_status", compute(fest, offer(**REF)).derived_status, "estimated")

print(f"\nTOTAL: {sum(R)} PASS / {len(R) - sum(R)} FAIL")
