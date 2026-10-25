"""Thin, lazily-importing adapters over the pure modules (INTERFACES.md). The API calls only these functions, so
(a) the app starts even while a sibling module is still being built, and (b) tests monkeypatch one seam.
Each adapter's signature mirrors INTERFACES.md exactly.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any


# --------------------------------------------------------------------------- intake (Agent 2)
def current_facts(all_facts: list) -> dict:
    from intake import ledger
    return ledger.current_facts(all_facts)


def apply_inputs(session_id: str, existing: list, inputs: list):
    from intake import ledger
    return ledger.apply_inputs(session_id, existing, inputs)


def next_question(facts: Mapping, selected: list[str], offer, acknowledgements: list, skipped: set[str]):
    from intake import questions
    return questions.next_question(facts, selected, offer, acknowledgements, skipped)


def find_candidate(question_id: str, facts: Mapping, selected: list[str], offer, acknowledgements: list,
                   skipped: set[str]):
    """Re-derive a QuestionCandidate from its deterministic id (q_<fact_key> / q_ack_<rule_id>).

    Uses an intake helper when one exists (`candidate_for` / `candidate_by_id` / `get_candidate`), else searches the
    current next question and its refinements (also with an empty skipped set, so a re-asked skip is found)."""
    from intake import questions
    for name in ("candidate_for", "candidate_by_id", "get_candidate"):
        helper = getattr(questions, name, None)
        if callable(helper):
            try:
                cand = helper(question_id, facts, selected, offer, acknowledgements)
            except TypeError:
                cand = helper(question_id, facts, offer)
            if cand is not None:
                return cand
    for skip_set in (skipped, set()):
        nq = questions.next_question(facts, selected, offer, acknowledgements, skip_set)
        for cand in [nq.question, *(nq.refinements or [])]:
            if cand is not None and cand.question_id == question_id:
                return cand
    return None


def apply_answer(session_id: str, question, response, existing: list):
    from intake import questions
    return questions.apply_answer(session_id, question, response, existing)


def readiness(facts: Mapping, selected: list[str], offer) -> list:
    # Single evaluator shared by intake and engine (IMP-002); exists since CP0.
    from engine.requirements import evaluate_all
    return evaluate_all(selected, facts, offer)


# --------------------------------------------------------------------------- documents + llm (Agent 2)
def build_manual_offer(session_id: str, req):
    from documents.manual import build_manual_offer as _build
    return _build(session_id, req)


def get_llm_client():
    from llm.client import get_llm_client as _get
    return _get()


def process_document(session_id: str, doc_id: str, filename: str, data: bytes, data_mode: str, llm):
    from documents.pipeline import process_document as _process
    return _process(session_id, doc_id, filename, data, data_mode, llm)


def apply_verification(status, req):
    from documents.verify import apply_verification as _verify
    return _verify(status, req)


# --------------------------------------------------------------------------- engine / scenarios / counterfactual (Agent 1)
def compute(facts: Mapping, offer, *, profile_version: int = 0):
    from engine import compute as _compute
    return _compute(facts, offer, profile_version=profile_version)


def run_catalog(facts: Mapping, offer):
    from scenarios import run_catalog as _run
    return _run(facts, offer)


def evaluate_counterfactual(facts: Mapping, offer, competing_offers: list):
    from counterfactual import evaluate as _evaluate
    return _evaluate(facts, offer, competing_offers=list(competing_offers))


def assumptions_payload() -> dict[str, Any]:
    from engine import assumptions_payload as _payload
    return _payload()


# --------------------------------------------------------------------------- explain (Agent 4)
def build_explanations(facts, offer, baseline, with_offer, scenarios, resilience, counterfactual, readiness):
    from explain import build_explanations as _build
    return _build(facts, offer, baseline, with_offer, scenarios, resilience, counterfactual, readiness)


def llm_configured() -> bool:
    import os
    if os.getenv("LLM_DATA_MODE", "synthetic_only") == "off":
        return False
    return bool(os.getenv("GEMINI_API_KEY"))
