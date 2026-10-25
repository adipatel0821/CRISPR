"""Shared helpers for the intake tests (no tests in this module)."""
from __future__ import annotations

from intake import ledger, questions
from schemas.contracts import CORE_ANALYSES, LoanOffer, QuestionResponse, VerifiedFinancialTerm


def make_offer(cash_down: str | None = "4000.00", ready: bool = True) -> LoanOffer:
    terms = {}
    if cash_down is not None:
        terms["cash_down"] = VerifiedFinancialTerm(term_key="cash_down", value=cash_down, value_type="currency",
                                                   status="provided", source_kind="user_input")
    return LoanOffer(offer_id="o_test", session_id="s_test", origin="manual", terms=terms,
                     ready_for_calculation=ready)


class Session:
    """Drives next_question / apply_answer like the API would (append-only ledger)."""

    def __init__(self, selected=None, offer=None):
        self.selected = list(selected or CORE_ANALYSES)
        self.offer = offer
        self.ledger: list = []
        self.acks: list = []
        self.skipped: set[str] = set()
        self.asked: list = []

    @property
    def facts(self):
        return ledger.current_facts(self.ledger)

    def next(self):
        return questions.next_question(self.facts, self.selected, self.offer, self.acks, self.skipped)

    def answer(self, q, value=None, **flags):
        resp = QuestionResponse(question_id=q.question_id, fact_key=q.fact_key, typed_value=value, **flags)
        out = questions.apply_answer("s_test", q, resp, self.ledger)
        self.ledger += out.new_facts
        self.acks += out.acknowledgements
        if out.skipped_key:
            self.skipped.add(out.skipped_key)
        return out

    def run_script(self, answers):
        """Answer the questions in order; returns the list of asked question ids. Fails if the
        script runs out before the interview stops."""
        for value in answers:
            r = self.next()
            assert r.question is not None, f"interview stopped early; asked {self.asked}"
            self.asked.append(r.question)
            self.answer(r.question, value)
        return [q.question_id for q in self.asked]
