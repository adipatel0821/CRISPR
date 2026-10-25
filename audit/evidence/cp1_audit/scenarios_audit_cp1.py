"""Agent 5 CP1 spot-check of scenarios (A-09r, A-33, A-34, A-36 basis) and counterfactuals (A-11r, A-36) with an
independent month-by-month recompute. Run from backend/: PYTHONPATH=. .venv/Scripts/python.exe <this file>"""
from decimal import Decimal as D, ROUND_HALF_UP

R = []


def check(name, got, exp):
    ok = got == exp; R.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}: got={got!r} expected={exp!r}")


from schemas.contracts import LoanOffer, VerifiedFinancialTerm, TERM_VALUE_TYPES  # noqa: E402
from engine import compute, build_inputs, month_net  # noqa: E402
from scenarios import run_catalog  # noqa: E402
from counterfactual import evaluate  # noqa: E402


def F(**kv):
    return {k: {"key": k, "value": v, "status": "provided", "verification": "none"} for k, v in kv.items()}


def offer(**terms):
    t = {k: VerifiedFinancialTerm(term_key=k, value=str(v), value_type=TERM_VALUE_TYPES.get(k, "currency"),
                                  status="provided", verification="user_confirmed", source_kind="user_input")
         for k, v in terms.items()}
    return LoanOffer(offer_id="o_audit", session_id="s_audit", origin="manual", terms=t, ready_for_calculation=True)


# household with a debt ending in month 4 (A-09r)
HH = {"income.take_home_monthly": "4200.00", "income.variability": "stable", "expenses.essential.total": "2900.00",
      "expenses.current_vehicle_costs_monthly": "260.00", "vehicle.replaces_current": "true",
      "vehicle.new_ownership_costs_monthly": "310.00", "expenses.flexible.total": "400.00", "debts.count": "1",
      "debts[d1].type": "personal_loan", "debts[d1].monthly_payment": "200.00", "debts[d1].remaining_months": "4",
      "savings.liquid": "6000.00", "loan.down_payment_source": "savings"}
REF = dict(cash_price="22000.00", taxes_title_fees="1500.00", cash_down="4000.00", principal="20000.00",
           amount_financed="19500.00", prepaid_finance_charges="500.00", contract_rate="0.0475",
           apr="0.05796", term_months="60", monthly_payment="375.14")
facts, off = F(**HH), offer(**REF)
inputs = build_inputs(facts, off)
PAY = D("375.14")

print("== A-09r baseline month_net vs independent arithmetic (debt ends after month 4) ==")
for run in ("without_offer", "with_offer"):
    ok_all = True
    for t in range(1, 13):
        debt = D(200) if t <= 4 else D(0)
        exp = D(4200) - 2900 - 400 - debt - ((PAY + 50) if run == "with_offer" else 0)
        got = month_net(t, inputs, run)
        if got != exp:
            ok_all = False; print(f"     month {t} {run}: engine {got} vs {exp}")
    check(f"{run}: 12 months equal", ok_all, True)

results, resilience = run_catalog(facts, off)
by = {(r.scenario_id, r.run): r for r in results}
print("   scenarios:", sorted({r.scenario_id for r in results}))

print("== A-09r scenario path net == month_net on unshocked months; A-33 floor/gap; A-34 pairing ==")
for (sid, run), r in sorted(by.items()):
    # independent floored recursion over the engine's reported nets
    s = D(r.start_balance); sav = max(s, D(0)); gap = max(-s, D(0)); mx = gap; floor_ok = True; path_ok = True
    for p in r.monthly_paths:
        net = D(p.net)
        if net >= 0:
            rep = min(gap, net); gap -= rep; sav += net - rep
        else:
            raw = sav + net
            if raw < 0:
                gap += -raw; sav = D(0)
            else:
                sav = raw
        mx = max(mx, gap)
        floor_ok &= D(p.savings_balance) >= 0
        path_ok &= (D(p.savings_balance), D(p.unfunded_gap)) == (sav.quantize(D("0.01")), gap.quantize(D("0.01")))
        comp = D(p.income) - D(p.essential) - D(p.flexible) - D(p.debt_payments) - D(p.new_payment) \
            - D(p.incremental_vehicle_costs) - D(p.one_time)
        path_ok &= comp == net
    check(f"{sid}/{run}: S_t>=0, balances & components recompute, max_gap", (floor_ok, path_ok, D(r.max_unfunded_gap)),
          (True, True, mx.quantize(D("0.01"))))
exp_spike = by.get(("sc_expense_spike", "without_offer"))
if exp_spike:
    nets = [D(p.net) for p in exp_spike.monthly_paths]
    unshocked = all(nets[t - 1] == month_net(t, inputs, "without_offer") for t in range(1, 13) if t != 2)
    check("sc_expense_spike without_offer unshocked months == month_net", unshocked, True)
    check("sc_expense_spike one_time month 2 == essentials", exp_spike.monthly_paths[1].one_time, "2900.00")
check("start balances: without=6000.00, with=F13 2000.00",
      (by[("sc_expense_spike", "without_offer")].start_balance, by[("sc_expense_spike", "with_offer")].start_balance),
      ("6000.00", "2000.00"))
sids = {r.scenario_id for r in results}
for sid in sids:
    a, b = by.get((sid, "without_offer")), by.get((sid, "with_offer"))
    if a and b:
        check(f"A-34 {sid}: runway without >= with", a.months_of_runway >= b.months_of_runway, True)
check("A-10r every assumption text has 'Illustrative'",
      all("Illustrative" in a.text for r in results for a in r.assumptions if a.assumption_id.startswith("a_illustr")), True)

print("== A-33 floor & gap with a large shock (job loss on thin savings) ==")
thin = dict(HH); thin["savings.liquid"] = "4500.00"
res2, _ = run_catalog(F(**thin), off)
jl = next(r for r in res2 if r.scenario_id == "sc_job_loss" and r.run == "with_offer")
print(f"     sc_job_loss/with_offer start={jl.start_balance} first_shortfall={jl.first_shortfall_month} "
      f"max_gap={jl.max_unfunded_gap} recovery={jl.recovery_month}")
check("job loss with thin savings: all S_t >= 0", all(D(p.savings_balance) >= 0 for p in jl.monthly_paths), True)
check("job loss: shortfall recorded", jl.first_shortfall_month is not None and D(jl.max_unfunded_gap) > 0, True)

print("== A-11r / A-36 counterfactuals ==")
cf = evaluate(F(**{k: v for k, v in HH.items() if not k.startswith("debts")} | {"debts.count": "0"}), off)
base_calc = compute(F(**{k: v for k, v in HH.items() if not k.startswith("debts")} | {"debts.count": "0"}), off)
base = next(a for a in cf.alternatives if a.is_base)
check("A-11r base alternative == base calc (payment, FC, left after, F13)",
      (base.metrics["monthly_payment"], base.metrics["finance_charge"], base.metrics["monthly_left_after"],
       base.metrics["savings_after_purchase"]),
      tuple(base_calc.metrics[k].value for k in ("monthly_payment", "finance_charge", "monthly_left_after",
                                                 "savings_after_purchase")))
terms = sorted([a for a in cf.alternatives if a.lever_values.get("cash_down_delta") == "0"
                and not a.lever_values.get("remove_optional_add_ons") and a.lever_values.get("offer_id") == base.lever_values.get("offer_id")],
               key=lambda a: a.lever_values["term_months"])
pays = [D(a.metrics["monthly_payment"]) for a in terms]; fcs = [D(a.metrics["finance_charge"]) for a in terms]
print("     term ladder:", [(a.lever_values["term_months"], a.metrics["monthly_payment"], a.metrics["finance_charge"]) for a in terms])
check("A-11r longer term -> lower payment & higher finance charge",
      all(pays[i] > pays[i + 1] for i in range(len(pays) - 1)) and all(fcs[i] < fcs[i + 1] for i in range(len(fcs) - 1)), True)
check("A-38 non-native terms carry same_rate_assumed",
      all("same_rate_assumed" in a.assumption_flags for a in terms if a.lever_values["term_months"] != 60), True)
plus2k = next((a for a in cf.alternatives if a.lever_values.get("cash_down_delta") == "2000"
               and a.lever_values.get("term_months") == 60 and not a.lever_values.get("remove_optional_add_ons")), None)
if plus2k:
    # independent: principal 18000, 4.75%/60
    r = D("0.0475") / 12
    ind_pay = (D(18000) * r / (1 - (1 + r) ** -60)).quantize(D("0.01"), ROUND_HALF_UP)
    check("A-36 +$2,000 down: payment (independent 18000@4.75/60)", plus2k.metrics["monthly_payment"], str(ind_pay))
    check("A-36 deltas: savings_after_purchase -2000.00, payment down",
          (plus2k.deltas_vs_base.get("savings_after_purchase"), D(plus2k.deltas_vs_base.get("monthly_payment")) < 0),
          ("-2000.00", True))
else:
    check("A-36 +$2,000 alternative present", False, True)
check("A-37 only the verified offer id appears", {a.lever_values.get("offer_id") for a in cf.alternatives}, {"o_audit"})
print(f"\nTOTAL: {sum(R)} PASS / {len(R) - sum(R)} FAIL")
