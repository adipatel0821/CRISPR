# DecisionTwin — Architecture Research & Design (HackPSU Fall 2026)

**Status:** architecture **v1.1 (post-audit)** · **Verdict:** READY WITH NONBLOCKING LIMITATIONS · **Date:** 2026-10-24 · **No application code exists.** Architecture approval and implementation authorization are separate team decisions.
**Tracks:** FNB Challenge (Trust, Decisions & Financial Confidence) · Nittany AI Challenge · (MLH Best Use of Gemini API, if applicable)

## Read in this order

0. `SUMMARY.md` / `SUMMARY.pdf` — two-page overview of all work and every file.
1. `reviews/supervisor_final_review.md` — what the audit found, what changed, red-team results, verdict.
2. `supervisor/system_architecture.md` — the architecture (v1.1).
3. `supervisor/api_and_data_contracts.md` — **the only authoritative schema source (v1.1)**.
4. `supervisor/team_execution_plan.md` and `reviews/final_implementation_blueprint.md` — roles, schedule from 19:45 EDT, checkpoints, cut list.
5. Your stage report (`stage-0X-*/stage_0X_architecture.md`, v1.1 header lists changes), its Word spec, and its review (`reviews/stage_0X_review.md`).
6. `supervisor/mvp_acceptance_plan.md` (A-01…A-42), `reviews/implementation_readiness_checklist.md`.
7. `reviews/architecture_change_matrix.md` (CH-01…CH-38), `supervisor/architecture_decisions.md` (ADR-001…ADR-023), `supervisor/integration_risk_register.md`, `reviews/evidence_register.md`.
8. `diagrams/*.mmd` — paste into any Mermaid renderer.

## Process disclosure

- **v1.0** (commit `a180770`): six scoped research passes plus a supervisor synthesis. This chat environment can't spawn subagents.
- **v1.1 audit:** six sequential scoped review passes (Stage 1→6), a supervisor synthesis with contract reconciliation, and a separate red-team pass. These were simulated roles, not independent agents. The v1.0 documents were authored in the same conversation, so every material finding is backed by a primary source fetched on 2026-10-24 or a numeric reproduction (`reviews/evidence_register.md`).
- **Verified 2026-10-24:** Devpost deadlines and judging criteria (fetched twice); Gemini structured output, document understanding and API terms; Reg Z §1026.18(b); CFPB Making Ends Meet emergency-savings report; Fulford & Low expense-shock paper.
- **Retracted from v1.0:** the "CFPB median 3-week shock"; "validated narration"; "verified" meaning user-confirmed.
- **Not re-fetched:** framework documentation URLs (cited as locations, marked ◻).

## Most important v1.1 changes

1. Loan payment computed on the **principal**, not the amount financed. APR solved on amount financed without double-subtracting fees.
2. Trade-in counted at **equity**. **Savings after the down payment** drives reserve and stress. **Replaced-vehicle** costs are netted.
3. Real documents go to Gemini **only on paid quota** (`LLM_DATA_MODE`), because the unpaid-tier terms prohibit sensitive data.
4. Document checks add **label anchors, an independent TILA reader and an offer chooser**.
5. Intake is **readiness-driven and blocking-first**; deficits are acknowledged, not rejected.
6. Scenarios are **illustrative**, paired with and without the loan, and floored at zero.
7. Alternatives are **actionable only** (no hypothetical rates).
8. Explanations are **claim-based templates**; LLM narration is deferred.

## Deliverable index

| Path | Type | Status |
|---|---|---|
| `README.md`, `SUMMARY.md`, `SUMMARY.pdf` | Overview | v1.1 |
| `stage-0{1..6}-*/stage_0X_architecture.md` (6) | Stage reports | v1.1 |
| `stage-0{1..6}-*/stage_0X_technical_stack.docx` (6) | Word specs | v1.1, render-checked |
| `supervisor/system_architecture.md` | Architecture | v1.1 |
| `supervisor/api_and_data_contracts.md` | Contracts | v1.1 (authoritative) |
| `supervisor/architecture_decisions.md` | ADR register | ADR-001…023 |
| `supervisor/integration_risk_register.md` | Risks | v1.1 (R-01…R-22) |
| `supervisor/mvp_acceptance_plan.md` | Tests | v1.1 (A-01…A-42) |
| `supervisor/team_execution_plan.md` | Plan | v1.1 (from 19:45 EDT) |
| `supervisor/master_technical_specification.docx` | Word master spec | v1.1, render-checked |
| `reviews/00_baseline_assessment.md` | Audit baseline | new |
| `reviews/stage_0{1..6}_review.md` (6) | Stage reviews | new |
| `reviews/supervisor_final_review.md` | Synthesis + red team | new |
| `reviews/architecture_change_matrix.md` | Change trace | new |
| `reviews/implementation_readiness_checklist.md` | Readiness checks | new |
| `reviews/evidence_register.md` | Evidence | new |
| `reviews/final_implementation_blueprint.md` | Build plan | new |
| `diagrams/*.mmd` (9) | Mermaid | v1.1, 9/9 parse |

Validation performed: Mermaid parser (9/9); DOCX conversion to PDF (7/7) with visual checks; a cross-document consistency script over 23 files (formula IDs, error codes, endpoints, statuses, assumption IDs, deferred scope) with 0 issues remaining.
