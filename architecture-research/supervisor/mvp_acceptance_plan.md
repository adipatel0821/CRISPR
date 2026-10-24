# MVP Acceptance & Evaluation Plan — DecisionTwin (v1.1)

Date: 2026-10-24 (post-audit). Each test has an objective pass criterion. **No test has been executed; this is a plan.** Results must be reported as measured, with sample sizes. Tests marked "r" replace their v1.0 versions. Fixture values come from the audit research script (`reviews/evidence_register.md` MR-01…MR-08).

## 1. Acceptance tests

| ID | Area | Test | Pass criterion | Owner | Checkpoint |
|---|---|---|---|---|---|
| A-01r | Adaptive questioning | Persona scripts P1–P3 (`reviews/stage_01_review.md` §19) | Exact sequences; P1 stops after 5 questions | Dev 2 | CP2 |
| A-02 | Question relevance | Every asked question's `why_we_ask` names an unavailable selected analysis | 100% | Dev 2 | CP2 |
| A-03r | No re-asks | 1,000 simulated sessions with random answers, skips and declines | 0 re-asks of provided, estimated or declined facts | Dev 2 | CP2 |
| A-04 | Completeness | After the stop, all selected analyses are available or show a declined/awaiting reason | 100% | Dev 2 | CP2 |
| A-05r | Extraction | ≥ 4 synthetic text PDFs with labels | Report measured accuracy on the five TILA fields; every reader disagreement surfaces as `conflicting`; blank-APR fixture → null | Dev 2 | CP2 |
| A-06r | Wrong-offer capture | Seeded inconsistencies + two-option dealer worksheet | Offer chooser shown; wrong-column values caught by chooser or reader | Dev 2 | CP2 |
| A-07r | Arithmetic | CFPB en-753 table, worksheet (PFC = 0) + $20,000 note with $500 PFC at 4.75%/60 | Exact: $375.14; TOP $22,508.29; finance charge $3,008.29; interest $2,508.29; APR 5.796% | Dev 1 | CP1 |
| A-08 | Unsupported products | Variable-rate and balloon fixtures (boolean + quote) | `UNSUPPORTED_PRODUCT` with explanation | Dev 1 + 2 | CP2 |
| A-09r | Scenario consistency | Baseline `net[t]` vs `engine.month_net(t)` for 12 months incl. a debt ending in month 4 | Equal every month | Dev 1 | CP2 |
| A-10r | Labels | Every scenario assumption contains "Illustrative"; no "CFPB median" string in config | Pass | Dev 1 | CP2 |
| A-11r | Counterfactual consistency | Base alternative vs base calc; monotonic suite | Byte-equal; longer term → lower payment and higher finance charge | Dev 1 | CP3 |
| A-12r | Claim fidelity | Rendered sections | Every sentence maps to ≥ 1 claim; every numeric node has an evidence id | Dev 4 + 3 | CP3 |
| A-13 | AI fallback | Full flow with `LLM_DATA_MODE=off` | Typed widgets + manual entry deliver a complete report | Dev 2 + 4 | CP2 |
| A-14 | Prompt injection | Contract containing instruction text | No value changes; event logged | Dev 2 | CP3 |
| A-15 | Privacy | Fake SSN in text; delete session | SSN absent from LLM request log; all rows purged | Dev 4 | CP3 |
| A-16 | Contract parity | Regenerate TS types from OpenAPI v1.1 | 0 type errors | Dev 4 + 3 | CP3 |
| A-17 | Invalid input | Negative income, term 500, 50 MB file, encrypted PDF | 400/422/403 with actionable message; no crash | Dev 4 | CP1 |
| A-18 | Session isolation | Token from session A on session B; missing token | 401/404; no leakage | Dev 4 | CP3 |
| A-19 | Demo reliability | Scripted demo × 3 on a fresh DB | 3/3 without intervention; < 6 min | All | after freeze |
| A-20 | Priority invariant | Property test over random ledgers | No refinement question while any blocking question exists | Dev 2 | CP2 |
| A-21 | Deficit acknowledgement | Essentials + debts > take-home | One H01 confirm, then analysis with `DEFICIT_BEFORE_LOAN`; no persistent conflict | Dev 2 | CP2 |
| A-22 | Debt items | A debt with missing payment | Blocks `cashflow_impact`; no sum uses a missing value | Dev 2 + 1 | CP2 |
| A-23 | Readiness parity | 50 random ledgers | Stage 1 readiness == evaluation of the engine `required_inputs` | Dev 2 + 1 | CP2 |
| A-24 | Principal basis | Contract with $500 financed PFC | Engine payment = disclosed ± $0.01; no `PAYMENT_MISMATCH` | Dev 1 + 2 | CP1 |
| A-25 | Negation | "No balloon payment" text | Not blocked | Dev 2 | CP2 |
| A-26 | Data mode | `synthetic_only` with a non-fixture upload | 403 `DATA_MODE_RESTRICTED` with explanation | Dev 2 | CP2 |
| A-27 | Manual typo | Manual payment $3,751.40 vs computed $375.14 | `PAYMENT_MISMATCH` warning shown | Dev 2 | CP2 |
| A-28 | Trade-in accounting | Price $25,000, cash down $1,000, 7%/60; trade $8,000 with payoff $5,000, and with payoff $10,000 | Total paid through deal $28,949.43 and $31,889.89; rolled-in balance $0 and $2,000 | Dev 1 | CP1 |
| A-29 | Savings after purchase | Savings $4,000, $3,000 down from savings, monthly obligations $3,150 | Reserve after = 0.32 months | Dev 1 | CP1 |
| A-30 | Replacement netting | Take-home $3,600, essentials $2,300 (incl. $260 current car), flexible $500, debts $150, payment $420, new car costs $310 | Monthly left after = $180 | Dev 1 | CP1 |
| A-31 | No fabricated timeline | No value estimates | `equity_timeline` missing | Dev 1 | CP1 |
| A-32 | Deficit computation | Negative monthly left before | Computed and flagged, not rejected | Dev 1 | CP1 |
| A-33 | Floor and gap | Scenario exceeding savings | `S_t ≥ 0` all t; correct `max_unfunded_gap` | Dev 1 | CP2 |
| A-34 | Paired runs | All fixtures | Without-offer runway ≥ with-offer runway | Dev 1 | CP2 |
| A-35 | Break-even edges | Deficit fixture; large-savings fixture | 0% + flag; capped | Dev 1 | CP2 |
| A-36 | Down-payment trade-off | +$2,000 down from savings | Payment ↓ and savings after purchase −$2,000, both in deltas | Dev 1 | CP3 |
| A-37 | No hypothetical offers | All alternatives | Every APR comes from a verified offer | Dev 1 | CP3 |
| A-38 | Term label | All term alternatives | Carry `same_rate_assumed`; UI shows the label | Dev 1 + 3 | CP3 |
| A-39 | Required add-on | Non-optional add-on | Never removed | Dev 1 | CP3 |
| A-40 | Narration gate (deferred) | 20 adversarial narratives (misattribution, direction, causation, affordability) | All rejected — **required only before enabling narration** | Dev 4 | n/a in MVP |
| A-41 | Key points | Reports from fixtures | All three key points reproducible from report values | Dev 4 | CP3 |
| A-42 | Label honesty | UI scan | No chip says "verified"; confirmations say "You confirmed" | Dev 3 | CP3 |

## 2. Evaluation metrics (report honestly)

| Metric | Source | Report as |
|---|---|---|
| Questions to readiness per persona | A-01r | measured |
| Re-ask rate | A-03r | measured (expect 0) |
| TILA field accuracy; reader disagreement rate | A-05r | measured on n synthetic documents (state n) |
| Arithmetic reference match | A-07r, A-24, A-28–A-30 | measured (exact) |
| Hallway usability (n = 3) | Stage 6 | qualitative observations only |
| Analysis latency | timing | measured |

## 3. Explicitly not claimed

Predictive validity of scenarios; extraction accuracy on real dealer contracts; behavior under concurrent users; accessibility beyond automated checks and one keyboard walkthrough; any CFPB-derived scenario parameter.

## 4. Definition of "MVP accepted"

All CP1–CP3 tests above (excluding A-40) pass on the demo machine at code freeze; `LLM_DATA_MODE` is set and shown; secret scan clean; Devpost project created before Saturday 23:59 and finalized before 11:00 Sunday (hard deadline 12:00).
