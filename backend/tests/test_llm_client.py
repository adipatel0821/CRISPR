"""LLM adapter: data-mode enforcement inside the client, redaction, metadata-only logs, retry, errors."""
from __future__ import annotations

import json
import logging

import pytest
from pydantic import BaseModel

from llm.client import LLMClient, LLMMalformedOutput, LLMUnavailable, get_llm_client, redact


class Out(BaseModel):
    answer: str


class Recorder:
    def __init__(self, responses):
        self.responses = list(responses)
        self.prompts: list[str] = []

    def __call__(self, prompt, json_schema, schema, model, timeout):
        self.prompts.append(prompt)
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


OK = json.dumps({"answer": "ok"})


def test_off_mode_never_calls():
    t = Recorder([OK])
    c = LLMClient(data_mode="off", transport=t)
    assert not c.available
    with pytest.raises(LLMUnavailable) as e:
        c.generate_json("hello", Out, is_synthetic_fixture=True)
    assert e.value.details["fallback_available"] is True
    assert t.prompts == []


def test_synthetic_only_blocks_real_content_and_allows_fixtures():
    t = Recorder([OK])
    c = LLMClient(data_mode="synthetic_only", transport=t)
    assert c.allows(True) and not c.allows(False)
    with pytest.raises(LLMUnavailable) as e:
        c.generate_json("real user text", Out, is_synthetic_fixture=False)
    assert e.value.reason == "data_mode_synthetic_only"
    assert t.prompts == []
    assert c.generate_json("fixture text", Out, is_synthetic_fixture=True).answer == "ok"
    assert len(t.prompts) == 1


def test_paid_mode_allows_real_content():
    t = Recorder([OK])
    c = LLMClient(data_mode="paid", transport=t)
    assert c.generate_json("real text", Out, is_synthetic_fixture=False).answer == "ok"


def test_unconfigured_is_unavailable():
    c = LLMClient(data_mode="paid", api_key=None)
    assert not c.available
    with pytest.raises(LLMUnavailable) as e:
        c.generate_json("x", Out, is_synthetic_fixture=True)
    assert e.value.reason == "not_configured"


def test_factory_defaults_to_synthetic_only_and_never_paid(monkeypatch):
    monkeypatch.delenv("LLM_DATA_MODE", raising=False)
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    c = get_llm_client()
    assert c.data_mode == "synthetic_only" and c.model == "gemini-2.5-flash"
    monkeypatch.setenv("LLM_DATA_MODE", "PAID-please")
    assert get_llm_client().data_mode == "synthetic_only"
    monkeypatch.setenv("LLM_DATA_MODE", "paid")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-x")
    c = get_llm_client()
    assert c.data_mode == "paid" and c.model == "gemini-x"


def test_redaction_before_call_and_metadata_only_logs(caplog):
    t = Recorder([OK])
    c = LLMClient(data_mode="paid", transport=t)
    text = ("Buyer SSN: 123-45-6789 Phone: (555) 010-4477 Email: sample.buyer@example.com "
            "Account No. 4417 1234 5678 9113. APR 5.80 % Amount Financed $19,500.00 60 payments of $375.14")
    with caplog.at_level(logging.INFO, logger="decisiontwin.llm"):
        c.generate_json(text, Out, is_synthetic_fixture=False)
    sent = t.prompts[0]
    for secret in ["123-45-6789", "sample.buyer@example.com", "010-4477", "4417 1234 5678 9113"]:
        assert secret not in sent
        assert secret not in caplog.text
        assert secret not in repr(c.calls)
    # financial values survive redaction
    for keep in ["5.80 %", "$19,500.00", "$375.14", "60 payments"]:
        assert keep in sent
    assert c.calls[-1].outcome == "ok" and len(c.calls[-1].prompt_hash) == 16
    assert "APR" not in repr(c.calls)            # no raw text in the log record


def test_redact_keeps_money_and_dates():
    assert redact("Total of Payments $22,508.29 beginning 12/01/2026") == \
        "Total of Payments $22,508.29 beginning 12/01/2026"


def test_one_retry_on_schema_failure_then_malformed():
    t = Recorder(["not json", OK])
    c = LLMClient(data_mode="paid", transport=t)
    assert c.generate_json("x", Out, is_synthetic_fixture=False).answer == "ok"
    assert c.calls[-1].outcome == "retry_ok" and c.calls[-1].attempts == 2
    t2 = Recorder(['{"wrong": 1}', "[]"])
    c2 = LLMClient(data_mode="paid", transport=t2)
    with pytest.raises(LLMMalformedOutput):
        c2.generate_json("x", Out, is_synthetic_fixture=False)
    assert len(t2.prompts) == 2


def test_transport_error_maps_to_unavailable():
    c = LLMClient(data_mode="paid", transport=Recorder([TimeoutError("slow")]))
    with pytest.raises(LLMUnavailable):
        c.generate_json("x", Out, is_synthetic_fixture=False)
    assert c.calls[-1].outcome == "unavailable"


def test_invalid_mode_rejected():
    with pytest.raises(ValueError):
        LLMClient(data_mode="free")
