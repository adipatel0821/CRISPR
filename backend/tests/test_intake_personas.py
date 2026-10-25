"""A-01r persona scripts (reviews/stage_01_review.md §19), A-21 deficit, A-22 debt items, A-04."""
from __future__ import annotations

from decimal import Decimal

from intake import ledger, questions, rules
from tests.test_intake_support import Session, make_offer

CORE = ["loan_cost", "cashflow_impact", "reserve_impact", "stress_test", "alternatives"]


def _avail(resp):
    return {r.analysis_id: r.available for r in resp.readiness}


def test_p1_stable_salaried_stops_after_five_questions():
    s = Session(CORE, make_offer("4000.00"))
    ids = s.run_script(["4,200", "2900", "0", "6000", "My savings"])
    assert ids == ["q_income.take_home_monthly", "q_expenses.essential.total", "q_debts.count",
                   "q_savings.liquid", "q_loan.down_payment_source"]
    # Q5 names the offer's down payment
    assert "$4,000" in s.asked[4].text
    assert s.asked[4].why_we_ask.startswith("Needed for:")
    final = s.next()
    assert final.question is None                      # stop after exactly 5
    assert all(_avail(final).values()), _avail(final)
    facts = s.facts
    assert facts["income.take_home_monthly"].value == "4200.00"
    assert facts["debts.count"].value == "0"
    assert facts["loan.down_payment_source"].value == "savings"
    # Refinements offered (documented in §19 P1): flexible, replacement, new-car costs, gross income, resale estimate
    ref_keys = [q.fact_key for q in final.refinements]
    for k in ["expenses.flexible.total", "vehicle.replaces_current", "vehicle.new_ownership_costs_monthly",
              "income.gross_monthly", "vehicle.value_estimates"]:
        assert k in ref_keys
    assert all(q.priority_class == "refinement" for q in final.refinements)
    # Curated order from question_policy.yaml
    assert ref_keys.index("expenses.flexible.total") < ref_keys.index("vehicle.replaces_current") \
        < ref_keys.index("vehicle.new_ownership_costs_monthly") < ref_keys.index("income.gross_monthly") \
        < ref_keys.index("vehicle.value_estimates")


def test_p1_readiness_after_each_answer_matches_script():
    s = Session(CORE, make_offer("4000.00"))
    expected_after = [
        {"loan_cost"},                                                     # after take-home
        {"loan_cost"},                                                     # after essentials
        {"loan_cost", "cashflow_impact"},                                  # after debts = 0
        {"loan_cost", "cashflow_impact"},                                  # after savings
        set(CORE),                                                         # after down-payment source
    ]
    for value, exp in zip(["4200", "2900", "0", "6000", "savings"], expected_after):
        q = s.next().question
        s.answer(q, value)
        avail = {a for a, ok in _avail(s.next()).items() if ok}
        assert avail == exp


def test_p2_variable_income_sequence():
    s = Session(CORE, make_offer("4000.00"))
    ids = s.run_script(["2,800 to 4,000", ["3400", "2800"], "2000", "0", "5000", "savings"])
    assert ids == ["q_income.take_home_monthly", "q_income.take_home_monthly", "q_expenses.essential.total",
                   "q_debts.count", "q_savings.liquid", "q_loan.down_payment_source"]
    assert s.asked[0].kind == "currency"
    assert s.asked[1].kind == "currency_pair"           # "In a typical month? In a slow month?"
    assert "slow month" in s.asked[1].text
    facts = s.facts
    assert facts["income.variability"].value == "somewhat_variable"
    assert facts["income.take_home_monthly"].value == "3400.00"
    assert facts["income.low_month"].value == "2800.00"
    final = s.next()
    assert final.question is None
    stress = next(r for r in final.readiness if r.analysis_id == "stress_test")
    assert stress.available and "income.low_month" in stress.required


def test_p2_pair_answer_as_text():
    s = Session(CORE, make_offer("4000.00"))
    s.run_script(["2800-4000", "3,400 / 2,800"])
    assert s.facts["income.take_home_monthly"].value == "3400.00"
    assert s.facts["income.low_month"].value == "2800.00"


def test_p3_debts_and_low_savings_with_down_payment_plausibility():
    s = Session(CORE, make_offer("1500.00"))
    ids = s.run_script(["3100", "2350", "2", "210", "95", "400", "savings", "Somewhere else"])
    assert ids == ["q_income.take_home_monthly", "q_expenses.essential.total", "q_debts.count",
                   "q_debts[d1].monthly_payment", "q_debts[d2].monthly_payment", "q_savings.liquid",
                   "q_loan.down_payment_source", "q_ack_H02_down_payment"]
    ack_q = s.asked[-1]
    assert ack_q.rule_id == "H02_down_payment"
    assert "$1,500" in ack_q.text and "$400" in ack_q.text
    final = s.next()
    assert final.question is None
    assert all(_avail(final).values())
    assert s.facts["loan.down_payment_source"].value == "other"
    # cash flow before the loan is positive: 3100 - 2350 - 210 - 95 = 445 (no deficit acknowledgement)
    assert rules.deficit_amount(s.facts) is None
    paid, keys = rules.known_debt_payments(s.facts)
    assert paid == Decimal("305.00") and len(keys) == 2
    # Affirm's payments-left is offered as a refinement (lets Stage 4 drop it after month 4)
    assert "debts[d2].remaining_months" in [q.fact_key for q in final.refinements]
    assert len([a for a in s.acks if a.rule_id == "H02_down_payment"]) == 1


def test_deficit_variant_confirms_once_then_proceeds():
    s = Session(CORE, make_offer("4000.00"))
    ids = s.run_script(["3100", "2900", "1", "410", "Yes", "5000", "savings"])
    assert ids == ["q_income.take_home_monthly", "q_expenses.essential.total", "q_debts.count",
                   "q_debts[d1].monthly_payment", "q_ack_H01_deficit", "q_savings.liquid",
                   "q_loan.down_payment_source"]
    h01 = s.asked[4]
    assert h01.text == "This leaves about −$210 each month before this loan. Is that right?"
    final = s.next()
    assert final.question is None
    assert all(_avail(final).values())
    # never a conflict, never re-asked (A-21)
    assert [h for h in rules.check_rules(s.facts, s.offer, s.acks) if h.rule_id == "H01_deficit"] == []
    assert sum(1 for q in s.asked if q.rule_id == "H01_deficit") == 1


def test_deficit_answer_no_reasks_essentials_once_and_never_loops():
    s = Session(CORE, make_offer("4000.00"))
    s.run_script(["3100", "2900", "1", "410", "No"])
    r = s.next()
    assert r.question.question_id == "q_expenses.essential.total"    # user said the figure was wrong
    s.answer(r.question, "2900")                                      # re-enters the same deficit
    r = s.next()
    assert r.question.question_id == "q_savings.liquid"               # no second H01
    s.answer(r.question, "5000")
    s.answer(s.next().question, "savings")
    assert s.next().question is None


def test_expenses_above_income_alone_never_loops():
    s = Session(CORE, make_offer("0.00"))
    asked = []
    answers = {"q_income.take_home_monthly": "3000", "q_expenses.essential.total": "3500", "q_debts.count": "0",
               "q_ack_H01_deficit": "Yes", "q_savings.liquid": "200"}
    for _ in range(20):
        q = s.next().question
        if q is None:
            break
        asked.append(q.question_id)
        s.answer(q, answers[q.question_id])
    assert asked == ["q_income.take_home_monthly", "q_expenses.essential.total", "q_ack_H01_deficit",
                     "q_debts.count", "q_savings.liquid"]          # cash down 0 → no down-payment question


def test_a22_debt_with_missing_payment_blocks_cashflow():
    upd = ledger.apply_inputs("s", [], [{"key": "income.take_home_monthly", "value": "4200"},
                                        {"key": "expenses.essential.total", "value": "2900"},
                                        {"key": "debts.count", "value": "1"},
                                        {"key": "debts[d1].type", "value": "student_loan"}])
    facts = ledger.current_facts(upd.new_facts)
    assert facts["debts[d1].monthly_payment"].status == "missing"
    assert facts["debts[d1].monthly_payment"].value is None          # unknown is never zero
    r = questions.next_question(facts, ["cashflow_impact"], make_offer())
    cash = r.readiness[0]
    assert not cash.available and cash.missing == ["debts[d1].monthly_payment"]
    assert r.question.question_id == "q_debts[d1].monthly_payment"
    assert "student loan" in r.question.text
    total, keys = rules.known_debt_payments(facts)
    assert total == Decimal(0) and keys == []                         # a missing payment is never summed


def test_loan_terms_never_asked_and_offer_awaited():
    s = Session(["loan_cost"], None)
    r = s.next()
    assert r.question is None
    assert r.readiness[0].awaiting_offer and not r.readiness[0].available


def test_declined_blocker_is_terminal_and_reported():
    s = Session(CORE, make_offer("4000.00"))
    s.run_script(["4200", "2900", "0"])
    q = s.next().question
    assert q.fact_key == "savings.liquid"
    s.answer(q, declined=True)
    r = s.next()
    # savings declined: the remaining blocker (down-payment source) is still asked, savings never again
    assert r.question.fact_key == "loan.down_payment_source"
    s.answer(r.question, "savings")
    final = s.next()
    assert final.question is None
    reserve = next(x for x in final.readiness if x.analysis_id == "reserve_impact")
    assert not reserve.available and reserve.declined == ["savings.liquid"]
    assert "chose not to share" in reserve.reason


def test_skip_defers_within_pass_only():
    s = Session(["cashflow_impact"], make_offer())
    q = s.next().question
    s.answer(q, skipped=True)
    assert s.next().question.fact_key == "expenses.essential.total"
    s.skipped.clear()                                                 # a new pass
    assert s.next().question.fact_key == "income.take_home_monthly"


def test_estimate_marks_status_estimated():
    s = Session(["cashflow_impact"], make_offer())
    q = s.next().question
    s.answer(q, "4200", marked_estimate=True)
    f = s.facts["income.take_home_monthly"]
    assert f.status == "estimated" and f.uncertainty.kind == "approximate"
    assert s.next().question.fact_key != "income.take_home_monthly"


def test_candidate_from_id_roundtrip():
    s = Session(CORE, make_offer("1500.00"))
    s.run_script(["3100", "2350", "0", "400", "savings"])
    r = s.next()
    assert r.question.question_id == "q_ack_H02_down_payment"
    again = questions.candidate_from_id(r.question.question_id, s.facts, CORE, s.offer, s.acks)
    assert again == r.question
    first = questions.candidate_from_id("q_income.low_month", s.facts, CORE, s.offer, s.acks)
    assert first.priority_class == "refinement"
    assert questions.candidate_from_id("q_bogus.key", s.facts, CORE, s.offer, s.acks) is None


def test_invalid_answer_raises_and_is_reasked():
    import pytest
    from intake.errors import FactValidationError
    s = Session(["cashflow_impact"], make_offer())
    q = s.next().question
    with pytest.raises(FactValidationError) as e:
        s.answer(q, "-100")
    assert "negative" in e.value.message
    with pytest.raises(FactValidationError):
        s.answer(q, "lots")
    assert s.next().question.question_id == q.question_id
