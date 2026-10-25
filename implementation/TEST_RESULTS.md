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
| 21:25 | **fresh clone** of origin/decisiontwin-implementation @ ad80880 into a clean folder, README steps verbatim (Git Bash): new venv + `pip install -r requirements.txt`, `python -m pytest`; `npm install`, `tsc --noEmit`, `npm test`, `next build` | **306 passed**; TSC OK; 14 passed; build compiled. Live server start from the fresh clone: pending (after CP1 audit frees ports) |
| ≈21:35–21:55 | Phase 2 agents (agent-reported): Agent 1 316 passed; Agent 2 348 passed (A-03r 1,000 sessions 0 re-asks); Agent 3 doc_flow 32/32, manual_flow 25/25, a11y 26/26 (axe serious/critical 1 → 0), web tests 20/20 | see audit/inbox/agent_{1,2,3}_phase_CP2.md |
| 21:52 | merged Phase 2 (3 branches) + ev_calc for every metric | **359 passed** |
| 21:56 | live re-run on merged code (uvicorn :8000 fresh DB + next start :3000): cp1_browser 23/23 · doc_flow 32/32 · manual_flow 25/25 · a11y 26/26 · API walkthrough PASS · document_walkthrough PASS · demo_cases PASS | **all PASS** (audit/evidence/phase2) |
| 22:18 | D2-001 fix (5b24df6) — Supervisor re-run | **362 passed**; Agent 5 re-audit: A-15 script 12/12, D2-001 VERIFIED, GO stands at 96712e4 |
| 22:20 | **fresh clone @ 96712e4, native startup per README** (uvicorn --env-file ../.env :8000, next start :3000, default SQLite path) | health ok/synthetic_only; pytest 362 passed; API walkthrough PASS; browser doc_flow 32/32; manual_flow 25/25 (audit/evidence/fresh_clone) |
| 23:5x | **UX redesign merged** (4 agents) + integration fixes (8ab1ed0) | web tests 76/76; live browser 226/226 (a11y 26, doc 32, manual 25, ux_a 58, ux_b 47, ux_c 38); backend unchanged 362 passed |
| 00:10 | Agent 5 UX regression audit @ 7fd7233 | **GO — NO CRITICAL REGRESSION** (226/226 re-run, selectors 16/16, extra flows: deficit, decline, delete) |
| 00:15 | constraint-aware alternative highlights (fa198d9) | web 78/78; live 226/226; Agent 5 re-check: GO stands, selectors 16/16 |
| 00:24 | unknown-delta wording fix (d3275a4) | web 79/79; live ux_c 38/38, ux_b 47/47, manual 25/25 |
