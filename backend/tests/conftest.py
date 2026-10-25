"""Shared fixtures for the API/explain suites.

The API tests replace the sibling modules (intake, documents, llm, engine, scenarios, counterfactual) with small
fakes through the single seam `api.adapters`, so this suite runs standalone. The fakes do *no* loan arithmetic:
the engine fake returns the audited reference values hard-coded from contracts v1.1 §3.7.
"""
from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

import pytest

from schemas.contracts import (AnalysisReadiness, CalculationResult, CounterfactualResult, DocumentStatus,
                               FinancialFact, LoanOffer, Metric, NextQuestionResponse, QuestionCandidate,
                               ResilienceSummary, ScenarioResult, VerifiedFinancialTerm, TERM_VALUE_TYPES)

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "reference_case.json"


def reference_case() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- fake domain errors (matched by name)
class FactValidationError(ValueError):
    pass


class UnsupportedUpload(Exception):
    pass


class DataModeRestricted(Exception):
    pass


class LLMUnavailable(Exception):
    pass


# --------------------------------------------------------------------------- fake intake
class _LedgerUpdate:
    def __init__(self, new_facts, superseded_ids):
        self.new_facts, self.superseded_ids = new_facts, superseded_ids


class _AnswerOutcome:
    def __init__(self, new_facts, superseded_ids, acknowledgements=(), skipped_key=None):
        self.new_facts, self.superseded_ids = new_facts, superseded_ids
        self.acknowledgements, self.skipped_key = list(acknowledgements), skipped_key


KNOWN_KEYS = {f["key"] for f in reference_case()["facts"]} | {"income.gross_monthly", "income.low_month"}
QUESTION_ORDER = ["income.take_home_monthly", "expenses.essential.total", "debts.count", "savings.liquid",
                  "loan.down_payment_source"]


def fake_current_facts(all_facts):
    out = {}
    for f in all_facts:
        if f.status != "superseded":
            out[f.key] = f
    return out


def _new_fact(session_id, key, value, status):
    return FinancialFact(fact_id=f"f_{uuid4().hex}", session_id=session_id, key=key, value=value,
                         value_type="currency", status=status)


def fake_apply_inputs(session_id, existing, inputs):
    current = fake_current_facts(existing)
    new, superseded = [], []
    for item in inputs:
        if item.key not in KNOWN_KEYS:
            raise FactValidationError(f"{item.key}: unknown fact key.")
        fact = _new_fact(session_id, item.key, item.value if item.status != "declined" else None, item.status)
        if item.key in current:
            fact.supersedes = current[item.key].fact_id
            superseded.append(current[item.key].fact_id)
        new.append(fact)
    return _LedgerUpdate(new, superseded)


def _candidate(key):
    return QuestionCandidate(question_id=f"q_{key}", fact_key=key, kind="currency", text=f"What is {key}?",
                             why_we_ask="Needed for your cash-flow analysis.", priority_class="blocking",
                             blocks_analyses=["cashflow_impact"], dependency_order=1)


def fake_next_question(facts, selected, offer, acknowledgements, skipped=frozenset()):
    for key in QUESTION_ORDER:
        if key not in facts and key not in skipped:
            return NextQuestionResponse(question=_candidate(key), readiness=[])
    return NextQuestionResponse(question=None, readiness=[])


def fake_apply_answer(session_id, question, response, existing):
    current = fake_current_facts(existing)
    if response.skipped:
        return _AnswerOutcome([], [], skipped_key=question.fact_key)
    status = "declined" if response.declined else ("estimated" if response.marked_estimate else "provided")
    value = None if response.declined else str(response.typed_value if response.typed_value is not None
                                               else response.raw_answer)
    fact = _new_fact(session_id, question.fact_key, value, status)
    sup = []
    if question.fact_key in current:
        sup.append(current[question.fact_key].fact_id)
    return _AnswerOutcome([fact], sup)


# --------------------------------------------------------------------------- fake documents
def fake_build_manual_offer(session_id, req):
    terms = {}
    for k, v in req.terms.items():
        if v is None:
            continue
        terms[k] = VerifiedFinancialTerm(term_key=k, value=str(v), value_type=TERM_VALUE_TYPES[k], status="provided",
                                         verification="user_confirmed" if req.confirmed else "none",
                                         source_kind="user_input")
    ready = (("principal" in terms or "amount_financed" in terms) and ("contract_rate" in terms or "apr" in terms)
             and "term_months" in terms)
    return LoanOffer(offer_id=f"o_{uuid4().hex}", session_id=session_id, label=req.label, origin="manual",
                     terms=terms, ready_for_calculation=ready)


def fake_process_document(session_id, doc_id, filename, data, data_mode, llm):
    if not data.startswith(b"%PDF-"):
        raise UnsupportedUpload("This file is not a PDF.")
    if data_mode == "synthetic_only" and b"FIXTURE" not in data:
        raise DataModeRestricted("Only bundled sample documents can be uploaded in synthetic_only mode.")
    offer = LoanOffer(offer_id=f"o_{uuid4().hex}", session_id=session_id, origin="document", doc_id=doc_id)
    return DocumentStatus(doc_id=doc_id, session_id=session_id, status="extracted", filename=filename, pages=1,
                          is_fixture=True, extraction_method="reader_only", offers_found=1, draft_offer=offer)


def fake_apply_verification(status, req):
    offer = status.draft_offer.model_copy(deep=True)
    offer.ready_for_calculation = True
    return offer


# --------------------------------------------------------------------------- fake engine (reference values, contracts §3.7)
def reference_metrics(with_offer: bool) -> dict[str, Metric]:
    m = {
        "monthly_left_before": Metric(value="900.00", formula_id="F08"),
        "reserve_months_before": Metric(value="2.07", formula_id="F10b"),
    }
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
            "dti_total": Metric(value=None, formula_id="F07b", status="missing",
                                missing_inputs=["income.gross_monthly"]),
        })
    return m


def fake_compute(facts, offer, *, profile_version=0):
    return CalculationResult(calc_id=f"c_{uuid4().hex}", profile_version=profile_version,
                             offer_id=offer.offer_id if offer else None,
                             metrics=reference_metrics(offer is not None))


def fake_run_catalog(facts, offer):
    return [ScenarioResult(scenario_id="sc_expense_spike", name="Unexpected expense", run=r, start_balance=b)
            for r, b in (("without_offer", "6000.00"), ("with_offer", "2000.00"))], ResilienceSummary()


def fake_evaluate(facts, offer, competing_offers=()):
    return CounterfactualResult(base_offer_id=offer.offer_id)


class FakeLLM:
    available = False


@pytest.fixture
def fakes(monkeypatch):
    """Install fakes for every sibling module behind api.adapters."""
    from api import adapters
    monkeypatch.setattr(adapters, "current_facts", fake_current_facts)
    monkeypatch.setattr(adapters, "apply_inputs", fake_apply_inputs)
    monkeypatch.setattr(adapters, "next_question", fake_next_question)

    def find_candidate(qid, facts, selected, offer, acks, skipped):
        key = qid[2:] if qid.startswith("q_") else None
        return _candidate(key) if key in QUESTION_ORDER else None

    monkeypatch.setattr(adapters, "find_candidate", find_candidate)
    monkeypatch.setattr(adapters, "apply_answer", fake_apply_answer)
    monkeypatch.setattr(adapters, "build_manual_offer", fake_build_manual_offer)
    monkeypatch.setattr(adapters, "get_llm_client", lambda: FakeLLM())
    monkeypatch.setattr(adapters, "process_document", fake_process_document)
    monkeypatch.setattr(adapters, "apply_verification", fake_apply_verification)
    monkeypatch.setattr(adapters, "compute", fake_compute)
    monkeypatch.setattr(adapters, "run_catalog", fake_run_catalog)
    monkeypatch.setattr(adapters, "evaluate_counterfactual", fake_evaluate)
    monkeypatch.setattr(adapters, "assumptions_payload", lambda: {"assumptions": [], "thresholds": {}})
    return adapters


@pytest.fixture
def db_url(tmp_path, monkeypatch):
    url = f"sqlite:///{(tmp_path / 'test.db').as_posix()}"
    monkeypatch.setenv("DATABASE_URL", url)
    from storage import db as storage_db
    storage_db.configure(url)
    yield url
    storage_db.get_engine().dispose()


@pytest.fixture
def client(db_url, fakes, monkeypatch):
    monkeypatch.setenv("LLM_DATA_MODE", "synthetic_only")
    from fastapi.testclient import TestClient
    from api.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def session(client):
    r = client.post("/api/v1/sessions", json={})
    assert r.status_code == 201, r.text
    body = r.json()
    return {"id": body["session_id"], "token": body["token"],
            "headers": {"Authorization": f"Bearer {body['token']}"}}


def reference_facts_payload() -> dict:
    return {"facts": [{"key": f["key"], "value": f["value"]} for f in reference_case()["facts"]]}


def reference_offer_payload() -> dict:
    case = reference_case()["offer"]
    return {"label": case["label"], "terms": case["terms"]}
