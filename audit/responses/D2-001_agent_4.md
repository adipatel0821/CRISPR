CORRECTION RESPONSE:
Directive ID: D2-001
Agent: Agent 4 (Backend & Integration Engineer)
Files changed: backend/api/routers/offers.py; backend/tests/test_api_llm_calls_audit.py (new)
What changed: _persist_llm_calls reads the real LLMClient.calls (list[CallRecord]) first, falling back to call_log only when calls is absent; each record maps to an llm_calls row with prompt_hash, latency_ms and outcome only (no prompt/response/document text); the list is cleared after persisting (no double writes). New tests use the real LLMClient with an injected RecordingTransport (no network) patched into api.adapters.get_llm_client and the real document pipeline in synthetic_only: malformed (2 prompts) and unavailable (TimeoutError) cases each write exactly 1 row per CallRecord with a 16-char prompt_hash; no row contains document text ("ANNUAL PERCENTAGE RATE", "Example Motors", "Sample Buyer", "123-45-6789", "19,500.00"); DELETE (204) removes the rows; reusing a client across two uploads writes 2 rows (no double write). All 3 new tests fail without the fix (verified by stashing). The legacy fake-based test still passes via the fallback.
Commit SHA: 5b24df6ef5bc3dce09ac5944ce07d9cf3ac105b0
Test executed: cd backend && .venv/Scripts/python.exe -m pytest -p no:warnings; PYTHONPATH=. .venv/Scripts/python.exe ../audit/evidence/release_audit/api_release_audit_a15.py <scratchpad>/a15
Test result: 362 passed (agent) — re-run by the Supervisor at 22:18 EDT: 362 passed. A-15 script: 12 PASS / 0 FAIL (llm_calls 1 after upload, 0 after DELETE).
Remaining limitations: one row per CallRecord (retries folded into outcome + total latency), not one row per transport attempt — per-attempt rows would need an attempts column / per-attempt records from llm/client.py. CallRecord purpose/model/prompt_chars/attempts not persisted (no columns).
Status: READY FOR RE-AUDIT
END CORRECTION RESPONSE
