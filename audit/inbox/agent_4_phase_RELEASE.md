=== STATUS PACKET ===
From: Agent 4 (Backend & Integration Engineer)
Phase: Post-release correction, D2-001
Time: 2026-10-24 22:16 America/New_York
Status: GREEN
Done: D2-001 fix in offers.py `_persist_llm_calls`; new real-client audit test file (3 tests); full suite green; A-15 script 12/12; committed 5b24df6 (not pushed).
In progress: none
Blocked: none
Decisions made: Read `calls` first, `call_log` only if `calls` is None; one audit row per CallRecord; the legacy fake test is kept unchanged (covers the fallback); test normalizes whitespace before scanning for "ANNUAL PERCENTAGE RATE" (split across lines in the fixture).
Assumptions: "≥1 row per LLM attempt" = one row per client CallRecord, consistent with the directive's field mapping; llm.client.get_llm_client() returns a new client per request, so sessions cannot mix records.
Inputs used: audit/directives/D2-001.md, backend/llm/client.py, backend/api/routers/offers.py, backend/storage/{models,repo}.py, backend/tests/{conftest,test_api_sessions,test_llm_client}.py, audit/evidence/release_audit/api_release_audit_a15.py
Outputs given: commit 5b24df6 (backend/api/routers/offers.py, backend/tests/test_api_llm_calls_audit.py). Nothing under audit/ or implementation/ edited.
Tests: pytest 362 passed (359 + 3 new). A-15 standalone 12 PASS / 0 FAIL. No servers started (TestClient only).
Questions for auditor: Is one llm_calls row per CallRecord (retries folded into outcome) acceptable for "per LLM attempt", or are per-transport-attempt rows required (needs an attempts column or per-attempt records from Agent 2's llm client)?
=== END PACKET ===
