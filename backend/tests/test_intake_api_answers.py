"""Real-module API checks for the CP1 audit LOW-1 fix and the debts.count-lowering fix (SQLite storage path,
so `repo.add_facts` superseded_ids marking is exercised too). No fakes."""
from __future__ import annotations

import pytest

API = "/api/v1"


@pytest.fixture
def real_client(db_url, monkeypatch):
    monkeypatch.setenv("LLM_DATA_MODE", "off")
    from fastapi.testclient import TestClient
    from api.main import app
    with TestClient(app) as c:
        yield c


def _session(c):
    s = c.post(f"{API}/sessions", json={})
    assert s.status_code == 201, s.text
    return s.json()["session_id"], {"Authorization": f"Bearer {s.json()['token']}"}


@pytest.mark.parametrize("body", [
    {"typed_value": "4200.005"}, {"raw_answer": "4200.005"}, {"typed_value": "1e3"}, {"typed_value": 4200.5},
])
def test_answers_reject_the_inputs_facts_rejects(real_client, body):
    c = real_client
    sid, h = _session(c)
    r = c.post(f"{API}/sessions/{sid}/answers", headers=h, json={"question_id": "q_income.take_home_monthly", **body})
    assert r.status_code == 400, r.text
    err = r.json()["error"]
    assert err["code"] == "VALIDATION_ERROR" and err["message"]          # friendly re-ask message
    # the same value is rejected on the form path
    value = body.get("typed_value", body.get("raw_answer"))
    r2 = c.post(f"{API}/sessions/{sid}/facts", headers=h,
                json={"facts": [{"key": "income.take_home_monthly", "value": value}]})
    assert r2.status_code in (400, 422), r2.text
    view = c.get(f"{API}/sessions/{sid}", headers=h).json()
    assert "income.take_home_monthly" not in view["profile"]["facts"]           # nothing stored


def test_answers_friendly_input_stores_contract_value(real_client):
    c = real_client
    sid, h = _session(c)
    r = c.post(f"{API}/sessions/{sid}/answers", headers=h,
               json={"question_id": "q_income.take_home_monthly", "typed_value": "$4,200"})
    assert r.status_code == 200, r.text
    fact = c.get(f"{API}/sessions/{sid}", headers=h).json()["profile"]["facts"]["income.take_home_monthly"]
    assert fact["value"] == "4200.00" and fact["original_representation"] == "$4,200"


def test_lowering_debt_count_over_the_api(real_client):
    c = real_client
    sid, h = _session(c)
    facts = [{"key": "income.take_home_monthly", "value": "4200.00"},
             {"key": "expenses.essential.total", "value": "2900.00"},
             {"key": "debts.count", "value": "3"},
             {"key": "debts[d1].monthly_payment", "value": "210.00"},
             {"key": "debts[d2].monthly_payment", "value": "95.00"},
             {"key": "debts[d3].monthly_payment", "value": "40.00"}]
    assert c.post(f"{API}/sessions/{sid}/facts", headers=h, json={"facts": facts}).status_code == 200
    r = c.post(f"{API}/sessions/{sid}/facts", headers=h, json={"facts": [{"key": "debts.count", "value": "1"}]})
    assert r.status_code == 200, r.text
    cur = c.get(f"{API}/sessions/{sid}", headers=h).json()["profile"]["facts"]
    assert cur["debts.count"]["value"] == "1"
    assert cur["debts[d1].monthly_payment"]["value"] == "210.00"
    assert "debts[d2].monthly_payment" not in cur and "debts[d3].monthly_payment" not in cur
    ready = {x["analysis_id"]: x for x in c.get(f"{API}/sessions/{sid}/readiness", headers=h).json()}
    assert ready["cashflow_impact"]["missing"] == []
    # raising the count again requires the new item
    assert c.post(f"{API}/sessions/{sid}/facts", headers=h,
                  json={"facts": [{"key": "debts.count", "value": "2"}]}).status_code == 200
    ready = {x["analysis_id"]: x for x in c.get(f"{API}/sessions/{sid}/readiness", headers=h).json()}
    assert ready["cashflow_impact"]["missing"] == ["debts[d2].monthly_payment"]
