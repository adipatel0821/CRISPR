=== STATUS PACKET ===
From: Agent 3 (Frontend)
Phase: CP2/CP3 gap closure: live document upload flow, provenance honesty in the UI (supports D1-001), accessibility
Time: 2026-10-24 21:51 ET
Status: GREEN
Done:
- Ran the document upload flow live (Next :3000 -> uvicorn :8000, synthetic_only) and fixed 2 defects there:
  (1) The offer chooser sent offer_choice as a 0-based index. The API requires 1..N (documents/verify.py:56), so the two-option worksheet returned 400 VALIDATION_ERROR "offer_choice must be between 1 and 2." It now sends 1-based values.
  (2) contract_variable_rate.pdf showed two unsupported alerts plus Confirm/Save controls. It now shows one alert (backend message + "Type the terms instead" + "Try another file") and a read-only "Terms we read — for reference only" list, with no save or results path.
- Changed the document chip wording from "From your contract, p.N" to "From your document, p.N". This matches the backend evidence labels, review R6-03 and DEMO_CHECKLIST.
- Provenance honesty: added an "Includes an assumption" / "Estimate" chip on figures whose metric status is assumed or estimated, or whose value depends on a recorded assumption:
  - a_no_running_costs and a_not_replacing -> F14, F09, F10
  - a_pfc_zero and a_rate_from_apr -> loan figures
  The chip opens the assumption text and links to #assumptions. It appears on the dashboard figures and in claim lines. The printable report gets a text note, and the dashboard header carries a notice. It works with today's backend (status provided, assumptions_used=[a_no_running_costs]) and with the D1-001 fix (status "assumed").
- Accessibility: fixed 1 critical axe violation (label on #doc-upload; that input is also removed from the tab order). The keyboard-only pass through welcome -> intake -> offer upload -> confirm -> down-payment -> results passes.
- Saved scripts: web/e2e/doc_flow.mjs, web/e2e/manual_flow.mjs (CP1 audit script plus 2 assumption-chip checks), web/e2e/a11y.mjs.
In progress: none
Blocked: none
Decisions made:
- The assumption-to-metric map comes from the engine dependencies:
  - F09 = take-home − essentials − debts − payment − F14 (engine/cashflow.py)
  - F10 = F13 / (essentials + debts + payment + F14) (engine/ratios.py)
  - F11 is NOT mapped: it does not depend on F14, despite the wording in D1-001.
- When a metric is "assumed" but no mapped assumption explains it, the chip still shows. It is never silently "provided".
- Unsupported documents are shown read-only, with no confirm/save path.
Assumptions: Backend contract offer_choice is 1-based (verify.py). Metric.status is null for provided values and set for weaker ones (engine/result.py::metric).
Inputs used: audit/reports/CP1_AUDIT.md, audit/directives/D1-001.md, implementation/INTERFACES.md, implementation/DECISIONS.md, audit/evidence/cp1/cp1_browser.mjs, backend/fixtures/documents/*, live API responses
Outputs given: 4 commits on feature/product-experience-cp2 (da591e3, f770423, 17a6737, 1622ee5); web/e2e scripts
Tests:
- Backend pytest: 306 passed
- npm run typecheck: 0 errors
- npx eslint .: 0 problems
- npm test: 20/20 (6 new assumption tests)
- npx next build: OK
- Live browser runs:
  - doc_flow.mjs PASS 32/32 (before fixes 18/22)
  - manual_flow.mjs PASS 25/25
  - a11y.mjs PASS 26/26
- axe serious/critical: before 1 (critical "label" on /offer upload tab), after 0 across all 7 pages (9 states scanned)
- Docker / fixture-mode (NEXT_PUBLIC_USE_FIXTURES=1) browser run: NOT RUN
Questions for auditor:
1. F14 "Change in car running costs" shows the chip "Source not stated" because the report has no ev_calc_F14 evidence and no claim cites F14 (backend explain). Should Agent 4 add ev_calc_F14?
2. Commit f770423 includes dashboard/page.tsx with the chip wiring, so f770423 does not build on its own; the branch tip builds. Acceptable?
=== END PACKET ===
