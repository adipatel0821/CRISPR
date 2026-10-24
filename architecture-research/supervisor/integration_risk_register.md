# Integration & Risk Register — DecisionTwin

Date: 2026-10-24. Severity = Likelihood (L/M/H) × Impact (L/M/H). Owners refer to the four-developer roles in `team_execution_plan.md` (Dev 1 Engine, Dev 2 Intelligence, Dev 3 Experience, Dev 4 Integration & Narrative).

## 1. Cross-stage dependencies

| From → To | Dependency | Contract element | Status |
|---|---|---|---|
| Stage 1 → Stage 3 | sensitivity needs partial compute | `CalculationResult.metrics[*].status = missing` | resolved (ADR-S3-05) |
| Stage 2 → Stage 3 | arithmetic checks | `engine.payment`, `engine.solve_apr`; `prepaid_finance_charges`, `contract_rate` | resolved |
| Stage 2 → Stage 1 | verified loan facts | `LoanOffer.ready_for_calculation` | resolved |
| Stage 3 → Stage 4 | monthly cash-flow function | `engine.cashflow.month_net` | resolved |
| Stage 4 ↔ Stage 5 | shared assumptions | `assumption_ids`, scenario catalog by reference | resolved |
| Stage 5 → Stage 6 | numbers/levers visible to narration | `allowed_numbers`, `TradeOffFact` | resolved |
| Stage 1 → Stage 6 | question count/UX | stop at T0, optional list with sensitivity | resolved |
| API → Web | type parity | OpenAPI → Zod/TS generation | process (R-07) |

## 2. Interface incompatibilities found and resolved

1. Money as floats in early sketches → string decimals everywhere (contracts §1).
2. `null` used for unknown → `status: missing` facts (contracts §1).
3. Scenario runner re-implementing amortization → import from engine.
4. Narration consuming raw JSON → `ExplanationPlan` with `allowed_numbers`.

## 3. Unresolved architecture questions

| ID | Question | Owner | Deadline |
|---|---|---|---|
| Q-1 | Gemini model string, free-tier limits, data-use terms on event day | Dev 2 | before Checkpoint 1 |
| Q-2 | F12 depreciation: assumption curve vs "ask the dealer" only | Dev 1 | Checkpoint 1 |
| Q-3 | Include illustrative "1 point lower offer" alternative | Dev 1 + Dev 4 | Checkpoint 2 |
| Q-4 | Break-even horizon `M` = 3 or show 3 and 6 | Dev 1 | Checkpoint 2 |
| Q-5 | Print stylesheet vs server PDF for report | Dev 3 | Checkpoint 2 |

## 4. Risk register

| ID | Risk | Category | L | I | Sev | Mitigation | Owner | Verification test |
|---|---|---|---|---|---|---|---|---|
| R-01 | Extraction misreads a TILA value (e.g., APR 7.99 → 1.99) and the user confirms it | Financial correctness / AI | M | H | **High** | Verbatim quote + quote-match check; APR recompute within ⅛ pt; arithmetic checks; UI highlights failed checks; user must act per field | Dev 2 | A-05, A-06 (acceptance plan) |
| R-02 | Arithmetic drift or a wrong formula | Financial correctness | L | H | **High** | Decimal engine; CFPB reference vectors; property tests; golden files; independent spreadsheet cross-check | Dev 1 | A-07 |
| R-03 | Narrative states a number or advice not in the results | AI | M | H | **High** | Numeric-membership gate; deny-list; templates-first; failure ⇒ template | Dev 4 | A-11 |
| R-04 | Gemini quota/outage during demo | API availability | M | M | **Med-High** | Typed widgets; manual offer entry; template explanations; demo script avoids live scans unless pre-tested; cached sample extraction fixture allowed *only if labeled* in the demo as a cached result | Dev 2 | A-13 |
| R-05 | Prompt injection via uploaded document | Security | L | M | **Med** | Untrusted framing; schema-only; no tools; evidence requirement; free-text screening | Dev 2 | A-14 |
| R-06 | Sensitive data sent to provider without consent | Privacy | M | M | **Med** | Consent screen; redaction in text mode; image-mode opt-in; no identity fields in ontology | Dev 4 | A-15 |
| R-07 | Frontend/backend type drift after schema change | Integration | H | M | **Med-High** | Regenerate TS types from OpenAPI in a script; contract freeze after Checkpoint 1; one owner for schemas | Dev 4 | A-16 |
| R-08 | Scope creep (Monte Carlo, highlights, chat) breaks the vertical slice | Scope | H | H | **High** | Cut list in execution plan; features behind flags; code freeze at T−3h | All (Dev 4 enforces) | Checkpoint reviews |
| R-09 | Too many questions before first value | UX | M | M | **Med** | Stop at T0 (≤ 7–10 questions); optional list; estimate/skip | Dev 2 + Dev 3 | A-01, A-03 |
| R-10 | Users read runway/scenarios as predictions | Ethics / clarity | M | H | **Med-High** | Assumption panel beside every scenario; wording rules; hallway test question | Dev 3 + Dev 4 | A-12 |
| R-11 | Unsupported products (variable, balloon, precomputed) computed as if amortizing | Financial correctness | M | H | **Med-High** | Product-type detection blocks calculation with explanation | Dev 2 + Dev 1 | A-08 |
| R-12 | Public repo leaks an API key | Security | M | H | **Med-High** | `.env` git-ignored; secret scan before publishing; key rotation after event | Dev 4 | pre-submission checklist |
| R-13 | Deployment attempt consumes time and fails | Implementation | M | M | **Med** | Local Compose demo primary; deploy only after Checkpoint 2; video backup | Dev 4 | demo rehearsal |
| R-14 | SQLite write contention during demo | Operational | L | L | **Low** | WAL mode; single API process | Dev 4 | smoke test |
| R-15 | CFPB figures AI-extracted from PDFs quoted inaccurately on slides | Credibility | M | M | **Med** | Verify flagged figures in the PDFs before slides (project file warns) | Dev 4 | slide review |
| R-16 | Sensitivity bounds (question ranking) or default shocks taken as facts | Explainability | M | M | **Med** | Config labeled "assumption" with citations; assumptions endpoint shown in UI | Dev 2 + Dev 1 | A-02, A-10 |

## 5. Contingency triggers

- If extraction accuracy on the ground-truth set < 80% by Checkpoint 2 → demo uses text-PDF path only; scans described as enhanced scope.
- If narration gate rejects > 30% of outputs after tuning → ship templates only (no user-visible loss).
- If any T0 engine test fails at code freeze → block submission of the analysis feature until fixed; never ship a wrong number.
