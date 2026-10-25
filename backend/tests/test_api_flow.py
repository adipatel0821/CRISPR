"""Route behaviour with fakes: facts, questions, offers, documents, analysis, idempotency, invalid input (A-17)."""
from __future__ import annotations

import pytest

from tests.conftest import (DataModeRestricted, LLMUnavailable, reference_facts_payload, reference_offer_payload)
from tests.test_api_sessions import assert_error

API = "/api/v1"


def test_facts_persist_and_bump_profile_version(client, session):
    sid, h = session["id"], session["headers"]
    r = client.post(f"{API}/sessions/{sid}/facts", json=reference_facts_payload(), headers=h)
    assert r.status_code == 200, r.text
    prof = r.json()["profile"]
    assert prof["profile_version"] == 1
    assert prof["facts"]["income.take_home_monthly"]["value"] == "4200.00"
    ready = {x["analysis_id"]: x for x in prof["readiness"]}
    assert ready["cashflow_impact"]["awaiting_offer"] and ready["cashflow_impact"]["missing"] == []
    # supersede one value: the latest wins, the old row is kept (append-only)
    r = client.post(f"{API}/sessions/{sid}/facts",
                    json={"facts": [{"key": "income.take_home_monthly", "value": "4300.00"}]}, headers=h)
    prof = r.json()["profile"]
    assert prof["profile_version"] == 2 and prof["facts"]["income.take_home_monthly"]["value"] == "4300.00"


def test_acknowledgement_recorded_once(client, session):
    sid, h = session["id"], session["headers"]
    body = {**reference_facts_payload(), "acknowledge_rules": ["H01_deficit", "H01_deficit"]}
    prof = client.post(f"{API}/sessions/{sid}/facts", json=body, headers=h).json()["profile"]
    assert [a["rule_id"] for a in prof["acknowledgements"]] == ["H01_deficit"]
    assert len(prof["acknowledgements"][0]["fact_ids"]) == len(reference_facts_payload()["facts"])
    prof = client.post(f"{API}/sessions/{sid}/facts", json={"facts": [], "acknowledge_rules": ["H01_deficit"]},
                       headers=h).json()["profile"]
    assert len(prof["acknowledgements"]) == 1


def test_next_question_answer_skip_decline(client, session):
    sid, h = session["id"], session["headers"]
    q = client.get(f"{API}/sessions/{sid}/next-question", headers=h).json()
    assert q["question"]["question_id"] == "q_income.take_home_monthly"
    r = client.post(f"{API}/sessions/{sid}/answers", headers=h,
                    json={"question_id": "q_income.take_home_monthly", "typed_value": "4200.00"})
    assert r.status_code == 200, r.text
    assert r.json()["question"]["question_id"] == "q_expenses.essential.total"
    assert r.json()["profile_version"] == 1
    r = client.post(f"{API}/sessions/{sid}/answers", headers=h,
                    json={"question_id": "q_expenses.essential.total", "skipped": True})
    assert r.json()["question"]["question_id"] == "q_debts.count"      # skipped key is not re-asked
    r = client.post(f"{API}/sessions/{sid}/answers", headers=h,
                    json={"question_id": "q_debts.count", "declined": True})
    view = client.get(f"{API}/sessions/{sid}", headers=h).json()
    assert view["profile"]["facts"]["debts.count"]["status"] == "declined"
    assert view["profile"]["facts"]["debts.count"]["value"] is None
    # unknown / stale question id -> actionable 400
    err = assert_error(client.post(f"{API}/sessions/{sid}/answers", headers=h,
                                   json={"question_id": "q_bogus", "typed_value": "1"}), 400, "VALIDATION_ERROR")
    assert "next-question" in err["message"]


def test_readiness_endpoint(client, session):
    sid, h = session["id"], session["headers"]
    client.post(f"{API}/sessions/{sid}/facts", json=reference_facts_payload(), headers=h)
    client.post(f"{API}/sessions/{sid}/offers", json=reference_offer_payload(), headers=h)
    r = client.get(f"{API}/sessions/{sid}/readiness", headers=h)
    assert r.status_code == 200
    assert all(x["available"] for x in r.json())


def test_manual_offer_and_analysis_report(client, session):
    sid, h = session["id"], session["headers"]
    client.post(f"{API}/sessions/{sid}/facts", json=reference_facts_payload(), headers=h)
    offer = client.post(f"{API}/sessions/{sid}/offers", json=reference_offer_payload(), headers=h)
    assert offer.status_code == 200, offer.text
    assert offer.json()["offer_id"].startswith("o_") and offer.json()["ready_for_calculation"]
    r = client.post(f"{API}/sessions/{sid}/analysis", json={}, headers=h)
    assert r.status_code == 200, r.text
    rep = r.json()
    assert rep["report_id"].startswith("r_") and rep["session_id"] == sid
    assert rep["data_mode"] == "synthetic_only"
    assert rep["offer"]["offer_id"] == offer.json()["offer_id"]
    assert rep["with_offer"]["metrics"]["monthly_payment"]["value"] == "375.14"
    assert rep["with_offer"]["metrics"]["monthly_left_after"]["value"] == "474.86"
    assert rep["baseline"]["offer_id"] is None
    assert {s["run"] for s in rep["scenarios"]} == {"without_offer", "with_offer"}
    assert rep["counterfactual"]["base_offer_id"] == offer.json()["offer_id"]
    assert rep["profile_summary"]["facts"]["savings.liquid"]["value"] == "6000.00"
    assert rep["disclaimers"]
    # stored immutably and fetchable
    got = client.get(f"{API}/reports/{rep['report_id']}", headers=h).json()
    assert got == rep
    view = client.get(f"{API}/sessions/{sid}", headers=h).json()
    assert view["latest_report_id"] == rep["report_id"]


def test_analysis_without_offer_is_insufficient_information(client, session):
    sid, h = session["id"], session["headers"]
    client.post(f"{API}/sessions/{sid}/facts", json=reference_facts_payload(), headers=h)
    err = assert_error(client.post(f"{API}/sessions/{sid}/analysis", json={}, headers=h), 422,
                       "INSUFFICIENT_INFORMATION")
    assert [x["analysis_id"] for x in err["details"]["readiness"]][0] == "loan_cost"
    assert err["details"]["readiness"][0]["awaiting_offer"] is True
    # an offer that is not ready (no rate) is also insufficient
    client.post(f"{API}/sessions/{sid}/offers", json={"terms": {"principal": "20000.00"}}, headers=h)
    assert_error(client.post(f"{API}/sessions/{sid}/analysis", json={}, headers=h), 422, "INSUFFICIENT_INFORMATION")
    assert_error(client.post(f"{API}/sessions/{sid}/analysis", json={"offer_id": "o_nope"}, headers=h), 404,
                 "NOT_FOUND")


def test_partial_readiness_omits_unavailable_stages_no_500(client, session, fakes, monkeypatch):
    sid, h = session["id"], session["headers"]
    called = []
    monkeypatch.setattr(fakes, "run_catalog", lambda *a: called.append("scn") or ([], None))
    monkeypatch.setattr(fakes, "evaluate_counterfactual", lambda *a: called.append("cf"))
    client.post(f"{API}/sessions/{sid}/offers", json=reference_offer_payload(), headers=h)  # no household facts
    r = client.post(f"{API}/sessions/{sid}/analysis", json={}, headers=h)
    assert r.status_code == 200, r.text
    rep = r.json()
    assert called == []                       # stress/alternatives unavailable -> not run
    assert rep["scenarios"] == [] and rep["counterfactual"] is None
    ready = {x["analysis_id"]: x["available"] for x in rep["readiness"]}
    assert ready["loan_cost"] and not ready["cashflow_impact"]


def test_failing_optional_stage_is_omitted_not_500(client, session, fakes, monkeypatch):
    sid, h = session["id"], session["headers"]
    client.post(f"{API}/sessions/{sid}/facts", json=reference_facts_payload(), headers=h)
    client.post(f"{API}/sessions/{sid}/offers", json=reference_offer_payload(), headers=h)

    def broken(*a, **k):
        raise RuntimeError("scenario bug")
    monkeypatch.setattr(fakes, "run_catalog", broken)
    r = client.post(f"{API}/sessions/{sid}/analysis", json={}, headers=h)
    assert r.status_code == 200 and r.json()["scenarios"] == []


def test_analysis_idempotency(client, session):
    sid, h = session["id"], session["headers"]
    client.post(f"{API}/sessions/{sid}/facts", json=reference_facts_payload(), headers=h)
    client.post(f"{API}/sessions/{sid}/offers", json=reference_offer_payload(), headers=h)
    hk = {**h, "Idempotency-Key": "run-1"}
    r1 = client.post(f"{API}/sessions/{sid}/analysis", json={}, headers=hk).json()
    r2 = client.post(f"{API}/sessions/{sid}/analysis", json={}, headers=hk).json()
    assert r1["report_id"] == r2["report_id"] and r1 == r2
    r3 = client.post(f"{API}/sessions/{sid}/analysis", json={}, headers=h).json()
    assert r3["report_id"] != r1["report_id"]


def test_document_upload_get_verify_and_idempotency(client, session):
    sid, h = session["id"], session["headers"]
    files = {"file": ("offer.pdf", b"%PDF-1.7 FIXTURE sample", "application/pdf")}
    r1 = client.post(f"{API}/sessions/{sid}/documents", headers={**h, "Idempotency-Key": "u1"}, files=files)
    assert r1.status_code == 200, r1.text
    r2 = client.post(f"{API}/sessions/{sid}/documents", headers={**h, "Idempotency-Key": "u1"}, files=files)
    assert r2.json()["doc_id"] == r1.json()["doc_id"]
    doc_id = r1.json()["doc_id"]
    assert doc_id.startswith("d_")
    assert client.get(f"{API}/documents/{doc_id}", headers=h).json()["status"] == "extracted"
    offer = client.post(f"{API}/documents/{doc_id}/verify", json={"actions": []}, headers=h)
    assert offer.status_code == 200 and offer.json()["ready_for_calculation"]
    view = client.get(f"{API}/sessions/{sid}", headers=h).json()
    assert [o["offer_id"] for o in view["offers"]] == [offer.json()["offer_id"]]
    assert_error(client.get(f"{API}/documents/d_missing", headers=h), 404, "NOT_FOUND")


def test_document_data_mode_restricted_403(client, session):
    files = {"file": ("real.pdf", b"%PDF-1.7 real contract", "application/pdf")}
    err = assert_error(client.post(f"{API}/sessions/{session['id']}/documents", headers=session["headers"],
                                   files=files), 403, "DATA_MODE_RESTRICTED")
    assert "sample" in err["message"]


def test_llm_unavailable_503_with_fallback(client, session, fakes, monkeypatch):
    def down():
        raise LLMUnavailable("")
    monkeypatch.setattr(fakes, "get_llm_client", down)
    err = assert_error(client.post(f"{API}/sessions/{session['id']}/documents", headers=session["headers"],
                                   files={"file": ("x.pdf", b"%PDF-1.7 FIXTURE", "application/pdf")}),
                       503, "LLM_UNAVAILABLE")
    assert err["details"] == {"fallback_available": True}


# --------------------------------------------------------------------------- A-17 invalid input
def test_negative_income_is_400_actionable(client, session):
    err = assert_error(client.post(f"{API}/sessions/{session['id']}/facts", headers=session["headers"],
                                   json={"facts": [{"key": "income.take_home_monthly", "value": "-4200"}]}),
                       400, "VALIDATION_ERROR")
    assert "income.take_home_monthly" in err["message"] and "zero or more" in err["message"]
    assert err["details"]["fields"][0]["field"] == "income.take_home_monthly"


def test_intake_validation_error_maps_to_400(client, session):
    err = assert_error(client.post(f"{API}/sessions/{session['id']}/facts", headers=session["headers"],
                                   json={"facts": [{"key": "not.a.key", "value": "1"}]}), 400, "VALIDATION_ERROR")
    assert "not.a.key" in err["message"]


@pytest.mark.parametrize("terms,field", [
    ({"principal": "20000.00", "contract_rate": "0.0475", "term_months": 500}, "terms.term_months"),
    ({"principal": "20000.00", "contract_rate": "4.75", "term_months": 60}, "terms.contract_rate"),
    ({"principal": "-5", "contract_rate": "0.0475", "term_months": 60}, "terms.principal"),
    ({"principal": "abc", "contract_rate": "0.0475", "term_months": 60}, "terms.principal"),
    ({"principal": "20000", "contract_rate": "0.0475", "term_months": 60, "vin": "x"}, "terms.vin"),
])
def test_invalid_offer_terms_400(client, session, terms, field):
    err = assert_error(client.post(f"{API}/sessions/{session['id']}/offers", headers=session["headers"],
                                   json={"terms": terms}), 400, "VALIDATION_ERROR")
    assert err["details"]["fields"][0]["field"] == field
    assert field in err["message"]


def test_term_over_60_is_accepted(client, session):
    r = client.post(f"{API}/sessions/{session['id']}/offers", headers=session["headers"],
                    json={"terms": {"principal": "20000.00", "contract_rate": "0.0475", "term_months": 72}})
    assert r.status_code == 200


def test_malformed_body_400_with_field_messages(client, session):
    err = assert_error(client.post(f"{API}/sessions/{session['id']}/facts", headers=session["headers"],
                                   json={"facts": [{"value": "1"}]}), 400, "VALIDATION_ERROR")
    assert any(f["field"].endswith("key") for f in err["details"]["fields"])
    assert "key" in err["message"]


def test_upload_over_10mb_rejected(client, session):
    big = b"%PDF-1.7 FIXTURE" + b"0" * (11 * 1024 * 1024)
    err = assert_error(client.post(f"{API}/sessions/{session['id']}/documents", headers=session["headers"],
                                   files={"file": ("big.pdf", big, "application/pdf")}), 400, "VALIDATION_ERROR")
    assert "10 MB" in err["message"]


def test_non_pdf_bytes_422(client, session):
    err = assert_error(client.post(f"{API}/sessions/{session['id']}/documents", headers=session["headers"],
                                   files={"file": ("evil.pdf", b"MZ\x90\x00 not a pdf", "application/pdf")}),
                       422, "EXTRACTION_FAILED")
    assert "PDF" in err["message"]


def test_config_assumptions(client):
    r = client.get(f"{API}/config/assumptions")
    assert r.status_code == 200 and "assumptions" in r.json()
