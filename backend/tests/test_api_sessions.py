"""Sessions, auth/isolation (A-18), purge (A-15 delete part), error schema, health, 501."""
from __future__ import annotations

from storage import repo
from storage.db import get_engine
from sqlmodel import Session

from tests.conftest import reference_facts_payload, reference_offer_payload

API = "/api/v1"


def assert_error(resp, status, code):
    assert resp.status_code == status, resp.text
    body = resp.json()
    assert set(body) == {"error"}
    err = body["error"]
    assert set(err) == {"code", "message", "details", "request_id"}
    assert err["code"] == code
    assert isinstance(err["message"], str) and err["message"]
    assert err["request_id"] and resp.headers["X-Request-ID"] == err["request_id"]
    assert "Traceback" not in resp.text
    return err


def test_create_session_returns_token_once_and_hashes_it(client, session):
    assert session["id"].startswith("s_")
    assert len(session["token"]) >= 43          # 32 random bytes, url-safe base64
    with Session(get_engine()) as db:
        row = repo.session_by_token(db, session["token"])
        assert row.id == session["id"]
        assert row.token_hash != session["token"] and len(row.token_hash) == 64
        delta = repo._aware(row.expires_at) - repo._aware(row.created_at)
        assert delta.total_seconds() == 24 * 3600


def test_session_view_shows_data_mode_and_readiness(client, session):
    r = client.get(f"{API}/sessions/{session['id']}", headers=session["headers"])
    assert r.status_code == 200
    body = r.json()
    assert body["data_mode"] == "synthetic_only"
    assert body["profile"]["session_id"] == session["id"]
    ids = [x["analysis_id"] for x in body["profile"]["readiness"]]
    assert ids == ["loan_cost", "cashflow_impact", "reserve_impact", "stress_test", "alternatives"]
    assert all(not x["available"] for x in body["profile"]["readiness"])


def test_missing_and_bad_token_401(client, session):
    assert_error(client.get(f"{API}/sessions/{session['id']}"), 401, "UNAUTHORIZED")
    assert_error(client.get(f"{API}/sessions/{session['id']}", headers={"Authorization": "Bearer nope"}),
                 401, "UNAUTHORIZED")
    assert_error(client.get(f"{API}/sessions/{session['id']}", headers={"Authorization": session["token"]}),
                 401, "UNAUTHORIZED")


def test_token_from_session_a_on_session_b_is_404_without_leakage(client):
    a = client.post(f"{API}/sessions", json={}).json()
    b = client.post(f"{API}/sessions", json={}).json()
    ha = {"Authorization": f"Bearer {a['token']}"}
    hb = {"Authorization": f"Bearer {b['token']}"}
    # B owns a fact, an offer, a report
    client.post(f"{API}/sessions/{b['session_id']}/facts", json=reference_facts_payload(), headers=hb)
    client.post(f"{API}/sessions/{b['session_id']}/offers", json=reference_offer_payload(), headers=hb)
    rep = client.post(f"{API}/sessions/{b['session_id']}/analysis", json={}, headers=hb)
    assert rep.status_code == 200, rep.text
    report_id = rep.json()["report_id"]
    up = client.post(f"{API}/sessions/{b['session_id']}/documents", headers=hb,
                     files={"file": ("x.pdf", b"%PDF-1.7 FIXTURE", "application/pdf")})
    doc_id = up.json()["doc_id"]

    for method, path in [("get", f"/sessions/{b['session_id']}"), ("get", f"/sessions/{b['session_id']}/readiness"),
                         ("get", f"/sessions/{b['session_id']}/next-question"),
                         ("delete", f"/sessions/{b['session_id']}"),
                         ("get", f"/reports/{report_id}"), ("get", f"/documents/{doc_id}"),
                         ("get", "/sessions/s_doesnotexist")]:
        r = getattr(client, method)(API + path, headers=ha)
        err = assert_error(r, 404, "NOT_FOUND")
        assert b["session_id"] not in r.text and "4200" not in r.text
    r = client.post(f"{API}/sessions/{b['session_id']}/facts", json=reference_facts_payload(), headers=ha)
    assert_error(r, 404, "NOT_FOUND")
    r = client.post(f"{API}/documents/{doc_id}/verify", json={"actions": []}, headers=ha)
    assert_error(r, 404, "NOT_FOUND")
    # B still intact
    assert client.get(f"{API}/reports/{report_id}", headers=hb).status_code == 200


def test_delete_purges_every_row_including_llm_calls(client, session):
    sid, h = session["id"], session["headers"]
    client.post(f"{API}/sessions/{sid}/facts", json={**reference_facts_payload(), "acknowledge_rules": ["H01_deficit"]},
                headers=h)
    client.post(f"{API}/sessions/{sid}/offers", json=reference_offer_payload(), headers=h)
    client.post(f"{API}/sessions/{sid}/answers", json={"question_id": "q_debts.count", "skipped": True}, headers=h)
    client.post(f"{API}/sessions/{sid}/documents", headers={**h, "Idempotency-Key": "k1"},
                files={"file": ("x.pdf", b"%PDF-1.7 FIXTURE", "application/pdf")})
    assert client.post(f"{API}/sessions/{sid}/analysis", json={}, headers=h).status_code == 200
    with Session(get_engine()) as db:
        repo.log_llm_call(db, sid, "hash", 12, "ok")
        db.commit()
        before = repo.count_rows(db, sid)
    for table in ("facts", "acknowledgements", "offers", "reports", "documents", "llm_calls", "idempotency",
                  "skips", "question_log", "sessions"):
        assert before[table] >= 1, table

    r = client.delete(f"{API}/sessions/{sid}", headers=h)
    assert r.status_code == 204
    with Session(get_engine()) as db:
        after = repo.count_rows(db, sid)
    assert all(v == 0 for v in after.values()), after
    assert_error(client.get(f"{API}/sessions/{sid}", headers=h), 401, "UNAUTHORIZED")


def test_health(client, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    r = client.get(f"{API}/health")
    assert r.status_code == 200
    body = r.json()
    assert body == {"status": "ok", "db": True, "llm_configured": False, "data_mode": "synthetic_only",
                    "schema_version": "1.1", "calc_version": "1.1.0"}
    monkeypatch.setenv("LLM_DATA_MODE", "off")
    monkeypatch.setenv("GEMINI_API_KEY", "x")
    body = client.get(f"{API}/health").json()
    assert body["data_mode"] == "off" and body["llm_configured"] is False


def test_request_id_echoed(client):
    r = client.get(f"{API}/health", headers={"X-Request-ID": "abc-123"})
    assert r.headers["X-Request-ID"] == "abc-123"
    r = client.get(f"{API}/health")
    assert r.headers["X-Request-ID"].startswith("req_")


def test_unknown_route_uses_error_schema(client):
    assert_error(client.get(f"{API}/nope"), 404, "NOT_FOUND")


def test_explain_is_501(client, session):
    sid, h = session["id"], session["headers"]
    client.post(f"{API}/sessions/{sid}/facts", json=reference_facts_payload(), headers=h)
    client.post(f"{API}/sessions/{sid}/offers", json=reference_offer_payload(), headers=h)
    rid = client.post(f"{API}/sessions/{sid}/analysis", json={}, headers=h).json()["report_id"]
    assert_error(client.post(f"{API}/reports/{rid}/explain", headers=h), 501, "NOT_IMPLEMENTED")
    assert_error(client.post(f"{API}/reports/{rid}/explain"), 401, "UNAUTHORIZED")


def test_internal_error_has_no_stack_or_values(client, session, fakes, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("secret value 4200.00")
    monkeypatch.setattr(fakes, "next_question", boom)
    r = client.get(f"{API}/sessions/{session['id']}/next-question", headers=session["headers"])
    err = assert_error(r, 500, "INTERNAL")
    assert "4200" not in r.text and "RuntimeError" not in r.text


def test_cors_allows_web_origin(client):
    r = client.options(f"{API}/health", headers={"Origin": "http://localhost:3000",
                                                  "Access-Control-Request-Method": "GET"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_expired_session_is_401_and_swept(client, session):
    from datetime import datetime, timedelta, timezone
    with Session(get_engine()) as db:
        row = repo.session_by_token(db, session["token"])
        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.add(row)
        db.commit()
    err = assert_error(client.get(f"{API}/sessions/{session['id']}", headers=session["headers"]), 401,
                       "UNAUTHORIZED")
    assert "expired" in err["message"]
    with Session(get_engine()) as db:
        assert repo.purge_expired(db) == 1
        assert all(v == 0 for v in repo.count_rows(db, session["id"]).values())


def test_llm_call_log_persisted_without_prompt_text(client, session, fakes, monkeypatch):
    class LoggingLLM:
        available = True

        def __init__(self):
            self.call_log = [{"prompt_hash": "abc123", "latency_ms": 840, "outcome": "ok",
                              "prompt": "SSN 123-45-6789"}]

    monkeypatch.setattr(fakes, "get_llm_client", LoggingLLM)
    r = client.post(f"{API}/sessions/{session['id']}/documents", headers=session["headers"],
                    files={"file": ("x.pdf", b"%PDF-1.7 FIXTURE", "application/pdf")})
    assert r.status_code == 200, r.text
    from storage.models import LlmCallRow
    from sqlmodel import select
    with Session(get_engine()) as db:
        rows = db.exec(select(LlmCallRow).where(LlmCallRow.session_id == session["id"])).all()
        assert [(x.prompt_hash, x.latency_ms, x.outcome) for x in rows] == [("abc123", 840, "ok")]
        assert "123-45-6789" not in str([x.model_dump() for x in rows])
    client.delete(f"{API}/sessions/{session['id']}", headers=session["headers"])
    with Session(get_engine()) as db:
        assert db.exec(select(LlmCallRow).where(LlmCallRow.session_id == session["id"])).all() == []
