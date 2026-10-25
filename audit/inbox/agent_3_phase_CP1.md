=== STATUS PACKET ===
From: Agent 3 — Frontend / Product Experience  (compiled by the Supervisor from the agent's structured final report — the agent was launched before the audit protocol existed; content is the agent's own report, unedited except for layout)
Phase: CP1 (+ early CP2–CP4 work on the same branch)
Time: agent finished ≈ 20:50 EDT 2026-10-24; packet compiled 21:15 EDT
Status: YELLOW (agent self-reported integration_ready=True; tests below were run by the agent in its isolated worktree, mostly against fakes of sibling modules — GREEN is decided only after Supervisor integration + independent audit)
Done:
The DecisionTwin web frontend is built in web/ and committed on feature/product-experience in 5 commits, based on CP0 f0746c6. The worktree had been created from main, so I reset my new, empty branch to decisiontwin-implementation before starting.

Stack: Next.js 16.4.1 App Router, TypeScript strict, Tailwind v4, hand-written shadcn-style components on radix-ui, Recharts 3.10.1 and lucide-react, all with exact pins and package-lock.json committed. I used Next 16.4.1 instead of a release at least two weeks old because npm audit reports a critical RCE advisory for 16.0.0–16.4.0.

Contract types are generated from contracts/schemas.json into src/lib/contracts.ts by `npm run gen:types` (json-schema-to-typescript). Fields with server defaults are marked as always present because the backend serialises them; request bodies with optional fields are in src/lib/api-types.ts.

API client (src/lib/api.ts):
- Covers every route under /api/v1 with a Bearer token.
- Session id, token and report/offer/doc ids are kept in sessionStorage, wrapped in try/catch with an in-memory fallback.
- Errors become a typed ApiError with a recovery hint and field-level messages; 429/503 back off 1, 2, 4 s, max 3 retries.
- Idempotency-Key is sent on /analysis and /documents.
- NEXT_PUBLIC_USE_FIXTURES=1 serves fixtures through src/lib/fixture-backend.ts, which only replays JSON and records answers (no arithmetic). Fixture JSON is lazy-loaded so it is not in the live bundle.

Fixtures (src/fixtures/*.json): a complete DecisionReport for the reference case, plus offer, a document status with one conflicting term, session, health and a 7-step next-question sequence. They are generated offline by web/scripts/build_fixtures.py, which never runs in the browser:
- Uses Python Decimal with ROUND_HALF_UP and the F00–F14 formulas.
- Asserts every headline value against backend/fixtures/reference_case.json "expected" before writing anything.
- Contents: 3 paired scenarios with 12-month paths (one has a real shortfall with an unfunded gap), break-even 0.27 / 0.19, 8 alternatives (one not possible, same_rate_assumed flags), rate sensitivity, 15 claims, 47 evidence items, sections, key points, missing information and assumptions.

web/scripts/validate_fixtures.py checks the fixtures against backend/schemas/contracts.py, checks claim/evidence/key-point integrity, checks that no label says "verified", and re-checks the reference values.

Screens:
- `/` (welcome): what it does, 3 steps, data-mode banner from /health, consent, Start.
- `/intake`: one question at a time with a typed widget per question kind; estimate toggle, Skip for now, "I'd rather not say"; acknowledgement questions shown as confirm cards. Sticky readiness panel on desktop, collapsible on mobile. Answered facts with status chips and an edit action (POST /facts). Optional refinements list.
- `/offer`: grouped manual form with % to fraction conversion, inline and server field errors, and add-ons. Document tab: drag and drop, polling, offer chooser, and a verification table with quote + page, check icons with text, conflicting candidates and Confirm / Correct / Reject. Payment-mismatch and unsupported-product messages. Runs the analysis.
- `/dashboard`: decision headline, 3 key points, loan cost figures with source popovers, finance charge vs interest, a breakdown bar of the total paid, the APR check, your month, savings and reserve months, flags (informational vs warning, with citation), assumptions, missing information and the full source list.
- `/stress`: paired without/with-loan cards, a 12-month savings chart with the unfunded gap stated separately, month tables, break-even statement, "Illustrative scenario — not a forecast" on every card.
- `/alternatives`: scatter with the trade-off set and your offer labelled, a sortable table with "Same rate assumed — ask the lender" badges, impossible options greyed with reasons, rate sensitivity, "not recommendations" note.
- `/report`: print CSS, evidence footnotes, disclaimers, data mode, calc/schema version, Print / Save as PDF, and Delete my data with confirmation.

Global: progress stepper, results tabs, skeletons, aria-live status, error boundary with retry, readiness-driven empty states, Inter with tabular figures, one teal accent with amber/rose only for flags, visible focus rings, reduced-motion support. No loan math in TypeScript, and the word "verified" is never shown.
In progress:
- none (agent run finished; final commit 770e50f1e4926f3737e84e5583f8224c6d2846e7 on feature/product-experience)
Blocked:
- none reported
Decisions made:
- Specify the response bodies of POST /sessions/{id}/facts and POST /sessions/{id}/answers. Suggested: return NextQuestionResponse (or FinancialProfile) so the UI can avoid a refetch.
- QuestionCandidate.choices: say whether they are enum values (e.g. 'savings') or display strings ('My savings') and what QuestionResponse.typed_value must hold. Suggested: add an optional choice_labels: list[str] parallel to choices, and require typed_value to be the enum value.
- Fix the shape of VALIDATION_ERROR details, e.g. [{loc: [..., field], msg}] with term keys / fact keys as the last loc element, so the UI can map errors to fields.
- Fix the PAYMENT_MISMATCH signal on LoanOffer from POST /offers and /verify. The UI currently looks for 'PAYMENT_MISMATCH' in offer.warnings or monthly_payment.checks.arithmetic warn/fail; a stable flag or warning code would be safer.
- Document the payload shape of GET /config/assumptions. The UI calls it (api.assumptions()) but does not render it yet, because its shape is engine-owned and undefined.
- Optional: re-export contracts/schemas.json with defaulted fields listed as required (pydantic 'serialization' mode with json_schema_mode_override or a custom GenerateJsonSchema), so the TS generator does not need to force them required.
Assumptions:
- Not run against the real backend: integration is untested. The response shapes of POST /facts and POST /answers are not specified, so the UI ignores those bodies and refetches next-question and the session after each write.
- Choice answers are sent as the raw choice string, both raw_answer and typed_value. For readable labels the UI maps known enum values (stable, somewhat_variable, highly_variable, savings, other, none, true, false); any other choice string is shown as-is. The contract example uses display strings like 'My savings', which works only if Agent 2 maps them. Yes/no answers are sent as the strings 'true'/'false'; acknowledgements as typed_value true with raw_answer 'acknowledged'.
- ApiError.fieldErrors() guesses the shape of VALIDATION_ERROR details: a pydantic-style list with loc/msg, a {errors:[...]} wrapper, or a flat {field: message} map. Other shapes still show the general message but no field highlighting.
- Fixture mode always shows the reference-case report whatever the user types (clearly labelled). Fixture readiness comes from a precomputed sequence and does not reflect skipped or declined answers.
- The savings line chart floors savings at $0; the unfunded gap appears in text, the tooltip and the month table, not as a separate plotted series.
- On the report page, at 360 px, screen-reader table captions overflow the body by about 40 px internally. It is invisible and clipped (no page scroll) but not cleaned up.
- Using the shared venv, the fixture-validation script is a manual step; there is no npm script for it.
- Vitest was not added. vitest@4.1.12 hit an npm 9.7.2 install bug ('edgesOut'), and vitest 3.2.x has critical tinypool/mocker advisories, so tests use Node's built-in runner (Node 22.18 or later).
Inputs used:
- implementation/INTERFACES.md, backend/schemas/contracts.py (CP0 f0746c6), backend/engine/requirements.py, architecture-research stage docs for its modules
Outputs given:
- Branch feature/product-experience @ 770e50f1e4926f3737e84e5583f8224c6d2846e7; files: web/package.json, web/package-lock.json, web/tsconfig.json, web/eslint.config.mjs, web/next.config.ts, web/postcss.config.mjs, web/.gitignore, web/.env.example, web/README.md, web/AGENTS.md, web/CLAUDE.md, web/scripts/gen-types.mjs, web/scripts/build_fixtures.py, web/scripts/validate_fixtures.py, web/src/app/layout.tsx, web/src/app/globals.css, web/src/app/error.tsx, web/src/app/not-found.tsx, web/src/app/favicon.ico, web/src/app/page.tsx, web/src/app/intake/page.tsx, web/src/app/offer/page.tsx, web/src/app/dashboard/page.tsx, web/src/app/stress/page.tsx, web/src/app/alternatives/page.tsx, web/src/app/report/page.tsx, web/src/components/ui/button.tsx, web/src/components/ui/card.tsx, web/src/components/ui/badge.tsx, web/src/components/ui/input.tsx, web/src/components/ui/popover.tsx, web/src/components/ui/misc.tsx, web/src/components/site-header.tsx, web/src/components/banners.tsx, web/src/components/states.tsx, web/src/components/provenance-chip.tsx, web/src/components/figure.tsx, web/src/components/delete-data.tsx, web/src/components/readiness-panel.tsx, web/src/components/question-card.tsx …
- Public interfaces: web/src/lib/api.ts: `api` object with health, createSession, getSession, deleteSession, postFacts, nextQuestion, postAnswer, readiness, postOffer, uploadDocument, getDocument, verifyDocument, runAnalysis, getReport, assumptions. Also exports `ApiError` (code, status, details, requestId, recovery, fieldErrors()), `API_BASE` and `USE_FIXTURES`.; Environment variables: NEXT_PUBLIC_API_BASE (default http://localhost:8000; routes under /api/v1) and NEXT_PUBLIC_USE_FIXTURES=1 for fixture mode.; Backend expectations: CORS must allow the web origin and the headers Authorization, Content-Type and Idempotency-Key. Bearer token in the Authorization header. Multipart field name for uploads is 'file'.; web/src/lib/format.ts: percentToFraction, fractionToPercent, formatMoney, formatSignedMoney, formatRate, formatRatioPercent, formatMonths, normalizeCurrencyInput, normalizeIntegerInput, formatTimestamp.; web/src/lib/provenance.ts: sourceChip, evidenceChip, termChip, factStatusChip, honestLabel.; npm scripts: dev, build, start, lint, typecheck, test, gen:types (writes web/src/lib/contracts.ts from ../contracts/schemas.json).; Routes: /, /intake, /offer, /dashboard, /stress, /alternatives, /report.
Tests:
- Commands: Run from web/:
- `npm run typecheck` (tsc --noEmit)
- `npm run lint` (eslint)
- `npm run build`, in live mode and with NEXT_PUBLIC_USE_FIXTURES=1
- `npm test` (node --test src/lib/format.test.ts src/lib/provenance.test.ts)
- `P:/Projects/DecisionTwin/backend/.venv/Scripts/python.exe scripts/build_fixtures.py` (asserts against reference_case.json)
- `P:/Projects/DecisionTwin/backend/.venv/Scripts/python.exe scripts/validate_fixtures.py`

Manual browser checks against the fixture-mode production build (next start on port 3123, stopped afterwards; ports 3123/9333/9334 confirmed free), driven by throwaway Chrome scripts in the session scratchpad:
- Screenshots of every page at 1280 px.
- A horizontal-overflow check at a 360 px viewport.
- A click-through: consent → Start → answer all 6 intake questions → manual offer → See my results → dashboard → source popover → report → Delete my data.
- A second click-through: upload → verification table → resolve conflict → confirm all → save.
- Results (agent-reported): - typecheck: 0 errors.
- lint: 0 errors, 0 warnings.
- build: succeeds in both modes; all 8 routes prerendered (/, /_not-found, /intake, /offer, /dashboard, /stress, /alternatives, /report).
- `npm test`: 14 passed, 0 failed. Expected values are hand-written: percent→fraction including float-trap cases (4.35 → 0.0435), money/rate/months formatting, unknown never shown as zero, timestamp, and a full source × verification × status grid proving no label says "verified".
- build_fixtures.py: all reference-value assertions passed (375.14, 22508.29, 3008.29, 2508.29, 26508.29, 900.00 → 474.86, 2000.00, 2.07 → 0.60, first schedule row, break-even 0.27).
- validate_fixtures.py: "fixtures OK: report with 15 claims, 47 evidence items, 6 scenario runs, 8 alternatives".
- Main click-through: 14/14 PASS, no console errors.
- Upload click-through: 13/13 PASS, no console errors.
- 360 px check: scrollWidth equals clientWidth (360) on all 7 pages.

Two bugs were found and fixed through the browser checks:
- An Intl RangeError from combining dateStyle with timeZoneName crashed the results pages.
- Absolutely-positioned screen-reader text widened the page at 360 px; fixed with overflow-x: clip on html and body and a positioned body.
Questions for auditor:
- Remaining dependencies flagged by the agent: Agent 4 (api + storage): the /api/v1 routes must be live, with CORS for the web origin, before the UI can be tested in live mode.; Agent 2 (intake + documents): QuestionCandidate ids q_<fact_key> and q_ack_<rule_id>; handling of the choice and typed_value encoding described in known_defects; DocumentStatus / VerifyRequest / LoanOffer from document verification.; Agent 1 and Agent 4 (engine + explain): the DecisionReport must fill claims[].text, evidence ids of the form ev_calc_<formula_id> (the dashboard links each figure to its formula through this convention), profile_summary.decision (optional; the UI falls back to the offer terms), and readiness, so every number gets a source chip.
- Notes: Merge note: the worktree was created from main, not decisiontwin-implementation. I reset my new, empty branch to CP0 (f0746c6) before any commits, so the branch is based on CP0 like the other agents' branches.

Commits on top of CP0: 24e5785 (scaffold, client, types, fixtures), d72690c (welcome / intake / offer), b3ca76a (dashboard / report), 625559f (stress / alternatives / fixes), 770e50f (README). All edits are under web/ only. web/AGENTS.md and web/CLAUDE.md were generated by create-next-app 16.

No backend packages were added. Frontend package choices:
- next is 16.4.1 rather than a release at least two weeks old, because of a critical RCE advisory for 16.0.0–16.4.0; npm audit reports 0 vulnerabilities.
- Vitest was dropped in favour of node --test (reasons in known_defects).

Fixture numbers for scenarios and alternatives are my own offline computation: they follow the documented formulas, and the base values are asserted against reference_case.json. Agent 1's engine may differ on details I had to assume: gap repayment order (positive months repay the unfunded gap first), runway = first_shortfall_month − 1, the break-even closed form, and the grid labels. Treat those fixture values as illustrative, not as golden test data for the engine.

To demo without the backend: `cd web && npm ci && NEXT_PUBLIC_USE_FIXTURES=1 npm run dev`.
=== END PACKET ===
