# Stage 04 — Financial Uncertainty & Risk Simulation

**Agent:** Stage Architecture Agent 4 · **Reviewed by:** Supervisor (Phase C: reviews with Agents 3 and 5) · **Contracts:** `supervisor/api_and_data_contracts.md` v1.0
**Research date:** 2026-10-24.

---

## 1. Stage objective

Let the user see how the loan behaves if their circumstances change — income dips, unexpected expenses, cost increases, job loss — using methods that are mathematically justified by the data actually available (one user's self-reported figures), and communicate results as consequences of stated assumptions, never as forecasts.

## 2. Problem decomposition

1. Define a monthly cash-flow state machine (income, expenses, debt payments, new payment, ownership costs, savings balance).
2. Define a scenario catalog with CFPB-grounded defaults and user-adjustable parameters.
3. Run deterministic scenarios on the Stage 3 cash-flow function.
4. Run one-at-a-time sensitivity (tornado) on the main drivers.
5. Compute resilience measures that need no universal score (break-even income drop, runway).
6. (Enhanced) bounded Monte Carlo over user-stated income variability, with honest labeling.
7. Report assumptions as first-class objects.

## 3. Functional requirements

- FR1 12-month horizon by default (configurable 1–60), monthly steps.
- FR2 Scenario catalog: baseline; income dip (3 weeks, 1–2× per year); unexpected expense (3 weeks of income); income reduction (−25% for 3 months); job loss (0 income, N months); ownership cost increase (+20% insurance); custom (user-defined).
- FR3 Outputs per scenario: monthly paths, first shortfall month, months of runway, cumulative shortfall, recovery month, savings at end.
- FR4 Resilience: break-even income drop (%) sustainable for `M` months; buffer months after the default shocks.
- FR5 Every scenario carries `assumption_ids` with text and citation; the UI must render them beside results.
- FR6 Reproducible: identical inputs ⇒ identical outputs; any stochastic method must expose and fix its seed.

## 4. Nonfunctional requirements

All scenarios computed in < 100 ms (deterministic); Monte Carlo (if enabled) ≤ 2 s for 2,000 paths × 12 months; no claims of probability of distress in MVP outputs; results labeled "what-if under stated assumptions."

## 5. Data requirements

Stage 3 inputs; `income.variability` (category or min/typical/max); `savings.liquid`; optional `employment.stability` (T2). CFPB defaults from Making Ends Meet (2022): median income dip/expense spike ≈ 3 weeks of income, more than one per year for the typical family; emergency savings buckets. These are **population medians used as default shock sizes**, not predictions for this user.

## 6. Research findings

- **Deterministic stress testing** is the standard household-finance approach when individual-level distributions are unknown: pick named, explainable shocks and show consequences. It is exactly what CFPB's own tools do (Grad Path budget fit; "what if I can't make payments" guidance focuses on concrete options, not probabilities).
- **Sensitivity analysis (OAT / tornado)** ranks drivers by output change per input change; needs no distributions; directly answers "which factor drives the result."
- **Monte Carlo** requires a distribution per uncertain input. With one user's three numbers (min/typical/max) the only defensible choice is a triangular (or PERT) distribution, which is itself an assumption; outputs are then "assumption-driven ranges," not probabilities of real-world events. Justified only as an *enhancement* with explicit labeling.
- **Scenario trees with probabilities** require branch probabilities we cannot estimate honestly — rejected.
- **Predictive models of delinquency** (e.g., using CFPB's reported cohort delinquency rates) would be population statistics misapplied to an individual; CFPB's subprime report shows default risk alone does not even explain rate differences across lenders. We do **not** build or imply a distress predictor.
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

`scenarios/` package: `catalog.py` (scenario definitions from `config/scenarios.yaml`), `runner.py` (monthly loop using Stage 3's cash-flow function), `sensitivity.py` (OAT tornado), `resilience.py` (bisection for break-even drop), `montecarlo.py` (enhanced, seedable, NumPy optional). All functions pure; results typed per contracts §3.8.

## 10. Detailed processing workflow

1. Build the monthly baseline vector from Stage 3 (`income`, `essential`, `flexible`, `debt_payments`, `new_payment`, `ownership_costs`); apply amortization payment schedule for `new_payment` (constant for fixed-rate).
2. For each scenario: apply its transformation to the vector (e.g., month 3 and 9 income × (1 − 3/4.33)); run the savings balance recursion `S_t = S_{t−1} + income_t − outflows_t`; record first `S_t < 0`, cumulative shortfall `Σ max(0, −net_t)`, recovery month (first `t` after shortfall where `S_t ≥ 0`), runway `= #months before first shortfall`.
3. Sensitivity: for each driver `d ∈ {income, essential, flexible, ownership_costs, savings, payment}` evaluate headline metrics at `d × (1 ± δ)`, `δ = 10%` (config); rank by absolute change.
4. Break-even: bisection over `p ∈ [0,1]` on "income × (1 − p) for `M` months (config 3) keeps `min_t S_t ≥ 0`"; 30 iterations.
5. Assemble `ScenarioResult[]` + `ResilienceSummary`; attach `assumptions[]`.

## 11. Algorithms and reasoning strategies

**Income representation.** Monthly take-home as the stated value (status `stated`); if the user gave a range or min/typical/max, the deterministic scenarios use the *typical* value and add a scenario "income at your low month every month" (uses `min`), which is more honest than a distribution. The enhanced Monte Carlo samples from `Triangular(min, typical, max)` with `numpy.random.default_rng(seed)`.

**Unexpected expenses.** One-time outflow of size `shock_weeks/4.33 × take_home` (default 3 weeks, CFPB median) at a configurable month; also offered as "an expense of $X in month M" custom entry.

**Recurring obligations.** Existing debts continue at their stated payments; debts with `remaining_months` drop out when they end (improves realism, deterministic).

**Rate shocks.** Not applicable to fixed-rate MVP loans; variable-rate products are blocked upstream.

**Assumption vs observation.** Every number in a `ScenarioResult` has a status: user facts carry `stated/verified/estimated`; shock parameters carry `assumed` with an `assumption_id` whose text includes the CFPB citation; derived paths carry the weakest status.

**Uncertainty measures displayed (MVP).** Runway (months) per scenario; break-even income drop (%); buffer months after shocks; sensitivity ranking. **Not displayed:** probability of shortfall (requires a distribution we do not have) — unless the enhanced Monte Carlo is enabled, in which case the label is "share of simulated paths under the assumed income range," with the assumed range shown.

## 12. Data models and schemas

Contracts §3.8 (`ScenarioRequest`, `ScenarioResult`) and `ResilienceSummary`; `Assumption {assumption_id, text, source_kind: assumption, citation, params}` stored with the report; `SensitivityItem {driver, delta, metric, change}`.

## 13. Inputs and outputs

Inputs: `CalculationResult` (with and without offer), profile facts, scenario catalog, config. Outputs: `ScenarioResult[]`, `ResilienceSummary`, `SensitivityItem[]`.

## 14. API interaction requirements

Bundled in `POST /sessions/{id}/analysis` (default catalog) and re-runnable with a custom `ScenarioRequest[]` body; results embedded in `DecisionReport.scenarios`.

## 15. Integration dependencies

- **Stage 3**: single source of the monthly cash-flow function and payment (Agent 3↔4 review: the scenario runner must call `engine.cashflow.month_net(...)` rather than re-implementing it; baseline scenario must equal Stage 3's `monthly_residual_after` × 12 exactly — this is an acceptance test).
- **Stage 5**: alternatives are evaluated under the **same** scenario catalog and assumptions (Agent 4↔5 review: shared `assumption_ids`; the `delay_months` lever uses the same monthly surplus to grow savings).
- **Stage 6**: renders assumptions beside results; must not present runway as a prediction.

## 16. Error and failure handling

Missing `savings.liquid` ⇒ scenarios run with savings `missing` → shortfall metrics `missing`, runway computed as "months with positive net" only; invalid custom scenario params ⇒ `VALIDATION_ERROR`; non-converging bisection (pathological) ⇒ `break_even` `missing` with warning.

## 17. Security and privacy

No new data collection; `employment.stability` (T2) is optional and only adjusts the default job-loss months; never stored beyond session.

## 18. Testing and evaluation

- Baseline scenario equals Stage 3 residual (exact).
- Hand-computed 12-month paths for 3 fixtures (spreadsheet cross-check by a second developer).
- Monotonicity: larger savings ⇒ runway non-decreasing; larger shock ⇒ cumulative shortfall non-decreasing.
- Reproducibility: golden JSON files; Monte Carlo (if enabled) with fixed seed byte-equal across runs.
- Label audit: every `ScenarioResult` has ≥ 1 assumption with citation (test fails otherwise).

## 19. Performance and cost estimates

Deterministic catalog (6 scenarios × 12 months) ≈ 1–5 ms; sensitivity (6 drivers × 2) ≈ 10 ms; bisection 30 × 12 months ≈ 5 ms; Monte Carlo 2,000 × 12 with NumPy ≈ 50–200 ms (estimates; measure in tests). No infrastructure cost.

## 20. MVP, enhanced, and production scope

- **MVP:** catalog scenarios, custom scenario, OAT sensitivity, break-even drop, runway, assumptions objects.
- **Enhanced:** Monte Carlo on triangular income (labeled), interactive sliders (shock size/month), debts ending mid-horizon.
- **Production:** calibration of default shocks from user-consented history (bank data via aggregator), expense-category volatility, correlated shocks (job loss ⇒ insurance change), longer horizons with inflation assumptions.

## 21. Architectural decision records

**ADR-S4-01 Method** — Deterministic scenarios + OAT + break-even; Monte Carlo deferred/labelled. Evidence: data availability; CFPB tooling precedent. Confidence: high.
**ADR-S4-02 Defaults** — CFPB median shock (3 weeks of income, >1/year) as default scenario size; labeled assumption. Confidence: medium (figures AI-extracted from the PDF per project file; verify before slides).
**ADR-S4-03 No distress score** — resilience expressed as runway and break-even drop, not a universal score. Confidence: high.
**ADR-S4-04 Seeds mandatory** — `ScenarioRequest.seed` required; deterministic methods ignore it but record it. Confidence: high.

## 22. Unresolved questions

- Default `M` (months) for the break-even drop (proposal 3) and whether to show both 3 and 6 (owner: Dev 1, checkpoint 2).
- Verify the Making Ends Meet medians in the PDF before quoting on slides (owner: Dev 4).

## 23. Source references

- CFPB Making Ends Meet (2022) emergency savings report; Repossession in Auto Finance (Jan 2025); Subprime Auto Loan Outcomes by Lender Type (2021); Ask CFPB en-849 (if you can't make payments) — project CFPB research file (2026-10-24), PDFs: https://files.consumerfinance.gov/f/documents/cfpb_mem_emergency-savings-financial-security_report_2022-3.pdf ; https://files.consumerfinance.gov/f/documents/cfpb_report-repossession-in-auto-finance_2025-01.pdf
- NumPy random generator ◻ https://numpy.org/doc/stable/reference/random/generator.html (triangular distribution)
- Saltelli et al., *Global Sensitivity Analysis: The Primer* (Wiley, 2008) — OAT vs global methods; textbook reference, not re-verified online today.
