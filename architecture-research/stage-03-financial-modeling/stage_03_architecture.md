# Stage 03 — Financial Modeling & Computational Engine

**Agent:** Stage Architecture Agent 3 · **Reviewed by:** Supervisor (Phase C: reviews with Agents 1, 2, 4) · **Contracts:** `supervisor/api_and_data_contracts.md` v1.0
**Research date:** 2026-10-24. All reference figures below were **recomputed today** with Python `decimal` and match the CFPB sources (see §18).

---

## 1. Stage objective

Provide a deterministic, reproducible, LLM-free computation engine that converts verified facts and a verified loan offer into the metrics every other stage relies on: payment, total cost, APR recomputation, amortization, LTV, payment-to-income, DTI, monthly residual, reserve months, and a negative-equity timeline — with per-metric provenance and missing-value propagation.

## 2. Problem decomposition

Normalize inputs → compute loan metrics → compute household cash-flow before/after → compute reserve and ratio metrics → compute value-vs-balance timeline (assumption-flagged) → evaluate configurable flags with citations → return `CalculationResult`.

## 3. Functional requirements

- FR1 Fixed-rate, fully amortizing, monthly-payment loans (MVP).
- FR2 Payment, schedule, total of payments, total interest, total cost of purchase (CFPB worksheet rows K–P).
- FR3 APR recomputation from amount financed, payment and term (actuarial, monthly periods) for Stage 2 checks.
- FR4 Cash-flow residual before/after; reserve months (essentials basis) and savings-months-of-income (CFPB Making Ends Meet basis).
- FR5 LTV, payment-to-take-home, DTI (gross basis; `missing` if gross income unknown).
- FR6 Negative-equity months given a value curve (user-supplied resale value or assumption node).
- FR7 Configurable flags with CFPB citations; never a "safe/unsafe" verdict.
- FR8 Pure functions callable in-process by Stages 1, 2, 4, 5.

## 4. Nonfunctional requirements

Bit-for-bit reproducibility across runs and machines; `< 5 ms` per full evaluation (so Stage 1 sensitivity and Stage 5 grids stay interactive); no network; `calc_version` stamped on every result; 100% unit-test coverage on formulas with external reference vectors.

## 5. Data requirements

Inputs per contracts §3.6/3.7; config `assumptions.yaml` (flag thresholds, default depreciation curve, default flexible-expense share, rounding policy). No external data feeds.

## 6. Research findings

- **Amortization**: standard annuity formula with monthly nominal rate `r = APR_nominal/12` reproduces CFPB's published examples exactly when the payment is rounded to cents and the final payment absorbs rounding (recomputed today: $20,000 @ 4.75% → 36/48/60/72 months = $597.18 / $458.32 / $375.14 / $319.78; totals of interest $1,498.32 / $1,999.60 / $2,508.29 / $3,024.54 — CFPB en-753 publishes $597/$1,498, $458/$1,999, $375/$2,508, $320/$3,024). The CFPB worksheet example ($15,800 @ 3.5%, 48 mo) reproduces as $353.22 / $16,954.80 / $1,154.80 / total cost $22,954.80 (CFPB: $353.22 / $16,955 / $1,155 / $22,955).
- **APR vs contract rate**: APR includes prepaid finance charges (origination etc.); Reg Z computes APR by the actuarial method (Appendix J) and allows ⅛ percentage-point tolerance for regular transactions (§1026.22). A bisection solver on the annuity present value reproduces this for equal monthly payments (recomputed today: 4.75% note rate, 60 months, $500 prepaid charge on $20,000 ⇒ APR 5.796%). ◻ https://www.consumerfinance.gov/rules-policy/regulations/1026/
- **Total cost framing**: CFPB worksheet rows A–P (project file §1) — total cost of purchase = total of payments + down + trade-in; total interest = total of payments − amount financed. Adopted verbatim as formulas F02–F04.
- **Reserve metrics**: CFPB Making Ends Meet (2022) reports savings in **months of income** (24% none; 39% < 1 month; 37% ≥ 1 month) — we expose this basis for comparability (F11) and an essentials basis (F10) for planning.
- **Ratios**: DTI = monthly debt payments ÷ gross monthly income (en-1791); LTV = loan ÷ vehicle value (en-769; rolling in old debt pushes LTV > 100%, "risky for you as well as the lender").
- **Numerics**: Python `decimal` (◻ https://docs.python.org/3/library/decimal.html) gives exact decimal arithmetic with explicit rounding modes; `numpy-financial` (◻ https://numpy.org/numpy-financial/) uses binary floats (cent-level drift over long schedules and non-reproducible display rounding); neither NumPy nor pandas is needed for a per-user calculation of ≤ 96 rows.
- **Precomputed / Rule-of-78 contracts** exist in some states; they are **unsupported** in the MVP and detected by Stage 2.

## 7. Alternatives investigated

| Option | Strengths | Weaknesses |
|---|---|---|
| **A. Python `decimal` pure functions (recommended)** | Exact cents; reproducible; zero deps; matches CFPB vectors | Slightly more verbose code |
| B. float + `numpy-financial` | Familiar; vectorizable | Float drift; rounding ambiguity; extra dependency for one formula |
| C. TypeScript engine in Next.js (`decimal.js`) | Single language with the UI | Splits the engine from Python stages that must call it (Stage 1 sensitivity, Stage 2 checks); duplication risk |
| D. External financial API / spreadsheet engine | None material | Network dependency, opacity, cost |

## 8. Comparative decision matrix

| Criterion (weight) | **A** | B | C | D |
|---|---|---|---|---|
| Correctness & reliability (25%) | 5 | 3 | 4 | 3 |
| Hackathon feasibility (20%) | 5 | 5 | 3 | 2 |
| Integration simplicity (15%) | 4 | 4 | 3 | 2 |
| Functional capability (15%) | 4 | 4 | 4 | 3 |
| Explainability (10%) | 5 | 4 | 4 | 2 |
| Performance & cost (10%) | 5 | 5 | 4 | 2 |
| Extensibility (5%) | 4 | 3 | 3 | 2 |
| **Weighted** | **4.65** | **4.00** | **3.60** | **2.40** |

*Sensitivity:* A leads under any reweighting; C ties only if integration simplicity is scored assuming a TypeScript-only backend, which conflicts with Stages 1–2 (Python SDK, PyMuPDF).

## 9. Recommended architecture

A Python package `engine/` with pure functions and immutable dataclasses: `loan.py` (payment, schedule, apr solver), `cashflow.py` (normalization, residuals), `ratios.py`, `equity.py` (value curve), `flags.py` (config-driven), `result.py` (assembly + provenance propagation). No I/O, no globals except the loaded config object passed explicitly. Exposed to the API layer and imported directly by Stages 1, 2, 4, 5.

## 10. Detailed processing workflow

1. Build `EngineInputs` from the profile and offer; each input carries `status` and optional `uncertainty`.
2. Normalize: all money to monthly `Decimal` cents; rates to `Decimal` fractions; annual costs ÷ 12.
3. Compute loan metrics (F01–F05) if the offer is `ready_for_calculation`; else mark loan metrics `missing`.
4. Compute household metrics (F07–F11) before and after (after = before − new payment − ownership costs).
5. Compute value curve and negative-equity months (F12) if value inputs/assumption exist.
6. Evaluate flags from config; attach citations.
7. Assemble `CalculationResult`; `derived_status` = weakest input status; `inputs_used` lists fact/term ids.

## 11. Algorithms, formulas and conventions

Let `L` = amount financed, `i` = annual nominal rate (contract rate; APR if contract rate unknown — flagged), `r = i/12`, `n` = term months.

| ID | Metric | Formula / rule |
|---|---|---|
| F01 | Monthly payment | `P = round2( L·r / (1 − (1+r)^−n) )`; if `r = 0`: `P = round2(L/n)` |
| F01s | Schedule | for k=1..n: `I_k = round2(B_{k−1}·r)`, `Pr_k = P − I_k`, `B_k = B_{k−1} − Pr_k`; final payment `P_n = B_{n−1} + I_n` (absorbs rounding) |
| F02 | Total of payments | `Σ P_k` (from schedule, not `n·P`) |
| F03 | Total interest | `F02 − L` |
| F04 | Total cost of purchase | `F02 + down + trade_in_value` (CFPB worksheet N) |
| F05 | APR recomputed | solve `A = P · (1 − (1+x/12)^−n)/(x/12)` for `x` by bisection on `[0, 2]`, where `A = L − prepaid finance charges`; 60 iterations (precision ≫ ⅛ pt) |
| F06 | LTV | `L / vehicle_value` (vehicle_value = price for new purchase; user-supplied for used) |
| F07 | Payment-to-take-home | `P / take_home` |
| F07b | DTI (total) | `(existing_debt_payments + P) / gross_income` → `missing` if gross income absent |
| F08 | Residual before | `take_home − essential − flexible − existing_debt_payments` |
| F09 | Residual after | `F08 − P − ownership_costs_monthly` (ownership costs: insurance + fuel + maintenance + registration/12; each `estimated` if user-estimated) |
| F10 | Reserve months (essentials basis) | `savings_liquid / (essential + existing_debt_payments [+ P + ownership_costs])` |
| F11 | Savings months of income (CFPB basis) | `savings_liquid / take_home` |
| F12 | Negative-equity months | smallest `k` after which `B_k ≤ V_k` for all later k, where `V_k` is the value curve: user resale value interpolated, else assumption `V_k = price · (1 − d_1)^{k/12}` with configurable `d_1` (status `assumed`) |

**Conventions:** nominal annual rate with monthly compounding (U.S. consumer installment standard); payment-in-arrears; first payment one month after origination (date-level day counts are out of MVP scope and so noted); `round2` = `ROUND_HALF_UP` to cents; intermediate precision 28 digits (`decimal` default context) and all rounding points explicit (payment, each interest line). Reproducibility: identical inputs + `calc_version` ⇒ identical bytes.

**Missing-value propagation:** a metric with any `missing` required input returns `{value: null, status: missing, missing_inputs: [...]}`; an input with status `estimated`/`assumed` propagates its status to every dependent metric (`derived_status` = weakest). Partial results are first-class so Stage 1 can compute sensitivity before the profile is complete.

**Contradiction detection in the engine:** `apr < contract_rate`, `down > price`, `term ≤ 0`, `negative residual before any loan with savings_months = 0 and stated "stable"` → `warnings[]` (never silent).

**Thresholds (config, cited, not verdicts):** `TERM_GT_60` (CFPB en-753: "some financial experts recommend five years or less; longer loans are more likely to result in owing more than the vehicle is worth"), `LTV_GT_100` (en-769), `RESERVE_LT_1_MONTH` (Making Ends Meet buckets), `PAYMENT_SHARE_GT_x` (configurable; no CFPB universal threshold — labeled as a design assumption), `ADD_ONS_FINANCED` (en-797), `PREPAYMENT_PENALTY` (en-2132), `NEGATIVE_EQUITY_AT_START` (LTV > 100%).

## 12. Data models and schemas

`EngineInputs` (frozen dataclass; fields mirror contracts), `CalculationResult` (contracts §3.7), `Config` (loaded from YAML, validated by Pydantic, exposed via `GET /config/assumptions`). Each formula has a stable `formula_id` used by Stage 6 to render "how this was calculated" text.

## 13. Inputs and outputs

Inputs: facts (`income.take_home_monthly`, `expenses.essential.total`, `expenses.flexible.total?`, `debts[]`, `savings.liquid`, `vehicle.*?`, `income.gross_monthly?`), offer terms (`amount_financed | price+down+trade+fees`, `apr | contract_rate`, `term_months`, `prepaid_finance_charges?`, `add_ons[]`). Outputs: `CalculationResult`.

## 14. API interaction requirements

In-process Python API: `compute(profile: FinancialProfile, offer: LoanOffer | None, config) -> CalculationResult`; `payment(L, i, n)`, `schedule(...)`, `solve_apr(A, P, n)`, `value_curve(...)`. HTTP exposure only through `POST /analysis` (Stage 4/5 results bundled) and `GET /config/assumptions`.

## 15. Integration dependencies

Stage 1 (sensitivity via partial compute), Stage 2 (payment/APR checks), Stage 4 (monthly cash-flow function reused per month), Stage 5 (grid re-evaluation), Stage 6 (formula ids, flags, citations).

## 16. Error and failure handling

Invalid inputs → `ValueError` with structured code (`VALIDATION_ERROR`); unsupported product → `UnsupportedProductError` (`UNSUPPORTED_PRODUCT`); insufficient inputs → partial result with `missing` metrics (never an exception); solver non-convergence (pathological inputs) → `apr_recomputed.status = missing` with warning.

## 17. Security and privacy

No I/O; no logging of input values at INFO level (ids only); config is public (served to the UI) and contains no user data.

## 18. Testing and evaluation (independent reference approach)

- **External vectors** (verified 2026-10-24 by recomputation): CFPB en-753 term table; CFPB worksheet example; APR tolerance test against a hand-computed Reg Z-style example.
- **Property tests:** schedule balance ends at 0.00; `Σ principal = L`; `Σ interest = F03`; monotone relations (longer term ⇒ lower payment, higher total interest; larger down ⇒ lower LTV); r = 0 branch.
- **Golden files:** 10 fixtures with expected JSON (byte-equal) to pin reproducibility; any change requires `calc_version` bump.
- **Cross-check:** spreadsheet `PMT` computed independently by a different developer for 5 cases (documented in the test README).

## 19. Performance and cost estimates

Full evaluation incl. 72-row schedule in Decimal ≈ 0.5–2 ms (estimate; to be measured in the first unit-test run). Stage 5 grid of ~300 alternatives ≈ < 1 s. No infrastructure cost.

## 20. MVP, enhanced, and production scope

- **MVP:** F01–F12, flags, config, partial results, reference tests.
- **Enhanced:** bi-weekly/semimonthly payment frequencies (period count & rate conversion), extra-payment payoff scenarios, odd first-period interest.
- **Production:** Reg Z Appendix J irregular-period APR, state-specific rules (precomputed interest, late-fee caps), lease/balloon support with explicit models, versioned formula registry.

## 21. Architectural decision records

**ADR-S3-01 Numerics** — `decimal` with explicit `ROUND_HALF_UP` at cents; no NumPy/pandas in the core. Confidence: high.
**ADR-S3-02 Rounding/schedule** — round payment once; final payment absorbs residue; totals from schedule. Evidence: reproduces CFPB figures. Confidence: high.
**ADR-S3-03 Scope** — fixed-rate amortizing only; unsupported products blocked, not approximated. Confidence: high.
**ADR-S3-04 Verdict policy** — flags with citations and configurable thresholds; no "safe/unsafe." Confidence: high.
**ADR-S3-05 Partial computation** — missing inputs yield `missing` metrics (not exceptions) so Stage 1 can run sensitivity early (Agent 1↔3 review). Confidence: high.

## 22. Unresolved questions

- Default depreciation assumption `d_1` for F12 when the user gives no resale value (owner: Dev 1; proposal: ask the user or show "ask the dealer / look it up" per Grad-Path pattern rather than invent a curve; if an assumption is used it must be visibly labeled). Decision by checkpoint 1.
- Whether `payment_to_take_home` gets any flag threshold at all (no CFPB universal threshold) — default: none; show the number with context.

## 23. Source references

- CFPB en-753 (term table; total cost of ownership) and Auto Loan Worksheet rows A–P — project CFPB research file (2026-10-24); worksheet PDF https://files.consumerfinance.gov/f/documents/cfpb_auto_loan_worksheet.pdf
- CFPB en-733 (APR vs interest rate), en-787 (TILA disclosure), en-1791 (DTI), en-769 (LTV), en-797 (GAP), en-2132 (negotiable items), Making Ends Meet 2022 (savings buckets) — project file
- Regulation Z ◻ https://www.consumerfinance.gov/rules-policy/regulations/1026/ (§1026.18, §1026.22, Appendix J)
- Python `decimal` ◻ https://docs.python.org/3/library/decimal.html · `numpy-financial` ◻ https://numpy.org/numpy-financial/
