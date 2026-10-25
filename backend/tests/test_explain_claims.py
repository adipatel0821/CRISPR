"""Claim-based explanations: A-12r (claim fidelity), A-41 (key points), deny-list, A-42 (label honesty).

Inputs are the audited reference case (contracts v1.1 header / §3.7) with every expected value hard-coded from the
spec; nothing here is produced by the code under test.
"""
from __future__ import annotations

import re

import pytest

from engine.requirements import evaluate_all
from explain import build_explanations, check_text, DeniedLanguageError, find_denied
from explain.templates import TEMPLATES, render
from schemas.contracts import (Alternative, Assumption, CalculationResult, CounterfactualResult, FinancialFact,
                               Flag, ItemizationItem, LoanOffer, Metric, RateSensitivity, ResilienceSummary,
                               ScenarioResult, TermEvidence, VerifiedFinancialTerm, TERM_VALUE_TYPES, CORE_ANALYSES)
from tests.conftest import reference_case

NUM = re.compile(r"\d+(?:,\d{3})*(?:\.\d+)?")

# Expected key points for the reference case (task spec / contracts header; independent of the code).
KP_COST = ("This loan costs about $3,008 in finance charges over 60 months "
           "($2,508 interest plus $500 in prepaid finance charges).")
KP_CASH = ("Your monthly leftover goes from $900 to $475 after the payment and the change in car running costs.")
KP_RESERVE = ("Your savings would go from $6,000 to $2,000 after the down payment — about 0.6 months of "
              "essential costs.")


def make_facts():
    out = {}
    for i, f in enumerate(reference_case()["facts"]):
        out[f["key"]] = FinancialFact(fact_id=f"f_{i:02d}", session_id="s_t", key=f["key"], value=f["value"],
                                      value_type="currency", status="provided")
    return out


def make_offer(origin="manual", verification="user_confirmed", itemization=()):
    terms = {}
    for k, v in reference_case()["offer"]["terms"].items():
        ev = None
        source = "user_input"
        if origin == "document":
            source = "document"
            ev = TermEvidence(kind="document", doc_id="d_1", page=1, quote=f"{k} {v}")
        terms[k] = VerifiedFinancialTerm(term_key=k, value=str(v), value_type=TERM_VALUE_TYPES[k], status="provided",
                                         verification=verification, source_kind=source, evidence=ev)
    return LoanOffer(offer_id="o_ref", session_id="s_t", origin=origin, doc_id="d_1" if origin == "document" else None,
                     terms=terms, itemization=list(itemization), ready_for_calculation=True)


def calc(with_offer=True, **overrides):
    m = {"monthly_left_before": Metric(value="900.00", formula_id="F08",
                                       label="after essentials, debts and flexible spending"),
         "reserve_months_before": Metric(value="2.07", formula_id="F10b")}
    flags = [Flag(flag_id="DEFICIT_BEFORE_LOAN", triggered=False)]
    if with_offer:
        m.update({
            "principal": Metric(value="20000.00", formula_id="F00", basis="stated"),
            "monthly_payment": Metric(value="375.14", formula_id="F01", disclosed="375.14", mismatch="0.00"),
            "total_of_payments": Metric(value="22508.29", formula_id="F02"),
            "finance_charge": Metric(value="3008.29", formula_id="F03"),
            "interest": Metric(value="2508.29", formula_id="F03i"),
            "total_paid_through_deal": Metric(value="26508.29", formula_id="F04"),
            "apr_recomputed": Metric(value="0.05796", formula_id="F05", check="pass"),
            "payment_to_take_home": Metric(value="0.0893", formula_id="F07"),
            "incremental_vehicle_costs": Metric(value="50.00", formula_id="F14"),
            "monthly_left_after": Metric(value="474.86", formula_id="F09"),
            "savings_after_purchase": Metric(value="2000.00", formula_id="F13"),
            "reserve_months_after": Metric(value="0.60", formula_id="F10"),
            "dti_total": Metric(value=None, status="missing", formula_id="F07b", missing_inputs=["income.gross_monthly"]),
        })
        flags = [Flag(flag_id="TERM_GT_60", triggered=False, citation="CFPB en-753"),
                 Flag(flag_id="RESERVE_LT_1_MONTH", triggered=True, informational=True,
                      citation="CFPB MEM 2022 (savings groups)"),
                 Flag(flag_id="PAYMENT_MISMATCH", triggered=False)]
    for k, v in overrides.items():
        m[k] = v
    return CalculationResult(calc_id="c_w" if with_offer else "c_b", offer_id="o_ref" if with_offer else None,
                             derived_verification="user_confirmed", metrics=m, flags=flags)


ILLUSTRATIVE = Assumption(assumption_id="a_illustrative_scenarios",
                          text="Illustrative scenario chosen by DecisionTwin to show how your plan responds. "
                               "It is not a forecast of what will happen to you.")


def make_scenarios():
    return [
        ScenarioResult(scenario_id="sc_expense_spike", name="Unexpected expense equal to one month of essentials",
                       run="without_offer", start_balance="6000.00", months_of_runway=12, savings_end="13900.00",
                       assumptions=[ILLUSTRATIVE]),
        ScenarioResult(scenario_id="sc_job_loss", name="No income for two months", run="with_offer",
                       start_balance="2000.00", first_shortfall_month=1, max_unfunded_gap="4200.00",
                       assumptions=[ILLUSTRATIVE]),
    ]


def make_cf():
    alts = [
        Alternative(alt_id="alt_base", label="Offer as quoted", lever_values={}, is_base=True,
                    metrics={"monthly_payment": "375.14", "finance_charge": "3008.29"}),
        Alternative(alt_id="alt_012", label="48 months, +$1,000 down",
                    lever_values={"cash_down_delta": "1000", "term_months": 48},
                    assumption_flags=["same_rate_assumed"],
                    metrics={"monthly_payment": "435.48", "finance_charge": "2403.04",
                             "savings_after_purchase": "1000.00"}),
        Alternative(alt_id="alt_bad", label="Infeasible", lever_values={}, feasible=False,
                    metrics={"monthly_payment": "1.00", "finance_charge": "1.00"}),
    ]
    return CounterfactualResult(base_offer_id="o_ref", alternatives=alts, pareto_set=["alt_012", "alt_bad"],
                                rate_sensitivity=RateSensitivity(per_point_finance_charge_delta="530.12",
                                                                 statement_claim_id="cl_rate_1pt"))


def build(facts=None, offer=None, baseline=None, with_offer=None, scenarios=None, resilience=None, cf=None,
          readiness=None):
    facts = make_facts() if facts is None else facts
    offer = make_offer() if offer is None else offer
    readiness = evaluate_all(list(CORE_ANALYSES), facts, offer) if readiness is None else readiness
    return build_explanations(facts, offer, baseline or calc(False), with_offer or calc(True),
                              make_scenarios() if scenarios is None else scenarios,
                              ResilienceSummary(break_even_m3="0.27", break_even_m6="0.14") if resilience is None
                              else resilience,
                              make_cf() if cf is None else cf, readiness)


def by_id(expl):
    return {c.claim_id: c for c in expl.claims}


# --------------------------------------------------------------------------- A-41 key points
def test_reference_key_points_exact():
    expl = build()
    claims = by_id(expl)
    assert [claims[c].text for c in expl.key_points] == [KP_COST, KP_CASH, KP_RESERVE]


def test_key_points_reproducible_from_report_values():
    """A-41: each key-point claim's values equal the report's metric/fact/term values, and re-rendering the
    template from those values alone reproduces the sentence."""
    expl = build()
    claims = by_id(expl)
    cost, cash, reserve = (claims[c] for c in expl.key_points)
    w = calc(True).metrics
    assert cost.values["finance_charge"] == w["finance_charge"].value == "3008.29"
    assert cost.values["interest"] == w["interest"].value == "2508.29"
    assert cost.values["prepaid_finance_charges"] == "500.00" and cost.values["months"] == "60"
    assert cash.values["monthly_left_before"] == "900.00" and cash.values["monthly_left_after"] == "474.86"
    assert reserve.values["savings_liquid"] == "6000.00" and reserve.values["savings_after_purchase"] == "2000.00"
    assert reserve.values["reserve_months_after"] == "0.60"
    for c in (cost, cash, reserve):
        assert render(c.template_id, c.values) == c.text
    assert set(cost.evidence_ids) >= {"ev_calc_F03", "ev_calc_F03i", "ev_term_term_months",
                                      "ev_term_prepaid_finance_charges"}
    assert set(cash.evidence_ids) >= {"ev_calc_F08", "ev_calc_F09", "ev_calc_F14"}
    assert set(reserve.evidence_ids) >= {"ev_fact_f_08", "ev_calc_F13", "ev_calc_F10"}
    assert cash.direction == "down" and reserve.direction == "down"


def test_deficit_variant_leads_with_deficit():
    """A-21: deficit before the loan -> neutral deficit key point first."""
    base = calc(False, monthly_left_before=Metric(value="-210.00", formula_id="F08"))
    w = calc(True, monthly_left_before=Metric(value="-210.00", formula_id="F08"),
             monthly_left_after=Metric(value="-635.14", formula_id="F09"))
    expl = build(baseline=base, with_offer=w)
    claims = by_id(expl)
    texts = [claims[c].text for c in expl.key_points]
    assert texts[0] == ("Before this loan, your listed expenses exceed your take-home pay by about $210 a month; "
                        "with the payment the shortfall would be about $635 a month.")
    assert texts[1] == KP_COST and len(texts) == 3


def test_shortfall_after_variant():
    w = calc(True, monthly_left_after=Metric(value="-25.50", formula_id="F09"))
    expl = build(with_offer=w)
    texts = [by_id(expl)[c].text for c in expl.key_points]
    assert texts[1] == ("Your monthly leftover goes from $900 to a shortfall of about $26 a month after the payment "
                        "and the change in car running costs.")


def test_unknown_metric_is_not_zero():
    w = calc(True, monthly_left_after=Metric(value=None, status="missing", formula_id="F09",
                                             missing_inputs=["expenses.essential.total"]))
    expl = build(with_offer=w)
    texts = " ".join(c.text for c in expl.claims)
    assert "$0" not in texts and "cl_kp_cashflow" not in expl.key_points
    assert len(expl.key_points) == 2


def test_missing_savings_drops_reserve_key_point_and_lists_missing():
    facts = make_facts()
    facts["savings.liquid"] = FinancialFact(fact_id="f_x", session_id="s_t", key="savings.liquid",
                                            value_type="currency", status="declined")
    expl = build(facts=facts)
    assert "cl_kp_reserve" not in expl.key_points and len(expl.key_points) == 2
    items = {i.fact_key: i for i in expl.missing_information}
    assert "savings.liquid" in items and "the savings view" in items["savings.liquid"].why_it_matters
    assert "chose not to share" in items["savings.liquid"].why_it_matters
    claim = by_id(expl)["cl_missing_savings.liquid"]
    assert claim.type == "missing" and claim.template_id == "t_declined"
    assert "ev_fact_f_x" in claim.evidence_ids


# --------------------------------------------------------------------------- A-12r claim fidelity
def _tokens(values) -> set[str]:
    out: set[str] = set()
    for v in values.values():
        items = v if isinstance(v, (list, tuple)) else [v]
        for it in items:
            out.update(NUM.findall(str(it)))
    return out


def _check_fidelity(expl):
    ev_ids = {e.evidence_id for e in expl.evidence}
    claims = by_id(expl)
    assert expl.claims, "no claims"
    for c in expl.claims:
        assert c.text and c.text[-1] in ".!?", c.claim_id
        assert c.evidence_ids and set(c.evidence_ids) <= ev_ids, c.claim_id
        for tok in NUM.findall(c.text):
            assert tok in _tokens(c.values), (c.claim_id, tok, c.text)
    for s in expl.sections:
        assert s.narrative_text is None
        assert s.claims and all(cid in claims for cid in s.claims)
        assert s.template_text == " ".join(claims[cid].text for cid in s.claims)
        # every sentence of the section maps to at least one claim
        for sentence in re.split(r"(?<=[.!?])\s+(?=[A-Z$(])", s.template_text):
            assert any(sentence in claims[cid].text for cid in s.claims), sentence


def test_claim_fidelity_reference_case():
    expl = build()
    _check_fidelity(expl)
    ids = [s.section_id for s in expl.sections]
    assert ids == ["key_points", "loan_cost", "with_this_loan", "stress", "alternatives", "missing_info"]


def test_claim_fidelity_document_offer_with_add_on_and_mismatch():
    offer = make_offer("document", "evidence_matched_user_confirmed",
                       [ItemizationItem(item="add_on", name="GAP insurance", amount="895.00", optional=None)])
    w = calc(True, monthly_payment=Metric(value="375.14", formula_id="F01", disclosed="3751.40", mismatch="3376.26"))
    w.flags.append(Flag(flag_id="PAYMENT_MISMATCH", triggered=True))
    expl = build(offer=offer, with_offer=w)
    _check_fidelity(expl)
    claims = by_id(expl)
    assert claims["cl_cost_payment_mismatch"].text == (
        "The payment shown on your offer ($3,751.40) differs from the payment these terms produce ($375.14) by "
        "$3,376.26; financed fees or an irregular first period can cause this.")
    assert "cl_lender_add_on_0" in claims and "GAP insurance" in claims["cl_lender_add_on_0"].text


def test_loan_cost_section_detail_values():
    claims = by_id(build())
    assert claims["cl_cost_payment"].text == "Your monthly payment is $375.14 for 60 months."
    assert claims["cl_cost_total_of_payments"].text == "Over the full term your payments add up to $22,508.29."
    assert claims["cl_cost_finance_charge"].text == (
        "The finance charge is $3,008.29: $2,508.29 of interest plus $500.00 of prepaid finance charges.")
    assert claims["cl_cost_total_deal"].text == "Counting the down payment, the total paid through this deal is $26,508.29."
    assert claims["cl_cost_apr"].text == "The APR these terms work out to is 5.796%."
    assert claims["cl_cash_ratio"].text == "The payment is about 8.9% of your take-home pay."
    assert claims["cl_reserve_months"].text == ("Your savings cover about 2.1 months of essential costs today and "
                                                "about 0.6 months with this loan.")
    assert "cl_dti" not in claims                         # dti not selected and value missing


def test_stress_claims_state_run_and_illustrative():
    expl = build()
    stress = next(s for s in expl.sections if s.section_id == "stress")
    claims = by_id(expl)
    for cid in stress.claims:
        assert "illustrative" in claims[cid].text.lower()
    assert claims["cl_scn_sc_job_loss_with_offer"].text == (
        "In this illustrative scenario (No income for two months), with this loan your savings would run out in "
        "month 1, leaving a gap of up to about $4,200.")
    assert claims["cl_scn_sc_expense_spike_without_offer"].text == (
        "In this illustrative scenario (Unexpected expense equal to one month of essentials), without this loan "
        "your savings stay above zero for all 12 months, ending at about $13,900.")
    assert claims["cl_scn_break_even_m3"].text == (
        "In this illustrative calculation, with this loan your savings could cover a drop in take-home pay of about "
        "27% for three months.")
    assert "a_illustrative_scenarios" in claims["cl_scn_sc_job_loss_with_offer"].assumption_ids
    assert any(a.assumption_id == "a_illustrative_scenarios" for a in expl.assumptions)


def test_alternatives_carry_flags_and_never_rank():
    expl = build()
    claims = by_id(expl)
    alt = claims["cl_alt_alt_012"]
    assert alt.type == "comparison" and alt.assumption_ids == ["same_rate_assumed"]
    assert alt.text == ("48 months, +$1,000 down (if offered at the same rate): monthly payment about $435, finance "
                        "charge about $2,403, savings after purchase about $1,000.")
    assert "cl_alt_alt_bad" not in claims and "cl_alt_alt_base" not in claims
    assert claims["cl_rate_1pt"].text == ("Each percentage point of interest rate changes the finance charge on this "
                                          "loan by about $530.")


def test_lender_questions():
    expl = build()
    items = {i.fact_key: i for i in expl.missing_information}
    buy = items["loan.buy_rate"]
    assert buy.ask_the_lender and buy.citation == "CFPB en-727, en-759"
    assert by_id(expl)["cl_lender_buy_rate"].text == (
        "Ask the dealer what rate the lender actually approved (the buy rate).")


# --------------------------------------------------------------------------- deny-list + A-42
@pytest.mark.parametrize("bad", [
    "You can afford this loan.", "This is the best option.", "A better deal.", "We recommend this.",
    "You should take it.", "This loan is safe.", "Values verified.", "Payment is affordable.",
    "This fits your budget.", "Guaranteed savings."])
def test_deny_list_raises(bad):
    assert find_denied(bad)
    with pytest.raises(DeniedLanguageError):
        check_text(bad)


def test_templates_clean_and_digit_free():
    for tid, text in TEMPLATES.items():
        assert not find_denied(text), tid
        assert not re.search(r"\d", text), tid        # every number must come from claim values


def test_denied_dynamic_value_drops_claim():
    cf = make_cf()
    cf.alternatives[1].label = "Best choice"
    expl = build(cf=cf)
    assert "cl_alt_alt_012" not in by_id(expl)
    for c in expl.claims:
        assert not find_denied(c.text)


@pytest.mark.parametrize("origin,verification,label", [
    ("manual", "user_confirmed", "You confirmed"),
    ("manual", "none", "You entered"),
    ("document", "evidence_matched", "From your document, p.1 · matched"),
    ("document", "evidence_matched_user_confirmed", "From your document, p.1 · matched · you confirmed"),
    ("document", "user_confirmed", "From your document, p.1 · you confirmed"),
])
def test_label_honesty(origin, verification, label):
    expl = build(offer=make_offer(origin, verification))
    ev = {e.evidence_id: e for e in expl.evidence}
    assert ev["ev_term_term_months"].display_label == label
    assert ev["ev_calc_F03"].display_label == "Calculated · Finance charge"
    assert ev["ev_fact_f_08"].display_label == "You told us"
    for e in expl.evidence:
        assert "verified" not in e.display_label.lower()
    for c in expl.claims:
        assert "verified" not in c.text.lower()


def test_estimated_fact_label():
    facts = make_facts()
    facts["savings.liquid"] = facts["savings.liquid"].model_copy(update={"status": "estimated"})
    ev = {e.evidence_id: e for e in build(facts=facts).evidence}
    assert ev["ev_fact_f_08"].display_label == "Your estimate"
