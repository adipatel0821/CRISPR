# Supervisor Final Review — DecisionTwin Architecture Audit (v1.0 → v1.1)

**Date:** 2026-10-24 · **Starting commit:** `a180770` · **Inputs:** `00_baseline_assessment.md`, `stage_01_review.md` … `stage_06_review.md` · **Process:** simulated agents (disclosed in the baseline).

## 1. Findings by stage

| Stage | Verdict | Most important findings |
|---|---|---|
| S1 Questioning | REVISE | Stopping rule contradicted its own persona; the additive score let optional questions outrank required ones; hardship flagged as contradiction; "verified" meant user-confirmed; double-count of replaced vehicle costs; no declined state; down-payment source missing |
| S2 Documents | REVISE | No principal / note amount (critical); consistent-but-wrong extraction passes arithmetic; uncalibrated confidence displayed; Gemini unpaid-tier terms prohibit sensitive data; no itemization reconciliation |
| S3 Engine | REVISE (critical) | Payment computed on amount financed; APR double-subtracts PFC; trade-in gross value; reserve ignores down payment; replaced costs double-counted; depreciation assumption fabricates a timeline |
| S4 Scenarios | REVISE | Default shock falsely attributed to CFPB; savings start balance wrong; negative balances; broken baseline test; no without-loan comparison |
| S5 Alternatives | REVISE | Hypothetical rate shown as an option; down payment lever hid its savings cost; term what-if unlabeled; price and delay levers underspecified (deferred) |
| S6 Explanations/UX | REVISE (+ DEFER narration) | Numeric gate can't catch relational falsehoods; no readiness UI; no key points; chip labels overstate verification |

## 2. Decisions changed

| Decision | v1.0 | v1.1 | ADR |
|---|---|---|---|
| Question selection | Additive score with sensitivity | Lexicographic: blocking (dependency order) → refinement (curated); sensitivity display-only | ADR-016 |
| Completeness | Global T0 + sensitivity threshold | Per-analysis `AnalysisReadiness` | ADR-016 |
| Fact state | Single status precedence incl. `verified` | `status` × `verification` (two dimensions) + `declined` | ADR-017 |
| Loan computation base | Amount financed | Principal (note) via F00; APR from AF | ADR-018 |
| Total cost | TOP + down + trade value | Total paid through deal, with breakdown and positive equity only | ADR-018 |
| Reserve and stress start | Savings before purchase | Savings after purchase (F13) | ADR-018 |
| Vehicle costs | Full new-car costs | Incremental vs replaced vehicle (F14) | ADR-018 |
| Equity timeline | Assumed depreciation curve | User estimates only; otherwise missing | ADR-018 |
| Default shocks | "CFPB median" 3-week shocks | Illustrative user-relative scenarios, labeled; CFPB as context only | ADR-019 |
| Savings recursion | Unbounded negative | Floor at 0 + unfunded gap; paired with/without runs | ADR-019 |
| Alternatives | 6 levers incl. hypothetical APR | 4 actionable levers; rate sensitivity statement; what-if labels | ADR-020 |
| Document verification | Quote match + arithmetic | + label anchor, deterministic TILA reader, itemization reconcile, offer chooser | ADR-021 |
| LLM data handling | "Verify terms" | `LLM_DATA_MODE` (paid / synthetic_only / off); inline requests only | ADR-022 |
| Explanations | Templates + validated narration (MVP) | Claim-based templates (MVP); claim-referenced narration deferred | ADR-023 |
| Intake sequence | Interview then upload | Two-track, offer extraction in parallel | ADR-016 |
| LLM call types (MVP) | 3 | 2 (parse, extract) | ADR-023 |

## 3. Decisions retained

Modular monolith (Next.js + FastAPI); NetworkX + YAML; SQLite/SQLModel; Gemini behind one adapter; PyMuPDF; Python Decimal and its rounding policy; deterministic scenarios; grid + Pareto; no agent framework, vector DB or microservices; non-advice policy; Docker Compose demo; session-token isolation. Each was re-challenged in the stage reviews and kept because no alternative scored better under the actual system size and remaining time.

## 4. Rejected alternatives (this audit)

EVOI/Bayesian questioning; a second LLM "self-check" for extraction; an LLM-as-judge for narration; a population-calibrated Monte Carlo; scalar optimization; managed OCR for the MVP; a TypeScript engine.

## 5. Cross-stage integration audit

| Boundary | Question | v1.0 state | v1.1 resolution |
|---|---|---|---|
| S1 ↔ S2 | Does intake separate user facts from contractual terms? Does extraction prevent questions? | Interview asked nothing about the loan but sequenced it last, so readiness was unknowable during the interview | Two tracks. Loan terms only via `LoanOffer`; readiness shows "awaiting offer"; S1 never asks loan questions. |
| S1 ↔ S3 | Can the engine report missing inputs; can S1 know exactly what to ask? | S1 kept its own tier labels; drift risk | Engine publishes `required_inputs` (metric→inputs, analysis→metrics). S1 readiness reads it. Test A-23 enforces parity. |
| S2 ↔ S3 | Are terms normalized and verified before calculation? | AF used as base; "verified" = confirmed | F00 principal resolution; payment-mismatch check; `verification` levels; only `ready_for_calculation` offers enter. |
| S3 ↔ S4 | Do simulations use the engine without duplicating arithmetic? | Yes, but wrong start balance and broken test | `month_net(t)` per month; F13 start; month-by-month equality (A-09r). |
| S4 ↔ S5 | Consistent scenario assumptions? | Same catalog; down payment savings effect missing | Alternatives run S4 `with_offer` at their own F13; shared assumption ids. |
| S5 ↔ S6 | Can the UI explain alternatives without recommending? | Narration could imply preference | Claims of type `comparison` carry `assumption_flags`; no "better/best"; deny-list in templates. |
| S6 ↔ S1 | Progressive disclosure, skip, uncertainty? | No readiness UI; skips could loop | Readiness panel; `declined` terminal; estimate badges; refinement list optional. |

## 6. Contract reconciliation (all shared objects)

| Object | Original | Problem | Revised | Stages | ADR |
|---|---|---|---|---|---|
| FinancialFact | `status` with `verified` precedence; ±5% default | Conflated verification; arbitrary band | `status` ∈ {provided, estimated, assumed, missing, declined, conflicting, superseded, calculated}; `verification` ∈ {none, user_confirmed, evidence_matched, evidence_matched_user_confirmed}; band only if user-given | 1,2,3,6 | 017 |
| FinancialProfile | `completeness` per tier | Tiers ≠ analyses | `readiness` (AnalysisReadiness) replaces `completeness` | 1,6 | 016 |
| KnowledgeGraphNode/Edge | `tier` on nodes | Tier is analysis-dependent | Nodes keep `tier` as a default hint; edges carry `analysis` scoping; new nodes per R1-07/R1-10/R1-12 | 1,3 | 016 |
| QuestionCandidate | `score`, `score_breakdown` | Additive ranking defect | `priority_class`, `blocks_analyses[]`, `dependency_order`, `refinement_effect?` | 1,6 | 016 |
| QuestionResponse | — | No decline | `declined: bool` | 1 | 017 |
| AnalysisReadiness | — (new) | — | `{analysis_id, available, required, missing[], awaiting_offer, reason}` | 1,3,6 | 016 |
| LoanOffer | AF as base; no itemization | Wrong base; harm patterns invisible | `principal`, `cash_down`, `down_payment_source` (fact), `itemization[]`, `trade_in_equity`, `negative_equity_rolled_in`, `document_offers_count`, `offer_choice`; revised minimum set | 2,3,5 | 018, 021 |
| VerifiedFinancialTerm | `status` incl. verified; `extraction_confidence` shown | Overclaims | `verification`; checks + `label_anchor`, `independent_reader`, `itemization`; `apr` can be `warn`; `model_self_report` internal | 2,6 | 021 |
| CalculationResult | v1.0 metrics | Formula defects | Metrics per S3 v1.1 (F00–F14), flags v1.1, `required_inputs` echo | 3,4,5,6 | 018 |
| ScenarioRequest | `with_offer` bool | Single run | `runs: [without_offer, with_offer]` | 4,6 | 019 |
| ScenarioResult | negative savings | Misleading | `run`, `start_balance`, floored savings, `unfunded_gap`, `max_unfunded_gap`, `deficit_at_baseline` | 4,5,6 | 019 |
| CounterfactualResult | 6 levers incl. hypothetical APR | Infeasible options | MVP levers; `assumption_flags`; 4 objectives; `rate_sensitivity`; `deferred_levers` | 5,6 | 020 |
| ExplanationEvidence | unchanged | — | adds `verification` label | 6 | 017 |
| ExplanationSection | `narrative_text`, `allowed_numbers` | Weak gate | `claims[]`, `template_text`; `narrative_text` reserved null | 6 | 023 |
| DecisionReport | — | No synthesis or readiness | adds `readiness[]`, `key_points[]`, `data_mode` | 6 | 016, 022, 023 |

Final schemas are in `supervisor/api_and_data_contracts.md` v1.1. That file is now the only authoritative schema source; stage documents reference it rather than restating fields.

## 7. Red-team review (adversarial pass)

Conducted after the synthesis by a skeptical staff engineer / financial auditor role. **No tests were executed; all reproductions are scenario walkthroughs** except where `verify.py` is cited.

| ID | Attack | Sev | Reproduction | Root cause | Correction (v1.1) | Modules | Test |
|---|---|---|---|---|---|---|---|
| RT-01 | Irrelevant question | Med | User selects only "loan cost"; v1.0 still asks savings (T0) | Global tiers | Readiness by selected analyses | intake | A-20 |
| RT-02 | Repeated resolved question | Med | User skips savings → missing → re-asked | No declined state | `declined` terminal | intake | A-03r |
| RT-03 | Stops with critical info missing | High | Debt mentioned without payment; sum treats it as 0; T0 "debts" present | No per-item status | Debt sub-facts; blocking | intake, engine | A-22 |
| RT-04 | Hardship flagged as invalid | High | Expenses > income → v1.0 C03 clarification loop | Rule misclass | H01 deficit acknowledgement | intake | A-21, A-32 |
| RT-05 | Unknown silently zero | High | Flexible missing → default share; PFC missing → treated as 0 silently | Implicit defaults | No flexible default (label); `a_pfc_zero` explicit + payment mismatch | engine | A-24, A-32 |
| RT-06 | Double-counted expenses | High | Replacing a car; current insurance in essentials + new insurance | No replacement facts | F14 incremental | intake, engine | A-30 |
| RT-07 | Understated borrowing cost | Critical | $500 financed fee: payment −$9.38/mo, TOP −$562.68 (`verify.py`) | F01 base | F00/F01 | engine, documents | A-24, A-07r |
| RT-08 | Misread APR/fee | High | APR recompute with double PFC subtraction → false conflict on a correct contract (6.879% vs 5.796%) | F05 | F05 fix + `warn` | engine, documents | A-07r |
| RT-09 | Accepts incorrect AI extraction | High | Dealer sheet with 60/72-month columns; LLM reads 72-mo APR/FC; identities hold | Consistency ≠ correctness | Offer chooser, label anchor, independent TILA reader | documents | A-06r |
| RT-10 | Confirmation treated as verification | High | User confirms a misread value → chip "verified" | Single status | `verification` levels; chips "You confirmed" | all | A-42 |
| RT-11 | Invalid scenario | Med | Stress starts from pre-down-payment savings; runway overstated | F10/F13 | F13 start | scenarios | A-29, A-33 |
| RT-12 | Infeasible alternative | High | "APR −1 pt" option; +$3,000 down with $2,500 savings | Lever design | Remove hypothetical; down ≤ savings; F13 | counterfactual | A-36, A-37 |
| RT-13 | Unsupported affordability claim | High | Narrative "fits your budget" with allowed numbers | Numeric gate | Claim templates; narration deferred | explain | A-12r, A-40 |
| RT-14 | Misleading narrative | High | "Interest $3,008" when $3,008 includes fees | Metric naming | Finance charge vs interest; claim subjects | engine, explain | A-12r |
| RT-15 | Sensitive data exposure | High | Real contract sent on unpaid Gemini quota (human review possible per terms) | Data-mode gap | `LLM_DATA_MODE`, synthetic-only on unpaid; inline only | llm, documents | A-26 |
| RT-16 | Fails when Gemini is unavailable | Low | Outage | — | Already handled: typed widgets + manual entry (with checks); no narration dependency | all | A-13 |
| RT-17 | Inconsistent results across stages | High | S4 baseline ≠ S3 residual when a debt ends; S5 down payment ignores savings | Duplicated assumptions | `month_net(t)` single source; shared F13 | engine, scenarios, counterfactual | A-09r, A-36 |
| RT-18 | False citation | High | "CFPB median shock" on slides/UI | Unverified figure | Illustrative labels; context-only citations | scenarios, explain | A-10r |

**All Critical and High items have an architectural correction and an acceptance test.** None remain open at the architecture level.

## 8. Remaining risks (accepted, non-blocking)

1. Extraction accuracy on real dealer documents is unmeasured (only synthetic fixtures).
2. Paid Gemini tier needed for real-user documents. The demo runs on synthetic fixtures if billing isn't enabled.
3. The exact Gemini model string must be read from the models page at implementation time.
4. Stress scenarios are illustrative; users may still read them as forecasts. Mitigated by labels and paired cards.
5. Odd first periods and irregular APRs are out of scope (warnings, not errors).
6. The time budget is tight (see the blueprint). Scope cuts are pre-ordered.

## 9. Final architecture (v1.1)

Unchanged topology: Next.js ↔ FastAPI modular monolith; modules `intake`, `documents`, `engine`, `scenarios`, `counterfactual`, `explain`, `llm`, `storage`; SQLite.

Changed internals:

- Readiness-driven two-track intake.
- Principal-correct engine with transaction effects (F00–F14).
- Paired, floored scenarios.
- Actionable-lever alternatives.
- Claim-based explanations.
- Two LLM call types under an explicit data mode.

Diagrams are updated in `diagrams/`.

## 10. Implementation readiness verdict

**READY WITH NONBLOCKING LIMITATIONS.** The documented critical and high defects are corrected in the specification and contracts, every one is covered by an acceptance test, and the contracts have a single authoritative source. The limitations in §8 don't block the vertical slice.

Implementation authorization remains a separate team decision (per the brief). This verdict is about the architecture only.
