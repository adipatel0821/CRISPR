"""LLM adapter over google-genai (stage_02 §14, ADR-S2-03/06, contracts ADR-022).

LLM_DATA_MODE is enforced INSIDE the client, so no caller can bypass it:
  off             -> every call raises LLMUnavailable
  synthetic_only  -> only content flagged is_synthetic_fixture=True may be sent (default)
  paid            -> allowed (only when an operator sets it; never enabled automatically)
Other guarantees: 25 s timeout; structured JSON output (response_schema); one retry on a schema failure,
then LLMMalformedOutput; SSN / account / card / email / phone patterns redacted before ANY call; logs
carry metadata only (prompt hash, latency, outcome) — never raw text.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, ValidationError

log = logging.getLogger("decisiontwin.llm")

DEFAULT_MODEL = "gemini-2.5-flash"
DEFAULT_TIMEOUT_S = 25
DATA_MODES = ("off", "synthetic_only", "paid")


class LLMUnavailable(Exception):
    """LLM disabled by data mode, not configured, timed out or unreachable → 503 LLM_UNAVAILABLE
    (fallback_available: true)."""

    code = "LLM_UNAVAILABLE"

    def __init__(self, message: str, reason: str = "unavailable"):
        super().__init__(message)
        self.message = message
        self.reason = reason
        self.details = {"reason": reason, "fallback_available": True}


class LLMMalformedOutput(Exception):
    """Output failed schema validation twice → 502 LLM_MALFORMED_OUTPUT."""

    code = "LLM_MALFORMED_OUTPUT"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message
        self.details = {"fallback_available": True}


# ---------------------------------------------------------------------------
# Redaction (applied to every prompt before it leaves the process)
# ---------------------------------------------------------------------------
_REDACTIONS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[REDACTED-SSN]"),
    (re.compile(r"(?i)\b(SSN|social security(?: number)?)\s*[:#]?\s*\d{9}\b"), r"\1 [REDACTED-SSN]"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[REDACTED-EMAIL]"),
    (re.compile(r"(?i)\b(account|acct|loan)\s*(no\.?|number|#)\s*[:#]?\s*[A-Z0-9][A-Z0-9 -]{3,24}\d"),
     r"\1 \2 [REDACTED-ACCOUNT]"),
    (re.compile(r"\b(?:\d[ -]?){13,19}\b"), "[REDACTED-NUMBER]"),
    (re.compile(r"(?<![\d$.,])\(?\b\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b"), "[REDACTED-PHONE]"),
]


def redact(text: str) -> str:
    out = text
    for pattern, repl in _REDACTIONS:
        out = pattern.sub(repl, out)
    return out


def prompt_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


@dataclass
class CallRecord:
    """Metadata-only log entry (no prompt or response text)."""
    purpose: str
    model: str
    prompt_hash: str
    prompt_chars: int
    latency_ms: int
    outcome: str          # ok | retry_ok | malformed | unavailable | blocked_data_mode
    attempts: int


Transport = Callable[[str, dict[str, Any], type[BaseModel], str, float], str]


@dataclass
class LLMClient:
    data_mode: str = "synthetic_only"
    api_key: str | None = None
    model: str = DEFAULT_MODEL
    timeout_s: float = DEFAULT_TIMEOUT_S
    transport: Transport | None = None          # injectable for tests; default = google-genai
    calls: list[CallRecord] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.data_mode not in DATA_MODES:
            raise ValueError(f"LLM_DATA_MODE must be one of {DATA_MODES}, got {self.data_mode!r}")

    @property
    def configured(self) -> bool:
        return self.transport is not None or bool(self.api_key)

    @property
    def available(self) -> bool:
        """True when some content may be sent (still subject to the per-call synthetic check)."""
        return self.data_mode != "off" and self.configured

    def allows(self, is_synthetic_fixture: bool) -> bool:
        if not self.available:
            return False
        return self.data_mode == "paid" or (self.data_mode == "synthetic_only" and is_synthetic_fixture)

    # -- calls ---------------------------------------------------------------
    def generate_json(self, prompt: str, schema: type[BaseModel], *, is_synthetic_fixture: bool,
                      purpose: str = "extraction", system: str | None = None) -> BaseModel:
        """Structured call. Raises LLMUnavailable / LLMMalformedOutput. `prompt` is redacted here."""
        safe = redact(prompt)
        h = prompt_hash(safe)
        if self.data_mode == "off":
            self._record(purpose, h, safe, 0, "blocked_data_mode", 0)
            raise LLMUnavailable("AI extraction is turned off (LLM_DATA_MODE=off). Enter the terms manually.",
                                 "data_mode_off")
        if self.data_mode == "synthetic_only" and not is_synthetic_fixture:
            self._record(purpose, h, safe, 0, "blocked_data_mode", 0)
            raise LLMUnavailable("Only bundled synthetic documents may be sent to the AI in this mode.",
                                 "data_mode_synthetic_only")
        if not self.configured:
            self._record(purpose, h, safe, 0, "unavailable", 0)
            raise LLMUnavailable("The AI service is not configured (no GEMINI_API_KEY).", "not_configured")
        full = f"{system}\n\n{safe}" if system else safe
        json_schema = schema.model_json_schema()
        started = time.monotonic()
        last_err: Exception | None = None
        for attempt in (1, 2):
            try:
                raw = self._send(full, json_schema, schema)
            except LLMUnavailable:
                self._record(purpose, h, safe, self._ms(started), "unavailable", attempt)
                raise
            except Exception as e:  # noqa: BLE001 - network/SDK/timeout errors → unavailable
                self._record(purpose, h, safe, self._ms(started), "unavailable", attempt)
                raise LLMUnavailable(f"The AI service did not respond ({type(e).__name__}).", "error") from None
            try:
                parsed = schema.model_validate(json.loads(raw) if isinstance(raw, str) else raw)
            except (json.JSONDecodeError, ValidationError, TypeError) as e:
                last_err = e
                continue
            self._record(purpose, h, safe, self._ms(started), "ok" if attempt == 1 else "retry_ok", attempt)
            return parsed
        self._record(purpose, h, safe, self._ms(started), "malformed", 2)
        raise LLMMalformedOutput(f"The AI returned output that did not match the schema "
                                 f"({type(last_err).__name__}).")

    def _send(self, prompt: str, json_schema: dict[str, Any], schema: type[BaseModel]) -> str:
        if self.transport is not None:
            return self.transport(prompt, json_schema, schema, self.model, self.timeout_s)
        return _genai_send(self.api_key or "", prompt, schema, self.model, self.timeout_s)

    @staticmethod
    def _ms(started: float) -> int:
        return int((time.monotonic() - started) * 1000)

    def _record(self, purpose: str, h: str, safe: str, ms: int, outcome: str, attempts: int) -> None:
        rec = CallRecord(purpose=purpose, model=self.model, prompt_hash=h, prompt_chars=len(safe),
                         latency_ms=ms, outcome=outcome, attempts=attempts)
        self.calls.append(rec)
        log.info("llm_call purpose=%s model=%s prompt_hash=%s chars=%d latency_ms=%d outcome=%s attempts=%d",
                 rec.purpose, rec.model, rec.prompt_hash, rec.prompt_chars, rec.latency_ms, rec.outcome,
                 rec.attempts)


def _genai_send(api_key: str, prompt: str, schema: type[BaseModel], model: str, timeout_s: float) -> str:
    try:
        from google import genai
        from google.genai import types
    except ImportError as e:  # pragma: no cover - dependency is pinned
        raise LLMUnavailable("google-genai is not installed.", "not_installed") from e
    client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=int(timeout_s * 1000)))
    resp = client.models.generate_content(
        model=model, contents=prompt,
        config=types.GenerateContentConfig(temperature=0, response_mime_type="application/json",
                                           response_schema=schema))
    text = getattr(resp, "text", None)
    if not text:
        raise ValueError("empty response")
    return text


def get_llm_client(transport: Transport | None = None) -> LLMClient:
    """Factory reading the environment. Paid mode is used only if LLM_DATA_MODE=paid is set explicitly;
    an unknown value falls back to synthetic_only (never to paid)."""
    mode = (os.environ.get("LLM_DATA_MODE") or "synthetic_only").strip().lower()
    if mode not in DATA_MODES:
        log.warning("Unknown LLM_DATA_MODE %r; using synthetic_only", mode)
        mode = "synthetic_only"
    return LLMClient(data_mode=mode, api_key=os.environ.get("GEMINI_API_KEY") or None,
                     model=os.environ.get("GEMINI_MODEL") or DEFAULT_MODEL, transport=transport)
