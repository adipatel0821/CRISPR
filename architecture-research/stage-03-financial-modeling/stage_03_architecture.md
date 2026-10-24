# Stage 03 — Financial Modeling & Computational Engine

> **Version 1.1 (post-audit, 2026-10-24).** Revised per `reviews/stage_03_review.md` (verdict REVISE; critical defects corrected). **v1.0 formulas F01, F04, F05, F09 and F10 were wrong for common inputs and are superseded:** payment now on principal, not amount financed (CH-01); APR solved on amount financed without double-subtracting prepaid charges (CH-02); total cost uses trade-in equity with a breakdown (CH-03); savings after the down payment drives reserve (CH-04); replaced-vehicle costs and paid-off debts are netted (CH-05). Also: "total interest" relabeled finance charge vs interest (CH-19), no assumed depreciation curve (CH-17), flags v1.1 (CH-18), and a published `required_inputs` map (CH-20).

**Agent:** Stage Architecture Agent 3 · **Reviewed by:** Supervisor (Phase C: reviews with Agents 1, 2, 4) · **Contracts:** `supervisor/api_and_data_contracts.md` v1.1 (authoritative schemas)
**Research date:** 2026-10-24. All reference figures below were **recomputed today** with Python `decimal` and match the CFPB sources (see §18).

---

## 1. Stage objective

Provide a deterministic, reproducible, LLM-free engine that turns verified facts and a verified loan offer into the metrics every other stage relies on. It is the single authoritative source of financial arithmetic, and it publishes the input requirements Stage 1 uses for readiness.

## 2. Problem decomposition

Normalize inputs → compute loan metrics → compute household cash-flow before/after → compute reserve and ratio metrics → compute value-vs-balance timeline (assumption-flagged) → evaluate configurable flags with citations → return `CalculationResult`.

## 3. Functional requirements

- FR1 Fixed-rate, fully amortizing, monthly-payment loans (MVP).
- FR2 Resolve the principal (F00); payment and schedule on the principal; compare with the disclosed payment.
- FR3 Total of payments, finance charge (TOP − AF), interest (TOP − principal), and total paid through the deal with a breakdown.
- FR4 APR recomputation on amount financed for Stage 2 checks (warn-only tolerance).
- FR5 Transaction effects: savings after purchase, incremental vehicle costs, debts paid off by the transaction.
- FR6 Monthly leftover before/after, reserve months before/after, savings months of income, LTV and negative equity at start, payment-to-take-home, DTI (gross basis; missing if unknown).
- FR7 Equity timeline only from user-supplied value estimates.
- FR8 Flags v1.1 with citations; never a verdict.
- FR9 Publish `required_inputs` (metric → inputs; analysis → metrics) and `month_net(t)` for Stages 1, 4 and 5.

## 4. Nonfunctional requirements

Bit-for-bit reproducibility across runs and machines; `< 5 ms` per full evaluation (so Stage 1 sensitivity and Stage 5 grids stay interactive); no network; `calc_version` stamped on every result; 100% unit-test coverage on formulas with external reference vectors.

## 5. Data requirements

Inputs per contracts §3.6/3.7; config `assumptions.yaml` (flag thresholds, default depreciation curve, default flexible-expense share, rounding policy). No external data feeds.

## 6. Research findings

- **Amortization**: standard annuity formula with monthly nominal rate `r = APR_nominal/12` reproduces CFPB's published examples exactly when the payment is rounded to cents and the final payment absorbs rounding (recomputed today: $20,000 @ 4.75% → 36/48/60/72 months = $597.18 / $458.32 / $375.14 / $319.78; totals of interest $1,498.32 / $1,999.60 / $2,508.29 / $3,024.54 — CFPB en-753 publishes $597/$1,498, $458/$1,999, $375/$2,508, $320/$3,024). The CFPB worksheet example ($15,800 @ 3.5%, 48 mo) reproduces as $353.22 / $16,954.80 / $1,154.80 / total cost $22,954.80 (CFPB: $353.22 / $16,955 / $1,155 / $22,955).
- **APR vs contract rate**: APR includes prepaid finance charges (origination etc.); Reg Z computes APR by the actuarial method (Appendix J) and allows ⅛ percentage-point tolerance for regular transactions (§1026.22). A bisection solver on the annuity present value reproduces this for equal monthly payments (recomputed today: 4.75% note rate, 60 months, $500 prepaid charge on $20,000 ⇒ APR 5.796%). ◻ https://www.consumerfinance.gov/rules-policy/regulations/1026/
- **Total cost framing**: CFPB worksheet rows A–P (project file §1) — total cost of purchase = total of payments + down + trade-in; total interest = total of payments − amount financed. v1.0 adopted this verbatim. **v1.1:** the worksheet framing is kept for the simple case (no payoff, no PFC), but the general formulas follow Reg Z §1026.18(b): trade-in counts at equity, and "total interest" is split into finance charge and interest (see §11).
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

A Python package `engine/` of pure functions and immutable dataclasses: `principal.py` (F00), `loan.py` (payment, schedule, APR solver), `transaction.py` (F13, F14, debts_after), `cashflow.py` (F08, F09, `month_net(t)`), `ratios.py`, `equity.py` (F06/F06d/F12), `flags.py`, `requirements.py` (`required_inputs`), `result.py`. No I/O; config is passed in explicitly.

## 10. Detailed processing workflow

1. Build `EngineInputs` from the profile and offer (status and verification carried per input).
2. **F00** resolve the principal (stated → AF + PFC → AF with `a_pfc_zero`).
3. Loan metrics F01–F05 (if the offer is ready); compare F01 with the disclosed payment.
4. Equity at start F06/F06d; transaction effects F13/F14 and `debts_after`.
5. Household metrics F07–F11 before and after.
6. F12 only with user value estimates.
7. Flags; assemble `CalculationResult` with `derived_status`, `derived_verification` and the `required_inputs` echo.

## 11. Algorithms, formulas and conventions

Notation: `Pn` principal (note amount); `AF` amount financed; `PFC` prepaid finance charges; `i` contract rate (annual nominal; APR is used only if the contract rate is unknown, flagged), `r = i/12`; `n` term; `CD` cash down; `TV` trade value; `TP` trade payoff; `EQ = TV − TP`.

| ID | Metric | Formula / rule |
|---|---|---|
| F00 | Principal | stated principal; else `AF + PFC` (PFC known); else `AF` with assumption `a_pfc_zero` and flag `PFC_ASSUMED_ZERO` |
| F01 | Monthly payment | `round2(Pn·r/(1−(1+r)^−n))`; r = 0 → `round2(Pn/n)`; disclosed vs computed diff > $1.00 → `PAYMENT_MISMATCH` (warn) |
| F01s | Schedule | on `Pn`; `I_k = round2(B_{k−1}·r)`; `Pr_k = P − I_k`; final payment `B_{n−1} + I_n` |
| F02 | Total of payments | `Σ P_k` from the schedule |
| F03 | Finance charge | `TOP − AF` (TILA basis; includes PFC) |
| F03i | Interest | `TOP − Pn` |
| F04 | Total paid through this deal | `TOP + CD + PFC_paid_in_cash + max(EQ, 0)`; breakdown: cash price, taxes/title/fees, add-ons, prior-loan balance rolled in `max(−EQ, 0)`, finance charge |
| F05 | APR recomputed | solve `AF = P·(1−(1+x/12)^−n)/(x/12)` by bisection on [0, 2]; outside ⅛ pt of the disclosed APR → `warn` |
| F06 | Loan-to-value | `Pn / vehicle_value` (cash price for new purchases unless the user gives a value) |
| F06d | Negative equity at start | `max(Pn − vehicle_value, 0)` |
| F07 | Payment ÷ take-home | `P / take_home` (no threshold flag) |
| F07b | DTI | `(Σ debts_after + P) / gross_income`; missing if gross unknown |
| F08 | Monthly left before | `take_home − essential − Σ debts_before − flexible?`; without flexible the label is "before discretionary spending" (no default) |
| F14 | Incremental vehicle costs | `new_ownership_costs − (replaces_current ? current_vehicle_costs : 0)` (may be negative) |
| F09 | Monthly left after | `take_home − essential − Σ debts_after − P − F14 − flexible?` |
| F13 | Savings after purchase | `savings − (CD if source = savings) − (PFC_paid_in_cash if source = savings)` |
| F10b / F10 | Reserve months before / after | `savings / (essential + Σ debts_before)` / `F13 / (essential + Σ debts_after + P + F14)` |
| F11 | Savings months of income | `savings / take_home` and `F13 / take_home` |
| F12 | Equity timeline | only with user value estimates (linear between user points, labeled "your estimate"); else missing. No default depreciation. |

`debts_after` = debts excluding items with `paid_off_by_transaction = true`. `month_net(t, run, transforms)` returns the monthly net used by Stage 4: debts end at their `remaining_months`; the new payment applies only to the `with_offer` run.

**Conventions:** nominal annual rate, monthly compounding; payment in arrears; first period regular (irregular first periods surface as `PAYMENT_MISMATCH`/APR warnings, not errors); `ROUND_HALF_UP` to cents at the payment and at each interest line; 28-digit context; reproducible bytes per `calc_version`.

**Missing values:** a metric with a missing required input returns `{value: null, status: missing, missing_inputs}`. Estimated and assumed inputs propagate. Unknowns are never zero.

**Flags v1.1:** `DEFICIT_BEFORE_LOAN`, `DEFICIT_AFTER_LOAN`, `TERM_GT_60` (CFPB en-753), `NEGATIVE_EQUITY_AT_START` (en-769), `RESERVE_LT_1_MONTH` (informational; CFPB MEM savings groups), `ADD_ONS_FINANCED` (en-797), `PREPAYMENT_PENALTY` (en-2132), `PAYMENT_MISMATCH`, `PFC_ASSUMED_ZERO`. Removed: `PAYMENT_SHARE_GT_x` (no authoritative threshold).

**Reference vectors (verified 2026-10-24 in an isolated script):** CFPB en-753 table and worksheet (PFC = 0) exact. $20,000 note with $500 PFC at 4.75%/60 → payment $375.14, TOP $22,508.29, finance charge $3,008.29, interest $2,508.29, APR 5.796%.

## 12. Data models and schemas

`EngineInputs` (frozen dataclass mirroring contracts v1.1), `CalculationResult` (contracts §3.7), `Config` (YAML, Pydantic; served by `/config/assumptions`), `REQUIRED_INPUTS` (static map, exported). Each formula has a stable `formula_id` that Stage 6 uses for "how this was calculated".

## 13. Inputs and outputs

Inputs: take-home, essentials, flexible?, debt items (payment, remaining months, paid-off flag), savings, down-payment source, replacement flag and current vehicle costs, new vehicle costs, gross income?, value estimates?; offer terms (principal or AF (+PFC), contract rate or APR, term, cash down, trade value/payoff, itemization, disclosed payment and totals). Output: `CalculationResult` v1.1.

## 14. API interaction requirements

In-process Python API: `compute(profile: FinancialProfile, offer: LoanOffer | None, config) -> CalculationResult`; `payment(L, i, n)`, `schedule(...)`, `solve_apr(A, P, n)`, `value_curve(...)`. HTTP exposure only through `POST /analysis` (Stage 4/5 results bundled) and `GET /config/assumptions`.

## 15. Integration dependencies

Stage 1 (`required_inputs` for readiness; refinement-effect display), Stage 2 (F00/F01/F05 checks), Stage 4 (`month_net(t)`, F13 start balance), Stage 5 (re-runs per alternative incl. F13), Stage 6 (formula ids, flags, breakdown, claim values).

## 16. Error and failure handling

Invalid inputs → `VALIDATION_ERROR`; unsupported product → `UNSUPPORTED_PRODUCT`; insufficient inputs → partial result with missing metrics; solver non-convergence → `apr_recomputed` missing plus a warning. A deficit is computed and flagged, never rejected.

## 17. Security and privacy

No I/O; no logging of input values at INFO level (ids only); config is public (served to the UI) and contains no user data.

## 18. Testing and evaluation (independent reference approach)

- External vectors: CFPB en-753 table; CFPB worksheet; the Reg Z principal example ($20,000 note, $500 PFC) — A-07r, A-24.
- Transaction effects: trade-in cases (A-28), savings after purchase (A-29), replacement netting (A-30), no fabricated timeline (A-31), deficit (A-32).
- Property tests: the schedule ends at 0.00; Σ principal = `Pn`; interest = TOP − `Pn`; monotonic term/payment/interest relations.
- Golden files pinned per `calc_version`; independent spreadsheet cross-check for 5 cases.

## 19. Performance and cost estimates

Full evaluation incl. 72-row schedule in Decimal ≈ 0.5–2 ms (estimate; to be measured in the first unit-test run). Stage 5 grid of ~300 alternatives ≈ < 1 s. No infrastructure cost.

## 20. MVP, enhanced, and production scope

- **MVP:** F00–F14, flags v1.1, `required_inputs`, `month_net(t)`, reference tests.
- **Enhanced:** bi-weekly frequencies, extra-payment payoff, odd first period.
- **Production:** Reg Z Appendix J irregular APR, state precomputed-interest rules, cited depreciation data.

## 21. Architectural decision records

**ADR-S3-01 Numerics** — `decimal` with explicit `ROUND_HALF_UP` at cents; no NumPy/pandas in the core. Confidence: high.
**ADR-S3-02 Rounding/schedule** — round payment once; final payment absorbs residue; totals from schedule. Evidence: reproduces CFPB figures. Confidence: high.
**ADR-S3-03 Scope** — fixed-rate amortizing only; unsupported products blocked, not approximated. Confidence: high.
**ADR-S3-04 Verdict policy** — flags with citations and configurable thresholds; no "safe/unsafe." Confidence: high.
**ADR-S3-06 (v1.1) Principal basis and transaction effects** — payment on principal; APR on AF; equity-based total cost; savings after purchase; incremental vehicle costs. Evidence: Reg Z §1026.18(b) (fetched 2026-10-24) and numeric reproduction. Confidence: high. (ADR-018.)
**ADR-S3-07 (v1.1) No assumed depreciation** — equity timeline only from user estimates (closes Q-2). Confidence: high.
**ADR-S3-05 Partial computation** — missing inputs yield `missing` metrics (not exceptions) so Stage 1 can run sensitivity early (Agent 1↔3 review). Confidence: high.

## 22. Unresolved questions

- None blocking. Q-2 closed (no default curve). A `payment_to_take_home` threshold is not used (no authoritative source).

## 23. Source references

- CFPB en-753 (term table; total cost of ownership) and Auto Loan Worksheet rows A–P — project CFPB research file (2026-10-24); worksheet PDF https://files.consumerfinance.gov/f/documents/cfpb_auto_loan_worksheet.pdf
- CFPB en-733 (APR vs interest rate), en-787 (TILA disclosure), en-1791 (DTI), en-769 (LTV), en-797 (GAP), en-2132 (negotiable items), Making Ends Meet 2022 (savings buckets) — project file
- Regulation Z ◻ https://www.consumerfinance.gov/rules-policy/regulations/1026/ (§1026.18, §1026.22, Appendix J)
- Python `decimal` ◻ https://docs.python.org/3/library/decimal.html · `numpy-financial` ◻ https://numpy.org/numpy-financial/
