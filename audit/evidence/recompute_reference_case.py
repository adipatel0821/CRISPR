"""Agent 5 independent recompute of backend/fixtures/reference_case.json and CP1 acceptance vectors.
Pure Python decimal; does NOT import the project engine. Formulas per stage_03 §11 (v1.1).
Run: python recompute_reference_case.py [path/to/reference_case.json]
"""
import json, sys
from decimal import Decimal as D, ROUND_HALF_UP, getcontext
getcontext().prec = 28
C = D("0.01")
def r2(x): return x.quantize(C, rounding=ROUND_HALF_UP)

def payment(P, i, n):
    r = i / 12
    if r == 0: return r2(P / n)
    return r2(P * r / (1 - (1 + r) ** -n))

def schedule(P, i, n):
    r = i / 12; pay = payment(P, i, n); bal = P; rows = []
    for k in range(1, n + 1):
        I = r2(bal * r)
        p_k = pay if k < n else bal + I          # final payment absorbs residue
        pr = p_k - I; bal = bal - pr
        rows.append((k, p_k, I, pr, bal))
    return pay, rows

def apr_solve(AF, pay_rows, n):
    # AF = PV of the actual payment stream at monthly rate x/12; bisection on [0, 2]
    def pv(x):
        r = x / 12
        return sum(p / (1 + r) ** k for k, p, *_ in pay_rows) if r else sum(p for _, p, *_ in pay_rows)
    lo, hi = D(0), D(2)
    for _ in range(200):
        mid = (lo + hi) / 2
        if pv(mid) > AF: lo = mid
        else: hi = mid
    return (lo + hi) / 2

def apr_level(AF, pay, n):
    # textbook level-payment form used in stage_03 F05: AF = P(1-(1+x/12)^-n)/(x/12)
    lo, hi = D(0), D(2)
    for _ in range(200):
        mid = (lo + hi) / 2; r = mid / 12
        pv = pay * (1 - (1 + r) ** -n) / r if r else pay * n
        if pv > AF: lo = mid
        else: hi = mid
    return (lo + hi) / 2

out = []
def p(*a): s = " ".join(str(x) for x in a); print(s); out.append(s)

path = sys.argv[1] if len(sys.argv) > 1 else "backend/fixtures/reference_case.json"
fx = json.load(open(path)); t = fx["offer"]["terms"]; facts = {f["key"]: f["value"] for f in fx["facts"]}; exp = fx["expected"]

P = D(t["principal"]); AF = D(t["amount_financed"]); PFC = D(t["prepaid_finance_charges"]); i = D(t["contract_rate"])
n = int(t["term_months"]); CD = D(t["cash_down"]); price = D(t["cash_price"]); ttf = D(t["taxes_title_fees"])
pay, rows = schedule(P, i, n)
TOP = sum(r[1] for r in rows); interest = TOP - P; fc = TOP - AF
apr_stream = apr_solve(AF, rows, n); apr_lvl = apr_level(AF, pay, n)
F04 = TOP + CD + D(0) + max(D(0), D(0))               # PFC paid in cash 0, no trade-in
F04_breakdown = price + ttf + D(0) + D(0) + fc
take = D(facts["income.take_home_monthly"]); ess = D(facts["expenses.essential.total"]); flex = D(facts["expenses.flexible.total"])
debts = D(0); sav = D(facts["savings.liquid"])
F14 = D(facts["vehicle.new_ownership_costs_monthly"]) - (D(facts["expenses.current_vehicle_costs_monthly"]) if facts["vehicle.replaces_current"] == "true" else D(0))
F08 = take - ess - debts - flex
F09 = take - ess - debts - pay - F14 - flex
F13 = sav - (CD if facts["loan.down_payment_source"] == "savings" else 0)
F10b = r2(sav / (ess + debts)); F10 = r2(F13 / (ess + debts + pay + F14))
F11 = (r2(sav / take), r2(F13 / take))
itemization = price + ttf - CD - (AF + PFC)

calc = {
    "principal": r2(P), "monthly_payment": pay, "total_of_payments": TOP, "interest": interest, "finance_charge": fc,
    "total_paid_through_deal": F04, "apr_recomputed_approx": apr_stream.quantize(D("0.00001"), ROUND_HALF_UP),
    "monthly_left_before": F08, "incremental_vehicle_costs": F14, "monthly_left_after": F09,
    "savings_after_purchase": F13, "reserve_months_before": F10b, "reserve_months_after": F10,
}
p("== reference_case.json recompute ==")
p(f"final payment n={n}: {rows[-1][1]} (regular {pay}); final balance {rows[-1][4]}")
p(f"APR (actual payment stream, 10dp) = {apr_stream.quantize(D('1e-10'))}; level-payment form = {apr_lvl.quantize(D('1e-10'))}")
p(f"F04 breakdown sum = {F04_breakdown} (must equal F04 {F04}); itemization residual = {itemization}")
p(f"F11 savings_months_of_income before/after = {F11[0]} / {F11[1]}; F07 payment/take-home = {(pay / take).quantize(D('0.0001'), ROUND_HALF_UP)}")
fails = 0
for k, v in calc.items():
    e = exp[k]; ok = D(e) == v
    fails += not ok
    p(f"  {k:26s} expected {e:>10s}  recomputed {str(v):>10s}  {'OK' if ok else 'MISMATCH'}")
r1 = rows[0]; e1 = exp["first_schedule_row"]
ok1 = (r1[0], str(r1[1]), str(r1[2]), str(r1[3]), str(r1[4])) == (e1["n"], e1["payment"], e1["interest"], e1["principal"], e1["balance"])
fails += not ok1
p(f"  first_schedule_row expected {e1} recomputed {r1}  {'OK' if ok1 else 'MISMATCH'}")
p(f"  disclosed APR term in fixture = {t['apr']}; |disclosed - recomputed| = {abs(D(t['apr']) - apr_stream).quantize(D('1e-7'))} (<= 0.00125 => pass)")

p("\n== CP1 acceptance vectors (for later engine audit) ==")
# A-07r CFPB en-753 not reproduced here (table not in repo); A-28 trade-in accounting
for payoff, exp_tp, exp_roll in [(D(5000), D("28949.43"), D("0")), (D(10000), D("31889.89"), D("2000"))]:
    price2, cd2, tv = D(25000), D(1000), D(8000); EQ = tv - payoff
    Pn = price2 - cd2 - EQ                               # negative equity rolls in; positive equity reduces note
    pay2, rows2 = schedule(Pn, D("0.07"), 60); TOP2 = sum(r[1] for r in rows2)
    tp = TOP2 + cd2 + max(EQ, D(0)); roll = max(-EQ, D(0))
    ok = tp == exp_tp and roll == exp_roll; fails += not ok
    p(f"  A-28 payoff {payoff}: Pn {Pn} pay {pay2} TOP {TOP2} total_paid {tp} (exp {exp_tp}) rolled_in {roll} (exp {exp_roll}) {'OK' if ok else 'MISMATCH'}")
a29 = r2((D(4000) - D(3000)) / D(3150)); ok = a29 == D("0.32"); fails += not ok
p(f"  A-29 reserve after = {a29} (exp 0.32) {'OK' if ok else 'MISMATCH'}")
a30 = D(3600) - D(2300) - D(150) - D(420) - (D(310) - D(260)) - D(500); ok = a30 == D(180); fails += not ok
p(f"  A-30 monthly left after = {a30} (exp 180) {'OK' if ok else 'MISMATCH'}")
p(f"\nTOTAL MISMATCHES: {fails}")
