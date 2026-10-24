# Stage 04 — Financial Uncertainty & Risk Simulation

> **Version 1.1 (post-audit, 2026-10-24).** Revised per `reviews/stage_04_review.md` (verdict REVISE). **The v1.0 default shock ("CFPB median: 3 weeks of income, more than once a year") is retracted.** It is not supported by the CFPB sources reviewed. Defaults are now illustrative, user-relative and labeled; CFPB research appears only as context (CH-21). Also: the recursion starts from savings after purchase (CH-04); savings is floored at 0 with an unfunded gap (CH-22); every scenario runs without and with the offer (CH-23); baseline equality is checked month by month (CH-24); break-even edge cases and M = 3/6 are defined (CH-25); low-month scenario for variable income (CH-16).

**Agent:** Stage Architecture Agent 4 · **Reviewed by:** Supervisor (Phase C: reviews with Agents 3 and 5) · **Contracts:** `supervisor/api_and_data_contracts.md` v1.1 (authoritative schemas)
**Research date:** 2026-10-24.

---

## 1. Stage objective

Let the user see how the loan behaves if their circumstances change — income dips, unexpected expenses, cost increases, job loss — using methods that are mathematically justified by the data actually available (one user's self-reported figures), and communicate results as consequences of stated assumptions, never as forecasts.

## 2. Problem decomposition

1. Define a monthly cash-flow state machine (income, expenses, debt payments, new payment, ownership costs, savings balance).
2. Define a catalog of illustrative, user-relative scenarios (labeled as such; v1.1) with user-adjustable parameters in enhanced scope.
3. Run deterministic scenarios on the Stage 3 cash-flow function.
4. Run one-at-a-time sensitivity (tornado) on the main drivers.
5. Compute resilience measures that need no universal score (break-even income drop, runway).
6. (Enhanced) bounded Monte Carlo over user-stated income variability, with honest labeling.
7. Report assumptions as first-class objects.

## 3. Functional requirements

- FR1 12-month horizon (configurable 1–60), monthly steps.
- FR2 Catalog v1.1 (all labeled illustrative): `sc_expense_spike` (one-time expense = 1 month of essentials, month 2); `sc_income_cut` (−25%, months 2–4); `sc_low_month` (income = `income.low_month` every month; variable income only); `sc_job_loss` (0 income for 2 months; no benefits assumed); `sc_cost_rise` (+20% incremental vehicle costs). Custom scenarios are enhanced scope.
- FR3 Each scenario runs `without_offer` (start = savings) and `with_offer` (start = savings after purchase, F13).
- FR4 Outputs per run: monthly paths, first shortfall month, months of runway, max unfunded gap, recovery month, savings at end (floored at 0).
- FR5 Resilience: break-even income drop sustainable for 3 and 6 months; deficit-at-baseline and capped cases defined.
- FR6 Every result carries assumption ids with plain text; no CFPB attribution for parameters.
- FR7 Reproducible: identical inputs give identical outputs; seeds recorded.

## 4. Nonfunctional requirements

All scenarios computed in < 100 ms (deterministic); Monte Carlo (if enabled) ≤ 2 s for 2,000 paths × 12 months; no claims of probability of distress in MVP outputs; results labeled "what-if under stated assumptions."

## 5. Data requirements

Stage 3 inputs and outputs (`month_net(t)`, F13, F14, debt end months); `income.variability` and `income.low_month`; `savings.liquid`. **Population context (not parameters):** CFPB Making Ends Meet (2022) groups consumers by emergency savings in months of income; CFPB research (Fulford & Low) finds significant expense shocks are more common than significant income drops, with unexpected expenses averaging about 15% of income when they occur. These appear only as a context sentence, never as the user's scenario sizes.

## 6. Research findings

- **Deterministic stress testing** is the standard household-finance approach when individual-level distributions are unknown: pick named, explainable shocks and show consequences. It is exactly what CFPB's own tools do (Grad Path budget fit; "what if I can't make payments" guidance focuses on concrete options, not probabilities).
- **Sensitivity analysis (OAT / tornado)** ranks drivers by output change per input change; needs no distributions; directly answers "which factor drives the result."
- **Monte Carlo** requires a distribution per uncertain input. With one user's three numbers (min/typical/max) the only defensible choice is a triangular (or PERT) distribution, which is itself an assumption; outputs are then "assumption-driven ranges," not probabilities of real-world events. Justified only as an *enhancement* with explicit labeling.
- **Scenario trees with probabilities** require branch probabilities we cannot estimate honestly — rejected.
- **Predictive models of delinquency** (e.g., using CFPB's reported cohort delinquency rates) would be population statistics misapplied to an individual; CFPB's subprime report shows default risk alone does not even explain rate differences across lenders. We do **not** build or imply a distress predictor.
- **Audit finding (2026-10-24):** the v1.0 statement that CFPB reports a median shock of about 3 weeks of income, more than once a year, could not be substantiated in the CFPB sources reviewed and is retracted (S4-ISSUE-001).
- **Repossession consequences** (CFPB Jan 2025 report via project file): 94% of repossessed-and-sold vehicles leave a deficiency balance averaging $11,340 — used for *consequence explanation* text (Stage 6), not simulation.

## 7. Alternatives investigated

| Option | Description | Strengths | Weaknesses |
|---|---|---|---|
| **A. Deterministic scenarios + OAT sensitivity + break-even search (recommended)** | Named shocks on the Stage 3 cash-flow model | Transparent, reproducible, consistent with baseline, cheap | No distributional statement (by design) |
| B. Monte Carlo on triangular income (enhancement) | 2,000 paths with fixed seed | Shows ranges; demo appeal | Distribution is an assumption; easily over-read as probability |
| C. Scenario tree with probabilities | Branching events with weights | Intuitive diagrams | No defensible probabilities |
| D. Predictive distress model | ML on population data | "AI" appeal | No individual data; misleading; ethically risky |

## 8. Comparative decision matrix

| Criterion (weight) | **A** | B | C | D |
|---|---|---|---|---|
| Correctness & reliability (25%) | 5 | 3 | 3 | 1 |
| Hackathon feasibility (20%) | 5 | 3 | 3 | 1 |
| Integration simplicity (15%) | 5 | 4 | 3 | 2 |
| Functional capability (15%) | 3 | 4 | 3 | 4 |
| Explainability (10%) | 5 | 3 | 3 | 1 |
| Performance & cost (10%) | 5 | 4 | 4 | 2 |
| Extensibility (5%) | 3 | 4 | 3 | 3 |
| **Weighted** | **4.60** | **3.45** | **3.10** | **1.80** |

*Sensitivity:* B approaches A only if capability is weighted ≥ 40% and correctness ≤ 10%. Decision: A for MVP; B as a clearly labeled enhancement layered on A (same engine, same assumptions objects).

## 9. Recommended architecture

`scenarios/` package: `catalog.py` (from `scenarios.yaml`; every entry labeled illustrative), `runner.py` (paired runs over `engine.month_net(t)`), `sensitivity.py` (OAT ±10%, labeled), `resilience.py` (bisection for M = 3 and 6), `montecarlo.py` (**deferred**). All pure functions; results per contracts v1.1 §3.8.

## 10. Detailed processing workflow

1. Start balances: `without_offer` = `savings.liquid`; `with_offer` = F13 savings after purchase.
2. For each scenario and run, for t = 1..H: `net_t = engine.month_net(t, run, transforms)`; `raw = S_{t−1} + net_t`; `S_t = max(0, raw)`; the unfunded gap grows by `max(0, −raw)` and is repaid from later surpluses.
3. Record first shortfall month, months of runway, max unfunded gap, recovery month (first month after a shortfall when the gap returns to 0).
4. OAT: ±10% on income, essentials, flexible (if provided), incremental vehicle costs, savings and payment; rank by change in `months_of_runway` and `monthly_left_after`.
5. Break-even: bisection on the drop fraction p ∈ [0, 1] for M = 3 and M = 6 such that the minimum savings over the horizon stays ≥ 0 with no unfunded gap. Baseline deficit → 0 and `deficit_at_baseline`; full coverage at p = 1 → `capped`.
6. Assemble `ScenarioResult[]` (both runs) and `ResilienceSummary`.

## 11. Algorithms and reasoning strategies

**Income.** The baseline uses the typical take-home. For variable earners, `sc_low_month` uses `income.low_month` every month, a deterministic bound rather than a distribution.

**Unexpected expenses.** `sc_expense_spike` = one month of essential expenses in month 2. That's a user-relative illustrative size, not a population statistic. Week-based conversions, where used, are `monthly × 12/52`.

**Recurring obligations.** Debts continue until `remaining_months`, then drop out (through `month_net`). The new payment applies only to the `with_offer` run.

**Savings floor and gap.** Balances never go negative. A shortfall beyond savings accumulates as `unfunded_gap` with no interest assumed (`a_gap_no_interest`, stated in the UI). This avoids implying an interest-free credit line while still sizing the problem.

**Assumptions vs observations.** User facts keep their statuses; scenario parameters are `assumed` with the assumption id `a_illustrative_scenarios` ("Illustrative scenario chosen by DecisionTwin to show how your plan responds. It is not a forecast of what will happen to you.").

**Displayed uncertainty measures (MVP).** Runway (without vs with), max unfunded gap, break-even drop (3 and 6 months), OAT ranking. No probabilities.

## 12. Data models and schemas

Contracts v1.1 §3.8: `ScenarioRequest` (with `runs`), `ScenarioResult` (with `run`, `start_balance`, `unfunded_gap` path, `max_unfunded_gap`, `deficit_at_baseline`), `ResilienceSummary` (`break_even_m3`, `break_even_m6`, `capped`), `Assumption`, `SensitivityItem`.

## 13. Inputs and outputs

Inputs: `CalculationResult` (with and without offer), profile facts, scenario catalog, config. Outputs: `ScenarioResult[]`, `ResilienceSummary`, `SensitivityItem[]`.

## 14. API interaction requirements

Bundled in `POST /sessions/{id}/analysis` (default catalog) and re-runnable with a custom `ScenarioRequest[]` body; results embedded in `DecisionReport.scenarios`.

## 15. Integration dependencies

- **Stage 3:** `engine.month_net(t)` is the only arithmetic. Acceptance test A-09r checks the baseline `net[t]` equals the engine for every month, including debts that end mid-horizon. (The v1.0 test "residual × 12" was wrong and is retired.)
- **Stage 5:** alternatives use the identical catalog and assumption ids; each alternative's `with_offer` run starts from its own F13.
- **Stage 6:** paired cards, the assumptions panel and the context sentence; never "you will run short".

## 16. Error and failure handling

Missing savings → `reserve_impact` and `stress_test` are unavailable (readiness), not computed with 0. Missing `income.low_month` for variable income → `sc_low_month` is unavailable with its reason. Invalid custom parameters (enhanced) → `VALIDATION_ERROR`. Non-convergence → break-even missing plus a warning.

## 17. Security and privacy

No new data collection; `employment.stability` (T2) is optional and only adjusts the default job-loss months; never stored beyond session.

## 18. Testing and evaluation

A-09r month-by-month baseline equality (incl. a debt ending in month 4); A-10r label audit (every assumption text contains "Illustrative"; no "CFPB median" string in config); A-33 floor and gap; A-34 without-offer runway ≥ with-offer runway; A-35 break-even edges; hand-computed 12-month paths for 3 fixtures cross-checked in a spreadsheet; golden files.

## 19. Performance and cost estimates

Deterministic catalog (6 scenarios × 12 months) ≈ 1–5 ms; sensitivity (6 drivers × 2) ≈ 10 ms; bisection 30 × 12 months ≈ 5 ms; Monte Carlo 2,000 × 12 with NumPy ≈ 50–200 ms (estimates; measure in tests). No infrastructure cost.

## 20. MVP, enhanced, and production scope

- **MVP:** catalog v1.1 (no custom), paired runs, floor and gap, break-even M = 3/6, OAT.
- **Enhanced:** custom scenario and sliders.
- **Deferred:** Monte Carlo (adds no information beyond deterministic bounds for one user's min/typical/max and invites probability misreading).
- **Production:** consented transaction history for calibration; population-calibrated distributions with explicit labels.

## 21. Architectural decision records

**ADR-S4-01 Method** — Deterministic scenarios + OAT + break-even; Monte Carlo deferred/labelled. Evidence: data availability; CFPB tooling precedent. Confidence: high.
**ADR-S4-02 Defaults (superseded in v1.1)** — v1.0 used a "CFPB median shock" that could not be substantiated. **v1.1:** illustrative, user-relative scenarios labeled as such; CFPB research appears only as a context sentence with verified wording. Confidence: high. (ADR-019.)
**ADR-S4-05 (v1.1) Floor, gap and paired runs** — savings floored at 0 with an unfunded gap; every scenario runs without and with the offer. Confidence: high.
**ADR-S4-03 No distress score** — resilience expressed as runway and break-even drop, not a universal score. Confidence: high.
**ADR-S4-04 Seeds mandatory** — `ScenarioRequest.seed` required; deterministic methods ignore it but record it. Confidence: high.

## 22. Unresolved questions

- Resolved in v1.1: break-even horizon (show 3 and 6; Q-4). Open: exact wording of the CFPB context sentence (UD-04, Dev 4, before the video).

## 23. Source references

- CFPB Making Ends Meet (2022) emergency savings report; Repossession in Auto Finance (Jan 2025); Subprime Auto Loan Outcomes by Lender Type (2021); Ask CFPB en-849 (if you can't make payments) — project CFPB research file (2026-10-24), PDFs: https://files.consumerfinance.gov/f/documents/cfpb_mem_emergency-savings-financial-security_report_2022-3.pdf ; https://files.consumerfinance.gov/f/documents/cfpb_report-repossession-in-auto-finance_2025-01.pdf
- NumPy random generator ◻ https://numpy.org/doc/stable/reference/random/generator.html (triangular distribution)
- Saltelli et al., *Global Sensitivity Analysis: The Primer* (Wiley, 2008) — OAT vs global methods; textbook reference, not re-verified online today.
