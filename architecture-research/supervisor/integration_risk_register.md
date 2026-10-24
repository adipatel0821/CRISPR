# Integration & Risk Register — DecisionTwin (v1.1)

> **v1.1 (post-audit, 2026-10-24).** Updates: Q-2, Q-3, Q-4 closed; R-01, R-02 and R-15 mitigations strengthened; R-17 to R-22 added from the audit and red-team pass (`../reviews/supervisor_final_review.md` §7). Severities reflect the v1.1 design.

Date: 2026-10-24. Severity = Likelihood (L/M/H) × Impact (L/M/H). Owners refer to the four-developer roles in `team_execution_plan.md` (Dev 1 Engine, Dev 2 Intelligence, Dev 3 Experience, Dev 4 Integration & Narrative).

## 1. Cross-stage dependencies

| From → To | Dependency | Contract element | Status |
|---|---|---|---|
| Stage 1 → Stage 3 | sensitivity needs partial compute | `CalculationResult.metrics[*].status = missing` | resolved (ADR-S3-05) |
| Stage 2 → Stage 3 | arithmetic checks | `engine.payment`, `engine.solve_apr`; `prepaid_finance_charges`, `contract_rate` | resolved |
| Stage 2 → Stage 1 | verified loan facts | `LoanOffer.ready_for_calculation` | resolved |
| Stage 3 → Stage 4 | monthly cash-flow function | `engine.cashflow.month_net` | resolved |
| Stage 4 ↔ Stage 5 | shared assumptions | `assumption_ids`, scenario catalog by reference | resolved |
| Stage 5 → Stage 6 | numbers/levers visible to explanations | v1.1: `Claim` objects with `assumption_flags` (replaces `allowed_numbers`) | resolved |
| Stage 1 ↔ Stage 3 (v1.1) | readiness vs engine needs | `required_inputs` map | resolved (A-23) |
| Stage 1 ↔ Stage 2 (v1.1) | loan facts during intake | two-track; `awaiting_offer` | resolved |
| Stage 1 → Stage 6 | question count/UX | stop at T0, optional list with sensitivity | resolved |
| API → Web | type parity | OpenAPI → Zod/TS generation | process (R-07) |

## 2. Interface incompatibilities found and resolved

1. Money as floats in early sketches → string decimals everywhere (contracts §1).
2. `null` used for unknown → `status: missing` facts (contracts §1).
3. Scenario runner re-implementing amortization → import from engine.
4. Narration consuming raw JSON → `ExplanationPlan` with `allowed_numbers` (v1.0); **v1.1:** replaced by claims; narration deferred.
5. **v1.1:** amount financed used as the payment base → `principal` + F00; `verified` overloaded → `status` × `verification`.

## 3. Unresolved architecture questions

| ID | Question | Owner | Deadline |
|---|---|---|---|
| Q-1 | Gemini model string and rate limits (terms now verified: unpaid tier unsuitable for real data) | Dev 2 | before CP1 |
| Q-6 | Enable billing (`paid` mode) or demo in `synthetic_only` | Team / Dev 4 | before CP1 |
| Q-2 | F12 depreciation | Dev 1 | **Closed (ADR-018):** no assumed curve; user estimates only |
| Q-3 | Illustrative lower-rate alternative | Dev 1 + Dev 4 | **Closed (ADR-020):** excluded; rate-sensitivity statement instead |
| Q-4 | Break-even horizon | Dev 1 | **Closed (ADR-019):** show 3 and 6 |
| Q-5 | Print stylesheet vs server PDF for report | Dev 3 | Checkpoint 2 |

## 4. Risk register

| ID | Risk | Category | L | I | Sev | Mitigation | Owner | Verification test |
|---|---|---|---|---|---|---|---|---|
| R-01 | Extraction misreads a TILA value, or reads a different offer column, and the user confirms it | Financial correctness / AI | M | H | **High** | v1.1: label anchor + deterministic TILA reader (independent source) + offer chooser + itemization reconcile + arithmetic; user acts per field; confirmation labeled as such | Dev 2 | A-05r, A-06r |
| R-02 | Wrong formula (realized in v1.0: principal basis, APR, trade-in, reserve, replacement) | Financial correctness | M→L | H | **High** | v1.1 corrected spec (ADR-018); Reg Z principal example and transaction fixtures; golden files; spreadsheet cross-check | Dev 1 | A-07r, A-24, A-28–A-32 |
| R-03 | Explanation states a false relationship or implied advice | AI | L | H | **Med** | v1.1: claim-based templates only; narration deferred until A-40 passes | Dev 4 | A-12r, A-40 |
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
| R-15 | CFPB figures misquoted (realized in v1.0: "CFPB median shock") | Credibility | M | H | **High** | Retracted; illustrative labels; CFPB context sentences verified against source PDFs before slides (UD-04) | Dev 4 | A-10r, slide review |
| R-16 | Sensitivity bounds (question ranking) or default shocks taken as facts | Explainability | M | M | **Med** | Config labeled "assumption" with citations; assumptions endpoint shown in UI | Dev 2 + Dev 1 | A-02, A-10 |

| R-17 | Real user documents sent on unpaid Gemini quota (possible human review per terms) | Privacy / compliance | M | H | **High** | `LLM_DATA_MODE`; `synthetic_only` default; banner; inline only | Dev 2 + Dev 4 | A-26 |
| R-18 | Hardship (deficit) treated as bad data, blocking the users who most need analysis | Product / ethics | L | H | **Med** | H01 acknowledgement; `DEFICIT_*` flags | Dev 2 | A-21, A-32 |
| R-19 | Unknown values treated as zero (debt payments, PFC, flexible spending) | Financial correctness | L | H | **Med** | Item facts; `a_pfc_zero` explicit + mismatch check; no flexible default | Dev 1 + 2 | A-22, A-24, A-32 |
| R-20 | Alternatives imply options the user can't get | Ethics / clarity | L | M | **Low** | No hypothetical rates; `same_rate_assumed` labels | Dev 1 + 3 | A-37, A-38 |
| R-21 | Reduced time (start 19:45 vs 17:00 assumed in v1.0) | Implementation | H | M | **High** | Re-planned blueprint; ~48 effective hours; pre-ordered cut list | Dev 4 | checkpoint reviews |
| R-22 | Readiness and engine requirements drift apart | Integration | M | M | **Med** | Single `required_inputs` map; graph generated from it | Dev 1 + 2 | A-23 |

## 5. Contingency triggers

- If extraction on the synthetic set produces unresolved conflicts on > 1 of the five TILA fields by CP2 → demo the manual-entry path with checks; describe extraction as enhanced scope.
- Narration is deferred in v1.1; enable it only if A-40 passes after CP3 (otherwise no change).
- If billing is not enabled by CP1 → run `synthetic_only` and say so in the demo and Devpost text.
- If any T0 engine test fails at code freeze → block submission of the analysis feature until fixed; never ship a wrong number.
