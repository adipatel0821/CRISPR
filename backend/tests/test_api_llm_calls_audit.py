"""D2-001: the REAL llm.client.LLMClient's call records reach the llm_calls audit table through the API.

No network: the real client gets an injected recording transport. The real document pipeline runs on a bundled
synthetic fixture in LLM_DATA_MODE=synthetic_only. Checks: one llm_calls row per client call record, carrying
prompt_hash / latency_ms / outcome and no document text; the list is cleared after persisting; DELETE purges them.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from sqlmodel import Session, select

from llm.client import LLMClient
from storage import repo
from storage.db import get_engine
from storage.models import LlmCallRow

API = "/api/v1"
FIXTURE_PDF = Path(__file__).resolve().parents[1] / "fixtures" / "documents" / "contract_standard.pdf"
DOC_TEXT_NEEDLES = ("ANNUAL PERCENTAGE RATE", "PERCENTAGE RATE", "RETAIL INSTALLMENT SALE CONTRACT", "Example Motors",
                    "Sample Buyer", "123-45-6789", "19,500.00")


class RecordingTransport:
    """Stands in for google-genai: records each outbound prompt, then answers or fails as configured."""

    def __init__(self, reply):
        self.reply = reply
        self.prompts: list[str] = []

    def __call__(self, prompt, json_schema, schema, model, timeout):
        self.prompts.append(prompt)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


@pytest.fixture
def real_docs_client(db_url, monkeypatch):
    """Real API + real documents pipeline; only get_llm_client is replaced (by the real LLMClient class)."""
    monkeypatch.setenv("LLM_DATA_MODE", "synthetic_only")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    from fastapi.testclient import TestClient
    from api.main import app
    with TestClient(app) as c:
        yield c


def _rows(session_id: str) -> list[LlmCallRow]:
    with Session(get_engine()) as db:
        return db.exec(select(LlmCallRow).where(LlmCallRow.session_id == session_id)).all()


@pytest.mark.parametrize("reply, expected_outcome, expected_prompts", [
    ("not json", "malformed", 2),            # schema failure twice -> one record, outcome malformed
    (TimeoutError("slow"), "unavailable", 1),  # transport error -> one record, outcome unavailable
])
def test_real_llm_client_calls_persisted_and_purged(real_docs_client, monkeypatch, reply, expected_outcome,
                                                     expected_prompts):
    from api import adapters
    transport = RecordingTransport(reply)
    clients: list[LLMClient] = []

    def factory():
        c = LLMClient(data_mode="synthetic_only", transport=transport)
        clients.append(c)
        return c

    monkeypatch.setattr(adapters, "get_llm_client", factory)
    c = real_docs_client
    s = c.post(f"{API}/sessions", json={})
    assert s.status_code == 201, s.text
    sid, h = s.json()["session_id"], {"Authorization": f"Bearer {s.json()['token']}"}

    r = c.post(f"{API}/sessions/{sid}/documents", headers=h,
               files={"file": ("contract_standard.pdf", FIXTURE_PDF.read_bytes(), "application/pdf")})
    assert r.status_code == 200, r.text
    assert r.json()["is_fixture"] is True

    # the fixture was allowed through the data-mode gate and actually reached the (recording) transport
    assert len(transport.prompts) == expected_prompts
    assert len(clients) == 1
    llm = clients[0]
    assert llm.calls == [], "records must be cleared after persisting (no double write)"

    rows = _rows(sid)
    assert len(rows) >= 1, "at least one llm_calls row per LLM call"
    assert len(rows) == 1                      # one generate_json call for one document
    row = rows[0]
    assert row.prompt_hash and len(row.prompt_hash) == 16
    assert row.latency_ms is not None and row.latency_ms >= 0
    assert row.outcome == expected_outcome
    # the outbound prompt really carried document text; the audit row must not
    assert any("ANNUAL PERCENTAGE RATE" in " ".join(p.split()).upper() for p in transport.prompts)
    assert any("Example Motors" in p for p in transport.prompts)
    dumped = str([x.model_dump() for x in rows])
    flat = " ".join(dumped.split()).upper()
    for needle in DOC_TEXT_NEEDLES:
        assert needle not in dumped and needle.upper() not in flat
    for p in transport.prompts:
        assert p not in dumped

    with Session(get_engine()) as db:
        assert repo.count_rows(db, sid)["llm_calls"] == 1

    d = c.delete(f"{API}/sessions/{sid}", headers=h)
    assert d.status_code == 204, d.text
    assert _rows(sid) == []
    with Session(get_engine()) as db:
        assert repo.count_rows(db, sid)["llm_calls"] == 0


def test_second_upload_does_not_rewrite_earlier_records(real_docs_client, monkeypatch):
    """A single client instance reused across uploads must not persist the same CallRecord twice."""
    from api import adapters
    shared = LLMClient(data_mode="synthetic_only", transport=RecordingTransport("not json"))
    monkeypatch.setattr(adapters, "get_llm_client", lambda: shared)
    c = real_docs_client
    s = c.post(f"{API}/sessions", json={})
    sid, h = s.json()["session_id"], {"Authorization": f"Bearer {s.json()['token']}"}
    for _ in range(2):
        r = c.post(f"{API}/sessions/{sid}/documents", headers=h,
                   files={"file": ("contract_standard.pdf", FIXTURE_PDF.read_bytes(), "application/pdf")})
        assert r.status_code == 200, r.text
    assert len(_rows(sid)) == 2
    assert shared.calls == []
