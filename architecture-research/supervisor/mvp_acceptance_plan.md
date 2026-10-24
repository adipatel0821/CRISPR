# MVP Acceptance & Evaluation Plan — DecisionTwin

Date: 2026-10-24. Each test has an objective pass criterion. "Measured" means the number is produced by a test run; "claimed" means a target we have not yet measured — claims are not to be presented as results.

## 1. Acceptance tests (must pass before submission)

| ID | Area | Test | Pass criterion | Owner |
|---|---|---|---|---|
| A-01 | Adaptive questioning | Run the three persona scripts (Stage 1 appendix) through `next-question`/`answers` | Question orders differ between personas; T0 reached in ≤ 7 questions with a verified offer, ≤ 10 without | Dev 2 |
| A-02 | Question relevance | For every question asked in A-01, `why_we_ask` names a metric that is actually uncomputable or sensitive | 100% of questions have a non-empty dependency path | Dev 2 |
| A-03 | No redundant questions | 1,000 simulated sessions with random valid answers | 0 repeated fact keys; no T2 question without a goal trigger | Dev 2 |
| A-04 | Critical-information completeness | After stop, run analysis | All T0-dependent metrics have `status ≠ missing` | Dev 2 |
| A-05 | Document extraction | 6-document ground-truth set | Five TILA fields ≥ 95% exact on text PDFs, ≥ 85% on scans (measured); blank-APR doc yields `null` | Dev 2 |
| A-06 | Verification gate | Seeded inconsistency docs (3) | 100% flagged `conflicting`; no extracted term enters engine without `verified` | Dev 2 |
| A-07 | Arithmetic correctness | CFPB vectors (en-753 table; worksheet example), property tests, golden files | Exact match to cents; schedule ends at 0.00; byte-equal goldens | Dev 1 |
| A-08 | Unsupported products | Variable-rate and balloon fixtures | `UNSUPPORTED_PRODUCT` with explanation; no metrics computed | Dev 1 + Dev 2 |
| A-09 | Scenario reproducibility | Run default catalog twice; enhanced MC (if present) with fixed seed | Byte-equal outputs; baseline == engine residual × 12 | Dev 1 |
| A-10 | Assumption labeling | Inspect every `ScenarioResult` and flag | ≥ 1 assumption with citation per scenario; thresholds served by `/config/assumptions` | Dev 1 |
| A-11 | Counterfactual consistency | Base alternative vs base calc; monotonicity suite | Byte-equal; longer term ⇒ lower payment & higher interest in all cases | Dev 1 |
| A-12 | Source-grounded explanations | 30 synthetic narratives (20 adversarial) through the gate; UI numeric nodes | Gate rejects 20/20 adversarial; every numeric DOM node has `data-evidence-id` | Dev 4 + Dev 3 |
| A-13 | AI fallback | Run full flow with `LLM_OFFLINE=1` | Typed widgets, manual entry and templates deliver a complete report | Dev 2 + Dev 4 |
| A-14 | Prompt-injection resistance | Contract containing instruction text | No field changed; event logged | Dev 2 |
| A-15 | Privacy controls | Upload doc with fake SSN in text mode; delete session | SSN absent from LLM request log; all rows purged after delete | Dev 4 |
| A-16 | Contract parity | Regenerate TS types; typecheck web | Zero type errors against current OpenAPI | Dev 4 + Dev 3 |
| A-17 | Invalid input recovery | Negative income, term 500, 50 MB upload, encrypted PDF | 400/422 with actionable message; UI re-asks; no crash | Dev 4 |
| A-18 | Basic security | Session token from one session used on another; missing token | 401/404; no data leakage | Dev 4 |
| A-19 | End-to-end demo reliability | Scripted demo run 3× on the demo laptop (fresh DB) | 3/3 complete without manual intervention; total < 6 minutes | All |

## 2. Evaluation metrics (reported honestly)

| Metric | How measured | Report as |
|---|---|---|
| Questions to T0 | A-01 | measured per persona |
| Redundant-question rate | A-03 | measured (expect 0) |
| Extraction field accuracy | A-05 | measured on 6 synthetic docs; note the sample size |
| Quote-found rate | A-05 | measured |
| Arithmetic reference match | A-07 | measured (exact) |
| Narrative gate rejection rate | A-12 | measured |
| Hallway usability (3 testers) | Stage 6 §18 | measured; small-sample caveat |
| Time per analysis | timing in tests | measured |

## 3. Explicitly untested / not claimed

- Any predictive validity of scenarios (none is claimed).
- Extraction accuracy on real-world dealer contracts beyond the synthetic set.
- Performance under concurrent users.
- Accessibility beyond automated axe checks and one keyboard walkthrough.

## 4. Definition of "MVP accepted"

All A-01 … A-19 pass on the demo machine at code freeze; open decisions Q-1…Q-3 closed or explicitly deferred with UI labeling; secret scan clean; Devpost entry created before Saturday midnight and finalized before 11:00 AM Sunday (hard deadline noon).
