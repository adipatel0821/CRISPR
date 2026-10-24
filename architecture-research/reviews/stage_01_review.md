# Stage 01 Review — Knowledge Graph, Ontology & Adaptive Questioning

**Reviewer:** Review Agent 1 (simulated, scoped pass) · **Reviewed:** `stage-01-knowledge-graph/stage_01_architecture.md` v1.0, `diagrams/financial_knowledge_graph.mmd`, `diagrams/adaptive_question_workflow.mmd`, contracts §3.1–3.4, Stage 3 formula inputs, Stage 6 intake requirements · **Date:** 2026-10-24

## 1. Executive verdict

**REVISE.** The core (a typed dependency graph plus an append-only fact ledger, with the LLM limited to parsing) is right for this system size and should stay. Four parts are defective:

- The ranking can let optional questions outrank required ones.
- The stopping rule contradicts the persona example.
- Two rules misclassify real financial hardship as contradictory data.
- The status model conflates *who said it* with *whether it was checked*.

The fix is **analysis-specific readiness** with **lexicographic, deterministic question priority**. Sensitivity scoring is demoted from a ranking input to an optional display aid.

## 2. Existing architecture summary

v1.0 has three parts:

- **Ontology:** fact, metric, assumption and constraint nodes, connected by `required_by`, `improves`, `constrains` and `derived_from` edges.
- **Ranking score:** `w_req·req + w_sens·sens − w_eff·effort − w_priv·privacy`, where `sens` comes from substituting configured low/high bounds into the Stage 3 engine.
- **Stopping and rules:** stop when all T0 facts are present, there are no conflicts, and `max sens < τ = 0.05`. Contradiction rules C01–C07 apply throughout.

The status precedence is `verified > stated > extracted > estimated > assumed`.

## 3. Detailed user journey (as designed in v1.0)

Start → one question at a time with "why we ask", skip and estimate → stop offered → upload document → verify → analysis. The user can revise answers (supersession) and skip. If the AI is unavailable, typed widgets work.

## 4. Detailed technical workflow (v1.0)

`answer → (LLM parse | typed) → append facts → materialize profile → rules C01–C07 → candidates → sensitivity via engine → score → stop? → question + why`

## 5. Algorithms and technology review

| Element | Assessment |
|---|---|
| NetworkX DAG from YAML | Appropriate: ~40 nodes, and only reachability is needed. Keep. |
| Append-only ledger with supersession | Correct and auditable. Keep. |
| LLM parsing with key whitelist and widget fallback | Correct boundary. Keep. |
| Single additive score | **Defective** (S1-ISSUE-004). |
| Bound-substitution sensitivity | Mathematically valid as a what-if spread, but its ranking power depends entirely on designer bounds (S1-ISSUE-005). |
| Global T0 completeness | **Too coarse** (S1-ISSUE-001, -003). |
| Rules C01–C07 | Two rules misclassify legitimate states (S1-ISSUE-006, -007). |

## 6. Verified strengths

- Deterministic intake. The LLM never decides what to ask.
- Provenance and supersession on every fact.
- "Why we ask" derived from graph paths, not generated.
- No identity fields in the ontology, so data minimization holds by construction.

## 7. Identified weaknesses (issues)

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| S1-ISSUE-001 | High | **Stopping contradiction.** §11.3 stops only when `max sens < 0.05`, yet Persona P1 offers stop with optional sensitivities 0.09 and 0.06. Under the stated rule, P1 could not stop. | stage_01 §11.3 vs Appendix P1 |
| S1-ISSUE-002 | High | **Status conflates provenance and verification.** `verified` = "user confirmed a specific value". Confirmation by the same person who supplied the value is not independent verification, so a document-backed, check-passed term and a confirmed guess look alike. | contracts §2 |
| S1-ISSUE-003 | High | **Savings is T0 for everything.** Loan cost and cash-flow impact don't need savings. Blocking all output on it adds a sensitive question before any value is shown. | ontology table |
| S1-ISSUE-004 | High | **Optional can outrank required.** T1 `req = 0.5` plus `0.6 × sens` (up to 0.6) can reach 1.1, which exceeds a T0 with low `sens` and penalties (~0.9). | §11.1 arithmetic |
| S1-ISSUE-005 | Medium | **Bounds drive ranking.** `sens` uses config bounds (e.g., essential 40–70% of take-home), so ordering reflects designer assumptions, not user uncertainty. "Expected information value" is not what is computed. | §6, §11.1 |
| S1-ISSUE-006 | High | **Hardship treated as contradiction.** C03 ("essential + debts > take-home → clarification") treats a real deficit as a data error. Negative cash flow is a legitimate, important condition. | §9.2 C03 |
| S1-ISSUE-007 | Low | C06 (savings > 36× income) is a plausibility check, not a contradiction. It should confirm once, not block. | §9.2 C06 |
| S1-ISSUE-008 | High | **Debts without payment amounts.** The parser can create debt items with no `monthly_payment`. v1.0 has no per-item missing state, so downstream code may sum the missing amount as 0. | §11.4, P3 path |
| S1-ISSUE-009 | High | **Ownership cost double count.** If the new car replaces a current one, the current car's insurance, fuel and maintenance are already inside `expenses.essential`. v1.0 subtracts full new-car costs on top. Reproduced: the hit is overstated by $260/mo in the research example. | stage_03 F09; verify.py |
| S1-ISSUE-010 | Medium | **Skip and decline loop.** Skipped facts become `missing` and are candidates again, and estimates stay in the candidate set, so the system can re-ask. There is no `declined` state. | §11.2 |
| S1-ISSUE-011 | Medium | **Interview-before-upload ordering.** Loan facts arrive last, so readiness for the loan analyses is unknowable during the interview, and extraction latency (5–15 s) is serialized. | sequence diagram |
| S1-ISSUE-012 | Medium | **Down payment source not captured.** Cash down reduces savings, which reserve and stress analyses need (see S3-ISSUE-004). Whether the down payment comes from savings is never asked. | ontology |
| S1-ISSUE-013 | Low | The default "approximate = ±5%" band is an arbitrary precision claim. | contracts §3.1 |
| S1-ISSUE-014 | Medium | **Variable income range is under-specified.** "Between 2,800 and 4,000" maps to one value plus a range. The engine needs a *typical* value for the baseline and a *low month* for stress, explicitly. | P2 path |

## 8. Architectural contradictions

S1-ISSUE-001 (stopping vs personas). S1-ISSUE-002 (the label "verified" contradicts its meaning in Stage 2). S1-ISSUE-004 (the "required first" intent contradicts the formula).

## 9. Relevant research findings

- Expert-system backward chaining asks for a premise only when a goal needs it. That supports *requirement-first* ordering, which is lexicographic rather than additive.
- EVOI and information gain need a prior and a decision utility. With no population data and a no-recommendation policy, neither is defensible. Confirmed: keep them out.
- Reg Z §1026.18(b) (fetched today) defines amount financed relative to principal and prepaid finance charges. Intake must not collect "loan amount" ambiguously; offer terms come from Stage 2 or the manual-entry form, not interview questions.

## 10. Alternatives considered

| Option | Verdict |
|---|---|
| Keep the additive score, add hard T0 precedence | Partial fix; still opaque |
| **Lexicographic priority: blocking-for-selected-analyses (dependency order) → refinement (curated, configurable order); sensitivity shown, not ranked** | **Selected:** deterministic, explainable, no designer bounds in ranking |
| Bayesian/EVOI | Rejected (no data, no utility) |
| LLM-chosen next question | Rejected (unauditable) |

## 11. Recommended changes

| Change | Resolves |
|---|---|
| **R1-01** Introduce `AnalysisReadiness`, readiness per analysis: `loan_cost`, `cashflow_impact`, `reserve_impact`, `stress_test`, `alternatives`, `dti`, `equity_timeline`. Each lists `required_facts`, `missing`, `available: bool`. | 001, 003 |
| **R1-02** Replace the additive score with ordering `(priority_class, dependency_order, key)`. `blocking` = needed by a selected analysis that is not yet available. `refinement` = improves an available analysis. | 004, 005 |
| **R1-03** Stopping: the core questioning ends when all *selected* analyses are available. Refinement questions are offered as an optional list and never block. Sensitivity is shown as "could change your monthly leftover by up to $X" only where both bounds are user-derived (e.g., flexible spending ∈ [0, monthly left before]). | 001, 005 |
| **R1-04** Split fact state into `status` (`provided`, `estimated`, `assumed`, `missing`, `declined`, `conflicting`, `superseded`, `calculated`) and `verification` (`none`, `user_confirmed`, `evidence_matched`, `evidence_matched_user_confirmed`). | 002, 010 |
| **R1-05** Turn C03 into **H01 "deficit acknowledgement"**: if essential + debts > take-home, confirm once ("This leaves −$X each month. Is that right?"). If confirmed, accept it and pass `DEFICIT_BEFORE_LOAN` to Stage 3. Never block. C06 becomes a one-time plausibility confirm. | 006, 007 |
| **R1-06** Debt items are sub-facts with independent status. A debt with missing `monthly_payment` is blocking for `cashflow_impact`. "No debts" is recorded as `debts.count = 0` (provided), never inferred. | 008 |
| **R1-07** Add facts `vehicle.replaces_current` (bool), `expenses.current_vehicle_costs_monthly` (currency, a subset of essentials) and `debts[i].paid_off_by_transaction` (bool). Ask about replacement only when new ownership costs are entered or a trade-in exists. | 009 |
| **R1-08** `declined` is terminal unless the user reopens it. `estimated` facts are never auto-re-asked; the UI offers "refine". | 010 |
| **R1-09** Two-track intake: the first screen asks "Do you have a loan offer to upload?" Extraction runs asynchronously while household questions proceed. Loan facts are never interview questions; they come from the verified offer or the manual-offer form. | 011 |
| **R1-10** Add `loan.down_payment_source` (`savings`, `other`, `none`). It is blocking for `reserve_impact` when the down payment > 0. If the source is `savings` and the down payment > savings, run a plausibility confirm. | 012 |
| **R1-11** Remove the default ±5%. "Approximate" without a user range carries `uncertainty.kind = approximate` with no band. Stage 4 applies its labeled OAT delta. | 013 |
| **R1-12** For variable income, store `income.take_home_monthly` (typical) plus `income.low_month` (blocking for `stress_test` when `income.variability ≠ stable`). | 014 |

## 12. Updated workflow description

```
entry: choose analyses (default: all core) + "have an offer?" → [offer track runs in parallel: Stage 2]
loop: profile ← ledger; rules H01/H02/C01/C02/C04/C05/C07 → if hard conflict: clarify
      readiness ← for each selected analysis: required facts present (status ∈ provided|estimated|calculated, items complete)
      candidates ← facts blocking any unavailable selected analysis, excluding declined/pending-offer facts
      if candidates: ask first by (dependency_order, key) with why_we_ask = "Needed for <analysis>: <metric>"
      else: return null + readiness + refinement list (curated order; effect shown where user-derived)
answer → typed | LLM parse (whitelist) → append (supersede on change; declined if user declines)
```

## 13. Input and output contracts (changes)

`FinancialFact`: adds `verification` and `declined`; removes the ±5% default. `QuestionCandidate`: replaces `score`/`score_breakdown` with `priority_class`, `blocks_analyses[]`, `dependency_order`, `refinement_effect?`. `QuestionResponse`: adds `declined`. New `AnalysisReadiness`. New endpoint `GET /sessions/{id}/readiness`. New fact keys as listed in R1-06, R1-07, R1-10 and R1-12. (Final schemas: `supervisor/api_and_data_contracts.md` v1.1.)

## 14. Cross-stage dependencies

- **S2:** offer terms come only through `LoanOffer`. Readiness treats a pending extraction as "awaiting offer", not as missing questions.
- **S3:** the engine publishes a static `required_inputs` map per metric and analysis. Stage 1's readiness reads that same map (single source), so there are no duplicated dependency lists.
- **S6:** shows readiness per analysis and the optional refinement list.

## 15. Failure handling

| Failure | Handling |
|---|---|
| Parser down | Typed widgets |
| Required fact declined | That analysis is unavailable, shown with its reason. Other analyses still run. |
| Deficit | Confirmed once, then analyzed |
| Missing debt payment | Blocking question for that item |

## 16. Security and privacy

Ask-minimization improves: savings is no longer asked before value is shown unless reserve or stress analysis is selected. Gross income and credit band remain refinement-only. Free text goes to the LLM only in the configured data mode (see S2-ISSUE-008).

## 17. Performance implications

Ranking becomes a sort (microseconds). Sensitivity is computed only for display, on ≤5 refinement facts.

## 18. MVP vs future scope

**MVP:** readiness, lexicographic priority, two-track intake, H01, debt sub-facts, replacement facts, declined state, typed widgets, LLM parsing.
**Future:** learned priors, EVOI, multi-decision ontologies.

## 19. Persona evaluations (revised behavior; offer uploaded in parallel and verified)

**P1 — Stable salaried.** *Known at start:* offer (price $24,000, cash down $4,000, principal $20,000, APR 4.75%, 60 mo). *Selected analyses:* all core.

| # | Question | Why | Adds | Readiness after |
|---|---|---|---|---|
| 1 | Monthly take-home pay | needed for cashflow_impact | `income.take_home_monthly=4200 (provided)` | loan_cost ✓ (offer only) |
| 2 | Essential monthly expenses | cashflow_impact | `expenses.essential.total` | — |
| 3 | Any existing debt payments? | cashflow_impact | `debts.count=0` | cashflow_impact ✓ |
| 4 | Savings you could use in an emergency | reserve_impact, stress_test | `savings.liquid` | — |
| 5 | Where will the $4,000 down payment come from? | reserve_impact (down > 0) | `loan.down_payment_source=savings` | reserve ✓, stress ✓, alternatives ✓ |

*Stop.* Unavailable: `dti` (needs gross income), `equity_timeline` (needs resale estimate). Refinements offered: replacement + current car costs, new-car ownership costs, flexible spending, gross income, resale estimate. *Previous incorrect behavior fixed:* v1.0 would block on the sensitivity threshold (S1-ISSUE-001) and would ignore that the $4,000 down payment leaves savings.

**P2 — Variable-income worker.** Q1 take-home → answer "2,800 to 4,000" → the parser yields a range and sets `income.variability=variable` → Q2 "In a typical month? In a slow month?" (`income.take_home_monthly=3400`, `income.low_month=2800`, blocking for stress because income is variable) → Q3 essentials → Q4 debts → Q5 savings → Q6 down-payment source. *Stop.* `stress_test` includes the "low month every month" scenario. Refinements: how many slow months per year, replacement, ownership costs. *Risk caught:* without R1-12, v1.0 would average the range and understate low-month stress.

**P3 — Debts and low savings.** Q1 take-home $3,100 → Q2 essentials $2,350 → Q3 debts: "a student loan and Affirm" → two debt items, payments missing (blocking) → Q4 student loan monthly payment ($210) → Q5 Affirm payment and payments left ($95, 4 left; `remaining_months` lets Stage 4 drop it after month 4) → Q6 savings $400 → Q7 down-payment source: "savings" while the offer's down payment is $1,500 > $400 → plausibility confirm ("Your down payment is more than the savings you listed. Where will the rest come from?") → `other`. *Stop.* Cash flow is positive ($445 before the loan). Reserve after purchase is < 1 month and is flagged. *v1.0 incorrect behaviors fixed:* debt payments could have been summed as 0 (S1-ISSUE-008), and the Affirm debt was treated as permanent across the stress horizon.

**Deficit variant (red-team case):** essentials $2,900 + debts $410 > take-home $3,100. v1.0 C03 would block with "Is this before or after tax?". v1.1 confirms once, then shows "−$210 per month before this loan" as the headline fact.

## 20. Acceptance tests (new or changed)

| ID | Test | Pass criterion |
|---|---|---|
| A-01r | Persona scripts P1–P3 | Exact question sequences above; P1 stops after 5 |
| A-03r | 1,000 random sessions with skips and declines | 0 re-asks of declined or provided facts |
| A-20 | Priority invariant | No refinement question is ever asked while a blocking question exists (property test) |
| A-21 | Deficit acceptance | The deficit case yields one confirm, then analysis with `DEFICIT_BEFORE_LOAN`; no conflict state persists |
| A-22 | Debt item completeness | A debt with missing payment blocks cashflow_impact; no metric sums a missing payment |
| A-23 | Readiness parity | Stage 1 readiness == Stage 3 `required_inputs` evaluation for 50 random ledgers |

## 21. Implementation readiness

**Ready after contract v1.1.** Difficulty: low–medium. Lexicographic ordering is simpler than the v1.0 score.

## 22. Sources and evidence

Reg Z §1026.18(b), https://www.consumerfinance.gov/rules-policy/regulations/1026/18/ (✅ 2026-10-24). Gemini API terms, https://ai.google.dev/gemini-api/terms (✅ 2026-10-24). Research script `verify.py` outputs (ownership double count: $260/mo; reserve: 1.27 → 0.32 months). Buchanan & Shortliffe (1984), textbook, not re-verified.

## Required changes to existing repository files

- `stage-01-knowledge-graph/stage_01_architecture.md`: §9.1 ontology additions; §9.2 rules H01/H02; §11.1–11.3 replaced by priority and readiness; persona appendix replaced.
- `stage_01_technical_stack.docx`: algorithm and milestone sections.
- `supervisor/api_and_data_contracts.md`: §2, §3.1, §3.4; new §3.12 AnalysisReadiness; readiness endpoint.
- `diagrams/financial_knowledge_graph.mmd`, `diagrams/adaptive_question_workflow.mmd`.
- `supervisor/mvp_acceptance_plan.md`: A-01r, A-03r, A-20–A-23.
