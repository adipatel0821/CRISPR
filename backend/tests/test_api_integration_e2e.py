"""End-to-end over the REAL modules (no fakes): session -> facts -> manual offer -> analysis.

Auto-skips until engine.compute, intake.ledger/questions and documents.manual exist (i.e. after the Supervisor
merges the feature branches). Expected values are the audited reference case (contracts v1.1 header / §3.7).
"""
from __future__ import annotations

import importlib

import pytest

from tests.conftest import reference_facts_payload, reference_offer_payload


def _real_modules_available() -> bool:
    try:
        engine = importlib.import_module("engine")
        importlib.import_module("intake.ledger")
        importlib.import_module("intake.questions")
        manual = importlib.import_module("documents.manual")
        return callable(getattr(engine, "compute", None)) and callable(getattr(manual, "build_manual_offer", None))
    except Exception:  # noqa: BLE001
        return False


pytestmark = pytest.mark.skipif(not _real_modules_available(),
                                reason="engine.compute / intake / documents.manual not merged yet")

API = "/api/v1"


@pytest.fixture
def real_client(db_url, monkeypatch):
    monkeypatch.setenv("LLM_DATA_MODE", "off")
    from fastapi.testclient import TestClient
    from api.main import app
    with TestClient(app) as c:
        yield c


def test_reference_case_end_to_end(real_client):
    c = real_client
    s = c.post(f"{API}/sessions", json={})
    assert s.status_code == 201, s.text
    sid, token = s.json()["session_id"], s.json()["token"]
    h = {"Authorization": f"Bearer {token}"}

    r = c.post(f"{API}/sessions/{sid}/facts", json=reference_facts_payload(), headers=h)
    assert r.status_code == 200, r.text

    r = c.post(f"{API}/sessions/{sid}/offers", json=reference_offer_payload(), headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["ready_for_calculation"] is True

    r = c.get(f"{API}/sessions/{sid}/readiness", headers=h)
    assert r.status_code == 200, r.text
    ready = {x["analysis_id"]: x["available"] for x in r.json()}
    assert ready["loan_cost"] and ready["cashflow_impact"] and ready["reserve_impact"]

    r = c.post(f"{API}/sessions/{sid}/analysis", json={}, headers=h)
    assert r.status_code == 200, r.text
    rep = r.json()
    m = rep["with_offer"]["metrics"]
    assert m["monthly_payment"]["value"] == "375.14"
    assert m["monthly_left_after"]["value"] == "474.86"
    assert m["total_of_payments"]["value"] == "22508.29"
    assert m["finance_charge"]["value"] == "3008.29"
    assert m["interest"]["value"] == "2508.29"
    assert m["savings_after_purchase"]["value"] == "2000.00"
    assert m["reserve_months_after"]["value"] == "0.60"
    assert rep["baseline"]["metrics"]["monthly_left_before"]["value"] == "900.00"
    assert rep["data_mode"] == "off"

    claims = {cl["claim_id"]: cl for cl in rep["claims"]}
    assert [claims[k]["text"] for k in rep["key_points"]] == [
        "This loan costs about $3,008 in finance charges over 60 months "
        "($2,508 interest plus $500 in prepaid finance charges).",
        "Your monthly leftover goes from $900 to $475 after the payment and the change in car running costs.",
        "Your savings would go from $6,000 to $2,000 after the down payment — about 0.6 months of essential costs.",
    ]

    got = c.get(f"{API}/reports/{rep['report_id']}", headers=h)
    assert got.status_code == 200 and got.json()["report_id"] == rep["report_id"]
    assert c.delete(f"{API}/sessions/{sid}", headers=h).status_code == 204



def test_reserve_change_claim_carries_before_and_after(real_client):
    """Regression (CP1 browser check found "Savings Now: Not known"): the dashboard reads a change claim's
    values.before / values.after."""
    c = real_client
    s = c.post(f"{API}/sessions", json={}).json()
    h = {"Authorization": f"Bearer {s['token']}"}
    assert c.post(f"{API}/sessions/{s['session_id']}/facts", json=reference_facts_payload(), headers=h).status_code == 200
    assert c.post(f"{API}/sessions/{s['session_id']}/offers", json=reference_offer_payload(), headers=h).status_code == 200
    rep = c.post(f"{API}/sessions/{s['session_id']}/analysis", json={}, headers=h).json()
    claim = next(cl for cl in rep["claims"] if cl["claim_id"] == "cl_kp_reserve")
    assert claim["type"] == "change"
    assert claim["values"]["before"] == "6000.00" and claim["values"]["after"] == "2000.00"
