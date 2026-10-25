"""Build the web fixture JSON files (src/fixtures/*.json) for NEXT_PUBLIC_USE_FIXTURES=1.

OFFLINE fixture-data generation only. This script is never shipped to the browser and the UI never
computes loan math: it only formats the strings written here. Arithmetic follows the formula table in
architecture-research/stage-03-financial-modeling/stage_03_architecture.md (F00-F14, F01s schedule) with
Python Decimal and ROUND_HALF_UP, and every headline value is ASSERTED against the independent audited
values in backend/fixtures/reference_case.json ("expected") before anything is written.

Run from web/:  P:/Projects/DecisionTwin/backend/.venv/Scripts/python.exe scripts/build_fixtures.py
Then validate:  P:/Projects/DecisionTwin/backend/.venv/Scripts/python.exe scripts/validate_fixtures.py
"""
from __future__ import annotations

import json
from decimal import ROUND_HALF_UP, Decimal, getcontext
from pathlib import Path

getcontext().prec = 34
HERE = Path(__file__).resolve().parent
WEB = HERE.parent
REPO = WEB.parent
OUT = WEB / "src" / "fixtures"
REF = json.loads((REPO / "backend" / "fixtures" / "reference_case.json").read_text(encoding="utf-8"))
EXP = REF["expected"]

C = Decimal("0.01")
SESSION = "s_fixture_demo"
DOC = "d_fixture_contract_a"
OFFER = "o_fixture_offer_a"
GENERATED_AT = "2026-10-25T01:30:00Z"


def r2(x: Decimal) -> Decimal:
    return x.quantize(C, rounding=ROUND_HALF_UP)


def s(x: Decimal) -> str:
    return str(r2(x))


def payment(pn: Decimal, rate: Decimal, n: int) -> Decimal:
    r = rate / 12
    if r == 0:
        return r2(pn / n)
    return r2(pn * r / (1 - (1 + r) ** (-n)))


def schedule(pn: Decimal, rate: Decimal, n: int) -> list[dict]:
    r = rate / 12
    p = payment(pn, rate, n)
    bal = pn
    rows = []
    for k in range(1, n + 1):
        i = r2(bal * r)
        pay = bal + i if k == n else p
        pr = pay - i
        bal = bal - pr
        rows.append({"n": k, "payment": s(pay), "interest": s(i), "principal": s(pr), "balance": s(bal)})
    return rows


def loan(principal: Decimal, pfc: Decimal, rate: Decimal, n: int) -> dict:
    rows = schedule(principal, rate, n)
    top = sum(Decimal(r["payment"]) for r in rows)
    af = principal - pfc
    return {
        "payment": Decimal(rows[0]["payment"]), "top": top, "finance_charge": top - af,
        "interest": top - principal, "rows": rows,
    }


# ---------------------------------------------------------------------------
# Inputs (reference case)
# ---------------------------------------------------------------------------
take_home = Decimal("4200.00")
essential = Decimal("2900.00")
current_car = Decimal("260.00")
new_car = Decimal("310.00")
flexible = Decimal("400.00")
savings = Decimal("6000.00")
cash_price = Decimal("22000.00")
taxes = Decimal("1500.00")
cash_down = Decimal("4000.00")
principal = Decimal("20000.00")
amount_financed = Decimal("19500.00")
pfc = Decimal("500.00")
contract_rate = Decimal("0.0475")
apr = Decimal("0.05796")
term = 60

base = loan(principal, pfc, contract_rate, term)
incremental = new_car - current_car                                   # F14
left_before = take_home - essential - flexible                        # F08 (no debts)
left_after = left_before - base["payment"] - incremental              # F09
savings_after = savings - cash_down                                   # F13 (down payment from savings)
reserve_before = savings / essential                                  # F10b
reserve_after = savings_after / (essential + base["payment"] + incremental)  # F10
total_through_deal = base["top"] + cash_down                          # F04 (no PFC in cash, no negative equity)

# --- independent checks against the audited reference values ---------------
assert s(base["payment"]) == EXP["monthly_payment"], base["payment"]
assert s(base["top"]) == EXP["total_of_payments"], base["top"]
assert s(base["interest"]) == EXP["interest"]
assert s(base["finance_charge"]) == EXP["finance_charge"]
assert s(total_through_deal) == EXP["total_paid_through_deal"]
assert s(left_before) == EXP["monthly_left_before"]
assert s(incremental) == EXP["incremental_vehicle_costs"]
assert s(left_after) == EXP["monthly_left_after"]
assert s(savings_after) == EXP["savings_after_purchase"]
assert s(reserve_before) == EXP["reserve_months_before"]
assert s(reserve_after) == EXP["reserve_months_after"]
assert base["rows"][0] == EXP["first_schedule_row"], base["rows"][0]


# ---------------------------------------------------------------------------
# Evidence, claims
# ---------------------------------------------------------------------------
def ev(evidence_id, kind, label, ref, verification="none"):
    return {"evidence_id": evidence_id, "kind": kind, "verification": verification, "ref": ref,
            "display_label": label}


FORMULAS = {
    "F00": "Principal", "F01": "Monthly payment", "F01s": "Payment schedule", "F02": "Total of payments",
    "F03": "Finance charge", "F03i": "Interest", "F04": "Total paid through this deal",
    "F05": "APR recomputed", "F06": "Loan-to-value", "F06d": "Negative equity at start",
    "F07": "Payment ÷ take-home", "F07b": "Debt-to-income", "F08": "Monthly left before",
    "F09": "Monthly left after", "F10b": "Reserve months before", "F10": "Reserve months after",
    "F11": "Savings months of income", "F12": "Equity timeline", "F13": "Savings after purchase",
    "F14": "Incremental vehicle costs",
}
evidence = [ev(f"ev_calc_{fid}", "calculation", f"Calculated · {fid} {name}",
               {"formula_id": fid, "formula_name": name}) for fid, name in FORMULAS.items()]

FACT_IDS = {
    "income.take_home_monthly": "f_take_home", "income.variability": "f_variability",
    "expenses.essential.total": "f_essential", "expenses.current_vehicle_costs_monthly": "f_current_car",
    "vehicle.replaces_current": "f_replaces", "vehicle.new_ownership_costs_monthly": "f_new_car",
    "expenses.flexible.total": "f_flexible", "debts.count": "f_debts_count", "savings.liquid": "f_savings",
    "loan.down_payment_source": "f_down_source",
}
FACT_LABEL = {
    "income.take_home_monthly": "Monthly take-home pay", "income.variability": "How steady your income is",
    "expenses.essential.total": "Essential monthly expenses",
    "expenses.current_vehicle_costs_monthly": "Current car costs (monthly)",
    "vehicle.replaces_current": "New car replaces your current one",
    "vehicle.new_ownership_costs_monthly": "New car running costs (monthly)",
    "expenses.flexible.total": "Flexible monthly spending", "debts.count": "Number of existing debts",
    "savings.liquid": "Savings you could use", "loan.down_payment_source": "Where the down payment comes from",
}
ESTIMATED = {"vehicle.new_ownership_costs_monthly"}
for f in REF["facts"]:
    est = f["key"] in ESTIMATED
    evidence.append(ev(f"ev_fact_{FACT_IDS[f['key']].removeprefix('f_')}", "user_input",
                       "Estimate · you told us" if est else "You told us",
                       {"fact_id": FACT_IDS[f["key"]], "fact_key": f["key"], "value": f["value"],
                        "status": "estimated" if est else "provided"}))

TERM_QUOTES = {
    "apr": ("ANNUAL PERCENTAGE RATE", "5.796 %", "ANNUAL PERCENTAGE RATE The cost of your credit as a yearly rate 5.796 %"),
    "finance_charge": ("FINANCE CHARGE", "$3,008.29", "FINANCE CHARGE The dollar amount the credit will cost you $3,008.29"),
    "amount_financed": ("Amount Financed", "$19,500.00", "Amount Financed The amount of credit provided to you or on your behalf $19,500.00"),
    "total_of_payments": ("Total of Payments", "$22,508.29", "Total of Payments The amount you will have paid after you have made all payments as scheduled $22,508.29"),
    "monthly_payment": ("Amount of Payments", "$375.14", "Number of Payments 60 Amount of Payments $375.14 When Payments Are Due Monthly beginning 12/01/2026"),
    "term_months": ("Number of Payments", "60", "Number of Payments 60 Amount of Payments $375.14"),
    "cash_price": ("Cash Price", "$22,000.00", "1. Cash Price (including accessories) $22,000.00"),
    "taxes_title_fees": ("Taxes, title and fees", "$1,500.00", "2. Taxes, title and registration fees $1,500.00"),
    "cash_down": ("Cash Down Payment", "$4,000.00", "3. Cash Down Payment $4,000.00"),
    "principal": ("Principal Balance", "$20,000.00", "4. Principal Balance (amount of note) $20,000.00"),
    "prepaid_finance_charges": ("Prepaid Finance Charge", "$500.00", "5. Prepaid Finance Charge (loan origination fee) $500.00"),
    "contract_rate": ("Contract Rate", "4.75 %", "Simple interest contract rate 4.75 % per year"),
}
TILA_BOX = {"apr", "finance_charge", "amount_financed", "total_of_payments", "monthly_payment", "term_months"}
for key, (label, vtext, quote) in TERM_QUOTES.items():
    matched = key in TILA_BOX
    evidence.append(ev(f"ev_term_{key}", "document",
                       "From your contract, p.1 · matched · you confirmed" if matched
                       else "From your contract, p.1 · you confirmed",
                       {"doc_id": DOC, "page": 1, "term_key": key, "label_text": label, "value_text": vtext,
                        "quote": quote},
                       "evidence_matched_user_confirmed" if matched else "user_confirmed"))

ASSUMPTIONS = [
    {"assumption_id": "a_illustrative_scenarios",
     "text": "Illustrative scenario chosen by DecisionTwin to show how your plan responds. It is not a forecast of what will happen to you.",
     "source_kind": "assumption", "citation": None},
    {"assumption_id": "a_gap_no_interest",
     "text": "A shortfall beyond your savings is shown as an unfunded gap. No interest is added to it, and it is not a line of credit.",
     "source_kind": "assumption", "citation": None},
    {"assumption_id": "a_same_rate",
     "text": "Alternatives with a different term or down payment assume the lender would offer the same rate. Ask the lender to confirm.",
     "source_kind": "assumption", "citation": "CFPB en-753"},
    {"assumption_id": "a_job_loss_no_benefits",
     "text": "In the no-income scenario, no unemployment benefits or other income are assumed.",
     "source_kind": "assumption", "citation": None},
    {"assumption_id": "a_flexible_constant",
     "text": "Flexible spending stays at the amount you gave us in every month of the scenarios.",
     "source_kind": "assumption", "citation": None},
]
evidence += [ev(f"ev_{a['assumption_id']}", "assumption", "Assumption", {"assumption_id": a["assumption_id"]})
             for a in ASSUMPTIONS]


def money(x) -> str:
    d = r2(Decimal(x))
    return f"${d:,.2f}"


# ---------------------------------------------------------------------------
# Scenarios (paired, floored at 0, unfunded gap repaid first by later positive months)
# ---------------------------------------------------------------------------
def run_scenario(sid, name, run, income_fn, one_time_fn, assumption_ids):
    with_offer = run == "with_offer"
    pay = base["payment"] if with_offer else Decimal("0.00")
    inc = incremental if with_offer else Decimal("0.00")
    bal = savings_after if with_offer else savings
    start = bal
    gap = Decimal("0.00")
    months, first_short, max_gap, recovery = [], None, Decimal("0.00"), None
    for m in range(1, 13):
        income = income_fn(m)
        one = one_time_fn(m)
        net = income - essential - flexible - pay - inc - one
        if net >= 0:
            repay = min(gap, net)
            gap -= repay
            bal += net - repay
            if repay > 0 and gap == 0 and recovery is None:
                recovery = m
        else:
            if bal + net >= 0:
                bal += net
            else:
                gap += -(bal + net)
                bal = Decimal("0.00")
                if first_short is None:
                    first_short = m
        max_gap = max(max_gap, gap)
        months.append({"month": m, "income": s(income), "essential": s(essential), "flexible": s(flexible),
                       "debt_payments": "0.00", "new_payment": s(pay), "incremental_vehicle_costs": s(inc),
                       "one_time": s(one), "net": s(net), "savings_balance": s(bal), "unfunded_gap": s(gap)})
    return {
        "scenario_id": sid, "name": name, "run": run, "calc_id": f"c_fixture_{run}",
        "derived_status": "assumed", "start_balance": s(start), "monthly_paths": months,
        "first_shortfall_month": first_short,
        "months_of_runway": 12 if first_short is None else first_short - 1,
        "max_unfunded_gap": s(max_gap), "recovery_month": recovery, "savings_end": s(bal),
        "deficit_at_baseline": False,
        "assumptions": [a for a in ASSUMPTIONS if a["assumption_id"] in assumption_ids],
    }


SCEN = [
    ("sc_expense_spike", "Unexpected expense equal to one month of essentials (month 2)",
     lambda m: take_home, lambda m: essential if m == 2 else Decimal("0.00"),
     ["a_illustrative_scenarios", "a_gap_no_interest", "a_flexible_constant"]),
    ("sc_income_cut", "Take-home pay 25% lower in months 2–4",
     lambda m: r2(take_home * Decimal("0.75")) if 2 <= m <= 4 else take_home, lambda m: Decimal("0.00"),
     ["a_illustrative_scenarios", "a_gap_no_interest", "a_flexible_constant"]),
    ("sc_job_loss", "No income for 2 months (months 2–3)",
     lambda m: Decimal("0.00") if 2 <= m <= 3 else take_home, lambda m: Decimal("0.00"),
     ["a_illustrative_scenarios", "a_gap_no_interest", "a_job_loss_no_benefits", "a_flexible_constant"]),
]
scenarios = []
for sid, name, inc_fn, one_fn, aids in SCEN:
    for run in ("without_offer", "with_offer"):
        scenarios.append(run_scenario(sid, name, run, inc_fn, one_fn, aids))

shortfall = {"without_offer": [], "with_offer": []}
for sc in scenarios:
    if sc["first_shortfall_month"] is not None:
        shortfall[sc["run"]].append(sc["scenario_id"])


def break_even(sav: Decimal, left: Decimal, m: int) -> Decimal:
    # largest income-drop fraction p held for m months with savings staying >= 0 (closed form for a
    # constant negative net: sav + m*(left - p*take_home) >= 0)
    p = (sav / m + left) / take_home
    return min(max(p, Decimal("0")), Decimal("1"))


be3 = break_even(savings_after, left_after, 3)
be6 = break_even(savings_after, left_after, 6)
assert s(be3) == "0.27"  # contracts §3.8 example value for this household
resilience = {"break_even_m3": s(be3), "break_even_m6": s(be6), "capped": False, "deficit_at_baseline": False,
              "scenarios_with_shortfall": shortfall}

# ---------------------------------------------------------------------------
# Counterfactuals
# ---------------------------------------------------------------------------
GRID = [  # (alt_id, term, cash_down_delta)
    ("alt_base", 60, 0), ("alt_t36", 36, 0), ("alt_t48", 48, 0), ("alt_t72", 72, 0),
    ("alt_d1000", 60, 1000), ("alt_t48_d1000", 48, 1000), ("alt_d2000", 60, 2000), ("alt_d3000", 60, 3000),
]
alts = []
base_metrics = None
for alt_id, n, delta in GRID:
    d = Decimal(delta)
    flags = []
    if n != term:
        flags.append("same_rate_assumed")
    if n > 60:
        flags.append("term_gt_60")
    label = ("Your offer as written" if alt_id == "alt_base" else
             ", ".join(x for x in [f"{n} months" if n != term else "", f"+{money(d)[:-3]} down" if delta else ""] if x))
    lever_values = {"cash_down_delta": str(delta), "term_months": n, "remove_optional_add_ons": False,
                    "offer_id": OFFER}
    if d > savings_after:
        alts.append({"alt_id": alt_id, "label": label, "lever_values": lever_values, "assumption_flags": flags,
                     "metrics": {"monthly_payment": None, "finance_charge": None, "monthly_left_after": None,
                                 "savings_after_purchase": None, "break_even_m3": None},
                     "deltas_vs_base": {}, "feasible": False,
                     "infeasible_reasons": [f"Needs {money(d)} more cash down, but your savings after the current "
                                            f"down payment are {money(savings_after)}."],
                     "is_base": False})
        continue
    L = loan(principal - d, pfc, contract_rate, n)
    sav_after = savings_after - d
    left = left_before - L["payment"] - incremental
    m = {"monthly_payment": s(L["payment"]), "finance_charge": s(L["finance_charge"]),
         "total_of_payments": s(L["top"]), "monthly_left_after": s(left),
         "savings_after_purchase": s(sav_after),
         "reserve_months_after": s(sav_after / (essential + L["payment"] + incremental)),
         "break_even_m3": s(break_even(sav_after, left, 3))}
    if alt_id == "alt_base":
        base_metrics = m
    alts.append({"alt_id": alt_id, "label": label, "lever_values": lever_values, "assumption_flags": flags,
                 "metrics": m, "deltas_vs_base": {}, "feasible": True, "infeasible_reasons": [],
                 "is_base": alt_id == "alt_base"})
assert base_metrics and base_metrics["finance_charge"] == EXP["finance_charge"]
for a in alts:
    if a["feasible"]:
        a["deltas_vs_base"] = {k: s(Decimal(a["metrics"][k]) - Decimal(base_metrics[k]))
                               for k in ("monthly_payment", "finance_charge", "monthly_left_after",
                                         "savings_after_purchase")}

OBJ = [("finance_charge", "min"), ("monthly_left_after", "max"), ("savings_after_purchase", "max"),
       ("break_even_m3", "max")]


def dominates(a, b):
    ge = all((Decimal(a[k]) <= Decimal(b[k])) if d == "min" else (Decimal(a[k]) >= Decimal(b[k])) for k, d in OBJ)
    gt = any((Decimal(a[k]) < Decimal(b[k])) if d == "min" else (Decimal(a[k]) > Decimal(b[k])) for k, d in OBJ)
    return ge and gt


feas = [a for a in alts if a["feasible"]]
pareto = [a["alt_id"] for a in feas if not any(dominates(b["metrics"], a["metrics"]) for b in feas if b is not a)]

plus1 = loan(principal, pfc, contract_rate + Decimal("0.01"), term)
rate_fc = plus1["finance_charge"] - base["finance_charge"]
rate_pay = plus1["payment"] - base["payment"]
t48 = next(a for a in alts if a["alt_id"] == "alt_t48")

counterfactual = {
    "base_offer_id": OFFER,
    "levers": {"cash_down_delta": ["0", "1000", "2000", "3000"], "term_months": [36, 48, 60, 72],
               "remove_optional_add_ons": [False], "offer_id": [OFFER]},
    "deferred_levers": ["price_change", "delay_purchase"],
    "alternatives": alts, "pareto_set": pareto,
    "objectives": [{"metric": k, "direction": d} for k, d in OBJ],
    "rate_sensitivity": {"per_point_finance_charge_delta": s(rate_fc),
                         "per_point_monthly_payment_delta": s(rate_pay), "statement_claim_id": "cl_rate_1pt"},
    "sensitivity_ranking": [
        {"lever": "term_months", "metric": "finance_charge", "normalized_effect": "0.71"},
        {"lever": "cash_down_delta", "metric": "finance_charge", "normalized_effect": "0.18"},
    ],
    "notes": ["Alternatives are what-if calculations under the stated assumptions, not predictions or recommendations."],
}

# ---------------------------------------------------------------------------
# Metrics, flags
# ---------------------------------------------------------------------------
FLAG_IDS = [("TERM_GT_60", False, False, "CFPB en-753", None),
            ("NEGATIVE_EQUITY_AT_START", False, False, "CFPB en-769", None),
            ("DEFICIT_BEFORE_LOAN", False, False, None, None),
            ("DEFICIT_AFTER_LOAN", False, False, None, None),
            ("RESERVE_LT_1_MONTH", True, True, "CFPB MEM 2022 (savings groups)",
             "Savings after the down payment would cover less than one month of expenses with this loan."),
            ("ADD_ONS_FINANCED", False, False, "CFPB en-797", None),
            ("PREPAYMENT_PENALTY", False, False, "CFPB en-2132", None),
            ("PAYMENT_MISMATCH", False, False, None, None),
            ("PFC_ASSUMED_ZERO", False, False, None, None)]
with_metrics = {
    "principal": {"value": s(principal), "formula_id": "F00", "basis": "stated"},
    "monthly_payment": {"value": s(base["payment"]), "formula_id": "F01", "disclosed": "375.14", "mismatch": "0.00"},
    "total_of_payments": {"value": s(base["top"]), "formula_id": "F02"},
    "finance_charge": {"value": s(base["finance_charge"]), "formula_id": "F03"},
    "interest": {"value": s(base["interest"]), "formula_id": "F03i"},
    "total_paid_through_deal": {"value": s(total_through_deal), "formula_id": "F04",
                                "breakdown": {"cash_price": s(cash_price), "taxes_title_fees": s(taxes),
                                              "add_ons": "0.00", "prior_loan_balance_rolled_in": "0.00",
                                              "finance_charge": s(base["finance_charge"])}},
    "apr_recomputed": {"value": EXP["apr_recomputed_approx"], "formula_id": "F05", "disclosed": str(apr),
                       "check": "pass"},
    "ltv": {"value": str((principal / cash_price).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)),
            "formula_id": "F06"},
    "negative_equity_at_start": {"value": "0.00", "formula_id": "F06d"},
    "payment_to_take_home": {"value": str((base["payment"] / take_home).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)),
                             "formula_id": "F07"},
    "dti_total": {"value": None, "formula_id": "F07b", "status": "missing", "missing_inputs": ["income.gross_monthly"]},
    "monthly_left_before": {"value": s(left_before), "formula_id": "F08",
                            "label": "after essentials, debts and flexible spending"},
    "incremental_vehicle_costs": {"value": s(incremental), "formula_id": "F14"},
    "monthly_left_after": {"value": s(left_after), "formula_id": "F09"},
    "savings_after_purchase": {"value": s(savings_after), "formula_id": "F13"},
    "reserve_months_before": {"value": s(reserve_before), "formula_id": "F10b"},
    "reserve_months_after": {"value": s(reserve_after), "formula_id": "F10"},
    "savings_months_of_income": {"value": None, "formula_id": "F11", "before": s(savings / take_home),
                                 "after": s(savings_after / take_home)},
    "equity_timeline": {"value": None, "formula_id": "F12", "status": "missing",
                        "missing_inputs": ["vehicle.value_estimates"]},
}
METRIC_DEFAULTS = {"value": None, "status": None, "missing_inputs": None, "basis": None, "label": None,
                   "disclosed": None, "mismatch": None, "check": None, "breakdown": None, "before": None,
                   "after": None}


def full_metrics(ms):
    return {k: {**METRIC_DEFAULTS, **v} for k, v in ms.items()}


def calc(calc_id, offer_id, metrics, flags, schedule_rows, required, assumptions_used, verification):
    return {"calc_id": calc_id, "calc_version": "1.1.0", "schema_version": "1.1", "profile_version": 10,
            "offer_id": offer_id, "derived_status": "estimated", "derived_verification": verification,
            "metrics": full_metrics(metrics), "amortization_schedule": schedule_rows,
            "flags": [{"flag_id": f, "triggered": t, "informational": i, "citation": c, "detail": d}
                      for f, t, i, c, d in flags],
            "required_inputs": required, "assumptions_used": assumptions_used, "warnings": [],
            "computed_at": GENERATED_AT}


REQ = {
    "monthly_left_after": ["income.take_home_monthly", "expenses.essential.total", "debts.*.monthly_payment", "offer.minimum_set"],
    "savings_after_purchase": ["savings.liquid", "loan.down_payment_source", "offer.minimum_set"],
}
baseline_metrics = {k: v for k, v in with_metrics.items() if k in (
    "monthly_left_before", "reserve_months_before")}
baseline_metrics["monthly_left_after"] = {"value": None, "formula_id": "F09", "status": "missing",
                                          "missing_inputs": ["offer.minimum_set"]}
baseline = calc("c_fixture_without_offer", None, baseline_metrics,
                [f for f in FLAG_IDS if f[0] in ("DEFICIT_BEFORE_LOAN",)], [], REQ, [], "none")
with_offer = calc("c_fixture_with_offer", OFFER, with_metrics, FLAG_IDS, base["rows"], REQ, [], "user_confirmed")

# ---------------------------------------------------------------------------
# Offer
# ---------------------------------------------------------------------------
CHECKS0 = {k: "not_applicable" for k in
           ("quote_match", "label_anchor", "independent_reader", "arithmetic", "itemization", "apr_recompute", "range")}
TERM_VALUES = {k: str(v) for k, v in REF["offer"]["terms"].items()}
TERM_VALUES.update({"finance_charge": "3008.29", "total_of_payments": "22508.29"})
VALUE_TYPES = {"apr": "rate", "contract_rate": "rate", "term_months": "integer"}


def make_term(key, value, pending=False):
    matched = key in TILA_BOX
    label, vtext, quote = TERM_QUOTES[key]
    checks = dict(CHECKS0, quote_match="pass", label_anchor="pass", range="pass")
    if matched:
        checks["independent_reader"] = "pass"
    if key in ("monthly_payment", "total_of_payments", "finance_charge", "amount_financed"):
        checks["arithmetic"] = "pass"
    if key in ("amount_financed", "cash_price", "taxes_title_fees", "cash_down"):
        checks["itemization"] = "pass"
    if key == "apr":
        checks["apr_recompute"] = "pass"
    if pending:
        verification = "evidence_matched" if matched else "none"
    else:
        verification = "evidence_matched_user_confirmed" if matched else "user_confirmed"
    return {"term_key": key, "value": value, "value_type": VALUE_TYPES.get(key, "currency"), "status": "provided",
            "verification": verification, "source_kind": "document",
            "evidence": {"kind": "document", "doc_id": DOC, "page": 1, "label_text": label, "value_text": vtext,
                         "quote": quote, "quote_found_in_text": True,
                         "display_label": "From your contract, p.1" + (" · matched" if matched else "")},
            "checks": checks, "alternatives_found": [], "user_action": "pending" if pending else "confirmed"}


def offer_obj(pending=False):
    return {
        "offer_id": OFFER, "session_id": SESSION, "label": REF["offer"]["label"], "origin": "document",
        "doc_id": DOC, "document_offers_count": 1, "offer_choice": None, "product_type": "fixed_rate_amortizing",
        "terms": {k: make_term(k, TERM_VALUES[k], pending) for k in TERM_QUOTES},
        "itemization": [
            {"item": "cash_price", "name": "Cash price", "amount": s(cash_price), "optional": None, "financed": True, "evidence": None},
            {"item": "taxes_title", "name": "Taxes, title and fees", "amount": s(taxes), "optional": None, "financed": True, "evidence": None},
            {"item": "cash_down", "name": "Cash down payment", "amount": s(cash_down), "optional": None, "financed": False, "evidence": None},
            {"item": "prepaid_finance_charge", "name": "Loan origination fee", "amount": s(pfc), "optional": None, "financed": True, "evidence": None},
        ],
        "derived": {"trade_in_equity": None, "negative_equity_rolled_in": "0.00", "principal_basis": "stated"},
        "unsupported_features": [], "ready_for_calculation": not pending, "warnings": [],
    }


offer = offer_obj()

# Draft offer for the document flow: one conflicting term so the verification table shows two candidates.
draft = offer_obj(pending=True)
draft["ready_for_calculation"] = False
draft["terms"]["monthly_payment"]["status"] = "conflicting"
draft["terms"]["monthly_payment"]["checks"]["independent_reader"] = "fail"
draft["terms"]["monthly_payment"]["verification"] = "none"
draft["terms"]["monthly_payment"]["alternatives_found"] = [
    {"value": "375.14", "source": "independent_reader", "quote": TERM_QUOTES["monthly_payment"][2], "page": 1},
    {"value": "357.14", "source": "llm", "quote": "Amount of Payments $357.14", "page": 1},
]
draft["terms"]["apr"]["checks"]["apr_recompute"] = "pass"
document_status = {"doc_id": DOC, "session_id": SESSION, "status": "extracted",
                   "filename": "synthetic_contract_a.pdf", "pages": 2, "is_fixture": True,
                   "extraction_method": "llm+reader", "offers_found": 1, "offer_labels": [REF["offer"]["label"]],
                   "draft_offer": draft,
                   "message": "Extracted from the bundled synthetic sample. Please check each value against the document."}

# ---------------------------------------------------------------------------
# Claims, sections
# ---------------------------------------------------------------------------
def claim(cid, ctype, metric, values, text, evs, aids=(), direction=None, template=None):
    return {"claim_id": cid, "type": ctype, "subject_metric": metric, "values": values, "direction": direction,
            "evidence_ids": list(evs), "assumption_ids": list(aids), "template_id": template or f"t_{cid[3:]}",
            "text": text}


spike_w = next(x for x in scenarios if x["scenario_id"] == "sc_expense_spike" and x["run"] == "with_offer")
job_w = next(x for x in scenarios if x["scenario_id"] == "sc_job_loss" and x["run"] == "with_offer")
job_wo = next(x for x in scenarios if x["scenario_id"] == "sc_job_loss" and x["run"] == "without_offer")
min_spike = min(Decimal(m["savings_balance"]) for m in spike_w["monthly_paths"])

claims = [
    claim("cl_cost_1", "value", "finance_charge", {"amount": s(base["finance_charge"]), "months": term},
          f"This loan costs {money(base['finance_charge'])} in finance charges over {term} months.",
          ["ev_calc_F03", "ev_term_finance_charge"]),
    claim("cl_cashflow_change", "change", "monthly_left_after",
          {"before": s(left_before), "after": s(left_after)},
          f"In a typical month, what you have left after expenses goes from {money(left_before)} to {money(left_after)}.",
          ["ev_calc_F08", "ev_calc_F09", "ev_fact_take_home", "ev_fact_essential", "ev_fact_flexible"],
          direction="down"),
    claim("cl_reserve_flag", "threshold_flag", "reserve_months_after",
          {"flag_id": "RESERVE_LT_1_MONTH", "before": s(reserve_before), "after": s(reserve_after),
           "savings_after": s(savings_after)},
          f"After the {money(cash_down)} down payment, your remaining savings of {money(savings_after)} would cover about "
          f"{s(reserve_after)} months of expenses with this loan, down from {s(reserve_before)} months.",
          ["ev_calc_F10", "ev_calc_F10b", "ev_calc_F13", "ev_fact_savings", "ev_fact_down_source"],
          direction="down"),
    claim("cl_payment", "value", "monthly_payment", {"amount": s(base["payment"]), "disclosed": "375.14"},
          f"The monthly payment is {money(base['payment'])}, which matches the payment on your contract.",
          ["ev_calc_F01", "ev_term_monthly_payment"]),
    claim("cl_interest_vs_fc", "comparison", "interest",
          {"interest": s(base["interest"]), "finance_charge": s(base["finance_charge"]), "pfc": s(pfc)},
          f"Of the finance charge, {money(base['interest'])} is interest and {money(pfc)} is the prepaid finance charge "
          "(a loan fee counted in the finance charge).",
          ["ev_calc_F03i", "ev_calc_F03", "ev_term_prepaid_finance_charges"]),
    claim("cl_total_paid", "value", "total_paid_through_deal", {"amount": s(total_through_deal)},
          f"Including your down payment, you would pay {money(total_through_deal)} in total through this deal.",
          ["ev_calc_F04", "ev_term_cash_down"]),
    claim("cl_apr_check", "comparison", "apr_recomputed", {"recomputed": "0.05796", "disclosed": "0.05796"},
          "Recomputing the APR from the amount financed and the payments gives 5.796%, the same as the disclosed APR.",
          ["ev_calc_F05", "ev_term_apr"]),
    claim("cl_savings_change", "change", "savings_after_purchase",
          {"before": s(savings), "after": s(savings_after)},
          f"Your savings go from {money(savings)} to {money(savings_after)} after the down payment.",
          ["ev_calc_F13", "ev_fact_savings", "ev_term_cash_down"], direction="down"),
    claim("cl_stress_spike", "scenario_outcome", "savings_balance",
          {"scenario_id": "sc_expense_spike", "min_balance": s(min_spike)},
          f"In this illustrative scenario (an unexpected {money(essential)} expense in month 2), your savings with this "
          f"loan dip to {money(min_spike)} and do not run out.",
          ["ev_a_illustrative_scenarios", "ev_calc_F09"], ["a_illustrative_scenarios"]),
    claim("cl_stress_job_loss", "scenario_outcome", "unfunded_gap",
          {"scenario_id": "sc_job_loss", "first_shortfall_month": job_w["first_shortfall_month"],
           "max_unfunded_gap": job_w["max_unfunded_gap"]},
          f"In this illustrative scenario (no income for 2 months), with this loan your savings run out in month "
          f"{job_w['first_shortfall_month']} and the unfunded gap reaches {money(job_w['max_unfunded_gap'])}; without the "
          f"loan, savings last all 12 months (lowest point {money(min(Decimal(m['savings_balance']) for m in job_wo['monthly_paths']))}).",
          ["ev_a_illustrative_scenarios", "ev_a_gap_no_interest", "ev_a_job_loss_no_benefits"],
          ["a_illustrative_scenarios", "a_gap_no_interest", "a_job_loss_no_benefits"]),
    claim("cl_break_even", "value", "break_even_m3", {"m3": s(be3), "m6": s(be6)},
          f"With this loan, your savings could absorb a take-home pay drop of up to {int(r2(be3 * 100))}% for 3 months, "
          f"or {int(r2(be6 * 100))}% for 6 months, before running out (illustrative).",
          ["ev_a_illustrative_scenarios", "ev_calc_F09", "ev_calc_F13"], ["a_illustrative_scenarios"]),
    claim("cl_rate_1pt", "value", "finance_charge", {"per_point": s(rate_fc), "per_point_payment": s(rate_pay)},
          f"Each 1 percentage point of interest rate changes the finance charge by about {money(rate_fc)} "
          f"(about {money(rate_pay)} a month) on this loan.",
          ["ev_calc_F03", "ev_calc_F01"]),
    claim("cl_alt_t48", "comparison", "finance_charge",
          {"alt_id": "alt_t48", "finance_charge_delta": t48["deltas_vs_base"]["finance_charge"],
           "monthly_payment_delta": t48["deltas_vs_base"]["monthly_payment"]},
          f"If offered at the same rate, a 48-month term would lower the finance charge by "
          f"{money(-Decimal(t48['deltas_vs_base']['finance_charge']))} and raise the monthly payment by "
          f"{money(t48['deltas_vs_base']['monthly_payment'])}.",
          ["ev_calc_F03", "ev_calc_F01", "ev_a_same_rate"], ["a_same_rate"]),
    claim("cl_missing_buy_rate", "missing", "loan.buy_rate", {"fact_key": "loan.buy_rate"},
          "We don't know the lender's buy rate. Ask the dealer whether the 4.75% rate includes a dealer markup.",
          [], []),
    claim("cl_missing_gross", "missing", "income.gross_monthly", {"fact_key": "income.gross_monthly"},
          "Debt-to-income isn't shown because we don't have your gross (before-tax) income.", [], []),
]


def section(sid, title, cids, tags):
    texts = [c["text"] for c in claims if c["claim_id"] in cids]
    return {"section_id": sid, "title": title, "claims": cids, "template_text": " ".join(texts),
            "narrative_text": None, "provenance_tags": tags}


explanations = [
    section("key_points", "Key points", ["cl_cost_1", "cl_cashflow_change", "cl_reserve_flag"],
            ["document", "calculation", "user_input"]),
    section("with_loan", "With this loan", ["cl_payment", "cl_cost_1", "cl_interest_vs_fc", "cl_total_paid",
                                            "cl_apr_check", "cl_cashflow_change", "cl_savings_change"],
            ["document", "calculation", "user_input"]),
    section("stress", "Under stress", ["cl_stress_spike", "cl_stress_job_loss", "cl_break_even"],
            ["calculation", "assumption"]),
    section("alternatives", "Alternatives", ["cl_alt_t48", "cl_rate_1pt"], ["calculation", "assumption"]),
    section("missing_info", "What we don't know", ["cl_missing_buy_rate", "cl_missing_gross"], ["user_input"]),
    section("assumptions", "Assumptions", [], ["assumption"]),
]

READY = [{"analysis_id": a, "available": True, "awaiting_offer": False, "required": [], "missing": [], "declined": [],
          "reason": None} for a in ["loan_cost", "cashflow_impact", "reserve_impact", "stress_test", "alternatives"]]

report = {
    "report_id": "r_fixture_demo", "session_id": SESSION, "generated_at": GENERATED_AT, "calc_version": "1.1.0",
    "schema_version": "1.1", "data_mode": "synthetic_only", "readiness": READY,
    "key_points": ["cl_cost_1", "cl_cashflow_change", "cl_reserve_flag"],
    "profile_summary": {"decision": f"Financing a {money(cash_price)[:-3]} car over {term} months",
                        "vehicle_cash_price": s(cash_price), "term_months": term,
                        "facts_provided": len(REF["facts"]) - len(ESTIMATED), "facts_estimated": len(ESTIMATED)},
    "offer": offer, "baseline": baseline, "with_offer": with_offer, "scenarios": scenarios,
    "resilience": resilience, "counterfactual": counterfactual, "claims": claims, "evidence": evidence,
    "explanations": explanations, "assumptions": ASSUMPTIONS,
    "missing_information": [
        {"fact_key": "loan.buy_rate",
         "why_it_matters": "Dealers often see several lenders' rates and may add a markup. Knowing the buy rate tells you how much of the rate is negotiable.",
         "ask_the_lender": True, "citation": "CFPB en-727, en-759"},
        {"fact_key": "income.gross_monthly",
         "why_it_matters": "Lenders look at debt-to-income using gross income. Without it we can't show that ratio.",
         "ask_the_lender": False, "citation": None},
        {"fact_key": "vehicle.value_estimates",
         "why_it_matters": "With your estimate of the car's future value we could show when you'd owe less than it's worth.",
         "ask_the_lender": False, "citation": "CFPB en-769"},
    ],
    "disclaimers": ["This analysis is arithmetic on the figures you provided and assumptions you can see. "
                    "It is not a prediction and not financial advice."],
}

# ---------------------------------------------------------------------------
# Session + question sequence (intake fixtures)
# ---------------------------------------------------------------------------
session_created = {"session_id": SESSION, "token": "fixture-token-not-a-secret", "data_mode": "synthetic_only",
                   "selected_analyses": ["loan_cost", "cashflow_impact", "reserve_impact", "stress_test", "alternatives"],
                   "created_at": "2026-10-25T01:00:00Z"}
health = {"status": "ok", "db": True, "llm_configured": False, "data_mode": "synthetic_only",
          "schema_version": "1.1", "calc_version": "1.1.0"}

Q = [  # (fact_key, kind, text, choices, why, blocks, order, allow_estimate)
    ("income.take_home_monthly", "currency", "How much take-home pay do you get in a typical month?", None,
     "Needed for: what you have left each month (cash flow, savings impact, stress tests).",
     ["cashflow_impact", "reserve_impact", "stress_test", "alternatives"], 10, True),
    ("income.variability", "choice", "How steady is your take-home pay from month to month?",
     ["stable", "somewhat_variable", "highly_variable"],
     "Needed for: choosing which illustrative stress scenarios apply to you.", ["stress_test"], 12, False),
    ("expenses.essential.total", "currency",
     "What do your essential bills add up to each month (rent, utilities, groceries, insurance, your current car)?", None,
     "Needed for: what you have left each month and how long savings would last.",
     ["cashflow_impact", "reserve_impact", "stress_test", "alternatives"], 20, True),
    ("debts.count", "number", "How many other debts do you make monthly payments on (cards, student loans, other loans)?", None,
     "Needed for: your monthly obligations. Enter 0 if none.",
     ["cashflow_impact", "reserve_impact", "stress_test", "alternatives"], 30, False),
    ("savings.liquid", "currency", "How much do you have in savings you could use in an emergency?", None,
     "Needed for: savings after the purchase and how long they would last.",
     ["reserve_impact", "stress_test", "alternatives"], 40, True),
    ("loan.down_payment_source", "choice", "Where will the down payment come from?",
     ["savings", "other", "none"], "Needed for: savings after purchase (savings impact, stress test).",
     ["reserve_impact", "stress_test", "alternatives"], 45, False),
]
REFINE = [
    ("vehicle.replaces_current", "yes_no", "Will the new car replace a car you have now?", None,
     "Improves: the change in your monthly car costs.", 60, False,
     {"metric": "monthly_left_after", "max_abs_change": "260.00", "basis": "your current car costs, if they stop"}),
    ("expenses.flexible.total", "currency", "Roughly how much flexible spending do you have in a month (eating out, hobbies)?", None,
     "Improves: what you have left each month. Without it, we show money left before flexible spending.", 62, True,
     {"metric": "monthly_left_after", "max_abs_change": "900.00", "basis": "flexible spending between $0 and your monthly leftover before this loan"}),
    ("vehicle.new_ownership_costs_monthly", "currency", "What will insurance, fuel and upkeep for the new car cost each month?", None,
     "Improves: the true monthly cost of the new car.", 64, True, None),
    ("income.gross_monthly", "currency", "What is your gross (before-tax) monthly income?", None,
     "Unlocks: debt-to-income ratio.", 70, True, None),
]


def qc(t, priority, refinement_effect=None):
    key, kind, text, choices, why = t[:5]
    if priority == "blocking":
        blocks, order, est = t[5], t[6], t[7]
    else:
        blocks, order, est = [], t[5], t[6]
    return {"question_id": f"q_{key}", "fact_key": key, "kind": kind, "text": text, "choices": choices,
            "why_we_ask": why, "priority_class": priority, "blocks_analyses": blocks, "dependency_order": order,
            "refinement_effect": refinement_effect, "allow_skip": True, "allow_estimate": est, "rule_id": None}


CASHFLOW = ["income.take_home_monthly", "expenses.essential.total", "debts.count"]
RESERVE = CASHFLOW + ["savings.liquid", "loan.down_payment_source"]
REQS = {"loan_cost": [], "cashflow_impact": CASHFLOW, "reserve_impact": RESERVE, "stress_test": RESERVE,
        "alternatives": RESERVE}
REASON_TEXT = {"income.take_home_monthly": "your monthly take-home pay",
               "expenses.essential.total": "your essential monthly expenses",
               "debts.count": "whether you have existing debt payments",
               "savings.liquid": "the savings you could use in an emergency",
               "loan.down_payment_source": "where your down payment comes from"}


def readiness(known: set[str], offer_ready: bool):
    out = []
    for a, req in REQS.items():
        missing = [k for k in req if k not in known]
        avail = not missing and offer_ready
        if missing:
            reason = "Needs " + REASON_TEXT[missing[0]] + "."
        elif not offer_ready:
            reason = "Waiting for a loan offer with amount, rate and term."
        else:
            reason = None
        out.append({"analysis_id": a, "available": avail, "awaiting_offer": not missing and not offer_ready,
                    "required": req + ["offer.minimum_set"], "missing": missing + ([] if offer_ready else ["offer.minimum_set"]),
                    "declined": [], "reason": reason})
    return out


sequence = []
known: set[str] = set()
for i, t in enumerate(Q):
    sequence.append({"question": qc(t, "blocking"), "readiness": readiness(known, False), "refinements": [],
                     "profile_version": i})
    known.add(t[0])
refinements = [qc(t, "refinement", t[7]) for t in REFINE]
sequence.append({"question": None, "readiness": readiness(known, False), "refinements": refinements,
                 "profile_version": len(Q)})
ready_after_offer = readiness(known, True)

OUT.mkdir(parents=True, exist_ok=True)
files = {
    "report.json": report, "offer.json": offer, "document.json": document_status, "session.json": session_created,
    "health.json": health, "next-questions.json": {"sequence": sequence, "after_offer_readiness": ready_after_offer},
}
for name, obj in files.items():
    (OUT / name).write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("wrote", OUT / name)
print("pareto:", pareto, "rate/pt:", s(rate_fc), s(rate_pay), "be:", s(be3), s(be6))
