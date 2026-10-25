# Test Results

Reported as measured. States: Passed · Failed · Blocked · Not run · Not implemented.

| Run (ET) | Suite | Result |
|---|---|---|
| 20:08 | backend smoke (CP0): `python -m pytest` in backend/ | 4 passed |
| 20:31 | backend after D0 fixes (780c472): `python -m pytest` | 35 passed |
| 20:37 | backend after D0-003 reopen fix (8c8f379) | 37 passed |
| ≈20:50 | Agent 1 worktree (agent-reported) | 99 passed |
| ≈20:50 | Agent 2 worktree (agent-reported; engine faked) | 105 passed |
| ≈20:50 | Agent 4 worktree (agent-reported) | 74 passed, 1 skipped (e2e awaiting merge) |
| ≈20:50 | Agent 3 web (agent-reported) | typecheck 0, lint 0, build OK, 14 node tests passed |
| 21:00 | **merged** backend (94e8c7f, before fixes) | 20 failed (intake ↔ D0 validation interaction), rest passed |
| 21:04 | merged backend after integration fixes (46ec559) | **305 passed**, 0 failed |
| 21:07 | live API walkthrough `scripts/demo_walkthrough.py` (uvicorn :8000, fresh SQLite, synthetic_only) | **PASS** 32/32 — all reference values exact (375.14 / 22508.29 / 2508.29 / 3008.29 / 26508.29 / APR 0.05796 / 900.00→474.86 / 2000.00 / 2.07→0.60 / schedule row 1); P1 intake = 5 questions; 400 / 401 / 404 isolation / delete |
| 21:08 | web: `npm ci`, gen:types, `tsc --noEmit`, `eslint`, `npm test`, `next build` | 0 errors / 0 errors / 14 passed / build OK (8 routes) |
| 21:10 | **live browser walkthrough** (system Chrome, playwright-core; Next :3000 → API :8000) | 19/20 first run (test expectation wrong for the no-refinement path — corrected to 924.86 with labels), then found UI defect "Savings Now: Not known" → fixed (9ad5d6b) |
| 21:12 | backend after fix (9ad5d6b) | **306 passed** |
| 21:12 | live browser walkthrough re-run | **PASS 23/23** (welcome → 5 adaptive questions → manual offer → dashboard figures → stress → alternatives → report → 360 px, 0 console errors) |
| — | Docker Compose | NOT RUN (Docker not installed) |
| — | Gemini live extraction | NOT RUN (no API key; paid mode not authorized) |
| ≈21:15 | CP3 `scripts/document_walkthrough.py` (TestClient, synthetic fixtures, no Gemini key) — synthetic_only | **PASS** 25/25 (reader extraction 6 TILA fields exact; quote+page+label anchor; APR 5.80% vs 5.796% pass; confirm → evidence_matched_user_confirmed; analysis 375.14/474.86; two-option → needs_choice; variable-rate unsupported; injection ignored; non-fixture → 403; non-PDF rejected) |
| ≈21:15 | same, LLM_DATA_MODE=off (A-13) | **PASS** 25/25 (non-fixture PDF read locally, reader_only) |
| 21:17 | `scripts/demo_cases.py` normal / edge / failure | **PASS** 25/25 (edge values independently recomputed: 17,700 → 318.96 / 22,965.58 / 5,265.58; 445.00 → 126.04; reserve 0.13; deficit −210.00 acknowledged once) |
